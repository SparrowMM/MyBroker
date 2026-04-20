# MyBroker

MyBroker 是一个“经纪人后台 + 私人助理 Agent”MVP，用于沉淀你每天通过截图、对话、文字输入的工作信息，并自动输出按天/周/月分析结果。

## 当前能力

- 每日记录：支持保存日期、文字描述、对话内容、截图路径和截图备注
- 自动分析：新增或更新记录后自动生成当日分析摘要与标签
- 周报/月报：自动聚合多天记录输出阶段性总结、风险和建议
- 项目判断：根据任务描述判断是否应新建项目并给出建议名
- 百炼真实调用：日报总结、周月报聚合、项目判断均支持百炼增强（未配置 key 时自动降级）
- Supabase 接入：支持 Supabase Postgres（`DATABASE_URL`）与 Storage 截图上传

## 快速启动

1) 安装依赖

```bash
pip install -r requirements.txt
```

2) 启动服务

```bash
alembic upgrade head
uvicorn main:app --reload
```

3) 访问文档

- Swagger UI: `http://127.0.0.1:8000/docs`
- 健康检查: `http://127.0.0.1:8000/health`
- 前台界面: `http://127.0.0.1:8000/`

4) 启动 Next.js 前台（主入口，推荐）

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

- 页面：
  - `http://127.0.0.1:3000/records` 日报录入
  - `http://127.0.0.1:3000/analysis` 日报分析
  - `http://127.0.0.1:3000/reports` 周月报表
  - `http://127.0.0.1:3000/projects` 项目判断
- Next API（统一入口）：
  - `/api/v2/*` -> 转发到 FastAPI Worker `/v2/*`
  - `/api/uploads/*` -> 转发到 FastAPI Worker `/uploads/*`

## 核心接口

- `POST /records` 新建每日记录并触发分析
- `GET /records` 查询记录（可按日期过滤）
- `PATCH /records/{record_id}` 更新记录并重新分析
- `POST /records/{record_id}/reanalyze` 手动重跑分析
- `GET /records/reports/daily?report_date=2026-04-20`
- `GET /records/reports/weekly?year=2026&week=17`
- `GET /records/reports/monthly?year=2026&month=4`
- `GET /records/dashboard/overview?start_date=2026-04-01&end_date=2026-04-30` 仪表盘总览
- `GET /records/dashboard/trends?days=30` 周维度趋势
- `GET /records/action-items?days=14` 自动提取待办
- `POST /action-items/sync?days=14` 抽取待办并入库（去重）
- `GET /action-items?status=todo&priority=high` 查看待办清单
- `PATCH /action-items/{item_id}` 更新状态/优先级/截止日/备注
- `GET /action-items/stats` 查看待办完成率与逾期统计
- `GET /action-items/reminders/daily` 每日提醒（紧急项+到期项+建议动作）
- `GET /briefings/morning` 晨会简报（昨日总结+本周重点+今日优先待办）
- `GET /notifications/preview/daily?channel=wecom` 预览每日推送文案
- `POST /notifications/send/daily?channel=wecom` 推送到 webhook
- `POST /uploads/screenshot` 上传截图到 Supabase Storage
- `GET /notifications/logs?limit=50` 查看推送日志（成功/失败/重试次数）
- `GET /notifications/failure-stats?hours=24` 查看失败原因统计（配置/网络/HTTP/其他）
- `GET /notifications/health-score?hours=168` 查看渠道健康分（成功率/重试/恢复次数）
- `GET /notifications/health-score/trends?days=30` 查看健康分趋势序列（按天）
- `GET /notifications/self-heal/state` 查看自愈熔断状态（暂停中的渠道）
- `POST /notifications/self-heal/probe` 手动执行一次恢复探测
- `POST /notifications/health-alert/check` 手动执行健康分告警检查
- `GET /notifications/alerts/suppressed-channels` 查看告警抑制白名单
- `GET /notifications/settings` 查看自动推送配置状态
- `POST /notifications/run/auto-daily` 手动执行一次自动推送任务
- `POST /projects/decision` 判断是否新建项目
- `POST /v2/records` 前台友好日报创建
- `GET /v2/timeline?start_date=2026-04-01&end_date=2026-04-20` 时间线查询
- `GET /v2/reports/weekly?year=2026&week=17` 前台友好周报
- `GET /v2/reports/monthly?year=2026&month=4` 前台友好月报
- `POST /v2/projects/decision` 前台友好项目判断
- `GET /v2/dashboard` 前台聚合概览
- `GET /v2/system/health` 核心依赖健康检查（DB/Supabase/百炼配置）
- `GET /v2/llm/logs?limit=30` LLM 调用审计日志（摘要/耗时/状态）

## 环境变量

- `DATABASE_URL` 云数据库连接串（推荐 PostgreSQL/Supabase）
- `AUTO_CREATE_TABLES` 是否启动时自动建表（默认 `false`，建议使用 Alembic）
- `BAILIAN_API_KEY` 百炼 API Key（未配置时走本地回退分析）
- `BAILIAN_BASE_URL` 默认 `https://coding.dashscope.aliyuncs.com/v1`（coding plan 推荐）
- `BAILIAN_VISION_BASE_URL` 视觉模型专用端点（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
- `BAILIAN_VISION_API_KEY` 视觉模型专用 API Key（未配置时回退到 `BAILIAN_API_KEY`）
- `BAILIAN_MODEL` 默认 `qwen-plus`
- `BAILIAN_VISION_MODEL` 百炼视觉模型（用于图片解析，默认 `qwen-vl-max-latest`）
- `DASHSCOPE_API_KEY` 百炼兼容命名（可替代 `BAILIAN_API_KEY`）
- `DASHSCOPE_BASE_URL` 百炼兼容命名（可替代 `BAILIAN_BASE_URL`）
- `DASHSCOPE_VISION_BASE_URL` 百炼兼容命名（可替代 `BAILIAN_VISION_BASE_URL`）
- `DASHSCOPE_VISION_API_KEY` 百炼兼容命名（可替代 `BAILIAN_VISION_API_KEY`）
- `DASHSCOPE_MODEL` 百炼兼容命名（可替代 `BAILIAN_MODEL`）
- `DASHSCOPE_VISION_MODEL` 百炼兼容命名（可替代 `BAILIAN_VISION_MODEL`）
- `AGENT_BACKEND_URL` 你的 Agent 底层服务地址
- `SUPABASE_URL` Supabase 项目地址
- `SUPABASE_PUBLISHABLE_KEY` Supabase 前端 key
- `SUPABASE_SERVICE_ROLE_KEY` Supabase 服务端 key（上传与后端写入）
- `SUPABASE_STORAGE_BUCKET` 截图存储 bucket 名称
- `REMINDER_PUSH_ENABLED` 是否开启推送（`true/false`）
- `WEBHOOK_WECOM_URL` 企业微信机器人 webhook
- `WEBHOOK_FEISHU_URL` 飞书机器人 webhook
- `WEBHOOK_DINGTALK_URL` 钉钉机器人 webhook
- `AUTO_PUSH_DAILY_ENABLED` 是否开启定时自动推送
- `AUTO_PUSH_DAILY_CHANNEL` 定时推送渠道（`wecom`/`feishu`/`dingtalk`）
- `AUTO_PUSH_DAILY_HOUR` 定时推送小时（0-23）
- `AUTO_PUSH_DAILY_MINUTE` 定时推送分钟（0-59）
- `AUTO_PUSH_WEEKDAYS_ONLY` 是否仅工作日推送（默认 `true`）
- `NOTIFY_RETRY_TIMES` 失败后重试次数（不含首次）
- `NOTIFY_TEMPLATE_HEADER` 推送模板头部（可选）
- `NOTIFY_TEMPLATE_FOOTER` 推送模板尾部（可选）
- `NOTIFY_WEEKEND_TEMPLATE_HEADER` 周末推送头部模板（可选，未填则回退通用模板）
- `NOTIFY_WEEKEND_TEMPLATE_FOOTER` 周末推送尾部模板（可选，未填则回退通用模板）
- `NOTIFY_FAILURE_TEMPLATE` 全渠道失败时追加提示语
- `NOTIFY_FALLBACK_CHANNELS` 降级渠道顺序（逗号分隔，如 `feishu,dingtalk`）
- `NOTIFY_ALERT_ENABLED` 是否开启连续失败告警
- `NOTIFY_ALERT_THRESHOLD` 连续失败阈值（达到后触发告警）
- `NOTIFY_ALERT_CRITICAL_THRESHOLD` critical 告警阈值（达到后按 critical 级别告警）
- `NOTIFY_ALERT_CHANNEL` 告警发送渠道
- `NOTIFY_ALERT_COOLDOWN_MINUTES` 告警冷却时间（分钟，防止刷屏）
- `NOTIFY_SELF_HEAL_ENABLED` 是否开启自愈（配置错误触发渠道临时熔断）
- `NOTIFY_SELF_HEAL_PAUSE_MINUTES` 熔断暂停时长（分钟）
- `NOTIFY_SELF_HEAL_PROBE_ENABLED` 是否开启自动恢复探测
- `NOTIFY_SELF_HEAL_PROBE_INTERVAL_MINUTES` 自动恢复探测间隔（分钟）
- `NOTIFY_HEALTH_ALERT_ENABLED` 是否开启健康分告警
- `NOTIFY_CHANNEL_HEALTH_ALERT_ENABLED` 是否开启分渠道健康分告警
- `NOTIFY_HEALTH_WARNING_SCORE` warning 健康分阈值
- `NOTIFY_HEALTH_CRITICAL_SCORE` critical 健康分阈值
- `NOTIFY_HEALTH_CRITICAL_DAYS` 连续低于 critical 阈值的天数要求
- `NOTIFY_ALERT_SUPPRESSED_CHANNELS` 告警抑制白名单（逗号分隔；支持到期时间，如 `wecom,feishu@2026-05-01T12:00:00`）

### 云数据库建议（参考 ai-makaiqian 现有实践）

- 推荐使用 Supabase PostgreSQL 或其他云 PostgreSQL
- 若使用 Supabase pooler（`*.pooler.supabase.com`），服务会自动追加 `pgbouncer=true`
- 建议从 `.env.example` 复制为 `.env` 后填写你的云数据库连接串

## 迁移与验收

- 迁移目录：`alembic/`
- 初始化迁移：`alembic upgrade head`
- 第一阶段验收文档：`docs/phase1_acceptance_runbook.md`
- 一键验收脚本：`scripts/acceptance_phase1.sh`

## Next + Worker 架构说明

- Next.js（`frontend/`）是产品主入口，页面与 BFF API 均在 Next。
- FastAPI 作为 Worker，仅承载重任务能力（分析、调度、通知、存储）。
- Worker 地址通过 `frontend/.env.local` 的 `FASTAPI_WORKER_BASE_URL` 配置。