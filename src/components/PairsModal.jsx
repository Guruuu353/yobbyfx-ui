import React, { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useLive } from "../context/LiveContext";
import { SYMBOLS, SYMBOL_GROUPS } from "../lib/constants";
import { cx } from "../lib/format";

const MAX = 12;
const PRESETS = [
  { label: "Gold + majors", pairs: ["XAUUSD=X", "EURUSD=X", "GBPUSD=X", "USDJPY=X"] },
  { label: "Gold only", pairs: ["XAUUSD=X"] },
  { label: "JPY pairs", pairs: ["USDJPY=X", "EURJPY=X", "GBPJPY=X", "AUDJPY=X"] },
];

/** Pick the pairs you watch. The SAME list is what the server scans, keeps live from MT5 and lets the Expert trade. */
export default function PairsModal() {
  const { myPairs, savePairs, closePairs } = useLive();
  const [sel, setSel] = useState(myPairs.length ? myPairs : ["XAUUSD=X"]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => SYMBOL_GROUPS.map((g) => [g, SYMBOLS.filter((s) => s.group === g
    && (!q || `${s.short} ${s.label}`.toLowerCase().includes(q.toLowerCase())))]).filter(([, l]) => l.length), [q]);
  const toggle = (v) => setSel((x) => (x.includes(v) ? x.filter((y) => y !== v) : x.length >= MAX ? x : [...x, v]));
  async function save() { setBusy(true); await savePairs(sel); setBusy(false); closePairs(); }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={closePairs}>
      <div className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-gray-100">My pairs <span className="text-gray-500 font-normal">({sel.length}/{MAX})</span></div>
          <button onClick={closePairs} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center"><X size={15} /></button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Only these pairs are analysed, kept live from your MT5 and allowed to place Expert trades. Fewer pairs = faster and lighter.</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => setSel(p.pairs)} className="px-2.5 py-1 rounded-lg border border-border text-xs text-gray-300 hover:border-gold/50">{p.label}</button>
          ))}
          <button onClick={() => setSel([])} className="px-2.5 py-1 rounded-lg border border-border text-xs text-gray-500 hover:border-gray-500">Clear</button>
        </div>
        <div className="relative mt-3">
          <Search size={13} className="absolute left-2.5 top-2.5 text-gray-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a pair…" className="w-full bg-panel2 border border-border rounded-lg pl-8 pr-2 h-9 text-sm outline-none focus:border-gold" />
        </div>
        {groups.map(([g, list]) => (
          <div key={g} className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{g}</div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((s) => {
                const on = sel.includes(s.value);
                return (
                  <button key={s.value} onClick={() => toggle(s.value)} title={s.label}
                    className={cx("px-2.5 py-1.5 rounded-lg border text-xs font-semibold", on ? "border-gold bg-gold/15 text-gold" : "border-border text-gray-400 hover:border-gray-500")}>
                    {on && <Check size={11} className="inline -mt-0.5 mr-0.5" />}{s.short}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {sel.length > 6 && <div className="mt-3 text-[11px] text-amber-400">More than 6 pairs makes the server work harder; it still works, a little slower.</div>}
        <div className="flex gap-2 mt-4">
          <button disabled={busy || !sel.length} onClick={save} className="flex-1 h-10 rounded-xl bg-gold text-black font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save my pairs"}</button>
          <button onClick={closePairs} className="px-4 h-10 rounded-xl border border-border text-gray-300">Cancel</button>
        </div>
      </div>
    </div>
  );
}
