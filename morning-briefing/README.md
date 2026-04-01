# Morning Briefing

매일 아침 Google Calendar 일정, 판교 날씨, 운동복 알림을 카카오톡으로 전송하는 스크립트.

## 기능

- **오늘 일정** — Google Calendar에서 당일 일정 조회
- **운동복 알림** — 캘린더에 운동 관련 일정이 있으면 알림
- **판교 날씨** — 현재 기온, 체감온도, 최저/최고, 습도, 비 예보
- **옷차림 추천** — 체감온도 기준 8단계 옷차림 제안
- **부분 실패 처리** — 캘린더 또는 날씨 API 실패 시 나머지 정보만 전송
- **토큰 만료 경고** — 카카오 refresh_token 만료 7일 전부터 경고

## 메시지 예시

```
04/01 (수) 모닝 브리핑

[운동복 챙겨!] 필라테스 (18:00)

[판교 날씨] 튼구름
  현재 11도 (체감 9도)
  최저 8도 / 최고 16도
  습도 31%

[옷차림 추천] 코트, 점퍼

[오늘 일정] 2건
  10:00 인프라 개발 스터디
  14:00 [WAG] 배포 스크럼
```

## 설치

```bash
bash install.sh
```

## 사전 준비

### 1. OpenWeatherMap API Key

1. https://openweathermap.org/api 에서 API 키 발급
2. `.env`에 `OPENWEATHER_API_KEY` 입력

### 2. Google Calendar

1. https://console.cloud.google.com 에서 프로젝트 생성
2. Google Calendar API 사용 설정
3. OAuth 2.0 클라이언트 ID 만들기 (데스크톱 앱)
4. JSON 다운로드 → `credentials/google_credentials.json`에 저장
5. 인증 실행:
   ```bash
   .venv/bin/python auth_setup.py google
   ```

### 3. KakaoTalk

1. https://developers.kakao.com 에서 앱 생성
2. 플랫폼 → Web에 `http://localhost:9876` 추가
3. 카카오 로그인 활성화 + Redirect URI에 `http://localhost:9876/callback` 추가
4. 동의항목 → `카카오톡 메시지 전송(talk_message)` 선택
5. `.env`에 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` 입력
6. 인증 실행:
   ```bash
   .venv/bin/python auth_setup.py kakao
   ```

## 실행

```bash
# 수동 실행
.venv/bin/python morning_briefing.py

# 평일만
.venv/bin/python morning_briefing.py --weekday-only

# 주말만
.venv/bin/python morning_briefing.py --weekend-only
```

## 자동 실행 스케줄

`install.sh` 실행 시 macOS launchd에 등록:

- **평일** 05:50
- **주말** 07:50
