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

## 인증 토큰 가이드

이 프로젝트는 3개의 외부 API를 사용하며, 각각 인증 방식과 갱신 주기가 다르다.

### 1. OpenWeatherMap — API Key

| 항목 | 내용 |
|------|------|
| 방식 | 고정 API Key |
| 만료 | 없음 (영구) |
| 갱신 | 불필요 |
| 저장 위치 | `.env` → `OPENWEATHER_API_KEY` |

**발급 방법:**
1. https://openweathermap.org/api 가입
2. API Keys 메뉴에서 키 복사
3. `.env`에 입력

### 2. Google Calendar — OAuth 2.0

| 항목 | 내용 |
|------|------|
| 방식 | OAuth 2.0 (Authorization Code Flow) |
| access_token 만료 | 1시간 |
| refresh_token 만료 | 없음 (자동 갱신) |
| 갱신 | 자동 — 스크립트가 만료 시 refresh_token으로 자동 갱신 |
| 저장 위치 | `credentials/google_credentials.json` (OAuth 클라이언트), `credentials/google_token.json` (토큰) |

**발급 방법:**
1. https://console.cloud.google.com 에서 프로젝트 생성
2. Google Calendar API 사용 설정
3. OAuth 2.0 클라이언트 ID 만들기 (데스크톱 앱)
4. JSON 다운로드 → `credentials/google_credentials.json`에 저장
5. 인증 실행:
   ```bash
   .venv/bin/python auth_setup.py google
   ```

**갱신:** access_token 만료 시 스크립트가 자동으로 refresh. 별도 조치 불필요.
단, Google Cloud 프로젝트가 "테스트" 상태이면 refresh_token이 7일 후 만료될 수 있음 → 프로젝트를 "프로덕션"으로 게시하면 해결.

### 3. KakaoTalk — OAuth 2.0

| 항목 | 내용 |
|------|------|
| 방식 | OAuth 2.0 (Authorization Code Flow) + Client Secret |
| access_token 만료 | ~6시간 |
| refresh_token 만료 | ~2개월 (60일) |
| 갱신 | access_token은 자동 갱신. **refresh_token은 수동 재인증 필요** |
| 저장 위치 | `.env` → `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `credentials/kakao_token.json` (토큰) |

**발급 방법:**
1. https://developers.kakao.com 에서 앱 생성
2. 플랫폼 → Web에 `http://localhost:9876` 추가
3. 카카오 로그인 활성화 + Redirect URI에 `http://localhost:9876/callback` 추가
4. 동의항목 → `카카오톡 메시지 전송(talk_message)` 선택
5. `.env`에 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` 입력
6. 인증 실행:
   ```bash
   .venv/bin/python auth_setup.py kakao
   ```

**갱신 (수동):**
refresh_token 만료 7일 전부터 브리핑 메시지에 경고가 표시된다. 경고가 뜨면:
```bash
.venv/bin/python auth_setup.py kakao
```
브라우저에서 카카오 로그인 → 동의하면 새 토큰이 발급된다.

### 갱신 자동화 로드맵

현재 카카오 refresh_token은 ~2개월마다 수동 재인증이 필요하다. 향후 자동화 방안:

1. **Selenium/Playwright 자동 로그인** — 카카오 로그인 페이지를 헤드리스 브라우저로 자동화하여 refresh_token 만료 전 자동 재발급. 단, 카카오 보안 정책(캡차, 2FA)에 의해 불안정할 수 있음.
2. **카카오 Admin Key 방식** — REST API 대신 Admin Key를 사용하면 토큰 없이 메시지 전송 가능. 단, "나에게 보내기"는 지원하지 않아 친구 목록 기반 전송으로 변경 필요.
3. **만료 전 자동 갱신 최적화** — refresh_token 갱신 시 새 refresh_token이 내려오면 만료 기한이 리셋됨. 현재도 access_token 갱신 시 조건부로 처리하고 있으나, 만료 30일 전부터 의도적으로 갱신 요청을 보내 refresh_token 수명을 연장하는 로직 추가 가능.

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
