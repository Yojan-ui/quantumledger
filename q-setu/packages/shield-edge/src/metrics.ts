/**
 * The edge's counters, served in Prometheus text format on the admin port (never the public one).
 * Per connection: which key exchange it used (post-quantum hybrid or classical) and whether the TLS
 * session was resumed. Per request: status class and time from the request arriving to the origin's
 * response headers. That includes the origin's own time; the edge's added cost is measured by
 * comparing with direct requests to the origin (bench/).
 */
export type KxClass = "X25519MLKEM768" | "X25519" | "other" | "unknown";

const BUCKETS_MS = [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500];

export class EdgeMetrics {
  readonly connections: Record<KxClass, number> = {
    X25519MLKEM768: 0,
    X25519: 0,
    other: 0,
    unknown: 0,
  };
  handshakes = 0;
  resumed = 0;
  tlsErrors = 0;
  openConnections = 0;
  requests = 0;
  readonly statuses: Record<string, number> = {};
  originErrors = 0;
  private readonly hist = new Array<number>(BUCKETS_MS.length + 1).fill(0);
  private sumMs = 0;

  connection(kx: KxClass) {
    this.connections[kx]++;
  }

  /** Share of TLS connections that used a post-quantum hybrid key exchange (0–1), or undefined. */
  pqShare(): number | undefined {
    const all = Object.values(this.connections).reduce((a, b) => a + b, 0);
    return all ? this.connections.X25519MLKEM768 / all : undefined;
  }

  request(status: number, ms: number) {
    this.requests++;
    const k = `${Math.floor(status / 100)}xx`;
    this.statuses[k] = (this.statuses[k] ?? 0) + 1;
    let i = BUCKETS_MS.findIndex((b) => ms <= b);
    if (i < 0) i = BUCKETS_MS.length;
    this.hist[i]!++;
    this.sumMs += ms;
  }

  snapshot() {
    return {
      connections: { ...this.connections },
      pqShare: this.pqShare(),
      handshakes: this.handshakes,
      resumed: this.resumed,
      tlsErrors: this.tlsErrors,
      openConnections: this.openConnections,
      requests: this.requests,
      statuses: { ...this.statuses },
      originErrors: this.originErrors,
    };
  }

  prometheus(): string {
    const lines = [
      "# HELP qsetu_edge_connections_total TLS connections by key exchange.",
      "# TYPE qsetu_edge_connections_total counter",
      ...Object.entries(this.connections).map(
        ([k, v]) => `qsetu_edge_connections_total{kx="${k}"} ${v}`,
      ),
      "# TYPE qsetu_edge_handshakes_total counter",
      `qsetu_edge_handshakes_total ${this.handshakes}`,
      "# TYPE qsetu_edge_resumed_total counter",
      `qsetu_edge_resumed_total ${this.resumed}`,
      "# TYPE qsetu_edge_tls_errors_total counter",
      `qsetu_edge_tls_errors_total ${this.tlsErrors}`,
      "# TYPE qsetu_edge_open_connections gauge",
      `qsetu_edge_open_connections ${this.openConnections}`,
      "# TYPE qsetu_edge_origin_errors_total counter",
      `qsetu_edge_origin_errors_total ${this.originErrors}`,
      "# TYPE qsetu_edge_requests_total counter",
      ...Object.entries(this.statuses).map(
        ([k, v]) => `qsetu_edge_requests_total{status="${k}"} ${v}`,
      ),
      "# HELP qsetu_edge_request_ms Time from request to origin response headers, in ms.",
      "# TYPE qsetu_edge_request_ms histogram",
    ];
    let cum = 0;
    BUCKETS_MS.forEach((b, i) => {
      cum += this.hist[i]!;
      lines.push(`qsetu_edge_request_ms_bucket{le="${b}"} ${cum}`);
    });
    cum += this.hist[BUCKETS_MS.length]!;
    lines.push(`qsetu_edge_request_ms_bucket{le="+Inf"} ${cum}`);
    lines.push(`qsetu_edge_request_ms_sum ${this.sumMs.toFixed(3)}`);
    lines.push(`qsetu_edge_request_ms_count ${cum}`);
    return lines.join("\n") + "\n";
  }
}
