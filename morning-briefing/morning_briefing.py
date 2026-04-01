#!/usr/bin/env python3
"""Morning Briefing - 매일 아침 일정, 날씨, 운동복 알림을 카카오톡으로 전송"""

import json
import logging
import socket
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

import os

GOOGLE_TOKEN_FILE = BASE_DIR / "credentials" / "google_token.json"
KAKAO_TOKEN_FILE = BASE_DIR / "credentials" / "kakao_token.json"
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")

PANGYO_LAT = 37.3947
PANGYO_LON = 127.1112
KST = ZoneInfo("Asia/Seoul")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# 요일별 알림 (0=월, 1=화, ..., 6=일)
WEEKLY_REMINDERS = {
    3: ["아기 선생님 주차등록"],  # 목요일
}

WORKOUT_KEYWORDS = [
    "운동", "헬스", "gym", "workout", "fitness", "수영", "러닝", "달리기",
    "크로스핏", "필라테스", "필테", "뤼트", "광교", "요가", "yoga",
    "climbing", "클라이밍", "풋살", "테니스", "배드민턴", "골프", "등산",
    "조깅", "PT", "웨이트",
]

LOG_FILE = BASE_DIR / "morning_briefing.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
log = logging.getLogger(__name__)


# ── Google Calendar ──────────────────────────────────────────────

def get_google_calendar_service():
    if not GOOGLE_TOKEN_FILE.exists():
        raise FileNotFoundError("Google token 없음. `python auth_setup.py google` 실행 필요")

    creds = Credentials.from_authorized_user_file(str(GOOGLE_TOKEN_FILE), GOOGLE_SCOPES)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        GOOGLE_TOKEN_FILE.write_text(creds.to_json())

    return build("calendar", "v3", credentials=creds)


def get_today_events(service):
    today = datetime.now(KST)
    start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    events = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=start.isoformat(),
            timeMax=end.isoformat(),
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    return events.get("items", [])


def check_workout(events):
    for event in events:
        summary = event.get("summary", "").lower()
        if any(kw.lower() in summary for kw in WORKOUT_KEYWORDS):
            start_dt = event.get("start", {}).get("dateTime", "")
            return True, event.get("summary", ""), start_dt
    return False, None, None


# ── Weather ──────────────────────────────────────────────────────

def get_weather():
    resp = requests.get(
        "https://api.openweathermap.org/data/2.5/forecast",
        params={
            "lat": PANGYO_LAT,
            "lon": PANGYO_LON,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric",
            "lang": "kr",
            "cnt": 8,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    current = data["list"][0]
    temps = [item["main"]["temp"] for item in data["list"]]
    rain = any(
        item["weather"][0]["main"] in ("Rain", "Drizzle", "Thunderstorm")
        for item in data["list"]
    )

    return {
        "temp": current["main"]["temp"],
        "feels_like": current["main"]["feels_like"],
        "desc": current["weather"][0]["description"],
        "humidity": current["main"]["humidity"],
        "temp_min": min(temps),
        "temp_max": max(temps),
        "rain": rain,
    }


def get_air_quality():
    """OpenWeatherMap Air Pollution API로 미세먼지 정보 조회"""
    resp = requests.get(
        "https://api.openweathermap.org/data/2.5/air_pollution",
        params={
            "lat": PANGYO_LAT,
            "lon": PANGYO_LON,
            "appid": OPENWEATHER_API_KEY,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    components = data["list"][0]["components"]
    pm25 = components.get("pm2_5", 0)
    pm10 = components.get("pm10", 0)

    def grade(val, thresholds):
        if val <= thresholds[0]:
            return "좋음"
        elif val <= thresholds[1]:
            return "보통"
        elif val <= thresholds[2]:
            return "나쁨"
        return "매우나쁨"

    return {
        "pm25": pm25,
        "pm25_grade": grade(pm25, [15, 35, 75]),
        "pm10": pm10,
        "pm10_grade": grade(pm10, [30, 80, 150]),
    }


def get_clothing_recommendation(temp):
    """기온별 옷차림 추천 (실제 기온 기준)"""
    if temp >= 28:
        return "민소매, 반팔, 반바지"
    elif temp >= 23:
        return "반팔, 얇은 셔츠"
    elif temp >= 20:
        return "긴팔, 얇은 가디건"
    elif temp >= 17:
        return "니트, 맨투맨, 가디건"
    elif temp >= 12:
        return "자켓, 가디건, 야상"
    elif temp >= 9:
        return "자켓, 코트"
    elif temp >= 5:
        return "코트, 두꺼운 점퍼"
    elif temp >= 0:
        return "패딩, 두꺼운 코트"
    else:
        return "방한용품 필수, 패딩"


# ── KakaoTalk ────────────────────────────────────────────────────

def load_kakao_token():
    if not KAKAO_TOKEN_FILE.exists():
        log.error("카카오 토큰 없음. `python auth_setup.py kakao` 실행 필요")
        sys.exit(1)
    return json.loads(KAKAO_TOKEN_FILE.read_text())


def refresh_kakao_token(token_data):
    resp = requests.post(
        "https://kauth.kakao.com/oauth/token",
        data={
            "grant_type": "refresh_token",
            "client_id": KAKAO_REST_API_KEY,
            "client_secret": KAKAO_CLIENT_SECRET,
            "refresh_token": token_data["refresh_token"],
        },
        timeout=10,
    )
    resp.raise_for_status()
    new = resp.json()

    token_data["access_token"] = new["access_token"]
    if "refresh_token" in new:
        token_data["refresh_token"] = new["refresh_token"]
        token_data["refresh_token_expires_in"] = new.get("refresh_token_expires_in", 5183999)
        token_data["token_obtained_at"] = datetime.now(KST).isoformat()

    KAKAO_TOKEN_FILE.write_text(json.dumps(token_data, indent=2))
    return token_data["access_token"]


def get_refresh_token_remaining_days():
    """refresh_token 만료까지 남은 일수 반환. 계산 불가 시 None."""
    try:
        token_data = load_kakao_token()
        obtained_at_str = token_data.get("token_obtained_at")
        expires_in = token_data.get("refresh_token_expires_in")
        if not obtained_at_str or not expires_in:
            return None
        obtained_at = datetime.fromisoformat(obtained_at_str)
        if obtained_at.tzinfo is None:
            obtained_at = obtained_at.replace(tzinfo=KST)
        expiry = obtained_at + timedelta(seconds=expires_in)
        return (expiry - datetime.now(KST)).days
    except Exception:
        return None


def send_kakao(message):
    token_data = load_kakao_token()
    access_token = token_data["access_token"]

    template = json.dumps({
        "object_type": "text",
        "text": message,
        "link": {
            "web_url": "https://calendar.google.com",
            "mobile_web_url": "https://calendar.google.com",
        },
    })

    def _send(token):
        return requests.post(
            "https://kapi.kakao.com/v2/api/talk/memo/default/send",
            headers={"Authorization": f"Bearer {token}"},
            data={"template_object": template},
            timeout=10,
        )

    resp = _send(access_token)
    if resp.status_code == 401:
        log.info("카카오 토큰 만료 → 갱신 중")
        access_token = refresh_kakao_token(token_data)
        resp = _send(access_token)

    resp.raise_for_status()
    return resp.json()


# ── Message Builder ──────────────────────────────────────────────

def fmt_time(dt_str):
    if not dt_str:
        return ""
    return datetime.fromisoformat(dt_str).strftime("%H:%M")


def build_message(events, workout_info, weather, air_quality=None):
    now = datetime.now(KST)
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"][now.weekday()]
    header = f"{now.strftime('%m/%d')} ({weekday_kr}) 모닝 브리핑"

    lines = [header, ""]

    # 요일 알림
    reminders = WEEKLY_REMINDERS.get(now.weekday(), [])
    if reminders:
        for r in reminders:
            lines.append(f"[알림] {r}")
        lines.append("")

    # 운동복
    has_workout, name, time = workout_info
    if has_workout:
        lines.append(f"[운동복 챙겨!] {name} ({fmt_time(time)})")
    else:
        lines.append("[오늘은 운동 없음]")
    lines.append("")

    # 날씨
    if weather:
        w = weather
        lines.append(f"[판교 날씨] {w['desc']}")
        lines.append(f"  현재 {w['temp']:.0f}도 (체감 {w['feels_like']:.0f}도)")
        lines.append(f"  최저 {w['temp_min']:.0f}도 / 최고 {w['temp_max']:.0f}도")
        lines.append(f"  습도 {w['humidity']}%")
        if w["rain"]:
            lines.append("  비 예보 있음! 우산 챙기세요")
        lines.append("")
        clothing = get_clothing_recommendation(w["temp"])
        lines.append(f"[옷차림 추천] {clothing}")
    else:
        lines.append("[날씨 정보를 가져오지 못했습니다]")
    lines.append("")

    # 미세먼지
    if air_quality:
        aq = air_quality
        mask = " → 마스크 챙기세요!" if aq["pm25_grade"] in ("나쁨", "매우나쁨") or aq["pm10_grade"] in ("나쁨", "매우나쁨") else ""
        lines.append(f"[미세먼지] PM2.5 {aq['pm25']:.0f} ({aq['pm25_grade']}) / PM10 {aq['pm10']:.0f} ({aq['pm10_grade']}){mask}")
        lines.append("")

    # 일정
    if events is None:
        lines.append("[캘린더 정보를 가져오지 못했습니다]")
    elif events:
        lines.append(f"[오늘 일정] {len(events)}건")
        for ev in events:
            start = ev.get("start", {})
            t = fmt_time(start.get("dateTime", ""))
            s = ev.get("summary", "(제목 없음)")
            lines.append(f"  {t + ' ' if t else '종일 '}{s}")
    else:
        lines.append("[오늘 일정 없음]")

    return "\n".join(lines)


# ── Network ─────────────────────────────────────────────────────

def wait_for_network(max_wait=120, interval=5):
    """네트워크 연결을 기다린다. 잠자기에서 깨어난 직후 Wi-Fi 복구 대기용."""
    for i in range(max_wait // interval):
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3).close()
            return True
        except OSError:
            log.info("네트워크 대기 중... (%d초)", (i + 1) * interval)
            time.sleep(interval)
    return False


# ── Main ─────────────────────────────────────────────────────────

def main():
    now = datetime.now(KST)
    is_weekend = now.weekday() >= 5

    if "--weekday-only" in sys.argv and is_weekend:
        log.info("주말이라 스킵 (weekday-only)")
        return
    if "--weekend-only" in sys.argv and not is_weekend:
        log.info("평일이라 스킵 (weekend-only)")
        return

    if not wait_for_network():
        log.error("네트워크 연결 실패 - 종료")
        sys.exit(1)

    log.info("Morning Briefing 시작")

    events = None
    workout_info = (False, None, None)
    try:
        service = get_google_calendar_service()
        events = get_today_events(service)
        workout_info = check_workout(events)
    except Exception as e:
        log.error("캘린더 조회 실패: %s", e)

    weather = None
    try:
        weather = get_weather()
    except Exception as e:
        log.error("날씨 조회 실패: %s", e)

    air_quality = None
    try:
        air_quality = get_air_quality()
    except Exception as e:
        log.error("미세먼지 조회 실패: %s", e)

    if events is None and weather is None:
        log.error("캘린더, 날씨 모두 실패 - 전송 포기")
        sys.exit(1)

    message = build_message(events, workout_info, weather, air_quality)

    remaining_days = get_refresh_token_remaining_days()
    if remaining_days is not None and remaining_days <= 7:
        message += f"\n\n[경고] 카카오 refresh_token 만료 {remaining_days}일 전! `python auth_setup.py kakao` 재인증 필요"
        log.warning("카카오 refresh_token %d일 후 만료", remaining_days)

    log.info("메시지 생성 완료:\n%s", message)

    try:
        send_kakao(message)
        log.info("카카오톡 전송 완료!")
    except Exception as e:
        log.error("카카오톡 전송 실패: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
