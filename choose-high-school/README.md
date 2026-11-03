# 분당지역 고교 진학 종합 분석 시스템 (보관용 사본)

- 출처: https://bdh.mirae-academy.co.kr/ariimg/html/choose_high_school/index.html (분당미래탐구 / MathUp Info)
- 보관일: 2026-11-03
- 개인 보관·참고 목적의 사본입니다. 원 콘텐츠의 저작권은 원 제작자에게 있습니다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `original/index.html` | 서버에서 받은 원본 그대로 (단일 파일, 이미지 base64 포함) |
| `data/*.json` | 추출한 데이터 (아래 표 참고) |
| `src/` | 원본을 분리한 실행 가능 사본 (`index.html`, `style.css`, `app.js`, `data.js`, `tailwind-config.js`, `assets/`) |

`src/`는 광고·분석 추적 스크립트(GTM, gtag, GA, Kakao Pixel, enp tracker)를 제거한 것 외에는 원본과 동일하게 동작합니다.
Tailwind / Chart.js / Pretendard 는 원본과 같이 CDN에서 로드하므로 열람 시 인터넷 연결이 필요합니다.

## 데이터

서버 API 호출은 없고, 모든 데이터가 HTML 안의 JS 상수(정적)로 들어 있습니다.

| 파일 | 원본 상수 | 내용 |
| --- | --- | --- |
| `schoolNames.json` | `schoolNames` | 분당 18개 고교 이름 |
| `baseStats.json` | `baseStats` | 학교별 수학 내신 평균·표준편차·난이도·출제 특징 |
| `schoolData.json` | `SCHOOL_DATA` | 학교 그룹(과학중점/높은 일반고/평균 일반고), 5과목 평균·표준편차, 권역 |
| `achievementData.json` | `achievementData` | 2023~2025 · 1~3학년 · 5과목 평균/표준편차/성취도 A~E 비율 |
| `excelData.json` | `EXCEL_DATA` | `medical`(의약계열), `snu_medical`(서울대 의약계열), `major`(주요 대학, 2024~), `assign`(배정 지망) — 학교별·연도별 합격 실적 |

## 로컬에서 보기

```bash
cd choose-high-school/src && python3 -m http.server 8000
# http://localhost:8000
```

`file://`로 직접 열어도 동작합니다 (데이터는 `data.js`에 전역 상수로 포함).

## 데이터 수정 시 주의

`src/data.js`는 `data/*.json`에서 생성한 값입니다. JSON을 고치면 `data.js`의 해당 상수도 같이 갱신해야 합니다.
