#pragma once
// Canonical signed-message encoding. Both the engine (verify) and the client
// C ABI (sign) build the digest through this single function.
//
//   SHA3-256( "AETHERPOOL/ORDER/v1" || 0x00 || kind:u8 || order_id:u64 ||
//             participant:u16 || side:u8 || price:i64 || qty:i64 || ts_ns:u64 )
//   (all integers little-endian)
//
// ML-DSA signs this 32-byte digest. Side and participant are bound in addition
// to (order_id, price, qty, timestamp) so a captured signature cannot be
// replayed with the direction flipped or attributed to another desk.

#include <array>
#include <cstddef>
#include <cstdint>

#include "aether/Types.hpp"

extern "C" void OQS_SHA3_sha3_256(std::uint8_t* output, const std::uint8_t* input, std::size_t inplen);

namespace aether {

enum class MsgKind : std::uint8_t { NewOrder = 1, Cancel = 2 };

using Digest = std::array<std::uint8_t, 32>;

inline constexpr char kDigestDomain[] = "AETHERPOOL/ORDER/v1";   // 19 chars + NUL = 20 bytes
inline constexpr std::size_t kDigestInputLen = sizeof(kDigestDomain) + 1 + 8 + 2 + 1 + 8 + 8 + 8;

inline Digest order_digest(MsgKind kind, OrderId id, ParticipantId participant, Side side, Price price, Qty qty,
                           std::uint64_t ts_ns) noexcept {
  std::uint8_t buf[kDigestInputLen];
  std::size_t o = 0;
  for (char c : kDigestDomain) buf[o++] = std::uint8_t(c);
  auto put = [&](std::uint64_t v, int n) {
    for (int i = 0; i < n; ++i) buf[o++] = std::uint8_t(v >> (8 * i));
  };
  put(std::uint8_t(kind), 1);
  put(id, 8);
  put(participant, 2);
  put(std::uint8_t(side), 1);
  put(std::uint64_t(price), 8);
  put(std::uint64_t(qty), 8);
  put(ts_ns, 8);
  Digest d;
  OQS_SHA3_sha3_256(d.data(), buf, o);
  return d;
}

}  // namespace aether
