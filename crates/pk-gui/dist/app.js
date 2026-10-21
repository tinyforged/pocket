// pk · 端口终结者 —— 前端逻辑（原生 JS，无构建步骤）
// 数据全部来自 pk-gui 的 Tauri 命令；策略与 CLI 一致：
// 单进程一键杀、受保护进程二次确认（服务端还有同名单闸兜底）。

const { invoke } = window.__TAURI__.core;

const state = {
  entries: [],
  keyword: "",
  expanded: new Set(), // 展开详情的行 key
  killing: new Set(), // 终止中的 pid
  results: new Map(), // pid -> { ok, text }
  timer: null,
};

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
const rowKey = (e) => `${e.port}/${e.protocol}/${e.localAddr}/${e.process?.pid ?? "x"}`;

/* ---------- 数据 ---------- */

async function refresh() {
  try {
    state.entries = await invoke("scan_ports", { port: null });
    render();
  } catch (err) {
    toast(`扫描失败：${err}`, true);
  }
}

function visibleEntries() {
  const k = state.keyword.trim().toLowerCase();
  if (!k) return state.entries;
  return state.entries.filter((e) => {
    const p = e.process;
    return (
      String(e.port).includes(k) ||
      (p && p.name.toLowerCase().includes(k)) ||
      (p && (p.user || "").toLowerCase().includes(k))
    );
  });
}

/* ---------- 渲染 ---------- */

function render() {
  const list = visibleEntries();
  const rows = $("rows");
  $("empty").hidden = list.length > 0;

  rows.innerHTML = list.map(rowHtml).join("");

  rows.querySelectorAll("[data-toggle]").forEach((el) =>
    el.addEventListener("click", () => {
      const key = el.dataset.toggle;
      state.expanded.has(key) ? state.expanded.delete(key) : state.expanded.add(key);
      render();
    })
  );
  rows.querySelectorAll("[data-kill]").forEach((el) =>
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      askKill(Number(el.dataset.kill));
    })
  );
  rows.querySelectorAll("[data-copy]").forEach((el) =>
    el.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await navigator.clipboard.writeText(el.dataset.copy);
      toast(`已复制：${el.dataset.copy}`);
    })
  );

  const pids = new Set(state.entries.map((e) => e.process?.pid).filter(Boolean));
  const critical = state.entries.filter((e) => e.process?.risk === "critical").length;
  $("stats").textContent =
    `${state.entries.length} 条占用 · ${pids.size} 个进程` +
    (critical ? ` · 受保护 ${critical}` : "");
}

function riskBadge(p) {
  if (!p) return '<span class="badge dim">无进程信息</span>';
  if (p.risk === "critical") return '<span class="badge crit">⚠ 受保护</span>';
  if (p.risk === "caution") return '<span class="badge warn">系统账户</span>';
  return "";
}

function rowHtml(e) {
  const p = e.process;
  const key = rowKey(e);
  const open = state.expanded.has(key);
  const killing = p && state.killing.has(p.pid);
  const result = p && state.results.get(p.pid);

  const procCell = p
    ? `<span class="pname">${esc(p.name)}</span>
       <span class="pmeta">pid ${p.pid}${p.user ? " · " + esc(p.user) : ""}</span>
       ${riskBadge(p)}`
    : '<span class="pmeta">无法获取（可能需要提权）</span>';

  const killBtn = p
    ? `<button class="btn tiny danger-ghost" data-kill="${p.pid}" ${killing ? "disabled" : ""}>
         ${killing ? '<span class="spin"></span> 终止中' : "终止"}
       </button>`
    : "";

  const resultHtml = result
    ? `<div class="row-result ${result.ok ? "ok" : "bad"}">${result.ok ? "✓" : "✕"} ${esc(result.text)}</div>`
    : "";

  const detailHtmlText = open ? detailHtml(e) : "";

  return `
    <div class="row ${p?.risk === "critical" ? "is-crit" : ""}" data-toggle="${key}" title="点击展开详情">
      <span class="c-port">${e.port}</span>
      <span class="c-proto"><i class="proto ${e.protocol}">${e.protocol.toUpperCase()}</i></span>
      <span class="c-addr">${esc(e.localAddr)}</span>
      <span class="c-state">${e.state || "—"}</span>
      <span class="c-proc">${procCell}</span>
      <span class="c-act">${killBtn}</span>
    </div>
    ${resultHtml}
    ${detailHtmlText}`;
}

function detailHtml(e) {
  const p = e.process;
  if (!p) {
    return `<div class="detail">进程信息不可见：root / 其他用户的进程需要以提权方式运行才能看到。</div>`;
  }
  const cmd = (p.cmd || []).join(" ");
  const lines = [
    ["exe", p.exe],
    ["cwd", p.cwd],
    ["cmd", cmd],
    ["ppid", p.parent != null ? String(p.parent) : null],
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<div class="d-line"><span class="d-k">${k}</span><span class="d-v">${esc(v)}</span></div>`
    )
    .join("");
  return `<div class="detail">
    ${lines || '<div class="d-line"><span class="d-v">无更多信息</span></div>'}
    <button class="btn tiny ghost" data-copy="kill -9 ${p.pid}">复制 kill -9 ${p.pid}</button>
  </div>`;
}

/* ---------- 终止流程 ---------- */

function askKill(pid) {
  const e = state.entries.find((x) => x.process?.pid === pid);
  const p = e?.process;
  if (!p) return;

  const critical = p.risk === "critical";
  const caution = p.risk === "caution";

  $("m-title").textContent = critical ? "⚠ 终止受保护进程" : "终止进程";
  $("m-title").className = critical ? "critical" : "";
  $("modal-card").className = `modal ${critical ? "critical" : ""}`.trim();
  $("m-text").innerHTML =
    `将终止 <b>${esc(p.name)}</b>（pid ${p.pid}${p.user ? "，" + esc(p.user) : ""}），` +
    "先发 SIGTERM，3 秒内未退出则升级 SIGKILL。" +
    (critical
      ? '<br><span class="crit-text">这是受保护进程（数据库 / 系统组件 / Docker 等），误杀可能丢数据、废掉整套开发环境。</span>'
      : "") +
    (caution
      ? '<br><span class="warn-text">该进程运行在系统账户下，请再次确认。</span>'
      : "");

  const info = [p.exe && `exe：${esc(p.exe)}`, p.cwd && `cwd：${esc(p.cwd)}`].filter(Boolean);
  const list = $("m-list");
  list.innerHTML = critical ? info.map((s) => `<li>${s}</li>`).join("") : "";
  list.hidden = !critical;

  $("m-ack").hidden = !critical;
  $("m-check").checked = false;
  $("m-confirm").disabled = critical; // 受保护进程必须先勾选知晓风险

  const mask = $("modal");
  mask.hidden = false;

  $("m-cancel").onclick = () => (mask.hidden = true);
  $("m-check").onchange = (ev) => ($("m-confirm").disabled = !ev.target.checked);
  $("m-confirm").onclick = async () => {
    mask.hidden = true;
    await doKill(p, critical);
  };
}

async function doKill(p, force) {
  state.killing.add(p.pid);
  state.results.delete(p.pid);
  render();
  try {
    const results = await invoke("kill_processes", {
      requests: [{ pid: p.pid, startTime: p.startTime }],
      force,
    });
    const r = results[0];
    state.results.set(p.pid, { ok: r.ok, text: r.outcome || r.message });
  } catch (err) {
    state.results.set(p.pid, { ok: false, text: String(err) });
  } finally {
    state.killing.delete(p.pid);
    await refresh();
    const res = state.results.get(p.pid);
    if (res) toast(`pid ${p.pid}：${res.text}`, !res.ok);
  }
}

/* ---------- 杂项 ---------- */

let toastTimer;
function toast(text, bad = false) {
  const t = $("toast");
  t.textContent = text;
  t.className = `toast show ${bad ? "bad" : ""}`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2800);
}

/* ---------- 初始化 ---------- */

$("search").addEventListener("input", (e) => {
  state.keyword = e.target.value;
  render();
});
$("refresh").addEventListener("click", refresh);
$("auto").addEventListener("change", (e) => {
  clearInterval(state.timer);
  state.timer = e.target.checked ? setInterval(refresh, 4000) : null;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("modal").hidden = true;
  if (e.key === "/" && document.activeElement !== $("search")) {
    e.preventDefault();
    $("search").focus();
  }
});

refresh();
