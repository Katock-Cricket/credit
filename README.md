# credit

CREDIT 采集层 monorepo（P0 阶段）。

采集桥订阅 Bitfun / foreshadow 既有事件源，按协议把事件归一成 `CreditRawEvent` 落盘到本地，不修改事件源、不向事件源抛错。

## 包结构

- `@credit/protocol` — 事件 / 行为 / 会话 / 控制协议类型与版本迁移（`packages/protocol`）
- `@credit/core` — ingress 归一化（含 Actor 标注）、存储、会话状态机、日志（`packages/core`）
- `bridges/bitfun` — Bitfun 主进程侧四桥：`foreshadow-bridge`、`accept-bridge`、`agent-bridge`、`control-api`，及挂载入口 `mount`

## 采集层规格

权威契约见 `../docs/spec/P0-事件采集层.md`。

要点：

- 编辑事件（`textChanged`）若落在 `agentToolUse(Edit)` 后 30s 窗口内，经文件级匹配被标注 `actor: 'ai'`；其余基础为 `dev`。
- `userAccept` 仅含文件清单（`fileUris`），P0 不采集 diff 行数（下游指标由 P1+ 计算器经 `gitDiff` 兜底）。

## 开发

```bash
pnpm install
pnpm -r build        # 构建 @credit/* 包
pnpm test            # 运行 vitest 全量单测
```

## 挂载（Bitfun 仓）

`bridges/bitfun` 整目录同步到 `BitFun/src/web-ui/src/tools/credit/`，由 WebUI 启动入口一行挂载 `initCreditBridge()`。详见 `docs/spec/P0-事件采集层.md` §2.6。
