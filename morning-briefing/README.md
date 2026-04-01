# Morning Briefing

매일 아침 일정, 날씨, 아기 성장, 뉴스를 카카오톡으로 전송하는 개인 자동화 봇.
다중 수신자 지원, 수신자별 콘텐츠 커스터마이징, 웹 관리 UI 포함.

## 기능

- **다중 수신자** — `recipients.json`으로 수신자별 콘텐츠/위치/키워드 설정
- **오늘 일정** — Google Calendar에서 당일 일정 조회
- **운동복 알림** — 수신자별 운동 키워드로 캘린더 매칭
- **날씨** — 수신자별 위치 기반 날씨 (기온, 체감, 습도, 비 예보)
- **옷차림 추천** — 실제 기온 기준 9단계 옷차림 제안
- **미세먼지** — PM2.5/PM10 등급 + 마스크 권고
- **아기 성장** — 월령, 발달사항, 돌 카운트다운 (D-10/3/1/당일 특별 메시지)
- **뉴스 헤드라인** — Google News RSS 한국 주요 뉴스 5건
- **주간 날씨** — 월요일 한정 5일 예보 트렌드
- **요일 알림** — 수신자별 요일 커스텀 알림
- **부분 실패 처리** — API 실패 시 나머지 정보만 전송
- **토큰 만료 경고** — 카카오 refresh_token 만료 7일 전부터 경고
- **전송 이력** — 날짜별 성공/실패 기록
- **관리 웹 UI** — 수신자 CRUD, 미리보기, 수동 전송, 전송 이력

## 메시지 예시

```
04/02 (목) 모닝 브리핑

[알림] 아기 선생님 주차등록

[아기 성장] 생후 11개월 5일째
  이 시기: 몇 걸음 터벅거리며 걷고, '엄마' '아빠' 등 말을 해요
  돌까지 D-27

[오늘은 운동 없음]

[판교 날씨] 맑음
  현재 6도 (체감 4도)
  최저 6도 / 최고 16도
  습도 67%

[옷차림 추천] 코트, 두꺼운 점퍼

[미세먼지] PM2.5 95 (매우나쁨) / PM10 101 (나쁨) → 마스크 챙기세요!

[오늘의 뉴스]
  1. 트럼프 "이란 새 대통령, 휴전 요청..."
  2. ...

[오늘 일정 없음]
```

## 설치

```bash
bash install.sh
```

## 수신자 설정

`recipients.example.json`을 `recipients.json`으로 복사 후 편집:

```bash
cp recipients.example.json recipients.json
```

섹션별 on/off로 수신자마다 다른 콘텐츠를 받을 수 있다.

| 섹션 | 설명 |
|------|------|
| `weather` | 날씨 |
| `air_quality` | 미세먼지 |
| `clothing` | 옷차림 추천 |
| `calendar` | 캘린더 일정 |
| `workout` | 운동복 알림 |
| `reminder` | 요일별 커스텀 알림 |
| `baby` | 아기 성장 정보 |
| `news` | 뉴스 헤드라인 |
| `weekly_weather` | 주간 날씨 (월요일) |

전송 방식:
- `"self"` — 나에게 보내기 (본인 계정)
- `"friend"` — 카카오 친구에게 전송 (`kakao_uuid` 필요, `friends` 스코프 필요)

## 관리 웹 UI

```bash
.venv/bin/python web/app.py
# http://localhost:8888
```

수신자 추가/수정/삭제, 메시지 미리보기, 수동 전송, 전송 이력 조회 가능.

## 인증 토큰 가이드

### 1. OpenWeatherMap — API Key

| 항목 | 내용 |
|------|------|
| 방식 | 고정 API Key |
| 만료 | 없음 (영구) |
| 저장 위치 | `.env` → `OPENWEATHER_API_KEY` |

### 2. Google Calendar — OAuth 2.0

| 항목 | 내용 |
|------|------|
| 방식 | OAuth 2.0 |
| access_token | 자동 갱신 |
| 저장 위치 | `credentials/google_credentials.json`, `credentials/google_token.json` |

```bash
.venv/bin/python auth_setup.py google
```

### 3. KakaoTalk — OAuth 2.0

| 항목 | 내용 |
|------|------|
| 방식 | OAuth 2.0 + Client Secret |
| access_token | 자동 갱신 (~6시간) |
| refresh_token | **수동 재인증 필요** (~2개월) |
| 저장 위치 | `.env`, `credentials/kakao_token.json` |

```bash
.venv/bin/python auth_setup.py kakao
```

친구 메시지 전송 시 카카오 동의항목에 `friends` 스코프 추가 필요.

## 실행

```bash
.venv/bin/python morning_briefing.py              # 전체
.venv/bin/python morning_briefing.py --weekday-only  # 평일만
.venv/bin/python morning_briefing.py --weekend-only  # 주말만
```

## 자동 실행

`install.sh` 실행 시 macOS launchd + pmset 예약 깨우기 등록:

- **평일** 05:48 깨우기 → 05:50 실행
- **주말** 07:48 깨우기 → 07:50 실행

## 로드맵

### 구현 완료
- [x] 다중 수신자 (self + friend)
- [x] 수신자별 섹션 on/off
- [x] 관리 웹 UI (FastAPI + Jinja2)
- [x] 미세먼지 (OpenWeatherMap Air Pollution)
- [x] 뉴스 헤드라인 (Google News RSS)
- [x] 주간 날씨 (월요일)
- [x] 아기 성장 (월령, 발달, 돌 카운트다운)
- [x] 아기 발달 코퍼스 (이유식 메뉴, 놀이법, 예방접종, 수면 가이드)
- [x] 요일별 커스텀 알림
- [x] 네트워크 대기 (잠자기 후 Wi-Fi 복구)

### 예정
- [ ] 수신자 본인 토큰으로 "나에게 보내기" 방식 지원
- [ ] 뉴스 소스 다양화 (Naver News API, NewsAPI.org)
- [ ] 출근 소요시간 (카카오맵 길찾기 API)
- [ ] 카카오 토큰 자동 갱신 (Playwright)
- [ ] 서버 이전 (AWS Lambda / GCP Cloud Functions)
- [ ] 알림 채널 다양화 (슬랙, 텔레그램)
- [ ] 모니터링 (연속 실패 시 별도 알림)
