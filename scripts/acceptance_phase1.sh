#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8002}"
TODAY="$(date +%F)"
YEAR="$(date +%Y)"
MONTH="$(date +%m | sed 's/^0*//')"
WEEK="$(date +%V | sed 's/^0*//')"

echo "[1/5] 健康检查"
curl -fsS "${API_BASE}/health"
echo

echo "[2/5] 创建日报"
curl -fsS -X POST "${API_BASE}/v2/records" \
  -H "Content-Type: application/json" \
  -d "{\"record_date\":\"${TODAY}\",\"raw_text\":\"今日推进 MyBroker 重构联调\",\"chat_text\":\"完成前后端链路验证\",\"screenshot_paths\":[],\"screenshot_notes\":\"\"}"
echo

echo "[3/5] 项目判断"
curl -fsS -X POST "${API_BASE}/v2/projects/decision" \
  -H "Content-Type: application/json" \
  -d '{"task_description":"把 MyBroker 升级为多租户 SaaS 并设计里程碑排期","existing_projects":["MyBroker"]}'
echo

echo "[4/5] 周报/月报"
curl -fsS "${API_BASE}/v2/reports/weekly?year=${YEAR}&week=${WEEK}"
echo
curl -fsS "${API_BASE}/v2/reports/monthly?year=${YEAR}&month=${MONTH}"
echo

echo "[5/5] Dashboard"
curl -fsS "${API_BASE}/v2/dashboard"
echo

echo "Phase 1 验收通过（接口均可用）。"
