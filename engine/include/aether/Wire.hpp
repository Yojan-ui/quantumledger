#pragma once
// Binary ingress protocol (client -> engine). Little-endian, length-prefixed:
//
//   u32 len            bytes following this field (type + body)
//   u8  type
//   ... body
//
//   0x01 REGISTER_KEY  u16 participant | u8 alg | u16 pk_len | pk[pk_len]
//   0x02 NEW_ORDER     u64 id | u16 participant | u8 side | i64 price | i64 qty | u64 ts_ns
//                      | u8 alg | u8 key_fp[16] | u16 sig_len | sig[sig_len]
//   0x03 CANCEL        u64 id | u16 participant | u64 ts_ns | u8 alg | u8 key_fp[16] | u16 sig_len | sig
//   0x04 SET_POLICY    u8 min_alg (1 = ML-DSA-65 / NIST cat 3, 2 = ML-DSA-87 / NIST cat 5)
//   0x05 RESET         (empty) — clears book, key registry and replay state
//
// Egress (engine -> client) is newline-delimited compact JSON; see Bridge.cpp.

#include <cstddef>
#include <cstdint>
#include <cstring>

namespace aether::wire {

enum class FrameType : std::uint8_t { RegisterKey = 1, NewOrder = 2, Cancel = 3, SetPolicy = 4, Reset = 5 };

inline constexpr std::size_t kLenField = 4;
inline constexpr std::size_t kMaxFrame = 16 * 1024;
inline constexpr std::size_t kNewOrderFixed = 8 + 2 + 1 + 8 + 8 + 8 + 1 + 16 + 2;   // 54
inline constexpr std::size_t kCancelFixed = 8 + 2 + 8 + 1 + 16 + 2;                 // 37

// Bounds-checked little-endian reader over one frame body.
class Reader {
 public:
  Reader(const std::uint8_t* p, std::size_t n) : p_(p), n_(n) {}
  bool ok() const { return ok_; }
  std::size_t remaining() const { return n_ - o_; }

  template <class T>
  T get() {
    if (!ok_ || n_ - o_ < sizeof(T)) { ok_ = false; return T{}; }
    std::uint64_t v = 0;
    for (std::size_t i = 0; i < sizeof(T); ++i) v |= std::uint64_t(p_[o_ + i]) << (8 * i);
    o_ += sizeof(T);
    T out;
    std::memcpy(&out, &v, sizeof(T));   // little-endian host (arm64 / x86-64)
    return out;
  }
  const std::uint8_t* bytes(std::size_t n) {
    if (!ok_ || n_ - o_ < n) { ok_ = false; return nullptr; }
    const std::uint8_t* r = p_ + o_;
    o_ += n;
    return r;
  }

 private:
  const std::uint8_t* p_;
  std::size_t n_, o_ = 0;
  bool ok_ = true;
};

}  // namespace aether::wire
