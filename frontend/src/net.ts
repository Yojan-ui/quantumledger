// Network-layer model for one signed order on an Ethernet link.
//
// Deterministic arithmetic only: TCP segments a message into MSS-sized
// segments (MSS = MTU − 20 B IPv4 − 20 B TCP, no options); each segment is
// one IP packet in one Ethernet frame costing 38 B of L1/L2 overhead
// (14 header + 4 FCS + 8 preamble/SFD + 12 inter-frame gap). The receiver can
// hand the order to the gate only after the last segment arrives, so the
// reassembly wait is the line-rate serialisation of segments 2..n.
//
// The engine itself runs over loopback; this models the exchange-facing link.

export const IP_HDR = 20;
export const TCP_HDR = 20;
export const ETH_OVERHEAD = 38;
export const LINK_GBPS = 10;

export interface Segment { index: number; from: number; to: number; payload: number; wire: number }

export interface LinkProfile {
  mtu: number;
  mss: number;
  payload: number;             // application bytes (the signed order frame)
  segments: Segment[];
  wireBytes: number;           // everything serialised onto the link
  serNs: number;               // first bit of segment 1 → last bit of segment n
  reassemblyNs: number;        // extra wait vs. a single-packet message
  overheadBytes: number;       // headers + L1/L2 overhead
}

export function profile(payload: number, mtu: number, gbps = LINK_GBPS): LinkProfile {
  const mss = mtu - IP_HDR - TCP_HDR;
  const segments: Segment[] = [];
  for (let from = 0, i = 0; from < payload; from += mss, i++) {
    const n = Math.min(mss, payload - from);
    segments.push({ index: i, from, to: from + n, payload: n, wire: n + IP_HDR + TCP_HDR + ETH_OVERHEAD });
  }
  const wireBytes = segments.reduce((a, s) => a + s.wire, 0);
  const ns = (b: number) => (b * 8) / gbps;
  return {
    mtu, mss, payload, segments, wireBytes,
    serNs: ns(wireBytes),
    reassemblyNs: ns(wireBytes - (segments[0]?.wire ?? 0)),
    overheadBytes: wireBytes - payload,
  };
}
