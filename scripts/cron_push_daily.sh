#!/usr/bin/env bash
# 调用服务端定时推送接口（与 Vercel/GitHub Actions Cron 行为一致）
# 使用前请在环境中导出：
#   APP_BASE_URL — 部署根 URL，如 https://xxx.vercel.app
#   CRON_SECRET — 须与线上 CRON_SECRET 一致
#
# 示例：
#   export APP_BASE_URL=https://your-app.vercel.app
#   export CRON_SECRET=xxxxxxxx
#   ./scripts/cron_push_daily.sh

set -euo pipefail

BASE="${APP_BASE_URL:-}"
SECRET="${CRON_SECRET:-}"

if [[ -z "$BASE" || -z "$SECRET" ]]; then
  echo "缺少 APP_BASE_URL 或 CRON_SECRET（请先 export）。" >&2
  exit 1
fi

BASE="${BASE%/}"
URL="${BASE}/api/cron/push-daily"

exec curl -fsS -H "Authorization: Bearer ${SECRET}" "${URL}"
