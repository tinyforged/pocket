#!/usr/bin/env bash
# 发版脚本：统一改版本号 → 提交 → 打 tag → 推送（推送 tag 触发 release CI）
#
# 用法：
#   scripts/release.sh                 # 自动顺延：0.1.0-alpha.5 → 0.1.0-alpha.6；0.1.0 → 0.1.1
#   scripts/release.sh 0.1.0-beta.1    # 显式指定版本（可带 v 前缀）
#   scripts/release.sh --yes 0.1.0     # 跳过推送确认（非交互场景）
#
# 版本号同步三处：根 Cargo.toml（workspace 单一来源）、tauri.conf.json、前端 package.json。
# tag 与版本号出自同一来源，杜绝 tag 和应用版本错位（如 alpha.4 事故）。
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CARGO_TOML="Cargo.toml"
TAURI_CONF="crates/pk-gui/tauri.conf.json"
FRONT_PKG="crates/pk-gui/frontend/package.json"

die() { echo "错误：$*" >&2; exit 1; }

ASSUME_YES=0
VERSION_ARG=""
for arg in "$@"; do
  case $arg in
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) VERSION_ARG=$arg ;;
  esac
done

# --- 前置检查 ---
BRANCH=$(git branch --show-current)
[ "$BRANCH" = "main" ] || die "当前在 $BRANCH 分支，请在 main 上发版"
git diff --quiet && git diff --cached --quiet || die "工作区有未提交改动，先处理再发版"
git fetch --quiet origin main
git merge-base --is-ancestor origin/main HEAD || die "本地 main 落后于 origin/main，先 git pull"

# --- 确定新版本 ---
CUR=$(sed -n 's/^version = "\(.*\)"$/\1/p' "$CARGO_TOML" | head -n 1)
[ -n "$CUR" ] || die "未能从 $CARGO_TOML 读到 workspace version"

SEMVER_RE='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$'
if [ -n "$VERSION_ARG" ]; then
  NEW=${VERSION_ARG#v}
  [[ $NEW =~ $SEMVER_RE ]] || die "版本号格式不对：$NEW（示例：0.1.0 / 0.1.0-alpha.4）"
else
  case $CUR in
    *-alpha.*|*-beta.*|*-rc.*)
      base=${CUR%%-*}; pre=${CUR##*-}
      NEW="$base-${pre%%.*}.$((${pre#*.} + 1))"
      ;;
    *)
      rest=${CUR#*.}
      NEW="${CUR%%.*}.${rest%%.*}.$((${rest##*.} + 1))"
      ;;
  esac
fi
[ "$NEW" != "$CUR" ] || die "新版本与当前版本相同：$CUR"
git rev-parse -q --verify "refs/tags/v$NEW" >/dev/null && die "tag v$NEW 已存在"

# --- 同步三处版本号 ---
# 注意 \${1}：不加花括号时 \$1 紧跟版本号首位数字会被 perl 当成 \$10 捕获组
perl -pi -e "s/(^version\s*=\s*\")[^\"]*/\${1}$NEW/" "$CARGO_TOML"
perl -pi -e "s/(\"version\"\s*:\s*\")[^\"]*/\${1}$NEW/" "$TAURI_CONF" "$FRONT_PKG"
for f in "$CARGO_TOML" "$TAURI_CONF" "$FRONT_PKG"; do
  grep -q "\"$NEW\"" "$f" || die "$f 未能写入新版本号"
done

echo "版本：$CUR → $NEW"
git add "$CARGO_TOML" "$TAURI_CONF" "$FRONT_PKG"
git commit -m "chore(release): v$NEW"
git tag -a "v$NEW" -m "v$NEW"

# --- 推送 ---
if [ "$ASSUME_YES" -eq 0 ]; then
  [ -t 0 ] || die "非交互环境请在版本号前加 --yes"
  read -r -p "推送 main 与 v$NEW 触发 release CI？[y/N] " ans
  case $ans in
    y|Y|yes|YES) ;;
    *) echo "已中止：提交与 tag 留在本地未推送"; exit 1 ;;
  esac
fi
git push origin main
git push origin "v$NEW"

echo
echo "完成。CI 转绿后到 Releases → Drafts 手动发布（勿勾 pre-release，否则 releases/latest 拿不到 latest.json）。"
