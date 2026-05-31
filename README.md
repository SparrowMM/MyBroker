# MyBroker

MyBroker 是个人用的「工作记忆 + AI 经纪人」：用文字/截图记录每天的事，由经纪人排优先级、做日终复盘并给出生活与工作建议。实现进度见 [docs/implementation-progress.md](docs/implementation-progress.md)。

## 架构（对齐 finchledger 风格）

- **单一 Next.js 应用**：页面与 API 均在同一仓库，路由位于 `src/app`。
- **Prisma + PostgreSQL**：数据访问与迁移由 Prisma 管理（`prisma/schema.prisma`、`prisma/migrations`）。
- **百炼（DashScope）**：文本总结、周期汇总、项目判断、截图转 Markdown；未配置 Key 时日报分析走本地回退文案。
- **Supabase（可选）**：`POST /api/uploads/screenshot` 上传截图至 Storage。

历史上曾使用 FastAPI Worker + Next 转发；现已移除全部 Python 代码，接口由 Next Route Handlers 直接实现。

## 快速启动

建议使用 **Node.js 22.x**（与 CI 一致）；若使用 [nvm](https://github.com/nvm-sh/nvm)，可在仓库根目录执行 `nvm use`（读取 `.nvmrc`）。

1）安装依赖并生成 Prisma Client

```bash
npm install
```

2）配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local：至少配置 DATABASE_URL；生产建议配置 NEXT_PUBLIC_APP_URL（站点 https 根地址，用于 metadata/Open Graph）；使用 AI 能力需配置 BAILIAN_*；上传需配置 SUPABASE_*
```

3）数据库迁移（新库）

```bash
npx prisma migrate deploy
```

若库表已由旧版 Alembic 创建，一般可直接连接使用；若 Prisma 报错，可用 `npx prisma db pull` 对齐后再调整 schema。

4）开发服务

```bash
npm run dev
```

- 产品界面：<http://127.0.0.1:3000>（默认跳转 **`/today`**）；历史见 **`/history`**；设置见 **`/settings`**
- 轻量探活（不查库）：<http://127.0.0.1:3000/api/health>；依赖与 LLM 探测：<http://127.0.0.1:3000/api/v2/system/health>
- PWA 清单：<http://127.0.0.1:3000/manifest.webmanifest>（「添加到主屏幕」时用）

## 核心 HTTP 接口（节选）

| 说明 | 方法 | 路径 |
|------|------|------|
| 探活（轻量） | GET | `/api/health` |
| 依赖健康检查 | GET | `/api/v2/system/health` |
| LLM 调用日志 | GET | `/api/v2/llm/logs?limit=30` |
| 日报列表 | GET | `/api/v2/records`（`record_date`、`start_date`+`end_date`、`limit`；闭区间默认取前 2000 条、上限 5000；非区间默认上限 500） |
| 单条日报 | GET | `/api/v2/records/[id]` |
| 更新日报并重分析 | PATCH | `/api/v2/records/[id]` |
| 仅重跑分析 | POST | `/api/v2/records/[id]/reanalyze` |
| 导出日报 | GET | `/api/v2/records/export?start_date=&end_date=&format=csv`（或 `format=json`） |
| 创建日报（分析入库） | POST | `/api/v2/records` |
| 截图转 Markdown | POST | `/api/v2/records/markdown-from-image?record_date=YYYY-MM-DD` |
| Dashboard（最近 N 条） | GET | `/api/v2/dashboard?days=14` |
| 仪表盘总览 | GET | `/api/v2/dashboard/overview?start_date=&end_date=` |
| 仪表盘趋势 | GET | `/api/v2/dashboard/trends?days=30` |
| 指定日日报 | GET | `/api/v2/reports/daily?report_date=YYYY-MM-DD` |
| 时间线 | GET | `/api/v2/timeline?start_date=&end_date=` |
| 周报 / 月报 | GET | `/api/v2/reports/weekly`、`/api/v2/reports/monthly` |
| 项目是否新建 | POST | `/api/v2/projects/decision` |
| 待办列表 / 统计 / 同步 / 提醒 | GET/POST | `/api/v2/action-items`、`/stats`、`/sync?days=14`、`/reminders/daily` |
| 待办更新 | PATCH | `/api/v2/action-items/[id]` |
| 晨会简报 | GET | `/api/v2/briefings/morning` |
| 经纪人 · 今日优先级 | GET/POST | `/api/v2/broker/today-priorities?date=YYYY-MM-DD`（`refresh=1` 强制重算） |
| 经纪人 · 日终复盘 | GET/POST | `/api/v2/broker/daily-review?date=YYYY-MM-DD`（`refresh=1` 强制重算） |
| 每日推送预览 | GET | `/api/v2/notifications/preview/daily?channel=wecom` |
| 手动推送 | POST | `/api/v2/notifications/send/daily?channel=wecom`（可选 JSON：`{"markdown":"..."}` 覆盖正文） |
| 推送日志 | GET | `/api/v2/notifications/logs?limit=50` |
| 定时每日推送 | GET/POST | `/api/cron/push-daily`（需鉴权，见下） |
| 截图上传 Supabase | POST | `/api/uploads/screenshot`（`multipart` 字段 `file`） |
| 可选 Agent 桥接 | GET 等 | `/api/agent/**` → **`AGENT_BACKEND_URL`**（未配置 **503**）；若设 **`AGENT_PROXY_SECRET`**，须带 **`X-MyBroker-Proxy-Key`** 或 **`?proxy_key=`**（转发上游时会剥离） |

完整列表与变量说明见旧版 README 中的业务描述；环境变量名保持兼容（`BAILIAN_*`、`DASHSCOPE_*`、`SUPABASE_*` 等）。

## 定时每日推送（Cron）

1. 配置 **`CRON_SECRET`**（随机字符串，≥16 字符）。调用 `/api/cron/push-daily` 时必须携带 **`Authorization: Bearer <CRON_SECRET>`**，或使用 **`?secret=<CRON_SECRET>`**（便于本地 curl）。
2. 开启 **`AUTO_PUSH_DAILY_ENABLED=true`**，并设置 **`AUTO_PUSH_DAILY_CHANNEL`**（`wecom` / `feishu` / `dingtalk`）及对应 **`WEBHOOK_*_URL`**。
3. **`AUTO_PUSH_WEEKDAYS_ONLY`** 为 `true`（默认）时，周六日调用会直接返回 `skipped`（不推送）。
4. **`AUTO_PUSH_DAILY_HOUR` / `MINUTE`**：应用内**未做时钟调度**，仅作你在运维侧配置 Crontab / GitHub Actions / Vercel Cron 时刻时的参考。

**Vercel**：在项目环境变量中配置 `CRON_SECRET` 后，计划任务触发时会自动带上 `Authorization: Bearer`。仓库根目录 **`vercel.json`** 中示例为每天 **UTC** `01:00` 执行（约等于北京时间工作日早间，可按需改为其它 Cron 表达式；Cron 使用 UTC）。

**本地测试示例**：

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/push-daily
```

**脚本封装**（需 `export APP_BASE_URL` 与 `export CRON_SECRET`）：

```bash
export APP_BASE_URL=http://127.0.0.1:3000
export CRON_SECRET=你的密钥
./scripts/cron_push_daily.sh
```

**GitHub Actions**：在仓库 **Settings → Secrets and variables → Actions** 中配置 `APP_BASE_URL`（如 `https://你的部署.vercel.app`）、`CRON_SECRET`（与线上一致），可使用 `.github/workflows/daily-notify.yml`（默认每日 UTC 01:00，可自行修改 `cron`）；该 workflow 亦配置了 **`concurrency`**（重叠运行时保留最新一次）。

**CI 构建**：对 **`main` / `master`** 的推送或 PR 会依次执行 **`npm ci`** → **`npm run lint`**（`eslint-config-next`：core-web-vitals + typescript）→ **`npm run typecheck`** → **`npm run test`**（Vitest）→ **`npm run build`**（`.github/workflows/ci.yml`）；流水线内使用占位 **`DATABASE_URL`**，无需配置 Secrets。同一分支 / PR 多次推送时，进行中的旧运行会被 **`concurrency`** 取消，避免排队浪费。

**Dependabot**：已配置 **`.github/dependabot.yml`**，每周检查 **npm** 与 **GitHub Actions** 依赖并分组开 PR（需在仓库 **Settings → Code security** 中启用 Dependabot updates）。

## 验收脚本

共 **11** 步 HTTP 冒烟（含闭区间日报列表、`/api/agent` 桥接探测）；需本地 `npm run dev` 且数据库与密钥就绪。

```bash
API_BASE=http://127.0.0.1:3000 ./scripts/acceptance_phase1.sh
```

## 生产构建

```bash
npm run check       # lint + typecheck + 单元测试（Vitest，与 CI 一致）
npm run test        # 仅跑 Vitest（`src/**/*.test.ts`；`vitest.config` 中 TZ=UTC）
npm run lint        # ESLint（core-web-vitals + typescript，见 eslint.config.mjs）
npm run typecheck   # 可选：仅 TypeScript 校验，快于完整 build
npm run build
npm run start
```

## 迁移说明（从 Python Worker）

- 删除独立 Worker 进程与 `FASTAPI_WORKER_BASE_URL`；所有 `/api/v2/*`、`/api/uploads/*` 由本仓库 Next 应用提供。
- 若仍需临时调用旧版独立 HTTP 服务，可配置 **`AGENT_BACKEND_URL`**，通过 **`/api/agent/**`** 透明转发（同源路径）。公网部署请同时设置 **`AGENT_PROXY_SECRET`**，客户端用 **`X-MyBroker-Proxy-Key`** 或 **`?proxy_key=`** 鉴权（不影响转发 **`Authorization`** 给上游）。上线前建议收口并移除桥接。
- `DATABASE_URL` 请使用 `postgresql://...`（Prisma）；若曾为 `postgresql+psycopg://`，需改为标准 Postgres URL。
- Supabase Pooler 连接串可保留 `pgbouncer=true`，或在代码侧自动追加（见 `src/lib/database-connection-url.ts`）。
