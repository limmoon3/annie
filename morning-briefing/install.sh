#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON="$VENV_DIR/bin/python"

echo "=== Morning Briefing 설치 ==="

# 1. Python venv
echo "→ Python 가상환경 생성..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet -r "$SCRIPT_DIR/requirements.txt"
echo "  완료"

# 2. .env 확인
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo ""
    echo "⚠️  .env 파일이 생성되었습니다. API 키를 입력하세요:"
    echo "    $SCRIPT_DIR/.env"
    echo ""
fi

# 3. launchd plist 생성 (평일 5:50)
cat > "$PLIST_DIR/com.morning-briefing.weekday.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.morning-briefing.weekday</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$SCRIPT_DIR/morning_briefing.py</string>
        <string>--weekday-only</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>5</integer>
        <key>Minute</key>
        <integer>50</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$SCRIPT_DIR/launchd_stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$SCRIPT_DIR/launchd_stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

# 4. launchd plist 생성 (주말 7:50)
cat > "$PLIST_DIR/com.morning-briefing.weekend.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.morning-briefing.weekend</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$SCRIPT_DIR/morning_briefing.py</string>
        <string>--weekend-only</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>50</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$SCRIPT_DIR/launchd_stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$SCRIPT_DIR/launchd_stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

# 5. launchd 등록
launchctl unload "$PLIST_DIR/com.morning-briefing.weekday.plist" 2>/dev/null || true
launchctl unload "$PLIST_DIR/com.morning-briefing.weekend.plist" 2>/dev/null || true
launchctl load "$PLIST_DIR/com.morning-briefing.weekday.plist"
launchctl load "$PLIST_DIR/com.morning-briefing.weekend.plist"

echo ""
echo "=== 설치 완료! ==="
echo ""
echo "다음 단계:"
echo "  1. .env에 API 키 입력"
echo "     vi $SCRIPT_DIR/.env"
echo ""
echo "  2. Google Calendar 인증"
echo "     $PYTHON $SCRIPT_DIR/auth_setup.py google"
echo ""
echo "  3. KakaoTalk 인증"
echo "     $PYTHON $SCRIPT_DIR/auth_setup.py kakao"
echo ""
echo "  4. 테스트 실행"
echo "     $PYTHON $SCRIPT_DIR/morning_briefing.py"
echo ""
echo "스케줄:"
echo "  평일 05:50 / 주말 07:50"
