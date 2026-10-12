#include "aether/OrderBook.hpp"

#include <algorithm>

namespace aether {

const char* to_string(InsertResult r) noexcept {
  switch (r) {
    case InsertResult::Ok:             return "OK";
    case InsertResult::InvalidId:      return "INVALID_ID";
    case InsertResult::DuplicateId:    return "DUPLICATE_ID";
    case InsertResult::PriceOutOfBand: return "PRICE_OUT_OF_BAND";
    case InsertResult::BadTick:        return "BAD_TICK";
    case InsertResult::BadQty:         return "BAD_QTY";
    case InsertResult::PoolExhausted:  return "POOL_EXHAUSTED";
  }
  return "?";
}

const char* to_string(CancelResult r) noexcept {
  switch (r) {
    case CancelResult::Ok:           return "OK";
    case CancelResult::UnknownOrder: return "UNKNOWN_ORDER";
    case CancelResult::NotOwner:     return "NOT_OWNER";
  }
  return "?";
}

// ---------------------------------------------------------------------------
// LevelBitmap

std::uint32_t LevelBitmap::find_le(std::uint32_t i) const noexcept {
  std::uint32_t w = i >> 6;
  const std::uint32_t b = i & 63;
  std::uint64_t bits = words_[w] & (b == 63 ? ~0ull : ((1ull << (b + 1)) - 1));
  if (bits) return (w << 6) + 63u - std::uint32_t(std::countl_zero(bits));

  std::uint32_t s = w >> 6;
  std::uint64_t sm = summary_[s] & ((1ull << (w & 63)) - 1);
  for (;;) {
    if (sm) {
      w = (s << 6) + 63u - std::uint32_t(std::countl_zero(sm));
      return (w << 6) + 63u - std::uint32_t(std::countl_zero(words_[w]));
    }
    if (s == 0) return kNil;
    sm = summary_[--s];
  }
}

std::uint32_t LevelBitmap::find_ge(std::uint32_t i) const noexcept {
  std::uint32_t w = i >> 6;
  std::uint64_t bits = words_[w] & (~0ull << (i & 63));
  if (bits) return (w << 6) + std::uint32_t(std::countr_zero(bits));

  std::uint32_t s = w >> 6;
  std::uint64_t sm = (w & 63) == 63 ? 0 : (summary_[s] & (~0ull << ((w & 63) + 1)));
  for (;;) {
    if (sm) {
      w = (s << 6) + std::uint32_t(std::countr_zero(sm));
      return (w << 6) + std::uint32_t(std::countr_zero(words_[w]));
    }
    if (++s >= kSummary) return kNil;
    sm = summary_[s];
  }
}

// ---------------------------------------------------------------------------
// OrderIndex — linear probing, backward-shift delete

OrderIndex::OrderIndex(std::uint32_t capacity_pow2)
    : mask_(capacity_pow2 - 1),
      keys_(std::make_unique<OrderId[]>(capacity_pow2)),
      vals_(std::make_unique<std::uint32_t[]>(capacity_pow2)) {
  reset();
}

void OrderIndex::reset() noexcept {
  std::fill_n(keys_.get(), mask_ + 1, OrderId{0});
  size_ = 0;
}

std::uint32_t OrderIndex::find(OrderId id) const noexcept {
  for (std::uint64_t h = mix(id) & mask_;; h = (h + 1) & mask_) {
    const OrderId k = keys_[h];
    if (k == id) return vals_[h];
    if (k == 0) return kNil;
  }
}

bool OrderIndex::insert(OrderId id, std::uint32_t slot) noexcept {
  if (std::uint64_t(size_) * 4 >= (mask_ + 1) * 3) return false;   // keep load < 0.75
  for (std::uint64_t h = mix(id) & mask_;; h = (h + 1) & mask_) {
    const OrderId k = keys_[h];
    if (k == id) return false;
    if (k == 0) {
      keys_[h] = id;
      vals_[h] = slot;
      ++size_;
      return true;
    }
  }
}

bool OrderIndex::erase(OrderId id) noexcept {
  std::uint64_t i = mix(id) & mask_;
  for (;; i = (i + 1) & mask_) {
    if (keys_[i] == id) break;
    if (keys_[i] == 0) return false;
  }
  for (std::uint64_t j = i;;) {
    j = (j + 1) & mask_;
    if (keys_[j] == 0) break;
    const std::uint64_t k = mix(keys_[j]) & mask_;
    const bool stays = (i <= j) ? (i < k && k <= j) : (i < k || k <= j);
    if (!stays) {
      keys_[i] = keys_[j];
      vals_[i] = vals_[j];
      i = j;
    }
  }
  keys_[i] = 0;
  --size_;
  return true;
}

// ---------------------------------------------------------------------------
// OrderBook

namespace {
std::uint32_t ceil_pow2(std::uint32_t v) { return v <= 1 ? 1 : std::bit_ceil(v); }
}  // namespace

OrderBook::OrderBook(const OrderBookConfig& cfg)
    : cfg_(cfg),
      pool_(cfg.max_orders),
      index_(ceil_pow2(cfg.max_orders) * 2),
      bids_(std::make_unique<Level[]>(kLevels)),
      asks_(std::make_unique<Level[]>(kLevels)) {}

void OrderBook::reset() noexcept {
  pool_.reset();
  index_.reset();
  std::fill_n(bids_.get(), kLevels, Level{});
  std::fill_n(asks_.get(), kLevels, Level{});
  bid_map_.reset();
  ask_map_.reset();
  best_bid_ = best_ask_ = kNil;
  arrival_seq_ = match_seq_ = 0;
}

std::size_t OrderBook::memory_reserved_bytes() const noexcept {
  return pool_.bytes_reserved() + (std::size_t(ceil_pow2(cfg_.max_orders)) * 2) * (sizeof(OrderId) + 4) +
         2 * std::size_t(kLevels) * sizeof(Level) + 2 * sizeof(LevelBitmap);
}

const Order* OrderBook::find(OrderId id) const noexcept {
  const std::uint32_t s = index_.find(id);
  return s == kNil ? nullptr : &pool_[s];
}

void OrderBook::link_tail(Level& lv, std::uint32_t slot) noexcept {
  Order& o = pool_[slot];
  o.prev = lv.tail;
  o.next = kNil;
  if (lv.tail != kNil) pool_[lv.tail].next = slot; else lv.head = slot;
  lv.tail = slot;
  lv.total_qty += o.qty;
  ++lv.count;
}

void OrderBook::unlink(Level& lv, std::uint32_t slot) noexcept {
  Order& o = pool_[slot];
  if (o.prev != kNil) pool_[o.prev].next = o.next; else lv.head = o.next;
  if (o.next != kNil) pool_[o.next].prev = o.prev; else lv.tail = o.prev;
  lv.total_qty -= o.qty;
  --lv.count;
}

void OrderBook::remove_order(std::uint32_t slot) noexcept {
  Order& o = pool_[slot];
  const std::uint32_t lvl = o.level;
  if (o.side == Side::Buy) {
    Level& lv = bids_[lvl];
    unlink(lv, slot);
    if (lv.count == 0) {
      bid_map_.clear(lvl);
      if (best_bid_ == lvl) best_bid_ = lvl == 0 ? kNil : bid_map_.find_le(lvl - 1);
    }
  } else {
    Level& lv = asks_[lvl];
    unlink(lv, slot);
    if (lv.count == 0) {
      ask_map_.clear(lvl);
      if (best_ask_ == lvl) best_ask_ = lvl + 1 >= kLevels ? kNil : ask_map_.find_ge(lvl + 1);
    }
  }
  index_.erase(o.id);
  pool_.release(slot);
}

InsertResult OrderBook::insert_order(OrderId order_id, Side side, Price price, Qty qty, SigFingerprint signature,
                                     ParticipantId participant, std::uint64_t ts_ns) noexcept {
  if (order_id == 0) return InsertResult::InvalidId;
  if (qty <= 0) return InsertResult::BadQty;
  const Price off = price - cfg_.min_price;
  if (off < 0) return InsertResult::PriceOutOfBand;
  if (off % cfg_.tick_size != 0) return InsertResult::BadTick;
  const Price lvl_wide = off / cfg_.tick_size;
  if (lvl_wide >= Price(kLevels)) return InsertResult::PriceOutOfBand;
  const auto lvl = std::uint32_t(lvl_wide);

  const std::uint32_t slot = pool_.acquire();
  if (slot == kNil) return InsertResult::PoolExhausted;
  if (!index_.insert(order_id, slot)) {
    pool_.release(slot);
    return index_.find(order_id) != kNil ? InsertResult::DuplicateId : InsertResult::PoolExhausted;
  }

  Order& o = pool_[slot];
  o.id = order_id;
  o.price = price;
  o.qty = o.orig_qty = qty;
  o.seq = ++arrival_seq_;
  o.ts_ns = ts_ns;
  o.sig_fp = signature;
  o.level = lvl;
  o.participant = participant;
  o.side = side;

  if (side == Side::Buy) {
    link_tail(bids_[lvl], slot);
    bid_map_.set(lvl);
    if (best_bid_ == kNil || lvl > best_bid_) best_bid_ = lvl;
  } else {
    link_tail(asks_[lvl], slot);
    ask_map_.set(lvl);
    if (best_ask_ == kNil || lvl < best_ask_) best_ask_ = lvl;
  }
  return InsertResult::Ok;
}

CancelResult OrderBook::cancel_order(OrderId order_id, ParticipantId participant) noexcept {
  const std::uint32_t slot = index_.find(order_id);
  if (slot == kNil) return CancelResult::UnknownOrder;
  if (participant != 0 && pool_[slot].participant != participant) return CancelResult::NotOwner;
  remove_order(slot);
  return CancelResult::Ok;
}

std::uint32_t OrderBook::match_crossing_orders(TradeSink& sink) noexcept {
  std::uint32_t fills = 0;
  while (best_bid_ != kNil && best_ask_ != kNil && best_bid_ >= best_ask_) {
    Level& bl = bids_[best_bid_];
    Level& al = asks_[best_ask_];
    const std::uint32_t bs = bl.head, as = al.head;
    Order& b = pool_[bs];
    Order& a = pool_[as];

    const bool bid_is_maker = b.seq < a.seq;
    const Order& maker = bid_is_maker ? b : a;
    const Order& taker = bid_is_maker ? a : b;
    const Qty q = std::min(b.qty, a.qty);

    b.qty -= q; bl.total_qty -= q;
    a.qty -= q; al.total_qty -= q;

    Trade t;
    t.match_seq = ++match_seq_;
    t.maker_id = maker.id;
    t.taker_id = taker.id;
    t.price = maker.price;                  // resting order sets the price
    t.qty = q;
    t.maker_remaining = maker.qty;
    t.taker_remaining = taker.qty;
    t.maker_participant = maker.participant;
    t.taker_participant = taker.participant;
    t.aggressor = taker.side;
    sink.on_trade(t);
    ++fills;

    if (b.qty == 0) remove_order(bs);
    if (a.qty == 0) remove_order(as);
  }
  return fills;
}

std::size_t OrderBook::l2_walk(Side side, L2Level* out, std::size_t max) const noexcept {
  std::size_t n = 0;
  if (side == Side::Buy) {
    for (std::uint32_t lvl = best_bid_; lvl != kNil && n < max;
         lvl = lvl == 0 ? kNil : bid_map_.find_le(lvl - 1)) {
      const Level& lv = bids_[lvl];
      out[n++] = {price_of(lvl), lv.total_qty, lv.count};
    }
  } else {
    for (std::uint32_t lvl = best_ask_; lvl != kNil && n < max;
         lvl = lvl + 1 >= kLevels ? kNil : ask_map_.find_ge(lvl + 1)) {
      const Level& lv = asks_[lvl];
      out[n++] = {price_of(lvl), lv.total_qty, lv.count};
    }
  }
  return n;
}

std::size_t OrderBook::l2_bids(L2Level* out, std::size_t max) const noexcept { return l2_walk(Side::Buy, out, max); }
std::size_t OrderBook::l2_asks(L2Level* out, std::size_t max) const noexcept { return l2_walk(Side::Sell, out, max); }

std::size_t OrderBook::l3_best(Side side, L3Entry* out, std::size_t max) const noexcept {
  const std::uint32_t lvl = side == Side::Buy ? best_bid_ : best_ask_;
  if (lvl == kNil) return 0;
  const Level& lv = side == Side::Buy ? bids_[lvl] : asks_[lvl];
  std::size_t n = 0;
  for (std::uint32_t s = lv.head; s != kNil && n < max; s = pool_[s].next) {
    const Order& o = pool_[s];
    out[n++] = {o.id, o.qty, o.participant, o.sig_fp};
  }
  return n;
}

}  // namespace aether
