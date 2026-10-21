//! pk-core：pocket 工具箱的核心逻辑。
//!
//! 铁律：本 crate 不依赖任何终端 / 图形库；依赖方向永远是
//! `pk-cli` / `pk-tui` / `pk-gui` → `pk-core`，单向不可逆。

pub mod kill;
pub mod model;
pub mod scan;
