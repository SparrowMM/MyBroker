#!/usr/bin/env bash
# 本地先启动：npm run dev（默认 http://127.0.0.1:3000）。
# 可选合并前自检：npm run check
# 运行：API_BASE=http://127.0.0.1:3000 ./scripts/acceptance_phase1.sh
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000}"
TODAY="$(date +%F)"
YEAR="$(date +%Y)"
MONTH="$(date +%m | sed 's/^0*//')"
WEEK="$(date +%V | sed 's/^0*//')"

case "$(uname -s)" in
  Darwin*)
    START_OVERVIEW="$(date -v-30d +%F)"
    ;;
  *)
    START_OVERVIEW="$(date -d '30 days ago' +%F 2>/dev/null || date --date='30 days ago' +%F)"
    ;;
esac

echo "[1/11] 健康检查（轻量探活 + 依赖探测）"
curl -fsS "${API_BASE}/api/health"
echo
curl -fsS "${API_BASE}/api/v2/system/health"
echo

echo "[2/11] 创建日报"
curl -fsS -X POST "${API_BASE}/api/v2/records" \
  -H "Content-Type: application/json" \
  -d "{\"record_date\":\"${TODAY}\",\"raw_text\":\"今日推进 MyBroker 重构联调\",\"chat_text\":\"完成前后端链路验证\",\"screenshot_paths\":[],\"screenshot_notes\":\"\"}"
echo

echo "[3/11] 日报列表（闭区间 start_date+end_date+limit）"
curl -fsS "${API_BASE}/api/v2/records?start_date=${TODAY}&end_date=${TODAY}&limit=20"
echo

echo "[4/11] 项目判断"
curl -fsS -X POST "${API_BASE}/api/v2/projects/decision" \
  -H "Content-Type: application/json" \
  -d '{"task_description":"把 MyBroker 升级为多租户 SaaS 并设计里程碑排期","existing_projects":["MyBroker"]}'
echo

echo "[5/11] 周报/月报"
curl -fsS "${API_BASE}/api/v2/reports/weekly?year=${YEAR}&week=${WEEK}"
echo
curl -fsS "${API_BASE}/api/v2/reports/monthly?year=${YEAR}&month=${MONTH}"
echo

echo "[6/11] Dashboard（列表）"
curl -fsS "${API_BASE}/api/v2/dashboard"
echo

echo "[7/11] 指定日日报 / 仪表盘总览 / 趋势"
curl -fsS "${API_BASE}/api/v2/reports/daily?report_date=${TODAY}"
echo
curl -fsS "${API_BASE}/api/v2/dashboard/overview?start_date=${START_OVERVIEW}&end_date=${TODAY}"
echo
curl -fsS "${API_BASE}/api/v2/dashboard/trends?days=30"
echo

echo "[8/11] 晨会简报 / 待办统计（可选空数据）"
curl -fsS "${API_BASE}/api/v2/briefings/morning"
echo
curl -fsS "${API_BASE}/api/v2/action-items/stats"
echo

echo "[9/11] 推送预览（不发送）"
curl -fsS "${API_BASE}/api/v2/notifications/preview/daily?channel=wecom"
echo

echo "[10/11] 导出接口（JSON 冒烟）"
curl -fsS "${API_BASE}/api/v2/records/export?start_date=${TODAY}&end_date=${TODAY}&format=json"
echo

echo "[11/11] Agent 桥接（未配置应 503；设了代理密钥无凭证应 401；已配上游可能 2xx/502）"
tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w "%{http_code}" "${API_BASE}/api/agent")"
case "$code" in
  503)
    grep -q "AGENT_BACKEND_URL" "$tmp" || {
      echo "期望正文提示 AGENT_BACKEND_URL，实际："
      cat "$tmp"
      rm -f "$tmp"
      exit 1
    }
    ;;
  401)
    grep -qE "未授权|AGENT_PROXY" "$tmp" || {
      echo "期望未授权提示，实际："
      cat "$tmp"
      rm -f "$tmp"
      exit 1
    }
    ;;
  200|201|204)
    echo "（检测到上游可达，HTTP $code）"
    ;;
  502|504)
    echo "（上游不可达或超时，HTTP $code；桥接路由存在即可）"
    ;;
  *)
    echo "意外 HTTP $code:"
    cat "$tmp"
    rm -f "$tmp"
    exit 1
    ;;
esac
rm -f "$tmp"
echo

echo "Phase 1 验收通过（接口均可用）。"
