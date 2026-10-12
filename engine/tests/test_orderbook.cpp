// Order book invariants: FIFO priority, maker pricing, partial fills,
// cancel/ownership, bitmap best-price recovery, and a randomized
// cross-check against a naive reference model.

#include <cstdio>
#include <cstdlib>
#include <map>
#include <random>
#include <vector>

#include "aether/OrderBook.hpp"

using namespace aether;

#define CHECK(c)                                                         \
  do {                                                                   \
    if (!(c)) {                                                          \
      std::fprintf(stderr, "%s:%d CHECK failed: %s\n", __FILE__, __LINE__, #c); \
      std::exit(1);                                                      \
    }                                                                    \
  } while (0)

struct Collect final : TradeSink {
  std::vector<Trade> v;
  void on_trade(const Trade& t) noexcept override { v.push_back(t); }
};

constexpr Price px(double p) { return Price(p * 10'000 + 0.5); }
constexpr Qty qt(double q) { return Qty(q * 10'000 + 0.5); }

void test_fifo_and_maker_price() {
  OrderBook b({.min_price = 0, .tick_size = 100, .max_orders = 1024});
  Collect c;
  CHECK(b.insert_order(1, Side::Sell, px(100.00), qt(5), 0, 1) == InsertResult::Ok);
  CHECK(b.insert_order(2, Side::Sell, px(100.00), qt(5), 0, 2) == InsertResult::Ok);
  CHECK(b.insert_order(3, Side::Sell, px(100.50), qt(5), 0, 3) == InsertResult::Ok);
  CHECK(b.match_crossing_orders(c) == 0);
  // Aggressive buy at 101 for 12: fills #1 (5), #2 (5) at 100.00, then #3 (2) at 100.50.
  CHECK(b.insert_order(4, Side::Buy, px(101.00), qt(12), 0, 4) == InsertResult::Ok);
  CHECK(b.match_crossing_orders(c) == 3);
  CHECK(c.v[0].maker_id == 1 && c.v[0].price == px(100.00) && c.v[0].qty == qt(5));
  CHECK(c.v[1].maker_id == 2 && c.v[1].price == px(100.00));
  CHECK(c.v[2].maker_id == 3 && c.v[2].price == px(100.50) && c.v[2].qty == qt(2));
  CHECK(c.v[2].aggressor == Side::Buy);
  CHECK(b.best_ask() == px(100.50));
  CHECK(b.find(3)->qty == qt(3));
  CHECK(!b.has_bid());
}

void test_cancel_and_best_recovery() {
  OrderBook b({.min_price = 0, .tick_size = 100, .max_orders = 1024});
  CHECK(b.insert_order(10, Side::Buy, px(99.00), qt(1), 0, 7) == InsertResult::Ok);
  CHECK(b.insert_order(11, Side::Buy, px(50.00), qt(1), 0, 7) == InsertResult::Ok);
  CHECK(b.insert_order(12, Side::Buy, px(99.50), qt(1), 0, 7) == InsertResult::Ok);
  CHECK(b.best_bid() == px(99.50));
  CHECK(b.cancel_order(12, 8) == CancelResult::NotOwner);
  CHECK(b.cancel_order(12, 7) == CancelResult::Ok);
  CHECK(b.best_bid() == px(99.00));
  CHECK(b.cancel_order(10) == CancelResult::Ok);
  CHECK(b.best_bid() == px(50.00));   // crosses bitmap summary words
  CHECK(b.cancel_order(10) == CancelResult::UnknownOrder);
  CHECK(b.insert_order(11, Side::Buy, px(1.00), qt(1), 0) == InsertResult::DuplicateId);
  CHECK(b.insert_order(13, Side::Buy, px(1.005), qt(1), 0) == InsertResult::BadTick);
  CHECK(b.insert_order(14, Side::Buy, px(700.00), qt(1), 0) == InsertResult::PriceOutOfBand);
  CHECK(b.insert_order(15, Side::Buy, px(1.00), 0, 0) == InsertResult::BadQty);
}

void test_pool_exhaustion() {
  OrderBook b({.min_price = 0, .tick_size = 100, .max_orders = 4});
  for (OrderId i = 1; i <= 4; ++i) CHECK(b.insert_order(i, Side::Buy, px(10.0), qt(1), 0) == InsertResult::Ok);
  CHECK(b.insert_order(5, Side::Buy, px(10.0), qt(1), 0) == InsertResult::PoolExhausted);
  CHECK(b.cancel_order(2) == CancelResult::Ok);
  CHECK(b.insert_order(5, Side::Buy, px(10.0), qt(1), 0) == InsertResult::Ok);
}

// Randomised differential test against a std::map reference book.
void test_randomized_reference() {
  struct RefOrder { OrderId id; Qty qty; };
  std::map<Price, std::vector<RefOrder>, std::greater<>> rbids;
  std::map<Price, std::vector<RefOrder>> rasks;
  std::map<OrderId, std::pair<Side, Price>> where;
  OrderBook b({.min_price = 0, .tick_size = 100, .max_orders = 1u << 16});
  Collect c;
  std::mt19937_64 rng(42);
  Qty traded_book = 0, traded_ref = 0;

  auto ref_remove = [&](OrderId id) {
    auto [side, p] = where[id];
    auto erase_from = [&](auto& m) {
      auto& q = m[p];
      for (auto it = q.begin(); it != q.end(); ++it)
        if (it->id == id) { q.erase(it); break; }
      if (q.empty()) m.erase(p);
    };
    if (side == Side::Buy) erase_from(rbids); else erase_from(rasks);
    where.erase(id);
  };

  for (OrderId id = 1; id <= 200'000; ++id) {
    if (!where.empty() && rng() % 4 == 0) {
      auto it = where.begin();
      std::advance(it, long(rng() % std::min<std::size_t>(where.size(), 64)));
      const OrderId victim = it->first;
      CHECK(b.cancel_order(victim) == CancelResult::Ok);
      ref_remove(victim);
      continue;
    }
    const Side s = (rng() & 1) ? Side::Buy : Side::Sell;
    const Price p = Price(9'000 + rng() % 200) * 100;    // 90.00 .. 91.99
    Qty q = Qty(1 + rng() % 50) * 10'000;
    CHECK(b.insert_order(id, s, p, q, 0) == InsertResult::Ok);
    b.match_crossing_orders(c);

    // reference matching
    if (s == Side::Buy) {
      while (q > 0 && !rasks.empty() && rasks.begin()->first <= p) {
        auto& lvl = rasks.begin()->second;
        RefOrder& m = lvl.front();
        const Qty f = std::min(q, m.qty);
        q -= f; m.qty -= f; traded_ref += f;
        if (m.qty == 0) { where.erase(m.id); lvl.erase(lvl.begin()); if (lvl.empty()) rasks.erase(rasks.begin()); }
      }
      if (q > 0) { rbids[p].push_back({id, q}); where[id] = {s, p}; }
    } else {
      while (q > 0 && !rbids.empty() && rbids.begin()->first >= p) {
        auto& lvl = rbids.begin()->second;
        RefOrder& m = lvl.front();
        const Qty f = std::min(q, m.qty);
        q -= f; m.qty -= f; traded_ref += f;
        if (m.qty == 0) { where.erase(m.id); lvl.erase(lvl.begin()); if (lvl.empty()) rbids.erase(rbids.begin()); }
      }
      if (q > 0) { rasks[p].push_back({id, q}); where[id] = {s, p}; }
    }
  }
  for (auto& t : c.v) traded_book += t.qty;
  CHECK(traded_book == traded_ref);
  CHECK(b.resting_orders() == where.size());
  CHECK(rbids.empty() == !b.has_bid());
  if (!rbids.empty()) CHECK(b.best_bid() == rbids.begin()->first);
  if (!rasks.empty()) CHECK(b.best_ask() == rasks.begin()->first);

  L2Level lv[25];
  const std::size_t n = b.l2_bids(lv, 25);
  std::size_t i = 0;
  for (auto& [p, q] : rbids) {
    if (i >= n) break;
    Qty tot = 0;
    for (auto& o : q) tot += o.qty;
    CHECK(lv[i].price == p && lv[i].qty == tot && lv[i].count == q.size());
    ++i;
  }
}

int main() {
  test_fifo_and_maker_price();
  test_cancel_and_best_recovery();
  test_pool_exhaustion();
  test_randomized_reference();
  std::puts("orderbook: all tests passed");
  return 0;
}
