// AetherPool engine process.
//
//   client socket ──► [ingress thread]  frame decode → PqcEngine::verify
//                          │ verified commands          │ rejects / key acks / telemetry
//                          ▼                            ▼
//                    SpscRing<Cmd>                SpscRing<Evt> (ingress)
//                          │
//                    [matcher thread]  OrderBook insert/cancel/match
//                          │ fills / acks / telemetry   │ L2+L3 snapshots (10 Hz)
//                          ▼                            ▼
//                    SpscRing<Evt> (matcher)      SpscRing<Snapshot>
//                          └──────────► [egress thread] ──► NDJSON over the same socket
//
// Only the ingress thread touches PqcEngine and only the matcher touches the
// OrderBook, so neither needs a lock. All rings are pre-sized at startup.

#include <arpa/inet.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/socket.h>
#include <unistd.h>

#if defined(__APPLE__)
#include <mach/mach.h>
#endif

#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "aether/ClassicalBaseline.hpp"
#include "aether/Latency.hpp"
#include "aether/OrderBook.hpp"
#include "aether/PqcEngine.hpp"
#include "aether/RingBuffer.hpp"
#include "aether/Wire.hpp"

#include <oqs/oqs.h>

using namespace aether;

namespace {

std::atomic<bool> g_running{true};
std::atomic<int> g_listen_fd{-1};

// ---------------------------------------------------------------------------
// Ring payloads (trivially copyable)

struct Cmd {
  enum Type : std::uint8_t { New, Cancel, Reset } type;
  Side side;
  SigAlg alg;
  ParticipantId participant;
  std::uint32_t wire_bytes;
  OrderId id;
  Price price;
  Qty qty;
  std::uint64_t ts_ns;
  SigFingerprint sig_fp;
  std::uint64_t verify_ns;
  std::uint64_t arrival_ns;   // monotonic, stamped when the frame was fully read
};

struct TelIngress {
  std::uint64_t window_ns, frames, bytes, accepted, rejected;
  std::uint64_t verify_n, verify_p50, verify_p99, verify_max, verify_mean;
  std::uint64_t ticks_p50, gate_p50;
  std::uint64_t ring_depth, ring_hwm;
  std::uint64_t wire_avg;
  std::uint32_t keys;
  SigAlg policy;
};

struct TelMatch {
  std::uint64_t window_ns, cmds, fills;
  std::uint64_t match_p50, match_p99, e2e_p50, e2e_p99, e2e_max;
  std::uint64_t resting, pool_cap, book_bytes, total_fills;
};

struct TradeEvt {
  aether::Trade t;
  std::uint64_t ts_wall, verify_ns, e2e_ns;
  std::uint32_t wire;
  SigAlg alg;
};
struct AckEvt { OrderId id; Qty rem; ParticipantId p; std::uint64_t verify_ns; };
struct CxlEvt { OrderId id; ParticipantId p; };
struct RejEvt {
  OrderId id;
  ParticipantId p;
  MsgKind kind;
  SigAlg alg;
  const char* why;          // static string literal
  std::uint64_t gate_ns, verify_ns;
  std::uint32_t wire;
};
struct KeyEvt { ParticipantId p; SigAlg alg; bool ok; std::uint8_t fp[8]; };
struct PolicyEvt { SigAlg min; };

struct Evt {
  enum Type : std::uint8_t { Trade, Ack, Cxl, Rej, KeyAck, Policy, TelIn, TelMt, Reset } type;
  union {
    TradeEvt trade;
    AckEvt ack;
    CxlEvt cxl;
    RejEvt rej;
    KeyEvt key;
    PolicyEvt policy;
    TelIngress tin;
    TelMatch tmt;
  };
};

struct Snapshot {
  std::uint64_t seq, ts_wall;
  std::uint8_t nb, na, n3b, n3a;
  L2Level bids[25], asks[25];
  L3Entry l3b[8], l3a[8];
};

struct Shared {
  SpscRing<Cmd> cmds{1u << 15};
  SpscRing<Evt> ingress_evt{1u << 14};
  SpscRing<Evt> matcher_evt{1u << 16};
  SpscRing<Snapshot> snaps{16};
  std::atomic<int> client_fd{-1};
  std::atomic<std::uint64_t> conn_gen{0};
  std::atomic<std::uint64_t> evt_drops{0};
  std::atomic<std::uint64_t> egress_bytes{0};
};

void idle_backoff(unsigned& spins) {
  if (++spins < 512) return;
#if defined(__aarch64__)
  asm volatile("yield");
#endif
  if (spins > 4096) std::this_thread::sleep_for(std::chrono::microseconds(50));
}

void push_evt(SpscRing<Evt>& r, const Evt& e, Shared& sh) {
  if (!r.try_push(e)) sh.evt_drops.fetch_add(1, std::memory_order_relaxed);
}

// ---------------------------------------------------------------------------
// Matcher thread — sole owner of the OrderBook

class MatchSink final : public TradeSink {
 public:
  MatchSink(Shared& sh) : sh_(sh) {}
  const Cmd* cur = nullptr;
  std::uint64_t e2e_ns = 0;
  void on_trade(const aether::Trade& t) noexcept override {
    Evt e;
    e.type = Evt::Trade;
    e.trade.t = t;
    e.trade.ts_wall = wall_ns();
    e.trade.verify_ns = cur->verify_ns;
    e.trade.e2e_ns = now_ns() - cur->arrival_ns;
    e.trade.wire = cur->wire_bytes;
    e.trade.alg = cur->alg;
    push_evt(sh_.matcher_evt, e, sh_);
  }
 private:
  Shared& sh_;
};

void matcher_main(Shared& sh, OrderBookConfig cfg) {
  OrderBook book(cfg);
  MatchSink sink(sh);
  LatencyHistogram match_h, e2e_h;
  std::uint64_t cmds = 0, fills = 0, snap_seq = 0;
  std::uint64_t last_snap = now_ns(), last_tel = last_snap;
  unsigned spins = 0;

  while (g_running.load(std::memory_order_relaxed)) {
    Cmd c;
    int n = 0;
    while (n < 512 && sh.cmds.try_pop(c)) {
      ++n;
      ++cmds;
      const std::uint64_t t0 = now_ns();
      if (c.type == Cmd::Reset) {
        book.reset();
        Evt e; e.type = Evt::Reset;
        push_evt(sh.matcher_evt, e, sh);
        continue;
      }
      if (c.type == Cmd::Cancel) {
        const CancelResult r = book.cancel_order(c.id, c.participant);
        Evt e;
        if (r == CancelResult::Ok) {
          e.type = Evt::Cxl;
          e.cxl = {c.id, c.participant};
        } else {
          e.type = Evt::Rej;
          e.rej = {c.id, c.participant, MsgKind::Cancel, c.alg, to_string(r), 0, c.verify_ns, c.wire_bytes};
        }
        push_evt(sh.matcher_evt, e, sh);
        continue;
      }
      // New order: rest it, then uncross.
      const InsertResult r = book.insert_order(c.id, c.side, c.price, c.qty, c.sig_fp, c.participant, c.ts_ns);
      if (r != InsertResult::Ok) {
        Evt e;
        e.type = Evt::Rej;
        e.rej = {c.id, c.participant, MsgKind::NewOrder, c.alg, to_string(r), 0, c.verify_ns, c.wire_bytes};
        push_evt(sh.matcher_evt, e, sh);
        continue;
      }
      sink.cur = &c;
      fills += book.match_crossing_orders(sink);
      const std::uint64_t t1 = now_ns();
      match_h.record(t1 - t0);
      e2e_h.record(t1 - c.arrival_ns);

      const Order* o = book.find(c.id);
      Evt e;
      e.type = Evt::Ack;
      e.ack = {c.id, o ? o->qty : 0, c.participant, c.verify_ns};
      push_evt(sh.matcher_evt, e, sh);
    }

    const std::uint64_t now = now_ns();
    if (now - last_snap >= 100'000'000ull) {
      last_snap = now;
      Snapshot s;
      s.seq = ++snap_seq;
      s.ts_wall = wall_ns();
      s.nb = std::uint8_t(book.l2_bids(s.bids, 25));
      s.na = std::uint8_t(book.l2_asks(s.asks, 25));
      s.n3b = std::uint8_t(book.l3_best(Side::Buy, s.l3b, 8));
      s.n3a = std::uint8_t(book.l3_best(Side::Sell, s.l3a, 8));
      sh.snaps.try_push(s);   // a dropped snapshot is superseded 100 ms later
    }
    if (now - last_tel >= 500'000'000ull) {
      Evt e;
      e.type = Evt::TelMt;
      e.tmt = {now - last_tel, cmds, fills,
               match_h.percentile(0.50), match_h.percentile(0.99),
               e2e_h.percentile(0.50), e2e_h.percentile(0.99), e2e_h.max(),
               book.resting_orders(), book.pool_capacity(), book.memory_reserved_bytes(), book.total_fills()};
      push_evt(sh.matcher_evt, e, sh);
      last_tel = now;
      cmds = fills = 0;
      match_h.reset();
      e2e_h.reset();
    }

    if (n == 0) idle_backoff(spins); else spins = 0;
  }
}

// ---------------------------------------------------------------------------
// Ingress — frame decode + PQC gate. Runs on the accepting thread, one client at a time.

void ingress_session(Shared& sh, PqcEngine& pqc, int fd) {
  std::vector<std::uint8_t> buf(1u << 20);
  std::size_t have = 0;
  LatencyHistogram verify_h, ticks_h, gate_h;
  TelIngress tel{};
  std::uint64_t last_tel = now_ns(), wire_sum = 0, ring_hwm = 0;

  auto reject = [&](const SignedEnvelope& env, VerifyStatus st, const VerifyProfile& prof) {
    Evt e;
    e.type = Evt::Rej;
    e.rej = {env.id, env.participant, env.kind, env.alg, to_string(st), prof.gate_ns, prof.verify_ns, env.wire_bytes};
    push_evt(sh.ingress_evt, e, sh);
    ++tel.rejected;
  };

  auto handle_frame = [&](const std::uint8_t* body, std::size_t len, std::uint64_t arrival) {
    const auto type = wire::FrameType(body[0]);
    wire::Reader rd(body + 1, len - 1);
    const auto wire_bytes = std::uint32_t(len + wire::kLenField);
    ++tel.frames;
    tel.bytes += wire_bytes;

    switch (type) {
      case wire::FrameType::RegisterKey: {
        const auto p = rd.get<std::uint16_t>();
        const auto alg = SigAlg(rd.get<std::uint8_t>());
        const auto pk_len = rd.get<std::uint16_t>();
        const std::uint8_t* pk = rd.bytes(pk_len);
        Evt e;
        e.type = Evt::KeyAck;
        e.key.p = p;
        e.key.alg = alg;
        e.key.ok = rd.ok() && pqc.register_key(p, alg, pk, pk_len);
        std::uint8_t fp[kKeyFpLen]{};
        if (e.key.ok) PqcEngine::key_fingerprint(pk, pk_len, fp);
        std::memcpy(e.key.fp, fp, 8);
        push_evt(sh.ingress_evt, e, sh);
        return;
      }
      case wire::FrameType::SetPolicy: {
        const auto a = SigAlg(rd.get<std::uint8_t>());
        if (rd.ok() && is_pqc(a)) pqc.set_min_level(a);
        Evt e; e.type = Evt::Policy; e.policy.min = pqc.min_level();
        push_evt(sh.ingress_evt, e, sh);
        return;
      }
      case wire::FrameType::Reset: {
        pqc.clear_keys();
        Cmd c{}; c.type = Cmd::Reset;
        while (!sh.cmds.try_push(c)) std::this_thread::yield();
        return;
      }
      case wire::FrameType::NewOrder:
      case wire::FrameType::Cancel: {
        SignedEnvelope env{};
        env.wire_bytes = wire_bytes;
        if (type == wire::FrameType::NewOrder) {
          env.kind = MsgKind::NewOrder;
          env.id = rd.get<std::uint64_t>();
          env.participant = rd.get<std::uint16_t>();
          env.side = Side(rd.get<std::uint8_t>() & 1);
          env.price = rd.get<std::int64_t>();
          env.qty = rd.get<std::int64_t>();
          env.ts_ns = rd.get<std::uint64_t>();
        } else {
          env.kind = MsgKind::Cancel;
          env.id = rd.get<std::uint64_t>();
          env.participant = rd.get<std::uint16_t>();
          env.ts_ns = rd.get<std::uint64_t>();
        }
        env.alg = SigAlg(rd.get<std::uint8_t>());
        env.key_fp = rd.bytes(kKeyFpLen);
        env.sig_len = rd.get<std::uint16_t>();
        env.sig = rd.bytes(env.sig_len);
        VerifyProfile prof;
        if (!rd.ok() || rd.remaining() != 0) { reject(env, VerifyStatus::Malformed, prof); return; }

        const VerifyStatus st = pqc.verify(env, prof);
        if (prof.verify_ns) {
          verify_h.record(prof.verify_ns);
          ticks_h.record(prof.verify_ticks);
        }
        gate_h.record(prof.gate_ns);
        if (st != VerifyStatus::Ok) { reject(env, st, prof); return; }

        ++tel.accepted;
        wire_sum += wire_bytes;
        Cmd c{};
        c.type = env.kind == MsgKind::NewOrder ? Cmd::New : Cmd::Cancel;
        c.side = env.side;
        c.alg = env.alg;
        c.participant = env.participant;
        c.wire_bytes = wire_bytes;
        c.id = env.id;
        c.price = env.price;
        c.qty = env.qty;
        c.ts_ns = env.ts_ns;
        // ML-DSA signatures begin with the 32-byte challenge hash c~; its first
        // 8 bytes are a free, collision-resistant fingerprint for the L3 audit trail.
        std::memcpy(&c.sig_fp, env.sig, sizeof c.sig_fp);
        c.verify_ns = prof.verify_ns;
        c.arrival_ns = arrival;
        while (!sh.cmds.try_push(c)) std::this_thread::yield();   // backpressure → TCP window
        ring_hwm = std::max<std::uint64_t>(ring_hwm, sh.cmds.size_approx());
        return;
      }
    }
    SignedEnvelope env{};
    env.wire_bytes = wire_bytes;
    reject(env, VerifyStatus::Malformed, VerifyProfile{});
  };

  auto maybe_telemetry = [&] {
    const std::uint64_t now = now_ns();
    if (now - last_tel < 500'000'000ull) return;
    tel.window_ns = now - last_tel;
    tel.verify_n = verify_h.count();
    tel.verify_p50 = verify_h.percentile(0.50);
    tel.verify_p99 = verify_h.percentile(0.99);
    tel.verify_max = verify_h.max();
    tel.verify_mean = verify_h.mean();
    tel.ticks_p50 = ticks_h.percentile(0.50);
    tel.gate_p50 = gate_h.percentile(0.50);
    tel.ring_depth = sh.cmds.size_approx();
    tel.ring_hwm = ring_hwm;
    tel.wire_avg = tel.accepted ? wire_sum / tel.accepted : 0;
    tel.keys = std::uint32_t(pqc.registered_keys());
    tel.policy = pqc.min_level();
    Evt e;
    e.type = Evt::TelIn;
    e.tin = tel;
    push_evt(sh.ingress_evt, e, sh);
    tel = TelIngress{};
    verify_h.reset(); ticks_h.reset(); gate_h.reset();
    wire_sum = ring_hwm = 0;
    last_tel = now;
  };

  while (g_running.load(std::memory_order_relaxed)) {
    const ssize_t r = recv(fd, buf.data() + have, buf.size() - have, 0);
    if (r == 0) break;
    if (r < 0) {
      if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) { maybe_telemetry(); continue; }
      break;
    }
    have += std::size_t(r);
    const std::uint64_t arrival = now_ns();

    std::size_t off = 0;
    bool fatal = false;
    while (have - off >= wire::kLenField) {
      std::uint32_t len;
      std::memcpy(&len, buf.data() + off, 4);
      if (len == 0 || len > wire::kMaxFrame) { fatal = true; break; }   // desynchronised stream
      if (have - off - wire::kLenField < len) break;
      handle_frame(buf.data() + off + wire::kLenField, len, arrival);
      off += wire::kLenField + len;
    }
    if (fatal) break;
    std::memmove(buf.data(), buf.data() + off, have - off);
    have -= off;
    maybe_telemetry();
  }
}

// ---------------------------------------------------------------------------
// Egress — NDJSON serialisation (off the hot path)

class Out {
 public:
  void add(const char* fmt, ...) __attribute__((format(printf, 2, 3))) {
    va_list ap;
    va_start(ap, fmt);
    char tmp[2048];
    const int n = std::vsnprintf(tmp, sizeof tmp, fmt, ap);
    va_end(ap);
    if (n > 0) s.append(tmp, std::size_t(std::min(n, int(sizeof tmp) - 1)));
  }
  std::string s;
};

const char* side_str(Side s) { return s == Side::Buy ? "B" : "S"; }

std::uint64_t rss_bytes() {
#if defined(__APPLE__)
  mach_task_basic_info info;
  mach_msg_type_number_t count = MACH_TASK_BASIC_INFO_COUNT;
  if (task_info(mach_task_self(), MACH_TASK_BASIC_INFO, reinterpret_cast<task_info_t>(&info), &count) == KERN_SUCCESS)
    return info.resident_size;
#endif
  return 0;
}

void write_evt(Out& o, const Evt& e, const ClockInfo& ci) {
  switch (e.type) {
    case Evt::Trade: {
      const auto& t = e.trade;
      o.add("{\"t\":\"TRADE\",\"seq\":%llu,\"px\":%lld,\"qty\":%lld,\"aggr\":\"%s\",\"maker\":%llu,\"taker\":%llu,"
            "\"mp\":%u,\"tp\":%u,\"mrem\":%lld,\"trem\":%lld,\"ts\":%llu,\"verify_ns\":%llu,\"e2e_ns\":%llu,"
            "\"wire\":%u,\"alg\":\"%s\"}\n",
            (unsigned long long)t.t.match_seq, (long long)t.t.price, (long long)t.t.qty, side_str(t.t.aggressor),
            (unsigned long long)t.t.maker_id, (unsigned long long)t.t.taker_id, t.t.maker_participant,
            t.t.taker_participant, (long long)t.t.maker_remaining, (long long)t.t.taker_remaining,
            (unsigned long long)t.ts_wall, (unsigned long long)t.verify_ns, (unsigned long long)t.e2e_ns, t.wire,
            sig_alg_name(t.alg));
      break;
    }
    case Evt::Ack:
      o.add("{\"t\":\"ACK\",\"id\":%llu,\"p\":%u,\"rem\":%lld,\"verify_ns\":%llu}\n", (unsigned long long)e.ack.id,
            e.ack.p, (long long)e.ack.rem, (unsigned long long)e.ack.verify_ns);
      break;
    case Evt::Cxl:
      o.add("{\"t\":\"CXL\",\"id\":%llu,\"p\":%u}\n", (unsigned long long)e.cxl.id, e.cxl.p);
      break;
    case Evt::Rej:
      o.add("{\"t\":\"REJ\",\"id\":%llu,\"p\":%u,\"kind\":\"%s\",\"alg\":\"%s\",\"why\":\"%s\",\"gate_ns\":%llu,"
            "\"verify_ns\":%llu,\"wire\":%u,\"ts\":%llu}\n",
            (unsigned long long)e.rej.id, e.rej.p, e.rej.kind == MsgKind::Cancel ? "CANCEL" : "ORDER",
            sig_alg_name(e.rej.alg), e.rej.why, (unsigned long long)e.rej.gate_ns,
            (unsigned long long)e.rej.verify_ns, e.rej.wire, (unsigned long long)wall_ns());
      break;
    case Evt::KeyAck:
      o.add("{\"t\":\"KEY\",\"p\":%u,\"alg\":\"%s\",\"ok\":%s,\"fp\":\"%02x%02x%02x%02x%02x%02x%02x%02x\"}\n",
            e.key.p, sig_alg_name(e.key.alg), e.key.ok ? "true" : "false", e.key.fp[0], e.key.fp[1], e.key.fp[2],
            e.key.fp[3], e.key.fp[4], e.key.fp[5], e.key.fp[6], e.key.fp[7]);
      break;
    case Evt::Policy:
      o.add("{\"t\":\"POLICY\",\"min_alg\":\"%s\"}\n", sig_alg_name(e.policy.min));
      break;
    case Evt::Reset:
      o.add("{\"t\":\"RESET\"}\n");
      break;
    case Evt::TelIn: {
      const auto& t = e.tin;
      const double est_cycles = ci.est_core_ghz * double(t.verify_p50);
      o.add("{\"t\":\"TEL_IN\",\"window_ns\":%llu,\"frames\":%llu,\"bytes\":%llu,\"accepted\":%llu,\"rejected\":%llu,"
            "\"verify_n\":%llu,\"verify_p50_ns\":%llu,\"verify_p99_ns\":%llu,\"verify_max_ns\":%llu,"
            "\"verify_mean_ns\":%llu,\"verify_ticks_p50\":%llu,\"verify_est_cycles_p50\":%.0f,\"gate_p50_ns\":%llu,"
            "\"ring_depth\":%llu,\"ring_hwm\":%llu,\"wire_avg\":%llu,\"keys\":%u,\"policy\":\"%s\"}\n",
            (unsigned long long)t.window_ns, (unsigned long long)t.frames, (unsigned long long)t.bytes,
            (unsigned long long)t.accepted, (unsigned long long)t.rejected, (unsigned long long)t.verify_n,
            (unsigned long long)t.verify_p50, (unsigned long long)t.verify_p99, (unsigned long long)t.verify_max,
            (unsigned long long)t.verify_mean, (unsigned long long)t.ticks_p50, est_cycles,
            (unsigned long long)t.gate_p50, (unsigned long long)t.ring_depth, (unsigned long long)t.ring_hwm,
            (unsigned long long)t.wire_avg, t.keys, sig_alg_name(t.policy));
      break;
    }
    case Evt::TelMt: {
      const auto& t = e.tmt;
      o.add("{\"t\":\"TEL_MATCH\",\"window_ns\":%llu,\"cmds\":%llu,\"fills\":%llu,\"match_p50_ns\":%llu,"
            "\"match_p99_ns\":%llu,\"e2e_p50_ns\":%llu,\"e2e_p99_ns\":%llu,\"e2e_max_ns\":%llu,\"resting\":%llu,"
            "\"pool_cap\":%llu,\"book_bytes\":%llu,\"total_fills\":%llu,\"rss\":%llu}\n",
            (unsigned long long)t.window_ns, (unsigned long long)t.cmds, (unsigned long long)t.fills,
            (unsigned long long)t.match_p50, (unsigned long long)t.match_p99, (unsigned long long)t.e2e_p50,
            (unsigned long long)t.e2e_p99, (unsigned long long)t.e2e_max, (unsigned long long)t.resting,
            (unsigned long long)t.pool_cap, (unsigned long long)t.book_bytes, (unsigned long long)t.total_fills,
            (unsigned long long)rss_bytes());
      break;
    }
  }
}

void write_snapshot(Out& o, const Snapshot& s) {
  o.add("{\"t\":\"L2\",\"seq\":%llu,\"ts\":%llu,\"bids\":[", (unsigned long long)s.seq, (unsigned long long)s.ts_wall);
  for (int i = 0; i < s.nb; ++i)
    o.add("%s[%lld,%lld,%u]", i ? "," : "", (long long)s.bids[i].price, (long long)s.bids[i].qty, s.bids[i].count);
  o.add("],\"asks\":[");
  for (int i = 0; i < s.na; ++i)
    o.add("%s[%lld,%lld,%u]", i ? "," : "", (long long)s.asks[i].price, (long long)s.asks[i].qty, s.asks[i].count);
  o.add("],\"l3b\":[");
  for (int i = 0; i < s.n3b; ++i)
    o.add("%s[%llu,%lld,%u,\"%016llx\"]", i ? "," : "", (unsigned long long)s.l3b[i].id, (long long)s.l3b[i].qty,
          s.l3b[i].participant, (unsigned long long)s.l3b[i].sig_fp);
  o.add("],\"l3a\":[");
  for (int i = 0; i < s.n3a; ++i)
    o.add("%s[%llu,%lld,%u,\"%016llx\"]", i ? "," : "", (unsigned long long)s.l3a[i].id, (long long)s.l3a[i].qty,
          s.l3a[i].participant, (unsigned long long)s.l3a[i].sig_fp);
  o.add("]}\n");
}

std::string sig_bench_json(const SigBench& b) {
  Out o;
  o.add("{\"name\":\"%s\",\"backend\":\"%s\",\"available\":%s,\"keygen_ns\":%llu,\"sign_ns\":%llu,\"verify_ns\":%llu,"
        "\"verify_p99_ns\":%llu,\"pk_bytes\":%zu,\"sk_bytes\":%zu,\"sig_bytes\":%zu,\"iterations\":%d}",
        b.name, b.backend, b.available ? "true" : "false", (unsigned long long)b.keygen_ns, (unsigned long long)b.sign_ns,
        (unsigned long long)b.verify_ns, (unsigned long long)b.verify_p99_ns, b.pk_bytes, b.sk_bytes, b.sig_bytes,
        b.iterations);
  return o.s;
}
std::string kem_bench_json(const KemBench& b) {
  Out o;
  o.add("{\"name\":\"%s\",\"backend\":\"%s\",\"available\":%s,\"keygen_ns\":%llu,\"encaps_ns\":%llu,\"decaps_ns\":%llu,"
        "\"pk_bytes\":%zu,\"sk_bytes\":%zu,\"ct_bytes\":%zu,\"ss_bytes\":%zu,\"iterations\":%d}",
        b.name, b.backend, b.available ? "true" : "false", (unsigned long long)b.keygen_ns, (unsigned long long)b.encaps_ns,
        (unsigned long long)b.decaps_ns, b.pk_bytes, b.sk_bytes, b.ct_bytes, b.ss_bytes, b.iterations);
  return o.s;
}

bool send_all(int fd, const char* p, std::size_t n) {
  while (n) {
    const ssize_t w = send(fd, p, n, 0);
    if (w < 0) {
      if (errno == EINTR) continue;
      return false;
    }
    p += w;
    n -= std::size_t(w);
  }
  return true;
}

void egress_main(Shared& sh, const std::string& preamble, const ClockInfo& ci) {
  Out o;
  std::uint64_t seen_gen = 0, hb_seq = 0, last_hb = 0;
  const std::uint64_t boot = now_ns();
  unsigned spins = 0;
  while (g_running.load(std::memory_order_relaxed)) {
    const int fd = sh.client_fd.load(std::memory_order_acquire);
    const std::uint64_t gen = sh.conn_gen.load(std::memory_order_acquire);
    if (fd >= 0 && gen != seen_gen) {
      seen_gen = gen;
      o.s.clear();
      o.s += preamble;   // HELLO + BENCH for every new client
    }

    int n = 0;
    Evt e;
    while (n < 1024 && sh.ingress_evt.try_pop(e)) { write_evt(o, e, ci); ++n; }
    while (n < 4096 && sh.matcher_evt.try_pop(e)) { write_evt(o, e, ci); ++n; }
    Snapshot s;
    while (sh.snaps.try_pop(s)) { write_snapshot(o, s); ++n; }

    const std::uint64_t now = now_ns();
    if (now - last_hb >= 250'000'000ull) {
      last_hb = now;
      o.add("{\"t\":\"HB\",\"seq\":%llu,\"uptime_ns\":%llu,\"ts\":%llu,\"evt_drops\":%llu,\"egress_bytes\":%llu}\n",
            (unsigned long long)++hb_seq, (unsigned long long)(now - boot), (unsigned long long)wall_ns(),
            (unsigned long long)sh.evt_drops.load(), (unsigned long long)sh.egress_bytes.load());
      ++n;
    }

    if (!o.s.empty()) {
      if (fd >= 0 && seen_gen == gen) {
        if (send_all(fd, o.s.data(), o.s.size())) sh.egress_bytes.fetch_add(o.s.size(), std::memory_order_relaxed);
        else shutdown(fd, SHUT_RDWR);   // ingress will observe EOF and retire the session
      }
      o.s.clear();
    }
    if (n == 0) idle_backoff(spins); else spins = 0;
  }
}

std::string build_preamble(const OrderBookConfig& cfg, const ClockInfo& ci, int iters) {
  std::fprintf(stderr, "[aether] benchmarking primitives (%d iterations each)...\n", iters);
  const SigBench s65 = PqcEngine::bench_sig(SigAlg::MlDsa65, iters);
  const SigBench s87 = PqcEngine::bench_sig(SigAlg::MlDsa87, iters);
  const SigBench ec = bench_ecdsa_p256(iters);
  const SigBench rsa = bench_rsa2048(iters);
  const KemBench k768 = PqcEngine::bench_kem(OQS_KEM_alg_ml_kem_768, "ML-KEM-768", iters);
  const KemBench k1024 = PqcEngine::bench_kem(OQS_KEM_alg_ml_kem_1024, "ML-KEM-1024", iters);
  const KemBench ecdh = bench_ecdh_p256(iters);
  std::fprintf(stderr, "[aether] verify median: ECDSA %llu ns | RSA %llu ns | ML-DSA-65 %llu ns | ML-DSA-87 %llu ns\n",
               (unsigned long long)ec.verify_ns, (unsigned long long)rsa.verify_ns, (unsigned long long)s65.verify_ns,
               (unsigned long long)s87.verify_ns);

  Out o;
  o.add("{\"t\":\"HELLO\",\"engine\":\"aetherpool\",\"version\":\"0.1.0\",\"liboqs\":\"%s\",\"scale\":%lld,"
        "\"tick\":%lld,\"min_price\":%lld,\"levels\":%u,\"max_orders\":%u,\"cpu\":\"%s\",\"counter\":\"%s\","
        "\"counter_hz\":%llu,\"est_core_ghz\":%.2f,\"order_fixed_bytes\":%zu}\n",
        OQS_VERSION_TEXT, (long long)kFixedScale, (long long)cfg.tick_size, (long long)cfg.min_price,
        OrderBook::kLevels, cfg.max_orders, ci.cpu, ci.counter, (unsigned long long)ci.counter_hz, ci.est_core_ghz,
        wire::kLenField + 1 + wire::kNewOrderFixed);
  o.s += "{\"t\":\"BENCH\",\"sig\":[" + sig_bench_json(ec) + "," + sig_bench_json(rsa) + "," + sig_bench_json(s65) +
         "," + sig_bench_json(s87) + "],\"kem\":[" + kem_bench_json(ecdh) + "," + kem_bench_json(k768) + "," +
         kem_bench_json(k1024) + "]}\n";
  return o.s;
}

void on_signal(int) {
  g_running.store(false);
  const int lf = g_listen_fd.exchange(-1);
  if (lf >= 0) close(lf);
}

}  // namespace

int main(int argc, char** argv) {
  int port = 9001;
  int bench_iters = 400;
  OrderBookConfig cfg;
  for (int i = 1; i + 1 < argc; i += 2) {
    const std::string k = argv[i];
    if (k == "--port") port = std::atoi(argv[i + 1]);
    else if (k == "--bench-iters") bench_iters = std::max(1, std::atoi(argv[i + 1]));
    else if (k == "--tick") cfg.tick_size = std::atoll(argv[i + 1]);
    else if (k == "--min-price") cfg.min_price = std::atoll(argv[i + 1]);
    else if (k == "--max-orders") cfg.max_orders = std::uint32_t(std::atoll(argv[i + 1]));
  }
  std::signal(SIGINT, on_signal);
  std::signal(SIGTERM, on_signal);
  std::signal(SIGPIPE, SIG_IGN);

  const ClockInfo ci = probe_clock();
  const std::string preamble = build_preamble(cfg, ci, bench_iters);

  auto sh = std::make_unique<Shared>();
  PqcEngine pqc;

  const int lf = socket(AF_INET, SOCK_STREAM, 0);
  int one = 1;
  setsockopt(lf, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(std::uint16_t(port));
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);   // never exposed beyond localhost
  if (bind(lf, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0 || listen(lf, 4) != 0) {
    std::perror("[aether] bind/listen");
    return 1;
  }
  g_listen_fd.store(lf);

  std::thread matcher(matcher_main, std::ref(*sh), cfg);
  std::thread egress(egress_main, std::ref(*sh), std::cref(preamble), std::cref(ci));
  std::fprintf(stderr, "[aether] engine listening on 127.0.0.1:%d (cpu: %s, timer: %s)\n", port, ci.cpu, ci.counter);

  while (g_running.load()) {
    const int fd = accept(lf, nullptr, nullptr);
    if (fd < 0) {
      if (!g_running.load()) break;
      continue;
    }
    setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
#if defined(SO_NOSIGPIPE)
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof one);
#endif
    timeval tv{0, 100'000};   // wake ingress every 100 ms for telemetry when idle
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
    int rcvbuf = 4 << 20;
    setsockopt(fd, SOL_SOCKET, SO_RCVBUF, &rcvbuf, sizeof rcvbuf);

    std::fprintf(stderr, "[aether] client connected\n");
    sh->client_fd.store(fd, std::memory_order_release);
    sh->conn_gen.fetch_add(1, std::memory_order_acq_rel);
    ingress_session(*sh, pqc, fd);
    sh->client_fd.store(-1, std::memory_order_release);
    close(fd);
    std::fprintf(stderr, "[aether] client disconnected\n");
  }

  g_running.store(false);
  matcher.join();
  egress.join();
  OQS_destroy();
  return 0;
}
