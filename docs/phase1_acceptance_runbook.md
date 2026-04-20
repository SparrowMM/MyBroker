# MyBroker Phase 1 验收 Runbook

## 目标
验证核心链路：`输入文本/截图 -> 百炼分析 -> Supabase 存储 -> 项目新建判断 -> 周月报输出`。

## 前置准备
- 在 `.env` 中配置：
  - `DATABASE_URL`（建议 Supabase Postgres）
  - `BAILIAN_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET`
- 首次初始化数据库（迁移）：
  - `alembic upgrade head`

## 启动方式
- 后端：
  - `uvicorn main:app --reload --host 127.0.0.1 --port 8002`
- Next 前台（可选）：
  - `cd frontend && npm install`
  - `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8002 npm run dev`

## 自动化验收
执行：

```bash
API_BASE=http://127.0.0.1:8002 ./scripts/acceptance_phase1.sh
```

脚本覆盖检查项：
- 健康检查
- 创建日报并触发分析
- 项目新建判断
- 周报/月报查询
- Dashboard 聚合查询

## 人工补充验收
- 打开 `http://127.0.0.1:8002/` 验证内置前台：
  - 上传截图返回 URL
  - 提交日报成功返回分析结果
- 打开 `http://127.0.0.1:3000/records`（Next 前台）：
  - 上传截图并提交日报
  - 在 `analysis/reports/projects` 页面获取对应结果
- 在 Supabase 控制台验证：
  - `daily_records` 有新增行
  - 对应 bucket 下有截图对象

## 常见问题
- 百炼调用失败：检查 `BAILIAN_API_KEY` 与 `BAILIAN_BASE_URL`
- Supabase 上传失败：检查 `SUPABASE_SERVICE_ROLE_KEY` 与 bucket 名
- 数据库连不上：检查 `DATABASE_URL`，若用 pooler 确认网络白名单与 SSL 配置
