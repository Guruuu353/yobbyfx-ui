import React, { useEffect, useMemo, useState } from "react";
import { Bot, Check, Download, KeyRound, Link2, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import api from "../api";
import { useLive } from "../context/LiveContext";
import { Card, Chip, Segmented, Toggle } from "./ui";
import { ORDER_LABEL, ORDER_TONE, useBridge } from "../lib/bridge";
import { SYMBOLS, SYMBOL_GROUPS, symbolInfo } from "../lib/constants";
import { cx, errText, fmtAgo, fmtPrice } from "../lib/format";

const GRADES = ["C", "B", "A", "A+"];

const money = (v, cur) => (v == null ? "—" : `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? " " + cur : ""}`);
const pl = (v) => (v == null ? "text-gray-300" : v > 0 ? "text-bull" : v < 0 ? "text-bear" : "text-gray-300");

/** Live account + feed + open positions, straight from the terminal (refreshed every poll of the EA, ~2 s). */
const hhmm = (t) => (t ? new Date(t * 1000).toISOString().slice(11, 16) + " UTC" : "?");

function LivePanel({ data, orders, onAct, busy, onSync, syncing }) {
  const a = data?.account;
  const pos = data?.positions || [];
  const feed = Object.entries(data?.feed || {});
  const clk = data?.clock || {};
  const byId = Object.fromEntries((orders || []).map((o) => [o.id, o]));
  const dg = data?.diag || {};
  if (!data?.connected && !a && !dg.polls) return null;
  const stale = !data?.connected;
  const cfgNow = data?.config || {};
  const realBlocked = a && a.demo === false && (cfgNow.demo_only || a.allow_live === false);
  return (
    <div className="mt-4 rounded-xl border border-border bg-bg/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Live from MT5</div>
        {stale && <span className="text-[11px] text-amber-400">EA offline — last known values</span>}
      </div>
      {realBlocked && (
        <div className="mt-2 text-xs rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-200 p-2">
          <ShieldAlert size={13} className="inline -mt-0.5 mr-1" />This is a <b>REAL account</b>, so trading is locked until both switches are on:
          {cfgNow.demo_only ? <> untick <b>Demo accounts only</b> (Show advanced → below) and save</> : <> <span className="text-bull">app switch ✓</span></>}
          {a.allow_live === false ? <>; set <b>InpAllowLiveAccount = true</b> in the EA's Inputs tab (MT5 → drag the EA again)</> : <>; <span className="text-bull">EA switch ✓</span></>}.
        </div>
      )}
      {a && (
        <div className="mt-2 text-[11px] text-gray-400">
          Account <b className="text-gray-200">#{a.login}</b> · {a.company || a.server} · <b className={a.demo === false ? "text-amber-300" : "text-gray-200"}>{a.demo === false ? "REAL" : "DEMO"}</b>{a.leverage ? ` · 1:${a.leverage}` : ""}
          {a.balance <= 0 && <span className="text-bear"> · this terminal reports a balance of 0 — orders cannot be sized or placed. In MT5 make sure you are logged into the funded account (File → Login).</span>}
        </div>
      )}
      {a && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Balance</div><div className="tabular-nums text-sm">{money(a.balance, a.currency)}</div></div>
          <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Equity</div><div className="tabular-nums text-sm">{money(a.equity, a.currency)}</div></div>
          <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Floating P/L</div><div className={cx("tabular-nums text-sm", pl(a.profit))}>{money(a.profit, a.currency)}</div></div>
          <div className="bg-panel2 rounded-lg p-2"><div className="text-gray-500">Free margin</div><div className="tabular-nums text-sm">{money(a.margin_free, a.currency)}{a.margin_level ? <span className="block text-[10px] text-gray-600">level {Number(a.margin_level).toFixed(0)}%</span> : null}</div></div>
        </div>
      )}
      {feed.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {feed.map(([sym, f]) => (
            <span key={sym} className={f.live ? "text-bull" : "text-amber-400"} title={f.why || ""}>
              {symbolInfo(sym).short}: {f.live ? `live (${f.age_sec}s)` : `Yahoo fallback — ${f.why || "waiting for the EA"}`}
            </span>
          ))}
        </div>
      )}
      {data?.connected && data?.last_seen && (Date.now() / 1000 - data.last_seen) > 15 && (
        <div className="mt-2 text-[11px] text-amber-400">
          The EA last polled {Math.round(Date.now() / 1000 - data.last_seen)} s ago, so candles may use the delayed Yahoo feed until it recovers.
          {dg.hist && dg.hist !== "done" ? ` It is busy sending history (${dg.hist}).` : " Check the VPS load and the MT5 connection."}
        </div>
      )}
      {dg.hist && dg.hist !== "done" && <div className="mt-1 text-[11px] text-gray-500">Sending MT5 history to the app: {dg.hist} (runs in the background, the live feed has priority).</div>}
      {a && a.demo !== undefined && (a.terminal_trade_allowed === false || a.mql_trade_allowed === false || a.account_trade_allowed === false || a.trade_expert === false || a.connected === false) && (
        <div className="mt-2 text-xs rounded-lg border border-bear/40 bg-bear/10 text-red-200 p-2">
          <b>MT5 will not place trades yet:</b>
          {a.connected === false && <div>• MT5 is not connected to the broker.</div>}
          {a.terminal_trade_allowed === false && <div>• The Algo Trading button in the MT5 toolbar is OFF — press it so it turns green.</div>}
          {a.mql_trade_allowed === false && <div>• This EA has no permission: remove it, drag it on again and tick “Allow Algo Trading” in the Common tab.</div>}
          {a.account_trade_allowed === false && <div>• This account is <b>read-only</b>: you are logged in with the <b>investor</b> password (or the broker disabled trading). In MT5: File → Login to Trade Account and use the master (trading) password.</div>}
          {a.trade_expert === false && <div>• Your broker does not allow Expert Advisors on this account type.</div>}
        </div>
      )}
      {(dg.polls > 0) && (
        <div className="mt-2 text-[11px] text-gray-500">
          Link health: {dg.last_poll_ms != null ? `server answers in ${dg.last_poll_ms} ms` : "—"} · {dg.live_bars_in != null ? `${dg.live_bars_in} live candles in the last poll` : ""}
          {dg.ea_err && <span className="text-amber-400"> · EA reports: {dg.ea_err}</span>}
          {dg.last_error && <span className="text-bear"> · server problem: {dg.last_error}</span>}
        </div>
      )}
      {clk.skew_sec != null && Math.abs(clk.skew_sec) > 300 && (
        <div className="mt-2 text-[11px] text-amber-400">
          Two clocks disagree by {Math.round(Math.abs(clk.skew_sec) / 60)} min: your MT5 PC thinks it is {hhmm(clk.ea_utc)}, this server thinks {hhmm(clk.server_utc)}.
          One of them has the wrong time or time zone (set the VPS time zone, not the clock). Check against time.is.
        </div>
      )}
      {clk.server_offset != null && (
        <div className="mt-2 text-[11px] text-gray-400">
          Broker clock: <b className="text-gray-200">GMT{clk.server_offset >= 0 ? "+" : ""}{clk.server_offset}</b>
          {clk.mismatch && (
            <span className="text-amber-400"> · the app assumed GMT{clk.model_offset >= 0 ? "+" : ""}{clk.model_offset} for 4H/Daily candles.
              <button disabled={syncing} onClick={onSync} className="ml-1 underline text-gold">Match my MT5 clock</button></span>
          )}
        </div>
      )}
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Open positions ({pos.length})</div>
      {pos.length === 0 ? <div className="text-xs text-gray-600 py-2">No open positions in this terminal.</div> : (
        <div className="mt-1 overflow-x-auto">
          {pos.map((p) => {
            const o = p.id ? byId[p.id] : null;
            const buy = p.type === "BUY";
            const dec = symbolInfo(o?.symbol || "").precision ?? 2;
            return (
              <div key={p.ticket} className="flex items-center gap-2 py-1.5 border-t border-border/60 text-xs min-w-[520px]">
                <span className={cx("font-bold w-9", buy ? "text-bull" : "text-bear")}>{p.type}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-gray-200 truncate">{p.symbol} <span className="text-gray-500">· {p.volume} lots · @ {fmtPrice(p.open, dec)}{o?.kind && o.kind !== "signal" ? ` · ${o.kind}${o.kind === "early" ? (o.confirmed ? " (confirmed)" : " (waiting for signal)") : ""}` : ""}{!p.id ? " · not from GoldSignal" : ""}</span></div>
                  <div className="text-[11px] text-gray-500 truncate">SL {p.sl ? fmtPrice(p.sl, dec) : "—"} · TP {p.tp ? fmtPrice(p.tp, dec) : "—"} · now {fmtPrice(p.price, dec)}{o?.manage_note ? ` · ${o.manage_note}` : ""}</div>
                </div>
                <span className={cx("tabular-nums font-semibold", pl(p.profit))}>{money(p.profit)}</span>
                {o && o.status === "open" && !o.close_requested &&
                  <button disabled={busy} onClick={() => onAct(o.id, "close")} className="px-2 py-1 rounded-lg border border-bear/50 text-bear">Close</button>}
                {o?.close_requested && <span className="text-[10px] text-amber-400">closing…</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function guessApiUrl() {
  const env = import.meta.env.VITE_API_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  if (window.location.port === "5173") return `${window.location.protocol}//${window.location.hostname}:8000`;   // local dev
  return `${window.location.origin}/api`;                                                                    // Docker / nginx: the UI proxies /api to the backend
}

function Num({ label, value, onChange, step = 1, min, max, hint, suffix }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-gray-400 mb-1">{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="number" inputMode="decimal" value={value} step={step} min={min} max={max}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full bg-bg border border-border rounded-lg px-2.5 h-9 text-sm outline-none focus:border-gold tabular-nums" />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </span>
      {hint && <span className="block text-[10px] text-gray-600 mt-0.5 leading-snug">{hint}</span>}
    </label>
  );
}

function Group({ title, children, cols = "grid-cols-2 sm:grid-cols-3" }) {
  return (
    <div className="mt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</div>
      <div className={cx("grid gap-3", cols)}>{children}</div>
    </div>
  );
}

function OrderRow({ o, onAct, busy }) {
  const dec = symbolInfo(o.symbol).precision;
  const buy = o.direction === "BUY";
  return (
    <div className="flex items-center gap-2 py-2 border-t border-border/60 text-xs">
      <span className={cx("font-bold w-9", buy ? "text-bull" : "text-bear")}>{o.direction}</span>
      <div className="min-w-0 flex-1">
        <div className="text-gray-200 truncate">{o.broker_symbol} <span className="text-gray-500">· {o.kind === "early" ? `early (brain ${o.brain_pct ?? "?"}%)` : o.kind === "topup" ? "top-up" : o.style || "swing"}{o.signal_id ? ` · signal #${o.signal_id}` : ""}</span></div>
        <div className="text-[11px] text-gray-500 truncate">
          {o.fill_price ? `filled ${fmtPrice(o.fill_price, dec)}` : `entry ${fmtPrice(o.entry, dec)}`}
          {o.lots ? ` · ${o.lots} lots` : ""}{o.status === "open" && o.profit_now != null ? ` · P/L ${o.profit_now}` : o.profit != null ? ` · P/L ${o.profit}` : ""}
          {o.note ? ` · ${o.note}` : ""} · {fmtAgo(o.created_at)}
        </div>
      </div>
      <Chip tone={ORDER_TONE[o.status] || "gray"}>{ORDER_LABEL[o.status] || o.status}</Chip>
      {o.status === "awaiting" && <>
        <button disabled={busy} onClick={() => onAct(o.id, "send")} className="px-2.5 py-1 rounded-lg bg-gold text-black font-semibold">Send</button>
        <button disabled={busy} onClick={() => onAct(o.id, "skip")} className="px-2 py-1 rounded-lg border border-border text-gray-400">Skip</button>
      </>}
      {o.status === "queued" && <button disabled={busy} onClick={() => onAct(o.id, "cancel")} className="px-2 py-1 rounded-lg border border-border text-gray-400">Cancel</button>}
      {(o.status === "open" || o.status === "sent") && !o.close_requested && o.ticket &&
        <button disabled={busy} onClick={() => onAct(o.id, "close")} className="px-2 py-1 rounded-lg border border-bear/50 text-bear">Close</button>}
      {o.close_requested && o.status !== "closed" && <span className="text-[10px] text-amber-400">closing…</span>}
      {(o.status === "skipped" || o.status === "expired") &&
        <button disabled={busy} onClick={() => onAct(o.id, "send")} title="Send it to MT5 anyway" className="px-2 py-1 rounded-lg border border-border text-gray-500 hover:text-gold">Send anyway</button>}
    </div>
  );
}

export default function BridgeCard() {
  const { prefs, bumpData, savePairs, openPairs } = useLive();
  const { data, orders, err, reload, setData } = useBridge({ pollMs: 3000 });
  const [cfg, setCfg] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [token, setToken] = useState(null);       // plain token: only known right after it was created
  const [apiUrl, setApiUrl] = useState(() => { try { return localStorage.getItem("gs_ea_url") || guessApiUrl(); } catch { return guessApiUrl(); } });
  const [adv, setAdv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { if (data && (!cfg || !dirty)) setCfg(data.config); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setDirty(true); setMsg(null); };

  const pairs = cfg?.pairs || [];
  const togglePair = (v) => { const next = pairs.includes(v) ? pairs.filter((x) => x !== v) : [...pairs, v]; set("pairs", next); savePairs(next); };   // same list as "My pairs"
  const grouped = useMemo(() => SYMBOL_GROUPS.map((g) => [g, SYMBOLS.filter((s) => s.group === g)]), []);

  async function save(patch = {}) {
    setSaving(true); setMsg(null);
    try {
      const body = { ...cfg, ...patch };
      const r = await api.put("/bridge/config", body);
      setData(r.data); setCfg(r.data.config); setDirty(false);
      setMsg({ ok: true, text: "Saved. The server now scans your allowed pairs around the clock." });
      reload();
    } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setSaving(false); }
  }

  async function newToken() {
    if (data?.has_token && !window.confirm("Make a new token? The EA that is running now will be disconnected until you install the new file.")) return;
    setBusy(true);
    try { const r = await api.post("/bridge/token"); setToken(r.data.token); setData(r.data); }
    catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setBusy(false); }
  }
  async function revoke() {
    if (!window.confirm("Disconnect MetaTrader 5? The EA stops working until you create a new token.")) return;
    setBusy(true);
    try { const r = await api.delete("/bridge/token"); setToken(null); setData(r.data); } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setBusy(false); }
  }
  async function downloadEA() {
    try { localStorage.setItem("gs_ea_url", apiUrl); } catch { /* ignore */ }
    try {
      const r = await api.post("/bridge/ea-file", { token, api_url: apiUrl }, { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data); a.download = "GoldSignalBridge.mq5"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { setMsg({ ok: false, text: "Could not build the EA file: " + errText(e) }); }
  }
  async function syncClock() {
    setSyncing(true);
    try { const r = await api.post("/bridge/clock/sync"); setData(r.data); bumpData(); setMsg({ ok: true, text: "Candle clock now matches your MT5 server." }); }
    catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setSyncing(false); }
  }
  async function act(id, action) {
    setBusy(true);
    try { await api.post(`/bridge/orders/${id}/${action}`); await reload(); } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setBusy(false); }
  }

  if (!cfg) return <Card title="Expert · MetaTrader 5 bridge" icon={Bot}><div className="text-sm text-gray-500">{err ? String(err.message || err) : "Loading…"}</div></Card>;

  const acct = data?.account;
  const connected = data?.connected;
  const live = acct && acct.demo === false;
  const copyDash = () => {
    setCfg((c) => ({ ...c, entry_tf: prefs.entryTF, rr: prefs.rr, min_agreement: prefs.minAgreement, sens: prefs.sens, scalp: !!prefs.scalp, sessions_only: !!prefs.sessionsOnly }));
    setDirty(true);
  };
  const sc = data?.scanner;

  return (
    <Card id="expert" title="Expert · MetaTrader 5 bridge" icon={Bot}
      right={<Chip tone={connected ? "bull" : data?.has_token ? "amber" : "gray"}>{connected ? <><Wifi size={11} /> EA connected</> : <><WifiOff size={11} /> {data?.has_token ? "EA not connected" : "not linked"}</>}</Chip>}>
      <p className="text-xs text-gray-400 leading-relaxed">
        Let your signals reach your MetaTrader 5 account. <b className="text-gray-200">Manual</b>: each signal for an allowed pair waits for your tap on “Send”.
        {" "}<b className="text-gray-200">Auto</b>: the server places it for you the moment the engine fires, 24/5, even with this page closed.
        Only the pairs you tick below are ever scanned or traded.
      </p>

      {/* ---- mode */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Segmented value={cfg.mode} onChange={(v) => set("mode", v)}
          options={[{ value: "off", label: "Off" }, { value: "manual", label: "Manual" }, { value: "auto", label: "Auto" }]} />
        {sc && cfg.mode !== "off" && <span className="text-[11px] text-gray-500">Server scanner: {sc.expert_pairs} pair{sc.expert_pairs === 1 ? "" : "s"} watched{sc.last_tick ? `, last pass ${fmtAgo(sc.last_tick)}` : ""}</span>}
      </div>
      {cfg.mode === "auto" && (
        <label className="mt-3 flex items-start gap-2 text-xs rounded-xl border border-amber-400/40 bg-amber-400/10 text-amber-200 p-3 cursor-pointer">
          <input type="checkbox" checked={!!cfg.risk_ack} onChange={(e) => set("risk_ack", e.target.checked)} className="mt-0.5 accent-amber-400" />
          <span><ShieldAlert size={13} className="inline -mt-0.5 mr-1" />
            I understand Auto places real orders with no further confirmation, that signals are not guaranteed to win, and that I should run it on a <b>demo account first</b>. Auto does not switch on until this is ticked.</span>
        </label>
      )}

      <LivePanel data={data} orders={orders} onAct={act} busy={busy} onSync={syncClock} syncing={syncing} />

      {/* ---- pairs */}
      <Group title={`Allowed pairs (${pairs.length}) — same as My pairs`} cols="grid-cols-1">
        <div>
          <div className="text-[11px] text-gray-500 mb-2">The pairs you analyse are the pairs this Expert trades. Changing them here or in <button type="button" onClick={openPairs} className="text-gold underline">My pairs</button> updates both, and the server stops scanning the rest.</div>
          {grouped.map(([g, list]) => (
            <div key={g} className="mb-2">
              <div className="text-[10px] text-gray-600 mb-1">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((s) => {
                  const on = pairs.includes(s.value);
                  return (
                    <button key={s.value} type="button" onClick={() => togglePair(s.value)} title={s.note}
                      className={cx("px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors", on ? "border-gold bg-gold/15 text-gold" : "border-border text-gray-400 hover:border-gray-500")}>
                      {on && <Check size={11} className="inline -mt-0.5 mr-0.5" />}{s.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {cfg.mode !== "off" && pairs.length === 0 && <div className="text-xs text-amber-400">Tick at least one pair, otherwise nothing is scanned or sent.</div>}
        </div>
      </Group>

      {/* ---- engine */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Engine for these pairs</div>
        <button type="button" onClick={copyDash} className="text-[11px] text-gold hover:underline">Copy my dashboard settings</button>
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Entry timeframe</span>
          <Segmented size="sm" value={cfg.entry_tf} onChange={(v) => set("entry_tf", v)} options={["1m", "5m", "15m", "30m"]} /></label>
        <Num label="Reward : risk" value={cfg.rr} step={0.25} min={0.5} max={10} onChange={(v) => set("rr", v)} />
        <Num label="Min agreement %" value={cfg.min_agreement} min={30} max={100} onChange={(v) => set("min_agreement", v)} />
        <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Sensitivity</span>
          <Segmented size="sm" value={cfg.sens} onChange={(v) => set("sens", v)} options={["strict", "normal", "high"]} /></label>
      </div>
      <div className="mt-1 grid sm:grid-cols-2 gap-x-6">
        <Toggle on={!!cfg.sessions_only} onChange={(v) => set("sessions_only", v)} label="Trade only London / New York" />
        <Toggle on={!!cfg.scalp} onChange={(v) => set("scalp", v)} label="Also scan for scalps" />
      </div>

      {/* ---- which signals become orders */}
      <Group title="Which signals become orders">
        <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Minimum grade</span>
          <Segmented size="sm" value={cfg.min_grade} onChange={(v) => set("min_grade", v)} options={GRADES} /></label>
        <Num label="Min brain score" value={cfg.min_brain} min={0} max={100} onChange={(v) => set("min_brain", v)} hint="0 = ignore the brain" />
        <Num label="Max signal age" value={cfg.max_age_bars} min={0} max={6} onChange={(v) => set("max_age_bars", v)} suffix="candles" hint="older = too late" />
      </Group>
      <div className="mt-1 grid sm:grid-cols-3 gap-x-6">
        <Toggle on={!!cfg.allow_swing} onChange={(v) => set("allow_swing", v)} label="Swing trades" />
        <Toggle on={!!cfg.allow_scalp} onChange={(v) => set("allow_scalp", v)} label="Scalps" />
        <Toggle on={!!cfg.allow_counter} onChange={(v) => set("allow_counter", v)} label="Counter-trend" hint="against the 4H" />
      </div>

      {/* ---- size + limits */}
      <Group title="Size and limits">
        <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Lot size</span>
          <Segmented size="sm" value={cfg.lot_mode} onChange={(v) => set("lot_mode", v)} options={[{ value: "risk", label: "Risk %" }, { value: "fixed", label: "Fixed lots" }]} /></label>
        {cfg.lot_mode === "risk"
          ? <Num onChange={(v) => set("risk_pct", v)} label="Risk per trade" value={cfg.risk_pct} step={0.05} min={0.05} max={5} suffix="% of balance" hint="lots are worked out from the stop distance" />
          : <Num onChange={(v) => set("lots", v)} label="Lots per trade" value={cfg.lots} step={0.01} min={0.01} suffix="lots" />}
        <Num onChange={(v) => set("max_lots", v)} label="Largest lot allowed" value={cfg.max_lots} step={0.01} min={0.01} suffix="lots" />
        <Num onChange={(v) => set("max_open", v)} label="Max open trades" value={cfg.max_open} min={1} max={20} />
        <Num onChange={(v) => set("max_open_per_pair", v)} label="Max per pair" value={cfg.max_open_per_pair} min={1} max={5} />
        <Num onChange={(v) => set("daily_loss_r", v)} label="Daily loss stop" value={cfg.daily_loss_r} step={0.5} min={0} max={50} suffix="R" hint="no new trades after this; 0 = off" />
      </Group>

      {/* ---- early entries from the brain */}
      <Group title="Early entries (brain) — act before the candle closes" cols="grid-cols-1">
        <div>
          <Toggle on={!!cfg.early_enabled} onChange={(v) => set("early_enabled", v)} label="Enter early when the brain says the setup is ready"
            hint="Needs the live MT5 feed. Places a reduced-size trade on your broker's live price when price is in the 1H zone, a trigger candle is forming and the trend lines up. The engine's signal then confirms it (levels aligned, rest of the risk added); if it never confirms, the manager closes it." />
          {cfg.early_enabled && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Num label="Min readiness" value={cfg.early_min_pct} min={50} max={100} suffix="%" onChange={(v) => set("early_min_pct", v)} />
              <Num label="Min brain score" value={cfg.early_min_brain} min={0} max={100} onChange={(v) => set("early_min_brain", v)} />
              <Num label="Early size" value={cfg.early_risk_factor} step={0.1} min={0.1} max={1} suffix="× risk" hint="the rest is added on confirmation" onChange={(v) => set("early_risk_factor", v)} />
              <Num label="Give up after" value={cfg.early_ttl_bars} min={1} max={20} suffix="candles" hint="if the signal never comes" onChange={(v) => set("early_ttl_bars", v)} />
              <Toggle on={!!cfg.early_topup} onChange={(v) => set("early_topup", v)} label="Add the rest on confirmation" />
            </div>
          )}
        </div>
      </Group>

      {/* ---- live trade management */}
      <Group title="Trade management (checked every ~2 s)">
        <Num label="Trail from" value={cfg.trail_start_r} step={0.25} min={0} max={10} suffix="R" hint="0 = no trailing" onChange={(v) => set("trail_start_r", v)} />
        <Num label="Trail distance" value={cfg.trail_gap_r} step={0.25} min={0.2} max={5} suffix="R behind the peak" onChange={(v) => set("trail_gap_r", v)} />
        <Num label="Close if brain flips" value={cfg.flip_close_pct} min={50} max={100} suffix="%" hint="opposite side ready at this % while the trade is under +1R" onChange={(v) => set("flip_close_pct", v)} />
        <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Before high-impact news</span>
          <Segmented size="sm" value={cfg.news_action} onChange={(v) => set("news_action", v)} options={[{ value: "off", label: "Ignore" }, { value: "breakeven", label: "Break-even" }, { value: "close", label: "Close" }]} /></label>
        <Num label="News guard" value={cfg.news_guard_min} min={1} max={60} suffix="min before" onChange={(v) => set("news_guard_min", v)} />
        <Num label="Daily loss stop" value={cfg.daily_loss_pct} step={0.5} min={0} max={50} suffix="% of balance" hint="real P/L; 0 = off" onChange={(v) => set("daily_loss_pct", v)} />
      </Group>

      <button type="button" onClick={() => setAdv((v) => !v)} className="mt-4 text-xs text-gold hover:underline">{adv ? "Hide" : "Show"} advanced (execution, symbol names)</button>
      {adv && (
        <>
          <Group title="Execution">
            <Num onChange={(v) => set("expire_min", v)} label="Order expires after" value={cfg.expire_min} min={1} max={120} suffix="min" hint="if the EA cannot place it in time" />
            <Num onChange={(v) => set("be_at_r", v)} label="Break-even at" value={cfg.be_at_r} step={0.25} min={0} max={5} suffix="R" hint="EA moves the stop to entry; 0 = off" />
            <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Stop / target</span>
              <Segmented size="sm" value={cfg.price_mode} onChange={(v) => set("price_mode", v)} options={[{ value: "relative", label: "From MT5 price" }, { value: "absolute", label: "Exact levels" }]} />
              <span className="block text-[10px] text-gray-600 mt-0.5 leading-snug">From MT5 price = same distances applied to your broker's live price (safest if feeds differ).</span></label>
            <Num label="Skip if price moved" value={cfg.max_drift_r} step={0.05} min={0.05} max={3} suffix="R" hint="late signal guard (checked on the live broker price)" onChange={(v) => set("max_drift_r", v)} />
            <Num onChange={(v) => set("minlot_x", v)} label="Smallest lot may risk" value={cfg.minlot_x} step={0.5} min={1} max={10} suffix="× budget" hint="small accounts: the minimum lot can risk more than your % budget; orders above this are skipped" />
            <Num onChange={(v) => set("max_spread_pts", v)} label="Max spread" value={cfg.max_spread_pts} min={0} suffix="points" hint="0 = no limit" />
            <Num onChange={(v) => set("slippage_pts", v)} label="Slippage" value={cfg.slippage_pts} min={0} suffix="points" />
          </Group>
          <Toggle on={!!cfg.demo_only} onChange={(v) => set("demo_only", v)} label="Demo accounts only" hint="Leave on until you have watched it trade on demo. Real accounts also need the EA input ‘InpAllowLiveAccount’ switched on." />
          <Group title="Symbol names at your broker">
            <label className="block"><span className="block text-[11px] text-gray-400 mb-1">Suffix</span>
              <input value={cfg.suffix} onChange={(e) => set("suffix", e.target.value)} placeholder="e.g. m  .pro  #"
                className="w-full bg-bg border border-border rounded-lg px-2.5 h-9 text-sm outline-none focus:border-gold" /></label>
            <Num label="Magic number" value={cfg.magic} min={1} onChange={(v) => set("magic", v)} hint="tags the EA's trades" />
          </Group>
          {pairs.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[11px] text-gray-500">MT5 name used for each pair (type to override):</div>
              {pairs.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-300">{symbolInfo(s).short}</span><span className="text-gray-600">→</span>
                  <input defaultValue={(cfg.overrides || {})[s] || ""} placeholder={data?.known?.[s] || s}
                    onChange={(e) => { const o = { ...(cfg.overrides || {}) }; if (e.target.value.trim()) o[s] = e.target.value.trim(); else delete o[s]; set("overrides", o); }}
                    className="flex-1 bg-bg border border-border rounded-lg px-2.5 h-8 text-xs outline-none focus:border-gold" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="button" disabled={saving || !dirty} onClick={() => save()}
          className="px-4 h-9 rounded-xl bg-gold text-black text-sm font-semibold disabled:opacity-40">{saving ? "Saving…" : dirty ? "Save Expert options" : "Saved"}</button>
        {msg && <span className={cx("text-xs", msg.ok ? "text-bull" : "text-bear")}>{msg.text}</span>}
      </div>
      {cfg.mode === "auto" && !cfg.risk_ack && dirty && <div className="mt-1 text-[11px] text-amber-400">Tick the box above or Auto will be saved as Manual.</div>}

      {/* ---- link MT5 */}
      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200"><Link2 size={15} className="text-gold" /> Link your MetaTrader 5 account</div>
        {acct && (
          <div className="mt-2 text-xs text-gray-300 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Chip tone={live ? "bear" : "bull"}>{live ? "REAL account" : "DEMO account"}</Chip>
            <span>#{acct.login} · {acct.company || acct.server}</span>
            <span>{acct.balance != null ? `${Number(acct.balance).toLocaleString()} ${acct.currency || ""}` : ""}</span>
            <span className="text-gray-500">{data?.seen_ago != null ? `seen ${data.seen_ago}s ago` : ""} · EA v{data?.ea_version}</span>
          </div>
        )}
        {acct && acct.terminal_trade_allowed === false && <div className="mt-1 text-xs text-amber-400">MT5's “Algo Trading” button is off, so orders cannot be placed. Switch it on (green).</div>}
        {data?.ea_version && data.ea_version !== data.ea_latest && <div className="mt-1 text-xs text-amber-400">A newer EA ({data.ea_latest}) is available: create a new token and download it again.</div>}

        <ol className="mt-3 space-y-2 text-xs text-gray-400 list-decimal pl-4 leading-relaxed">
          <li>Press <b className="text-gray-200">{data?.has_token ? "New token" : "Create token"}</b> below, then <b className="text-gray-200">Download EA</b>. The file already contains your token and server address.
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button disabled={busy} onClick={newToken} className="px-3 h-8 rounded-lg border border-gold/60 text-gold font-semibold inline-flex items-center gap-1.5"><KeyRound size={13} /> {data?.has_token ? "New token" : "Create token"}</button>
              <button disabled={!token} onClick={downloadEA} title={token ? "" : "Create a token first (it is shown only once)"}
                className="px-3 h-8 rounded-lg bg-gold text-black font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"><Download size={13} /> Download EA</button>
              {data?.has_token && <button disabled={busy} onClick={revoke} className="px-2 h-8 rounded-lg border border-border text-gray-500 hover:text-bear">Disconnect</button>}
              {data?.has_token && !token && <span className="text-[11px] text-gray-500">token …{data.token_hint} is active (shown only once - make a new one to download again)</span>}
            </div>
            <label className="mt-2 block"><span className="text-[11px] text-gray-500">Server address as your MT5 PC reaches it (https:// is best online)</span>
              <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="mt-0.5 w-full bg-bg border border-border rounded-lg px-2.5 h-8 text-xs outline-none focus:border-gold" /></label>
            {/^http:\/\/(?!localhost|127\.)/.test(apiUrl) && <div className="mt-1 text-[11px] text-amber-400">This address is not https. Your token travels in plain text; use https for an online server.</div>}
          </li>
          <li>In MT5: <b className="text-gray-200">File → Open Data Folder → MQL5 → Experts</b>, paste <code className="bg-black/30 px-1 rounded">GoldSignalBridge.mq5</code>, open it in MetaEditor, press <b className="text-gray-200">Compile (F7)</b>.</li>
          <li>MT5 <b className="text-gray-200">Tools → Options → Expert Advisors</b>: tick <i>Allow algorithmic trading</i> and <i>Allow WebRequest for listed URL</i>, then add the server address from above.</li>
          <li>Drag <b className="text-gray-200">GoldSignalBridge</b> onto any chart and press the green <b className="text-gray-200">Algo Trading</b> button. This card turns to “EA connected”, and the EA starts sending your MT5 candle history so the brain can learn from years of data.</li>
        </ol>
      </div>

      {/* ---- orders */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Orders sent to MT5</div>
          {data?.counts && <div className="text-[11px] text-gray-600">{Object.entries(data.counts).map(([k, v]) => `${v} ${k}`).join(" · ")}</div>}
        </div>
        {orders.length === 0
          ? <div className="text-xs text-gray-600 py-3">Nothing yet. When a signal appears for an allowed pair it shows up here.</div>
          : <div className="mt-1">{orders.slice(0, 15).map((o) => <OrderRow key={o.id} o={o} onAct={act} busy={busy} />)}</div>}
      </div>
      <p className="mt-3 text-[10px] text-gray-600 leading-snug">Trading is risky; signals are not guaranteed. The EA was written for MT5 but has not been run against every broker: test it on a demo account and watch a few trades before going live.</p>
    </Card>
  );
}

/** Small control for a signal card: send this signal to MT5 (manual mode) or show what happened to it (auto mode). */
export function SendToMt5({ signalId, symbol }) {
  const { data, orders, reload } = useBridge({ pollMs: 8000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (!data || !signalId || data.config.mode === "off" || !data.config.pairs.includes(symbol)) return null;
  const o = orders.find((x) => x.signal_id === signalId);
  async function send() {
    setBusy(true); setErr(null);
    try { await api.post(`/bridge/signal/${signalId}/send`); await reload(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  const canSend = !o || ["awaiting", "skipped", "expired", "cancelled"].includes(o.status);
  return (
    <div className="mt-3 flex items-center gap-2 text-xs rounded-xl border border-border bg-bg/60 px-3 py-2">
      <Bot size={14} className="text-gold shrink-0" />
      <div className="min-w-0 flex-1 text-gray-300">
        {o ? <><b>{ORDER_LABEL[o.status] || o.status}</b>{o.note ? <span className="text-gray-500"> · {o.note}</span> : null}</>
          : data.config.mode === "auto" ? "Auto: no order was created for this one." : "MT5 bridge: manual mode."}
        {!data.connected && <span className="text-amber-400"> · EA offline</span>}
        {err && <span className="text-bear"> · {err}</span>}
      </div>
      {canSend && <button disabled={busy} onClick={send} className="px-3 py-1.5 rounded-lg bg-gold text-black font-semibold shrink-0">{o && o.status !== "awaiting" ? "Send anyway" : "Send to MT5"}</button>}
    </div>
  );
}
