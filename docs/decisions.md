# 架构决策记录（ADR）

格式：状态 / 背景 / 决策 / 后果。条目只追加不改写；改主意就写新条目并标注替代了谁。

## ADR-001：采用 Cargo workspace monorepo

- 状态：已接受（2026-10-21）
- 背景：core 与 CLI/UI 之间预期高频双向改动，跨仓库意味着每天在 `git submodule`
  或 `path = "../"` 之间折腾。multi-repo 的好处（隔离、独立发布）对自用项目没有价值。
- 决策：单仓库 Cargo workspace，`members = ["crates/*"]`，新 crate 加目录即自动收录，
  root 无需改动。
- 后果：加新工具零成本；代价是仓库只装得下"同属一个工具箱"的东西，无关项目另开仓库。

## ADR-002：pk-core 不依赖任何 UI

- 状态：已接受（2026-10-21）
- 背景：工具箱的未来形态是 CLI / TUI / GUI 多前端共用同一核心逻辑；若 core 沾上终端或
  图形库，第二个前端出现时只能重写或妥协。
- 决策：依赖方向永远单向：`pk-cli` / `pk-tui` / `pk-gui` → `pk-core`。core 禁止依赖
  clap、ratatui、tauri 等任何终端 / 图形库。平台差异用 `#[cfg(target_os)]` 切换，
  不用 feature flag。core 暴露**面向能力**的 trait（`PortScanner` / `ProcessKiller`）
  与可复用类型（`ProcessInfo` / `PortEntry` / `KillTarget` / `Privilege`）。
- 后果：第二个工具（进程清理、磁盘占用）直接复用 core 类型，不用改一行 core；
  core 的测试不依赖终端环境。约束由 CI 三平台编译兜底。

## ADR-003：CLI 先于 TUI / GUI

- 状态：已接受（2026-10-21）
- 背景：CLI 实现成本最低、迭代最快；而 CLI 的命令结构一旦定型就是最难改的兼容性承诺，
  必须在只有 1 个工具时就设计成能容纳 N 个工具。
- 决策：先做 `pk-cli`。命令结构现在定死：`pk <子命令> [动作] <参数>`（如
  `pk port 8080`、`pk port kill 8080`），裸端口便捷形式 `pk 8080` 用 optional
  positional 实现。TUI / GUI 等 core 稳定、CLI 天天在用之后再立项。
- 后果：未来加 `pk disk` / `pk proc` 不会和裸端口形式冲突；GUI 需求出现时 core 无需
  改动。命令解析行为有单元测试锁定（见 `pk-cli` tests）。
