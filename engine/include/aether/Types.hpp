#pragma once
// Core scalar types. Prices and quantities are 64-bit fixed-point integers
// (scale 10,000) — no floating point anywhere in the book or matcher.

#include <cstdint>

namespace aether {

using Price = std::int64_t;   // fixed-point, 1.0000 == 10'000
using Qty   = std::int64_t;   // fixed-point, 1.0000 == 10'000
using OrderId = std::uint64_t;
using ParticipantId = std::uint16_t;

inline constexpr std::int64_t kFixedScale = 10'000;

enum class Side : std::uint8_t { Buy = 0, Sell = 1 };

// Signature algorithms accepted on the wire. Classical algorithms are
// recognised so they can be rejected with a precise reason.
enum class SigAlg : std::uint8_t {
  None      = 0,
  MlDsa65   = 1,   // FIPS 204, NIST security category 3
  MlDsa87   = 2,   // FIPS 204, NIST security category 5
  EcdsaP256 = 10,  // classical — Shor-vulnerable
  Rsa2048   = 11,  // classical — Shor-vulnerable
};

constexpr const char* sig_alg_name(SigAlg a) {
  switch (a) {
    case SigAlg::MlDsa65:   return "ML-DSA-65";
    case SigAlg::MlDsa87:   return "ML-DSA-87";
    case SigAlg::EcdsaP256: return "ECDSA-P256";
    case SigAlg::Rsa2048:   return "RSA-2048";
    case SigAlg::None:      return "NONE";
  }
  return "UNKNOWN";
}

constexpr bool is_pqc(SigAlg a) { return a == SigAlg::MlDsa65 || a == SigAlg::MlDsa87; }

// A 64-bit fingerprint of the verified signature, kept on the resting order
// for the L3 audit trail (the full signature is not retained on the hot path).
using SigFingerprint = std::uint64_t;

}  // namespace aether
