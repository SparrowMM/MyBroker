# MyBroker Phase 1 验收 Runbook

## 目标

验证核心链路：`输入文本/截图 -> 百炼分析 -> Supabase 存储（可选） -> 项目新建判断 -> 周月报输出`。

## 前置准备

- 在 `.env.local` 中配置：
  - `DATABASE_URL`（建议 Supabase Postgres，`postgresql://`）
  - `BAILIAN_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET`
- 首次初始化数据库（迁移）：

```bash
npx prisma migrate deploy
```

## 启动方式

```bash
npm install
npm run dev
```

默认：<http://127.0.0.1:3000>

合并或发布前建议在仓库根目录执行 **`npm run check`**（**lint** + **typecheck** + **Vitest**，与 CI 中 build 之前的步骤一致）。

## 自动化验收

```bash
API_BASE=http://127.0.0.1:3000 ./scripts/acceptance_phase1.sh
```

脚本覆盖检查项（共 11 组请求）：

- **`GET /api/health`**（轻量探活）、**`GET /api/v2/system/health`**（依赖探测）、创建日报、**`GET /api/v2/records`（闭区间列表）**、项目判断、周/月报
- Dashboard 列表、`reports/daily`、`dashboard/overview`、`dashboard/trends`
- 晨会简报、待办统计、推送预览（不发送）、**records/export（JSON）**
- **`GET /api/agent`**：默认环境（未配 `AGENT_BACKEND_URL`）应 **503**；若已配置代理密钥但未带凭证应 **401**；若已指向可达上游可能 **2xx**，不可达可能 **502**

## 人工补充验收

- 打开 <http://127.0.0.1:3000>：应跳转到 `/dashboard`。
- 打开 <http://127.0.0.1:3000/records>：上传本地截图，解析 Markdown（不上传 Supabase，除非另行接入上传接口）。
- 打开 `analysis` / `reports` / `projects` 页面验证查询。
- 在 Supabase 控制台验证（若使用上传）：对应 bucket 下有截图对象；`daily_records` 有新增行。

## 常见问题

- 百炼调用失败：检查 `BAILIAN_API_KEY` 与 `BAILIAN_BASE_URL`
- Supabase 上传失败：检查 `SUPABASE_SERVICE_ROLE_KEY` 与 bucket 名
- 数据库连不上：检查 `DATABASE_URL`，若用 pooler 可使用带 `pgbouncer=true` 的连接串
