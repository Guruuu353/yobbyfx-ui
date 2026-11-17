import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bot, Newspaper, AlertTriangle, BarChart3, Bell, BookOpen, CircleUser, FlaskConical,
  LayoutDashboard, LineChart, ListChecks, LogOut, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { LiveProvider, useLive } from "../context/LiveContext";
import { Chip, ErrorBoundary, Segmented, SymbolSelect } from "./ui";
import PairsModal from "./PairsModal";
import LivePrice from "./LivePrice";
import ChartModal from "./ChartModal";
import { ActivityLog, AlertsFeed, HappeningNow } from "./AlertsBoard";
import { InstallButton } from "./InstallCard";
import { applyUpdate, usePwa } from "../lib/pwa";
import { stateOf } from "../lib/brain";
import { symbolInfo } from "../lib/constants";
import { useActivity, useBoard } from "../lib/board";
import { useBridge } from "../lib/bridge";
import { KIND_STYLE as kindStyle } from "../lib/alertKinds";
import { ENTRY_TFS } from "../lib/constants";
import { cx, fmtAgo, fmtCountdown, fmtTime, timeModeLabel } from "../lib/format";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/charts", label: "Charts", icon: LineChart },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/signals", label: "Signals", icon: ListChecks },
  { to: "/market", label: "Market", icon: BarChart3 },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/backtest", label: "Backtest", icon: FlaskConical },
  { to: "/guide", label: "Manual", icon: BookOpen },
  { to: "/profile", label: "Profile", icon: CircleUser },
];
const MOBILE_MAIN = NAV.slice(0, 4);
const MOBILE_MORE = NAV.slice(4);

function ToastItem({ t }) {
  const { dismissToast, openChart, prefs } = useLive();
  const k = kindStyle[t.kind] || kindStyle.info;
  const Icon = k.icon;
  const [paused, setPaused] = useState(false);
  const left = useRef((t.secs || 0) * 1000);
  useEffect(() => {
    if (!t.secs || paused) return undefined;
    const start = Date.now(), rem = left.current;
    const h = setTimeout(() => dismissToast(t.id), rem);
    return () => { clearTimeout(h); left.current = Math.max(0, rem - (Date.now() - start)); };
  }, [paused, t.id, t.secs, dismissToast]);
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onClick={() => { dismissToast(t.id); if (t.symbol) openChart({ symbol: t.symbol, tf: prefs.entryTF, title: t.title, note: t.message }); }}
      className={cx("pointer-events-auto cursor-pointer relative overflow-hidden rounded-xl border backdrop-blur bg-panel/95 shadow-2xl p-3 flex gap-3 animate-[slidein_.25s_ease-out]", k.cls)}>
      <Icon size={22} className="shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="font-bold text-sm text-gray-100">{t.title}</div>
        <div className="text-xs text-gray-300 mt-0.5 break-words">{t.message}</div>
      </div>
      <button aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }} className="ml-auto shrink-0 self-start text-gray-500 hover:text-gray-200"><X size={14} /></button>
      {t.secs > 0 && <i className="absolute left-0 bottom-0 h-0.5 bg-current opacity-60"
        style={{ width: "100%", transformOrigin: "left", animation: `toastbar ${t.secs}s linear forwards`, animationPlayState: paused ? "paused" : "running" }} />}
    </div>
  );
}

function Toasts() {
  const { toasts } = useLive();
  return (
    <div className="fixed z-[60] top-3 right-3 left-3 sm:left-auto sm:w-96 space-y-2 pointer-events-none">
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}

function BellPanel({ onClose }) {
  const { prefs, alerts, unseen, markRead } = useLive();
  const [tab, setTab] = useState("alerts");
  const board = useBoard(prefs, { auto: false, pollMs: 15000 });
  const log = useActivity(20000);
  const live = board.rows.filter((r) => r.category === "signal" || r.category === "setup" || r.category === "watch");
  const tabs = [["alerts", `Alerts${unseen ? ` (${unseen})` : ""}`], ["now", `Happening now (${live.length})`], ["log", "Log"]];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed sm:absolute right-2 left-2 sm:left-auto top-12 sm:top-full sm:right-0 sm:mt-2 z-50 sm:w-[440px] max-h-[80vh] overflow-y-auto bg-bg border border-border rounded-2xl shadow-2xl"
        onClick={(e) => { if (e.target.closest("button[title='Open the full chart'],button[aria-label='Open chart']")) onClose(); }}>
        <div className="sticky top-0 z-10 bg-bg flex items-center gap-1 px-3 pt-3 pb-2 border-b border-border">
          <Segmented size="sm" value={tab} onChange={setTab} options={tabs.map(([value, label]) => ({ value, label }))} />
          <NavLink to="/alerts" onClick={onClose} className="ml-auto text-xs text-gold hover:underline whitespace-nowrap">Open page</NavLink>
        </div>
        <div className="p-2">
          {tab === "alerts" && <AlertsFeed limit={20} />}
          {tab === "now" && <HappeningNow board={board} entryTF={prefs.entryTF} minAgreement={prefs.minAgreement} />}
          {tab === "log" && <ActivityLog rows={log} entryTF={prefs.entryTF} limit={30} />}
        </div>
      </div>
    </>
  );
}

function AlertBell() {
  const { unseen } = useLive();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Alerts"
        className="relative w-8 h-8 rounded-lg border border-border bg-panel flex items-center justify-center hover:border-gold/50">
        <Bell size={16} className={unseen ? "text-gold" : "text-gray-400"} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bear text-[10px] font-bold flex items-center justify-center">{unseen > 9 ? "9+" : unseen}</span>
        )}
      </button>
      {open && <BellPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Status strip. The old layout stacked up to six full-height banners above every page, so the real content started
   half a screen down. Now only the most important message is shown (one slim line); the rest sit behind "+N more".
   ------------------------------------------------------------------------------------------------ */
const STRIP_TONE = {
  bear: "bg-bear/10 border-bear/40 text-bear",
  amber: "bg-amber-400/10 border-amber-400/30 text-amber-300",
  gold: "bg-gold/10 border-gold/40 text-gold",
};

function useStripItems() {
  const { error, live, lastUpdate, refresh, prefs, openChart } = useLive();
  const { updateReady } = usePwa();
  const d = live?.data;
  const items = [];
  if (error) {
    const offline = /offline|cannot reach/i.test(error);
    items.push({ key: "err", tone: "bear", icon: AlertTriangle,
      text: <><b>Data feed problem:</b> <span className="break-words">{error}</span>
        {lastUpdate ? <span className="opacity-80"> · showing last good data ({fmtAgo(Math.floor(lastUpdate / 1000))})</span> : null}
        {offline ? <span className="opacity-80"> · start the backend with <code className="bg-black/30 px-1 rounded">./run_backend.sh</code></span> : null}</>,
      action: <button onClick={refresh} className="underline shrink-0">Retry</button> });
  }
  const n = live?.signal?.news;
  if (n && n.filter !== "off") {
    const now = Math.floor(Date.now() / 1000);
    const w = n.blackout || (n.next && n.next.start - now <= 3600 ? n.next : null);
    if (w) {
      const on = !!n.blackout;
      items.push({ key: "news", tone: on ? "bear" : "amber", icon: Newspaper,
        text: <><b>{on ? "News blackout, signals paused:" : "High-impact news soon:"}</b> {w.label} · {on ? `resumes ~${fmtTime(w.end)}` : `pauses ${fmtTime(w.start)} (in ${fmtCountdown(w.start)})`}</> });
    }
  }
  const b = live?.signal?.brain;
  const s = b && ["BUY", "SELL"].map((k) => b.sides[k]).filter((x) => (x.state === "ready" || x.state === "fire")
    && (x.counter ? prefs.alertCounter !== false : prefs.alertReady !== false)).sort((a, c) => c.pct - a.pct)[0];
  if (s) {
    const st = stateOf(s);
    items.unshift({ key: "ready", box: st.box, blink: s.counter ? "blink-counter" : st.blink, icon: null,
      text: <><b className={s.direction === "BUY" ? "text-bull" : "text-bear"}>{s.direction} {s.state === "fire" ? "signal" : "READY"}</b>
        <span className="text-gray-200"> {symbolInfo(prefs.symbol).short} · {s.pct}% · {s.counter ? "counter-trend" : "with the trend"}</span></>,
      action: <span className="text-gold shrink-0">Open</span>,
      onClick: () => openChart({ symbol: prefs.symbol, tf: prefs.entryTF, title: `${s.direction} ready` }) });
  }
  if (updateReady) items.push({ key: "upd", tone: "gold", text: <b>A new version of GoldSignal is ready.</b>,
    action: <button onClick={applyUpdate} className="px-2 py-0.5 rounded-md bg-gold text-black font-semibold shrink-0">Update</button> });
  if (d?.demo) items.push({ key: "demo", tone: "amber", text: <><b>DEMO DATA</b> - synthetic prices for testing. Do not trade off these signals.</> });
  if (d && !d.demo && d.stale && !error) {
    items.push({ key: "stale", tone: "amber", text: <>Price feed ~<b>{Math.max(1, Math.round((d.lag_sec || 0) / 60))} min behind</b> ({d.source}); signals paused until it catches up.</> });
  }
  return items;
}

function StatusBanners() {
  const items = useStripItems();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const shown = open ? items : items.slice(0, 1);
  return (
    <div className="space-y-1">
      {shown.map((it) => {
        const Icon = it.icon;
        const cls = cx("w-full text-left flex items-center gap-2 text-xs rounded-lg border px-2.5 py-1.5 leading-snug",
          it.box || STRIP_TONE[it.tone], it.blink);
        const inner = (<>
          {Icon ? <Icon size={14} className="shrink-0" /> : <span className="w-2 h-2 rounded-full bg-current blink-text shrink-0" />}
          <span className="min-w-0 flex-1">{it.text}</span>
          {it.action}
        </>);
        return it.onClick
          ? <button key={it.key} type="button" onClick={it.onClick} className={cls}>{inner}</button>
          : <div key={it.key} className={cls}>{inner}</div>;
      })}
      {items.length > 1 && (
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-gray-500 hover:text-gray-300 px-1">
          {open ? "Show less" : `+${items.length - 1} more notice${items.length > 2 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

function BridgeChip() {
  const { data } = useBridge({ pollMs: 20000, orders: false });
  if (!data || data.config.mode === "off") return null;
  const auto = data.config.mode === "auto";
  return (
    <NavLink to="/profile#expert" title={data.connected ? "MetaTrader 5 is linked" : "MetaTrader 5 EA is not connected"}
      className={cx("hidden md:flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg border",
        data.connected ? "border-bull/40 text-bull bg-bull/10" : "border-amber-400/40 text-amber-300 bg-amber-400/10")}>
      <Bot size={13} /> MT5 {auto ? "AUTO" : "MANUAL"}{!data.connected && " · offline"}
    </NavLink>
  );
}

function TopBar() {
  const { prefs, setPref, refresh, loading, live, lastUpdate } = useLive();
  const d = live?.data;
  const btn = "w-8 h-8 rounded-lg border border-border bg-panel flex items-center justify-center hover:border-gold/50";
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border">
      <div className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-5 lg:px-6 h-11">
        <div className="hidden sm:flex lg:hidden w-7 h-7 rounded-md bg-gradient-to-br from-gold to-yellow-600 items-center justify-center font-black text-black text-sm">G</div>
        <SymbolSelect value={prefs.symbol} onChange={(v) => setPref("symbol", v)}
          className="bg-panel border border-border rounded-lg px-2 h-8 text-sm font-semibold outline-none focus:border-gold max-w-[32vw] sm:max-w-none" />
        <div className="px-2 py-0.5 rounded-lg border border-border bg-panel text-sm"><LivePrice /></div>
        <select value={prefs.entryTF} onChange={(e) => setPref("entryTF", e.target.value)} aria-label="Entry timeframe"
          className="sm:hidden bg-panel border border-border rounded-lg px-1.5 h-8 text-xs font-semibold outline-none">
          {ENTRY_TFS.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
          <Segmented size="sm" options={ENTRY_TFS} value={prefs.entryTF} onChange={(v) => setPref("entryTF", v)} />
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <BridgeChip />
          <div className="hidden 2xl:flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
            <span className={cx("w-2 h-2 rounded-full", d?.stale || !lastUpdate ? "bg-amber-400" : "bg-bull animate-pulse")} />
            {lastUpdate ? `Analysis ${fmtAgo(Math.floor(lastUpdate / 1000))}` : "Connecting…"}
            <span className="text-gray-600">· {timeModeLabel(prefs.timeMode)}</span>
            {d?.lag_sec != null && <span className="text-gray-600">· lag {d.lag_sec < 90 ? `${d.lag_sec}s` : `${Math.round(d.lag_sec / 60)}m`}</span>}
            {d?.demo && <Chip tone="amber">DEMO</Chip>}
          </div>
          <InstallButton className="hidden sm:flex" />
          <button onClick={refresh} aria-label="Refresh" className={cx(btn, "hidden sm:flex")}>
            <RefreshCw size={14} className={cx("text-gray-400", loading && "animate-spin")} />
          </button>
          <AlertBell />
        </div>
      </div>
    </header>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { prefs, chartItem, closeChart, pairsOpen } = useLive();
  const loc = useLocation();
  const [more, setMore] = useState(false);
  return (
    <div className="min-h-screen bg-bg text-gray-100 lg:pl-60">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border bg-panel/60 px-3 py-5">
        <div className="flex items-center gap-2.5 px-2 mb-7">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center font-black text-black">G</div>
          <div><div className="font-bold leading-tight">Gold<span className="text-gold">Signal</span></div><div className="text-[10px] text-gray-500 uppercase tracking-wider">4H → 1H → 5/15m</div></div>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cx("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive ? "bg-gold/10 text-gold" : "text-gray-400 hover:text-gray-100 hover:bg-white/5")}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border pt-3 flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-bold">{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{user?.name}</div><div className="text-[11px] text-gray-500 truncate">@{user?.username}</div></div>
          <button onClick={logout} aria-label="Log out" className="p-2 text-gray-500 hover:text-bear"><LogOut size={16} /></button>
        </div>
      </aside>

      <TopBar />
      <main className="px-3 sm:px-5 lg:px-6 py-3 pb-24 lg:pb-8 max-w-[1700px] mx-auto space-y-3" key={loc.pathname}>
        <StatusBanners />
        <ErrorBoundary resetKey={`${loc.pathname}|${prefs.symbol}|${prefs.entryTF}`}><Outlet /></ErrorBoundary>
      </main>

      {/* mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_MAIN.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cx("flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium", isActive ? "text-gold" : "text-gray-500")}>
            <Icon size={20} />{label}
          </NavLink>
        ))}
        <button onClick={() => setMore((v) => !v)} className={cx("flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium", MOBILE_MORE.some((n) => loc.pathname.startsWith(n.to)) ? "text-gold" : "text-gray-500")}>
          <MoreHorizontal size={20} />More
        </button>
      </nav>
      {more && (
        <>
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMore(false)} />
          <div className="lg:hidden fixed z-50 right-2 bottom-[calc(4.2rem+env(safe-area-inset-bottom))] w-56 bg-panel border border-border rounded-2xl shadow-2xl p-1.5">
            {MOBILE_MORE.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={() => setMore(false)}
                className={({ isActive }) => cx("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium", isActive ? "bg-gold/10 text-gold" : "text-gray-300")}>
                <Icon size={18} />{label}
              </NavLink>
            ))}
          </div>
        </>
      )}
      {pairsOpen && <PairsModal />}
      {chartItem && <ChartModal key={`${chartItem.symbol}-${chartItem.tf}-${chartItem.title}`} item={chartItem} onClose={closeChart} />}
      <Toasts />
    </div>
  );
}

export default function Layout() {
  return (
    <LiveProvider>
      <Shell />
    </LiveProvider>
  );
}
