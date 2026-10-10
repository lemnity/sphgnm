#!/bin/sh
# Заглушка sendmail для проверок: письмо из stdin и аргументы — в файлы LEAD_CAPTURE_DIR.
# Подключается так: SENDMAIL_PATH=scripts/sendmail-capture.sh LEAD_CAPTURE_DIR=/tmp/… next dev
dir="${LEAD_CAPTURE_DIR:-/tmp/sphagnum-lead-capture}"
mkdir -p "$dir" || exit 75
file="$dir/$(date +%s)-$$"
printf '%s\n' "$@" > "$file.args"
cat > "$file.eml.tmp" && mv "$file.eml.tmp" "$file.eml"
