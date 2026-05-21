# MyBroker 个人版 — 实现进度

> 目标用户：本人自用。主流程：**今天（记 + 经纪人）→ 历史（查 + 复盘）→ 设置（运维）**。

最后更新：2026-05-21

## 总览

| 状态 | 说明 |
|------|------|
| ✅ 已完成 | 个人版 IA、核心页面、经纪人 API、数据表、旧路由重定向 |
| 🔲 待办 | 验收脚本补充经纪人接口、README 主流程改写（可选） |

---

## Phase A — 个人版信息架构（已完成）

- [x] 导航精简为：**今天 / 历史 / 设置**
- [x] 首页 `/` → `/today`
- [x] 品牌文案改为个人「工作记忆 + AI 经纪人」
- [x] 旧页面重定向：
  - `/dashboard`、`/records`、`/action-items` → `/today`
  - `/records/history`、`/analysis`、`/reports` → `/history`
  - `/projects` → `/settings`
- [x] PWA `manifest` 描述更新

## Phase B — 今天页（已完成）

- [x] **快速记录**：文字 + 截图助手，默认今天，按钮「记下」
- [x] **今日记录列表**：就地编辑 / 删除 / 重分析（复用 `RecordCard`）
- [x] **待办**：未完成列表，勾选完成
- [x] **经纪人 · 今日优先级**：Top3 + 决策建议 + 经纪人口吻提醒
- [x] **经纪人 · 日终复盘**：Markdown 复盘（工作 + 生活边界在 prompt 中约束）

## Phase C — 经纪人后端（已完成）

- [x] 数据表 `daily_reviews`（按日缓存优先级 JSON + 复盘 Markdown）
- [x] `GET/POST /api/v2/broker/today-priorities?date=&refresh=1`
- [x] `GET/POST /api/v2/broker/daily-review?date=&refresh=1`
- [x] `src/lib/broker-advisor.ts`：LLM 生成 + 无 Key 时本地 fallback
- [x] `src/lib/broker-types.ts`：前端类型（避免客户端引入 Prisma）

## Phase D — 历史页（已完成）

- [x] 按天分组展示近 N 天记录摘要与标签
- [x] **本周小结**（复用 `/api/v2/reports/weekly`）
- [x] **导出 CSV**（复用 export API）
- [x] 按天 **查看/重新生成日复盘**

## Phase E — 设置页（已完成）

- [x] 模型健康检查（复用 `HealthBanner`）
- [x] **待办同步**（近 14 天记录 → action items）
- [x] 企业 IM 推送折叠说明 + 跳转原 `/notifications`（可选，非主路径）

## Phase F — 未纳入 / 保留 API（仍可用）

以下能力仍在代码库中，但**不在主导航**：

| 能力 | 路径 |
|------|------|
| 企业微信/飞书/钉钉推送 | `/notifications`、`/api/v2/notifications/*` |
| 数据看板统计 | `/api/v2/dashboard/*`（旧 `/dashboard` 已重定向） |
| 项目新建判断 | `/api/v2/projects/decision` |
| Agent 桥接 | `/api/agent/**` |

---

## 部署注意

新环境或本地需执行一次迁移：

```bash
npx prisma migrate deploy
# 或开发：npx prisma migrate dev
```

---

## 下一步建议（可选）

1. 在 `scripts/acceptance_phase1.sh` 增加经纪人接口冒烟（priorities + daily-review）。
2. 打开 App 时自动拉取今日优先级（已实现）；可考虑记录保存后**可选**自动刷新优先级。
3. 若长期不用推送，可从 UI 完全移除 `/notifications` 页面，仅保留 API。

---

## 变更文件索引（便于 Code Review）

- `prisma/schema.prisma` + `prisma/migrations/20260521000000_daily_reviews/`
- `src/lib/broker-advisor.ts`、`src/lib/broker-types.ts`
- `src/app/api/v2/broker/today-priorities/route.ts`
- `src/app/api/v2/broker/daily-review/route.ts`
- `src/app/today/page.tsx`、`src/app/history/page.tsx`、`src/app/settings/page.tsx`
- `src/app/nav-links.tsx`、`src/app/layout.tsx`、`src/app/page.tsx`
- `docs/implementation-progress.md`（本文件）
