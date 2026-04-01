#!/usr/bin/env python3
"""Google Calendar & KakaoTalk OAuth 초기 설정"""

import json
import os
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

GOOGLE_CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_credentials.json"
GOOGLE_TOKEN_FILE = BASE_DIR / "credentials" / "google_token.json"
KAKAO_TOKEN_FILE = BASE_DIR / "credentials" / "kakao_token.json"
KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")
KAKAO_REDIRECT_URI = "http://localhost:9876/callback"

GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def setup_google():
    """Google Calendar OAuth2 설정"""
    if not GOOGLE_CREDENTIALS_FILE.exists():
        print(
            "❌ Google OAuth credentials 파일이 필요합니다.\n"
            "\n"
            "1. https://console.cloud.google.com 접속\n"
            "2. 프로젝트 생성 (또는 기존 프로젝트 선택)\n"
            "3. 'Google Calendar API' 사용 설정\n"
            "4. 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기 (데스크톱 앱)\n"
            "5. JSON 다운로드 → 아래 경로에 저장:\n"
            f"   {GOOGLE_CREDENTIALS_FILE}\n"
        )
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(
        str(GOOGLE_CREDENTIALS_FILE), GOOGLE_SCOPES
    )
    creds = flow.run_local_server(port=0)
    GOOGLE_TOKEN_FILE.write_text(creds.to_json())
    print("✅ Google Calendar 인증 완료! 토큰 저장됨")


def setup_kakao():
    """KakaoTalk OAuth2 설정"""
    if not KAKAO_REST_API_KEY:
        print(
            "❌ KAKAO_REST_API_KEY가 .env에 없습니다.\n"
            "\n"
            "1. https://developers.kakao.com 접속\n"
            "2. 앱 만들기\n"
            "3. 앱 설정 → 플랫폼 → Web에 http://localhost:9876 추가\n"
            "4. 카카오 로그인 → 활성화\n"
            "5. 동의항목 → '카카오톡 메시지 전송' 선택 (talk_message)\n"
            "6. 앱 키 → REST API 키를 .env에 추가:\n"
            "   KAKAO_REST_API_KEY=your_key_here\n"
            f"7. Redirect URI에 {KAKAO_REDIRECT_URI} 추가\n"
        )
        sys.exit(1)

    auth_code = None

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            nonlocal auth_code
            qs = parse_qs(urlparse(self.path).query)
            auth_code = qs.get("code", [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("✅ 인증 완료! 이 창을 닫아도 됩니다.".encode())

        def log_message(self, *args):
            pass

    auth_url = (
        f"https://kauth.kakao.com/oauth/authorize"
        f"?client_id={KAKAO_REST_API_KEY}"
        f"&redirect_uri={KAKAO_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=talk_message"
    )

    print(f"브라우저에서 카카오 로그인 페이지를 엽니다...")
    webbrowser.open(auth_url)

    server = HTTPServer(("localhost", 9876), CallbackHandler)
    server.handle_request()

    if not auth_code:
        print("❌ 인증 코드를 받지 못했습니다.")
        sys.exit(1)

    # Exchange code for tokens
    resp = requests.post(
        "https://kauth.kakao.com/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": KAKAO_REST_API_KEY,
            "client_secret": KAKAO_CLIENT_SECRET,
            "redirect_uri": KAKAO_REDIRECT_URI,
            "code": auth_code,
        },
    )
    resp.raise_for_status()
    token_data = resp.json()

    KAKAO_TOKEN_FILE.write_text(json.dumps(token_data, indent=2))
    print("✅ 카카오톡 인증 완료! 토큰 저장됨")
    print(f"   access_token 만료: ~6시간")
    print(f"   refresh_token 만료: ~2개월 (자동 갱신됨)")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("google", "kakao"):
        print("사용법:")
        print("  python auth_setup.py google   # Google Calendar 인증")
        print("  python auth_setup.py kakao    # KakaoTalk 인증")
        sys.exit(1)

    (BASE_DIR / "credentials").mkdir(exist_ok=True)

    if sys.argv[1] == "google":
        setup_google()
    elif sys.argv[1] == "kakao":
        setup_kakao()
