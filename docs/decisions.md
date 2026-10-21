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

## ADR-004：扫描与终止的跨平台实现选型 netstat2 + sysinfo

- 状态：已接受（2026-10-21）
- 背景：端口→PID 映射与进程详情需要三平台一致的行为。自写三套平台代码
  （Linux `/proc`、macOS libproc、Windows IP Helper）成本高且每个平台都是
  一次试错；骨架阶段预留了按平台的空实现文件。
- 决策：采用 netstat2（套接字与 PID 归属）+ sysinfo（进程详情、终止信号）
  组合，删掉按平台文件，收敛为 `scan/sys.rs` / `kill/sys.rs` 单实现。
  ADR-002 的 `cfg(target_os)` 规则不变——将来某平台确需特化时再拆分支。
  终止策略"先礼后兵"：unix 先 SIGTERM、宽限 3 秒、超时 SIGKILL；
  Windows 无优雅信号，直接 TerminateProcess。
- 后果：
  - core 依赖面变大（两个系统级 crate）；
  - 非提权时他人/root 进程可能拿不到 PID（macOS libproc、Linux `/proc`
    均受属主限制），呈现为"无法获取进程（可能需要提权）"而非报错；
  - netstat2 会返回 port 0 与同进程重复条目，已在 core 过滤 / 去重
    （去重键含 pid：SO_REUSEPORT 多进程共享端口是真实占用，不能折叠）；
  - sysinfo 0.39 的 MSRV 为 1.95，高于 workspace 声明的 1.85；工具链已锁
    1.95，CI 同版本，声明值暂不动。

## ADR-005：终止的谨慎默认（多进程确认、受保护名单、PID 复用校验）

- 状态：已接受（2026-10-21）
- 背景：开发当天实测就踩了雷：`pk port kill 18080` 时端口上除了测试进程
  还有一个无关的 `go run` 网关，无确认的批量杀把它一并终止。多进程端口的
  "一键全杀"代价不可控；误杀数据库 / Docker 后端更是灾难级。
- 决策（CLI 层策略，core 只提供分级）：
  - 单进程 = 一键直杀（产品核心体验）；多进程 = 列出清单 + `[y/N]` 总确认，
    `--yes` 供脚本跳过；
  - `RiskLevel::Critical`（系统核心 / 数据库 / Docker 等，见
    `model.rs` 受保护名单）默认拒绝终止，需 `--force`；`Caution`
  （root / 系统账户属主）打警告但放行；
  - 杀前以启动时间校验 PID 未被复用（`KillTarget::expect_start_time`），
    校验失败直接中止；
  - 杀完输出等效手动命令（`kill -9 …` / `taskkill /F /PID …`），
    把操作权还给终端。
- 后果：交互多一步，但与误杀代价相比可忽略；TUI / GUI 出现时沿用同一
  `RiskLevel` 分级，策略只写一次。

## ADR-006：GUI 选型 Tauri 2 + 无 node 静态前端

- 状态：已接受（2026-10-21）
- 背景：设计文档候选 Tauri / egui，要求"高颜值"。egui 自带字体没有
  CJK 字形，而 macOS / Windows 的系统中文字体几乎都是 `.ttc` 集合，
  egui 的字体引擎（ab_glyph）不支持，意味着必须内嵌十几 MB 字体或
  运行时找 `.ttf`；Tauri 走系统 WebView，中文渲染与全套字体能力免费
  获得，CSS 的表现力就是"颜值"的上限。
- 决策：Tauri 2，前端为 `pk-gui/dist/` 下的原生 HTML/CSS/JS（无 node、
  无打包器），通过 `withGlobalTauri` + `window.__TAURI__.core.invoke`
  调用命令；命令层（`pk-gui/src/main.rs`）只做 pk-core 能力暴露与
  DTO 适配，core 一行不动，铁律不破。终止策略与 CLI 一致：单进程
  确认即杀，Critical 红色二次确认（勾选知晓风险才可点），服务端杀前
  重扫并执行同一份受保护名单闸。
- 后果：改前端需重新编译（无热载，`cargo run -p pk-gui` 即可）；
  Linux CI 需安装 webkit2gtk 系统依赖；工作区依赖树显著变大
  （tauri 全家桶），但只落在 `pk-gui`，core / cli 不受影响。
