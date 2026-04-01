#!/usr/bin/env python3
"""Morning Briefing - 매일 아침 일정, 날씨, 운동복 알림을 카카오톡으로 전송"""

import json
import logging
import os
import socket
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

GOOGLE_TOKEN_FILE = BASE_DIR / "credentials" / "google_token.json"
KAKAO_TOKEN_FILE = BASE_DIR / "credentials" / "kakao_token.json"
RECIPIENTS_FILE = BASE_DIR / "recipients.json"
BABY_MILESTONES_FILE = BASE_DIR / "baby_milestones.json"
SEND_HISTORY_FILE = BASE_DIR / "send_history.json"

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")

KST = ZoneInfo("Asia/Seoul")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
BABY_BIRTHDAY = date(2025, 4, 29)

LOG_FILE = BASE_DIR / "morning_briefing.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
log = logging.getLogger(__name__)


# ── Recipients ─────────────────────────────────────────────────

def load_recipients():
    if not RECIPIENTS_FILE.exists():
        log.error("recipients.json 없음")
        sys.exit(1)
    return json.loads(RECIPIENTS_FILE.read_text())


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


def check_workout(events, keywords):
    for event in events:
        summary = event.get("summary", "").lower()
        if any(kw.lower() in summary for kw in keywords):
            start_dt = event.get("start", {}).get("dateTime", "")
            return True, event.get("summary", ""), start_dt
    return False, None, None


# ── Weather ──────────────────────────────────────────────────────

def get_weather(lat, lon):
    resp = requests.get(
        "https://api.openweathermap.org/data/2.5/forecast",
        params={
            "lat": lat, "lon": lon,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric", "lang": "kr", "cnt": 8,
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


def get_weekly_weather(lat, lon):
    """5-day forecast에서 일별 요약 추출 (월요일 한정)"""
    resp = requests.get(
        "https://api.openweathermap.org/data/2.5/forecast",
        params={
            "lat": lat, "lon": lon,
            "appid": OPENWEATHER_API_KEY,
            "units": "metric", "lang": "kr", "cnt": 40,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    daily = {}
    for item in data["list"]:
        dt = datetime.fromtimestamp(item["dt"], tz=KST)
        day_key = dt.strftime("%m/%d")
        weekday = ["월", "화", "수", "목", "금", "토", "일"][dt.weekday()]
        if day_key not in daily:
            daily[day_key] = {
                "weekday": weekday,
                "temps": [], "descs": [], "rain": False,
            }
        daily[day_key]["temps"].append(item["main"]["temp"])
        daily[day_key]["descs"].append(item["weather"][0]["description"])
        if item["weather"][0]["main"] in ("Rain", "Drizzle", "Thunderstorm"):
            daily[day_key]["rain"] = True

    result = []
    for day_key, info in list(daily.items())[:5]:
        result.append({
            "date": day_key,
            "weekday": info["weekday"],
            "temp_min": min(info["temps"]),
            "temp_max": max(info["temps"]),
            "desc": max(set(info["descs"]), key=info["descs"].count),
            "rain": info["rain"],
        })
    return result


def get_air_quality(lat, lon):
    resp = requests.get(
        "https://api.openweathermap.org/data/2.5/air_pollution",
        params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY},
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
        "pm25": pm25, "pm25_grade": grade(pm25, [15, 35, 75]),
        "pm10": pm10, "pm10_grade": grade(pm10, [30, 80, 150]),
    }


def get_clothing_recommendation(temp):
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


# ── Baby ────────────────────────────────────────────────────────

def load_baby_milestones():
    if BABY_MILESTONES_FILE.exists():
        return json.loads(BABY_MILESTONES_FILE.read_text())
    return {}


def get_baby_info():
    today = date.today()
    age_days = (today - BABY_BIRTHDAY).days
    if age_days < 0:
        return None

    months = 0
    temp = BABY_BIRTHDAY
    while True:
        next_month = temp.month % 12 + 1
        next_year = temp.year + (1 if temp.month == 12 else 0)
        try:
            next_date = temp.replace(year=next_year, month=next_month)
        except ValueError:
            next_date = temp.replace(year=next_year, month=next_month + 1, day=1) - timedelta(days=1)
        if next_date > today:
            break
        months += 1
        temp = next_date

    days_in_month = (today - temp).days

    first_birthday = BABY_BIRTHDAY.replace(year=BABY_BIRTHDAY.year + 1)
    d_day = (first_birthday - today).days

    milestones = load_baby_milestones()
    milestone_text = milestones.get(str(months), {}).get("summary", "")

    special_message = None
    if d_day == 0:
        special_message = "오늘은 첫 번째 생일이에요! 축하합니다!"
    elif d_day == 1:
        special_message = "내일이 첫 번째 생일이에요!"
    elif d_day == 3:
        special_message = "돌까지 3일 남았어요!"
    elif d_day == 10:
        special_message = "돌까지 10일 남았어요!"
    elif days_in_month == 0 and months > 0:
        special_message = f"오늘로 생후 {months}개월이 되었어요!"

    return {
        "months": months,
        "days": days_in_month,
        "total_days": age_days,
        "d_day": d_day,
        "milestone": milestone_text,
        "special": special_message,
    }


# ── News ────────────────────────────────────────────────────────

def get_news_headlines(count=5):
    resp = requests.get(
        "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
        timeout=10,
    )
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    items = root.findall(".//item")

    headlines = []
    for item in items[:count]:
        title = item.find("title").text
        # Google News RSS 제목에서 ' - 출처' 제거
        if " - " in title:
            title = title.rsplit(" - ", 1)[0]
        headlines.append(title)
    return headlines


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


def get_access_token():
    """카카오 access_token을 가져오고, 만료 시 갱신"""
    token_data = load_kakao_token()
    return token_data, token_data["access_token"]


def send_kakao_self(message, token_data, access_token):
    """나에게 보내기"""
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


def send_kakao_friend(message, kakao_uuid, token_data, access_token):
    """친구에게 보내기"""
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
            "https://kapi.kakao.com/v1/api/talk/friends/message/default/send",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "receiver_uuids": json.dumps([kakao_uuid]),
                "template_object": template,
            },
            timeout=10,
        )

    resp = _send(access_token)
    if resp.status_code == 401:
        log.info("카카오 토큰 만료 → 갱신 중")
        access_token = refresh_kakao_token(token_data)
        resp = _send(access_token)

    resp.raise_for_status()
    return resp.json()


def send_to_recipient(name, recipient, message, token_data, access_token):
    """수신자에게 메시지 전송"""
    method = recipient.get("send_method", "self")
    if method == "self":
        return send_kakao_self(message, token_data, access_token)
    elif method == "friend":
        uuid = recipient.get("kakao_uuid", "")
        if not uuid:
            log.warning("[%s] kakao_uuid 미설정 — 전송 스킵", name)
            return None
        return send_kakao_friend(message, uuid, token_data, access_token)
    else:
        log.warning("[%s] 알 수 없는 send_method: %s", name, method)
        return None


def get_refresh_token_remaining_days():
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


# ── Send History ─────────────────────────────────────────────────

def save_send_history(name, success, message=""):
    history = []
    if SEND_HISTORY_FILE.exists():
        history = json.loads(SEND_HISTORY_FILE.read_text())

    history.append({
        "timestamp": datetime.now(KST).isoformat(),
        "recipient": name,
        "success": success,
        "message_preview": message[:100] if message else "",
    })

    # 최근 100건만 유지
    history = history[-100:]
    SEND_HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False))


# ── Message Builder ──────────────────────────────────────────────

def fmt_time(dt_str):
    if not dt_str:
        return ""
    return datetime.fromisoformat(dt_str).strftime("%H:%M")


def build_message(name, recipient, data):
    """수신자 설정에 따라 메시지를 조립"""
    now = datetime.now(KST)
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"][now.weekday()]
    header = f"{now.strftime('%m/%d')} ({weekday_kr}) 모닝 브리핑"
    sections = recipient.get("sections", {})
    loc_name = recipient.get("location", {}).get("name", "")

    lines = [header, ""]

    # 요일 알림
    if sections.get("reminder"):
        reminders_map = recipient.get("weekly_reminders", {})
        reminders = reminders_map.get(str(now.weekday()), [])
        if reminders:
            for r in reminders:
                lines.append(f"[알림] {r}")
            lines.append("")

    # 아기 성장
    if sections.get("baby") and data.get("baby"):
        b = data["baby"]
        lines.append(f"[아기 성장] 생후 {b['months']}개월 {b['days']}일째")
        if b.get("special"):
            lines.append(f"  {b['special']}")
        if b.get("milestone"):
            lines.append(f"  이 시기: {b['milestone']}")
        if b["d_day"] > 0:
            lines.append(f"  돌까지 D-{b['d_day']}")
        lines.append("")

    # 운동복
    if sections.get("workout") and data.get("events") is not None:
        keywords = recipient.get("workout_keywords", [])
        workout_info = check_workout(data["events"], keywords) if keywords else (False, None, None)
        has_workout, w_name, w_time = workout_info
        if has_workout:
            lines.append(f"[운동복 챙겨!] {w_name} ({fmt_time(w_time)})")
        else:
            lines.append("[오늘은 운동 없음]")
        lines.append("")

    # 날씨
    if sections.get("weather") and data.get("weather"):
        w = data["weather"]
        lines.append(f"[{loc_name} 날씨] {w['desc']}")
        lines.append(f"  현재 {w['temp']:.0f}도 (체감 {w['feels_like']:.0f}도)")
        lines.append(f"  최저 {w['temp_min']:.0f}도 / 최고 {w['temp_max']:.0f}도")
        lines.append(f"  습도 {w['humidity']}%")
        if w["rain"]:
            lines.append("  비 예보 있음! 우산 챙기세요")
        lines.append("")

    # 옷차림
    if sections.get("clothing") and data.get("weather"):
        clothing = get_clothing_recommendation(data["weather"]["temp"])
        lines.append(f"[옷차림 추천] {clothing}")
        lines.append("")

    # 미세먼지
    if sections.get("air_quality") and data.get("air_quality"):
        aq = data["air_quality"]
        mask = " → 마스크 챙기세요!" if aq["pm25_grade"] in ("나쁨", "매우나쁨") or aq["pm10_grade"] in ("나쁨", "매우나쁨") else ""
        lines.append(f"[미세먼지] PM2.5 {aq['pm25']:.0f} ({aq['pm25_grade']}) / PM10 {aq['pm10']:.0f} ({aq['pm10_grade']}){mask}")
        lines.append("")

    # 주간 날씨 (월요일만)
    if sections.get("weekly_weather") and now.weekday() == 0 and data.get("weekly_weather"):
        lines.append("[이번 주 날씨]")
        for day in data["weekly_weather"]:
            rain_mark = " 🌧" if day["rain"] else ""
            lines.append(f"  {day['date']}({day['weekday']}) {day['temp_min']:.0f}~{day['temp_max']:.0f}도 {day['desc']}{rain_mark}")
        lines.append("")

    # 뉴스
    if sections.get("news") and data.get("news"):
        lines.append("[오늘의 뉴스]")
        for i, headline in enumerate(data["news"], 1):
            lines.append(f"  {i}. {headline}")
        lines.append("")

    # 일정
    if sections.get("calendar"):
        events = data.get("events")
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

    return "\n".join(lines).rstrip()


# ── Network ─────────────────────────────────────────────────────

def wait_for_network(max_wait=120, interval=5):
    for i in range(max_wait // interval):
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3).close()
            return True
        except OSError:
            log.info("네트워크 대기 중... (%d초)", (i + 1) * interval)
            time.sleep(interval)
    return False


# ── Main ─────────────────────────────────────────────────────────

def collect_data(recipients):
    """모든 수신자에게 필요한 데이터를 위치별로 수집"""
    now = datetime.now(KST)
    data = {}

    # 캘린더 (공통)
    events = None
    try:
        service = get_google_calendar_service()
        events = get_today_events(service)
    except Exception as e:
        log.error("캘린더 조회 실패: %s", e)
    data["events"] = events

    # 위치별 날씨/미세먼지 캐시
    weather_cache = {}
    air_cache = {}
    weekly_cache = {}

    for name, r in recipients.items():
        loc = r.get("location", {})
        loc_key = f"{loc.get('lat')},{loc.get('lon')}"

        if loc_key not in weather_cache:
            try:
                weather_cache[loc_key] = get_weather(loc["lat"], loc["lon"])
            except Exception as e:
                log.error("[%s] 날씨 조회 실패: %s", name, e)
                weather_cache[loc_key] = None

        if loc_key not in air_cache:
            try:
                air_cache[loc_key] = get_air_quality(loc["lat"], loc["lon"])
            except Exception as e:
                log.error("[%s] 미세먼지 조회 실패: %s", name, e)
                air_cache[loc_key] = None

        if now.weekday() == 0 and loc_key not in weekly_cache:
            try:
                weekly_cache[loc_key] = get_weekly_weather(loc["lat"], loc["lon"])
            except Exception as e:
                log.error("[%s] 주간 날씨 조회 실패: %s", name, e)
                weekly_cache[loc_key] = None

    data["weather_cache"] = weather_cache
    data["air_cache"] = air_cache
    data["weekly_cache"] = weekly_cache

    # 아기 성장
    try:
        data["baby"] = get_baby_info()
    except Exception as e:
        log.error("아기 정보 실패: %s", e)
        data["baby"] = None

    # 뉴스
    try:
        data["news"] = get_news_headlines()
    except Exception as e:
        log.error("뉴스 조회 실패: %s", e)
        data["news"] = None

    return data


def get_recipient_data(recipient, shared_data):
    """수신자별 데이터를 공유 데이터에서 추출"""
    loc = recipient.get("location", {})
    loc_key = f"{loc.get('lat')},{loc.get('lon')}"

    return {
        "events": shared_data["events"],
        "weather": shared_data["weather_cache"].get(loc_key),
        "air_quality": shared_data["air_cache"].get(loc_key),
        "weekly_weather": shared_data["weekly_cache"].get(loc_key),
        "baby": shared_data.get("baby"),
        "news": shared_data.get("news"),
    }


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

    recipients = load_recipients()
    shared_data = collect_data(recipients)

    token_data, access_token = get_access_token()

    remaining_days = get_refresh_token_remaining_days()
    token_warning = ""
    if remaining_days is not None and remaining_days <= 7:
        token_warning = f"\n\n[경고] 카카오 refresh_token 만료 {remaining_days}일 전! `python auth_setup.py kakao` 재인증 필요"
        log.warning("카카오 refresh_token %d일 후 만료", remaining_days)

    for name, recipient in recipients.items():
        try:
            r_data = get_recipient_data(recipient, shared_data)
            message = build_message(name, recipient, r_data)

            if name == "나" and token_warning:
                message += token_warning

            log.info("[%s] 메시지 생성:\n%s", name, message)

            result = send_to_recipient(name, recipient, message, token_data, access_token)
            if result is not None:
                log.info("[%s] 카카오톡 전송 완료!", name)
                save_send_history(name, True, message)
            else:
                save_send_history(name, False, "전송 스킵")

        except Exception as e:
            log.error("[%s] 전송 실패: %s", name, e)
            save_send_history(name, False, str(e))

    log.info("Morning Briefing 완료")


if __name__ == "__main__":
    main()
