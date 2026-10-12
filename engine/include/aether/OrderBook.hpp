#pragma once
// Level-3 limit order book with strict price-time (FIFO) priority.
//
// Layout
//   * Prices map to a dense tick-indexed level array (65,536 ticks per side),
//     so level lookup is O(1) and there is no tree rebalancing.
//   * Non-empty levels are tracked in a two-level bitmap; finding the next
//     best price after a level empties is two count-leading/trailing-zero ops.
//   * Orders live in a pre-allocated IndexPool and form an intrusive doubly
//     linked FIFO queue per level.
//   * OrderId -> pool index uses an open-addressed table with backward-shift
//     deletion (no tombstones, no rehash).
// Nothing on insert / cancel / match touches the heap.

#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>
#include <memory>

#include "aether/MemoryPool.hpp"
#include "aether/Types.hpp"

namespace aether {

struct Order {
  OrderId id;
  Price price;
  Qty qty;          // remaining
  Qty orig_qty;
  std::uint64_t seq;       // engine arrival sequence — the "time" in price-time
  std::uint64_t ts_ns;     // client timestamp covered by the signature
  SigFingerprint sig_fp;
  std::uint32_t prev, next;
  std::uint32_t level;     // tick index
  ParticipantId participant;
  Side side;
};

struct Level {
  Qty total_qty = 0;
  std::uint32_t head = kNil, tail = kNil;
  std::uint32_t count = 0;
};

struct Trade {
  std::uint64_t match_seq;
  OrderId maker_id, taker_id;
  Price price;
  Qty qty;
  Qty maker_remaining, taker_remaining;
  ParticipantId maker_participant, taker_participant;
  Side aggressor;          // side of the taker (later-arriving) order
};

// Callback interface for fills — virtual dispatch, no std::function allocation.
class TradeSink {
 public:
  virtual void on_trade(const Trade& t) noexcept = 0;
 protected:
  ~TradeSink() = default;
};

struct L2Level { Price price; Qty qty; std::uint32_t count; };
struct L3Entry { OrderId id; Qty qty; ParticipantId participant; SigFingerprint sig_fp; };

enum class InsertResult : std::uint8_t { Ok, InvalidId, DuplicateId, PriceOutOfBand, BadTick, BadQty, PoolExhausted };
enum class CancelResult : std::uint8_t { Ok, UnknownOrder, NotOwner };

const char* to_string(InsertResult r) noexcept;
const char* to_string(CancelResult r) noexcept;

// ---------------------------------------------------------------------------

class LevelBitmap {
 public:
  static constexpr std::uint32_t kBits = 1u << 16;
  static constexpr std::uint32_t kWords = kBits / 64;        // 1024
  static constexpr std::uint32_t kSummary = kWords / 64;     // 16

  void set(std::uint32_t i) noexcept {
    words_[i >> 6] |= (1ull << (i & 63));
    summary_[i >> 12] |= (1ull << ((i >> 6) & 63));
  }
  void clear(std::uint32_t i) noexcept {
    std::uint64_t& w = words_[i >> 6];
    w &= ~(1ull << (i & 63));
    if (w == 0) summary_[i >> 12] &= ~(1ull << ((i >> 6) & 63));
  }
  void reset() noexcept { words_.fill(0); summary_.fill(0); }

  // Highest set index <= i, or kNil.
  std::uint32_t find_le(std::uint32_t i) const noexcept;
  // Lowest set index >= i, or kNil.
  std::uint32_t find_ge(std::uint32_t i) const noexcept;

 private:
  std::array<std::uint64_t, kWords> words_{};
  std::array<std::uint64_t, kSummary> summary_{};
};

class OrderIndex {
 public:
  explicit OrderIndex(std::uint32_t capacity_pow2);
  std::uint32_t find(OrderId id) const noexcept;
  bool insert(OrderId id, std::uint32_t slot) noexcept;   // false if present / full
  bool erase(OrderId id) noexcept;
  void reset() noexcept;

 private:
  static std::uint64_t mix(std::uint64_t x) noexcept {
    x ^= x >> 30; x *= 0xbf58476d1ce4e5b9ull;
    x ^= x >> 27; x *= 0x94d049bb133111ebull;
    return x ^ (x >> 31);
  }
  std::uint64_t mask_;
  std::unique_ptr<OrderId[]> keys_;        // 0 == empty
  std::unique_ptr<std::uint32_t[]> vals_;
  std::uint32_t size_ = 0;
};

// ---------------------------------------------------------------------------

struct OrderBookConfig {
  Price min_price = 0;            // price of tick index 0
  Price tick_size = 100;          // 0.0100
  std::uint32_t max_orders = 1u << 20;
};

class OrderBook {
 public:
  static constexpr std::uint32_t kLevels = LevelBitmap::kBits;

  explicit OrderBook(const OrderBookConfig& cfg = {});

  // Rests a verified order in the book (it may cross; call match_crossing_orders()).
  InsertResult insert_order(OrderId order_id, Side side, Price price, Qty qty, SigFingerprint signature,
                            ParticipantId participant = 0, std::uint64_t ts_ns = 0) noexcept;

  // Removes a resting order. If `participant` is non-zero, ownership is enforced.
  CancelResult cancel_order(OrderId order_id, ParticipantId participant = 0) noexcept;

  // Uncrosses the book: while best bid >= best ask, fill the FIFO heads at the
  // resting (earlier-sequence) order's price. Returns number of fills.
  std::uint32_t match_crossing_orders(TradeSink& sink) noexcept;

  void reset() noexcept;

  // --- read side ----------------------------------------------------------
  bool has_bid() const noexcept { return best_bid_ != kNil; }
  bool has_ask() const noexcept { return best_ask_ != kNil; }
  Price best_bid() const noexcept { return price_of(best_bid_); }
  Price best_ask() const noexcept { return price_of(best_ask_); }
  const Order* find(OrderId id) const noexcept;

  // Fill up to `max` aggregated levels from the touch outward. Returns count.
  std::size_t l2_bids(L2Level* out, std::size_t max) const noexcept;
  std::size_t l2_asks(L2Level* out, std::size_t max) const noexcept;
  // FIFO queue at the touch, front first.
  std::size_t l3_best(Side side, L3Entry* out, std::size_t max) const noexcept;

  std::uint32_t resting_orders() const noexcept { return pool_.used(); }
  std::uint32_t pool_capacity() const noexcept { return pool_.capacity(); }
  std::size_t memory_reserved_bytes() const noexcept;
  std::uint64_t total_fills() const noexcept { return match_seq_; }

  Price price_of(std::uint32_t lvl) const noexcept { return cfg_.min_price + Price(lvl) * cfg_.tick_size; }

 private:
  void link_tail(Level& lv, std::uint32_t slot) noexcept;
  void unlink(Level& lv, std::uint32_t slot) noexcept;
  void remove_order(std::uint32_t slot) noexcept;   // unlink + index erase + pool release
  std::size_t l2_walk(Side side, L2Level* out, std::size_t max) const noexcept;

  OrderBookConfig cfg_;
  IndexPool<Order> pool_;
  OrderIndex index_;
  std::unique_ptr<Level[]> bids_, asks_;
  LevelBitmap bid_map_, ask_map_;
  std::uint32_t best_bid_ = kNil, best_ask_ = kNil;
  std::uint64_t arrival_seq_ = 0;
  std::uint64_t match_seq_ = 0;
};

}  // namespace aether
