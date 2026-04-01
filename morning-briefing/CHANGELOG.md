# Changelog

## 2026-04-01

### Added
- 기온별 옷차림 추천 (체감온도 기준 8단계)
- 카카오 refresh_token 만료 7일 전 경고
- API 부분 실패 처리 (캘린더/날씨 중 하나 실패해도 나머지 전송)
- 운동 키워드 추가: 뤼트, 광교

### Fixed
- 운동 키워드 대소문자 비교 버그 수정 (PT 등 대문자 키워드 매칭 불가 문제)

### Initial Release
- Google Calendar 오늘 일정 조회
- OpenWeatherMap 판교 날씨 조회
- 운동복 챙기기 알림
- 카카오톡 나에게 보내기
- macOS launchd 자동 실행 (평일 05:50 / 주말 07:50)
