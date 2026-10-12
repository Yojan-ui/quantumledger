// Single WebSocket feed → tiny external store.
//
// React panels subscribe through useFeed(selector) (useSyncExternalStore with
// rAF-coalesced notifications). The 3D scene does not re-render on data at all:
// it reads `feed.state` inside useFrame and listens to the trade / drop event
// streams directly.

import { useSyncExternalStore } from "react";
import type { FlowMsg, Hello, KemResult, L2Depth, LogLine, QlEntry, Status, Telemetry, Trade } from "../types";

export interface FeedState {
  link: "connecting" | "open" | "closed";
  hello: Hello | null;
  status: Status | null;
  telemetry: Telemetry | null;
  l2: L2Depth | null;
  trades: Trade[];          // newest last, capped
  log: LogLine[];           // newest last, capped
  hbSeq: number;
}

type Listener = () => void;
type TradeListener = (t: Trade[]) => void;
type DropListener = (l: LogLine[]) => void;
type FlowListener = (o: FlowMsg[], n: number) => void;
type KemListener = (r: KemResult) => void;
type QlListener = (e: QlEntry) => void;

const MAX_TRADES = 200;
const MAX_LOG = 400;

class Feed {
  state: FeedState = {
    link: "connecting", hello: null, status: null, telemetry: null, l2: null, trades: [], log: [], hbSeq: 0,
  };
  private listeners = new Set<Listener>();
  private tradeListeners = new Set<TradeListener>();
  private dropListeners = new Set<DropListener>();
  private flowListeners = new Set<FlowListener>();
  private kemListeners = new Set<KemListener>();
  private qlListeners = new Set<QlListener>();
  private notifyQueued = false;
  private retry = 0;

  connect(): void {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.set({ link: "connecting" });
    ws.onopen = () => { this.retry = 0; this.set({ link: "open" }); };
    ws.onmessage = (ev) => this.handle(JSON.parse(ev.data as string));
    ws.onclose = () => {
      this.set({ link: "closed", status: this.state.status ? { ...this.state.status, connected: false } : null });
      const delay = Math.min(5000, 400 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  private handle(m: any): void {
    switch (m.type) {
      case "SNAPSHOT":
        this.set({
          hello: m.hello, status: m.status, telemetry: m.telemetry, l2: m.l2,
          trades: m.trades ?? [], log: m.log ?? [],
        });
        break;
      case "L2_DEPTH":
        this.set({ l2: m });
        break;
      case "EXECUTION_TICK": {
        const trades = (this.state.trades.concat(m.trades)).slice(-MAX_TRADES);
        this.set({ trades });
        this.tradeListeners.forEach((f) => f(m.trades));
        break;
      }
      case "QL_LEDGER":
        this.qlListeners.forEach((f) => f(m.entry));
        break;
      case "KEM_HANDSHAKE":
        this.kemListeners.forEach((f) => f(m));
        break;
      case "ORDER_FLOW":
        this.flowListeners.forEach((f) => f(m.orders, m.n));
        break;
      case "CRYPTO_TELEMETRY":
        this.set({ telemetry: m });
        break;
      case "ATTACK_LOG": {
        const log = this.state.log.concat(m.lines).slice(-MAX_LOG);
        this.set({ log });
        const drops = (m.lines as LogLine[]).filter((l) => l.level === "drop" && l.attack);
        if (drops.length) this.dropListeners.forEach((f) => f(drops));
        break;
      }
      case "ENGINE_STATUS": {
        const hbChanged = m.hb_seq !== this.state.status?.hb_seq;
        this.set({ status: m, hbSeq: hbChanged ? this.state.hbSeq + 1 : this.state.hbSeq });
        break;
      }
    }
  }

  private set(patch: Partial<FeedState>): void {
    this.state = { ...this.state, ...patch };
    if (!this.notifyQueued) {
      this.notifyQueued = true;
      requestAnimationFrame(() => {
        this.notifyQueued = false;
        this.listeners.forEach((l) => l());
      });
    }
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  onTrades(f: TradeListener): () => void {
    this.tradeListeners.add(f);
    return () => this.tradeListeners.delete(f);
  }
  onQl(f: QlListener): () => void {
    this.qlListeners.add(f);
    return () => this.qlListeners.delete(f);
  }
  onKem(f: KemListener): () => void {
    this.kemListeners.add(f);
    return () => this.kemListeners.delete(f);
  }
  onFlow(f: FlowListener): () => void {
    this.flowListeners.add(f);
    return () => this.flowListeners.delete(f);
  }
  onDrops(f: DropListener): () => void {
    this.dropListeners.add(f);
    return () => this.dropListeners.delete(f);
  }
}

export const feed = new Feed();

export function useFeed<T>(select: (s: FeedState) => T): T {
  return useSyncExternalStore(feed.subscribe, () => select(feed.state));
}
