import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";

/** The MT5 bridge ("Expert") state: settings, EA connection, and the orders handed to MT5. */
export function useBridge({ pollMs = 8000, orders = true } = {}) {
  const [data, setData] = useState(null);
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const [b, o] = await Promise.all([api.get("/bridge"), orders ? api.get("/bridge/orders", { params: { limit: 40 } }) : Promise.resolve(null)]);
      if (!alive.current) return;
      setData(b.data);
      if (o) setList(o.data.orders || []);
      setErr(null);
    } catch (e) {
      if (alive.current) setErr(e?.response?.data?.detail || e.message || "Cannot reach the backend");
    }
  }, [orders]);

  useEffect(() => {
    alive.current = true;
    load();
    const h = setInterval(() => { if (!document.hidden) load(); }, pollMs);
    return () => { alive.current = false; clearInterval(h); };
  }, [load, pollMs]);

  return { data, orders: list, err, reload: load, setData };
}

export const ORDER_TONE = {
  awaiting: "amber", queued: "blue", sent: "blue", open: "bull", closed: "gray",
  rejected: "bear", failed: "bear", skipped: "gray", expired: "gray", cancelled: "gray",
};
export const ORDER_LABEL = {
  awaiting: "Waiting for you", queued: "Queued for MT5", sent: "Sent to MT5", open: "Open in MT5", closed: "Closed",
  rejected: "Refused by MT5", failed: "Failed", skipped: "Skipped", expired: "Expired", cancelled: "Cancelled",
};
