#!/usr/bin/env python3
"""Morning Briefing 관리 웹 UI"""

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# morning_briefing 모듈을 임포트하기 위해 경로 추가
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

import morning_briefing as mb

KST = ZoneInfo("Asia/Seoul")
WEB_DIR = Path(__file__).parent

app = FastAPI(title="Morning Briefing Admin")
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
templates = Jinja2Templates(directory=WEB_DIR / "templates")


def load_recipients():
    if mb.RECIPIENTS_FILE.exists():
        return json.loads(mb.RECIPIENTS_FILE.read_text())
    return {}


def save_recipients(data):
    mb.RECIPIENTS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def load_send_history():
    if mb.SEND_HISTORY_FILE.exists():
        return json.loads(mb.SEND_HISTORY_FILE.read_text())
    return []


# ── Routes ──────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    recipients = load_recipients()
    history = load_send_history()
    recent = history[-10:][::-1]

    # 오늘 날씨 미리보기 (첫 수신자 위치 기준)
    weather = None
    air = None
    baby = None
    try:
        first = next(iter(recipients.values()), {})
        loc = first.get("location", {})
        if loc.get("lat"):
            weather = mb.get_weather(loc["lat"], loc["lon"])
            air = mb.get_air_quality(loc["lat"], loc["lon"])
    except Exception:
        pass
    try:
        baby = mb.get_baby_info()
    except Exception:
        pass

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "recipients": recipients,
        "recent_history": recent,
        "weather": weather,
        "air": air,
        "baby": baby,
        "now": datetime.now(KST),
    })


@app.get("/recipient/{name}", response_class=HTMLResponse)
async def edit_recipient(request: Request, name: str):
    recipients = load_recipients()
    recipient = recipients.get(name)
    if not recipient:
        return RedirectResponse("/", status_code=302)

    return templates.TemplateResponse("recipient.html", {
        "request": request,
        "name": name,
        "recipient": recipient,
        "all_sections": [
            ("weather", "날씨"),
            ("air_quality", "미세먼지"),
            ("clothing", "옷차림 추천"),
            ("calendar", "캘린더 일정"),
            ("workout", "운동복 알림"),
            ("reminder", "요일 알림"),
            ("baby", "아기 성장"),
            ("news", "뉴스"),
            ("weekly_weather", "주간 날씨"),
        ],
    })


@app.post("/recipient/{name}/update")
async def update_recipient(
    request: Request,
    name: str,
):
    form = await request.form()
    recipients = load_recipients()
    if name not in recipients:
        return RedirectResponse("/", status_code=302)

    r = recipients[name]

    # 섹션 업데이트
    all_sections = ["weather", "air_quality", "clothing", "calendar",
                    "workout", "reminder", "baby", "news", "weekly_weather"]
    for s in all_sections:
        r.setdefault("sections", {})[s] = f"section_{s}" in form

    # 위치
    lat = form.get("lat", "")
    lon = form.get("lon", "")
    loc_name = form.get("loc_name", "")
    if lat and lon:
        r["location"] = {"lat": float(lat), "lon": float(lon), "name": loc_name}

    # 운동 키워드
    keywords = form.get("workout_keywords", "")
    if keywords:
        r["workout_keywords"] = [k.strip() for k in keywords.split(",") if k.strip()]

    save_recipients(recipients)
    return RedirectResponse(f"/recipient/{name}", status_code=302)


@app.get("/recipient/{name}/delete")
async def delete_recipient(name: str):
    recipients = load_recipients()
    if name in recipients:
        del recipients[name]
        save_recipients(recipients)
    return RedirectResponse("/", status_code=302)


@app.post("/recipient/add")
async def add_recipient(
    name: str = Form(...),
    send_method: str = Form("self"),
    lat: float = Form(37.3947),
    lon: float = Form(127.1112),
    loc_name: str = Form("판교"),
):
    recipients = load_recipients()
    if name in recipients:
        return RedirectResponse("/", status_code=302)

    recipients[name] = {
        "send_method": send_method,
        "kakao_uuid": "",
        "sections": {
            "weather": True, "air_quality": True, "clothing": True,
            "calendar": send_method == "self",
            "workout": send_method == "self",
            "reminder": False,
            "baby": True, "news": True, "weekly_weather": True,
        },
        "location": {"lat": lat, "lon": lon, "name": loc_name},
        "workout_keywords": [],
        "weekly_reminders": {},
    }
    save_recipients(recipients)
    return RedirectResponse(f"/recipient/{name}", status_code=302)


@app.get("/preview/{name}", response_class=HTMLResponse)
async def preview_message(request: Request, name: str):
    recipients = load_recipients()
    recipient = recipients.get(name)
    if not recipient:
        return RedirectResponse("/", status_code=302)

    try:
        shared_data = mb.collect_data({name: recipient})
        r_data = mb.get_recipient_data(recipient, shared_data)
        message = mb.build_message(name, recipient, r_data)
    except Exception as e:
        message = f"미리보기 생성 실패: {e}"

    return templates.TemplateResponse("preview.html", {
        "request": request,
        "name": name,
        "message": message,
    })


@app.post("/send/{name}")
async def send_now(name: str):
    recipients = load_recipients()
    recipient = recipients.get(name)
    if not recipient:
        return RedirectResponse("/", status_code=302)

    try:
        shared_data = mb.collect_data({name: recipient})
        r_data = mb.get_recipient_data(recipient, shared_data)
        message = mb.build_message(name, recipient, r_data)

        token_data, access_token = mb.get_access_token()
        mb.send_to_recipient(name, recipient, message, token_data, access_token)
        mb.save_send_history(name, True, message)
    except Exception as e:
        mb.save_send_history(name, False, str(e))

    return RedirectResponse("/", status_code=302)


@app.get("/history", response_class=HTMLResponse)
async def history(request: Request):
    all_history = load_send_history()[::-1]
    return templates.TemplateResponse("history.html", {
        "request": request,
        "history": all_history,
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)
