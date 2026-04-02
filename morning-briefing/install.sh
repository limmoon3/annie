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

# 3. launchd plist 생성 (아침 05:00)
cat > "$PLIST_DIR/com.morning-briefing.morning.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.morning-briefing.morning</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$SCRIPT_DIR/morning_briefing.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>5</integer>
        <key>Minute</key>
        <integer>0</integer>
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

# 4. launchd plist 생성 (저녁 20:00)
cat > "$PLIST_DIR/com.morning-briefing.evening.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.morning-briefing.evening</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$SCRIPT_DIR/morning_briefing.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>20</integer>
        <key>Minute</key>
        <integer>0</integer>
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

# 5. 맥 예약 깨우기 (브리핑 2분 전)
echo "→ 맥 예약 깨우기 설정 (04:58, 19:58)..."
sudo pmset repeat wakeorpoweron MTWRFSS 04:58:00 wakeorpoweron MTWRFSS 19:58:00 \
    && echo "  완료" \
    || echo "  ⚠️  실패 - 수동으로 설정하세요: sudo pmset repeat wakeorpoweron MTWRFSS 04:58:00 wakeorpoweron MTWRFSS 19:58:00"

# 6. 기존 plist 제거 + 새 plist 등록
launchctl unload "$PLIST_DIR/com.morning-briefing.weekday.plist" 2>/dev/null || true
launchctl unload "$PLIST_DIR/com.morning-briefing.weekend.plist" 2>/dev/null || true
rm -f "$PLIST_DIR/com.morning-briefing.weekday.plist" "$PLIST_DIR/com.morning-briefing.weekend.plist"

launchctl unload "$PLIST_DIR/com.morning-briefing.morning.plist" 2>/dev/null || true
launchctl unload "$PLIST_DIR/com.morning-briefing.evening.plist" 2>/dev/null || true
launchctl load "$PLIST_DIR/com.morning-briefing.morning.plist"
launchctl load "$PLIST_DIR/com.morning-briefing.evening.plist"

echo ""
echo "=== 설치 완료! ==="
echo ""
echo "스케줄:"
echo "  매일 05:00 / 20:00 (2회)"
