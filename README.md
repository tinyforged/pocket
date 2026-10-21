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
pk port 8080        # 查看端口占用
pk 8080             # 便捷形式，等价于上一条
pk port kill 8080   # 杀掉占用端口的进程
pk port             # 列出全部端口占用
```

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
