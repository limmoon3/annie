# Annie Project Guidelines

## Development Workflow

비사소한 구현 작업 시 다음 워크플로우를 따른다:

1. **플랜 수립**: `EnterPlanMode`로 구현 계획을 짜고 사용자 승인을 받는다
2. **Ralph Loop 실행**: `/ralph-loop`으로 셀프 반복 구현. 플랜의 모든 항목이 완료될 때까지 자동 반복한다
3. **커밋 단위**: 기능/수정별로 커밋을 분리하여 쌓는다. 하나의 큰 커밋이 아닌 논리적 단위로 나눈다
4. **검증**: 각 커밋 전 실제 실행하여 동작 확인

## Bash Execution

이 프로젝트에서는 bash 명령을 사용자에게 안내하지 않고 직접 Bash 도구로 실행한다.
단, sudo 등 인터랙티브 입력이 필요한 경우만 사용자에게 안내.

## Git

- Remote: github.com/limmoon3/annie (개인 GitHub, 회사 GitHub 아님)
- 커밋 메시지: `{type}: {내용}` (Jira 번호 없음)
