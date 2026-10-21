# pocket

随身工具箱（pocket knife）。仓库 `pocket`，命令 `pk`。

## 结构

```text
crates/pk-core   # 纯逻辑：扫描 / 进程终止，不依赖任何 UI 库
crates/pk-cli    # 二进制 pk
```

依赖方向：`pk-cli`（及未来的 `pk-tui` / `pk-gui`）→ `pk-core`，永远单向。

## 命令

```bash
pk port 8080        # 查看端口占用（协议 / 地址 / 状态 / 进程）
pk 8080             # 便捷形式，等价于上一条
pk port 8080 -v     # 附进程详情：exe / cwd / 命令行 / 父进程
pk port             # 列出全部端口占用
pk port kill 8080   # 终止占用进程：SIGTERM → 3s 宽限 → SIGKILL
```

终止的谨慎默认：

- 单进程直接杀；多进程先列出清单、`[y/N]` 确认（`--yes` 跳过，供脚本）
- 受保护进程（数据库 / 系统组件 / Docker 后端）默认拒绝，需 `--force`
- 杀前校验启动时间，防 PID 复用误杀；杀完附等效手动命令（`kill -9 …`）

## 开发

```bash
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test --all
```

提交遵循 Conventional Commits（`feat:` / `fix:` / `refactor:`），trunk-based，直推 `main`。

## 路线图（触发线到了才做）

- `pk-tui` / `pk-gui`：core 稳定、CLI 天天在用之后
- 插件 / 子命令注册机制：有第 3 个工具时
- crates.io 发布：有外部用户时

架构决策见 [docs/decisions.md](docs/decisions.md)。
