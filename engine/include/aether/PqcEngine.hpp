#pragma once
// Post-quantum verification gate.
//
// Every inbound order/cancel passes through PqcEngine::verify() on the ingress
// thread *before* it is allowed onto the matching ring buffer. Verification
// uses liboqs' C implementations of FIPS 204 ML-DSA-65 / ML-DSA-87; FIPS 203
// ML-KEM-768 / ML-KEM-1024 are exposed for session key establishment and
// benchmarking.
//
// Gate order (cheapest checks first so floods of junk cost ~nothing):
//   1. algorithm policy (classical algorithms and downgrades are refused)
//   2. participant / key registration lookup
//   3. constant-time key-fingerprint binding check
//   4. timestamp freshness window
//   5. ML-DSA signature verification over the canonical order digest
//   6. per-participant monotonic order-id (replay) check

#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>

#include "aether/Latency.hpp"
#include "aether/OrderDigest.hpp"
#include "aether/Types.hpp"

struct OQS_SIG;
struct OQS_KEM;

namespace aether {

inline constexpr std::size_t kKeyFpLen = 16;
inline constexpr std::size_t kMaxParticipants = 1024;
inline constexpr std::size_t kMaxSigBytes = 4627;     // ML-DSA-87
inline constexpr std::size_t kMaxPkBytes = 2592;      // ML-DSA-87

enum class VerifyStatus : std::uint8_t {
  Ok,
  ClassicalRejected,     // ECDSA / RSA — forgeable by a CRQC (Shor)
  AlgPolicy,             // PQC alg below the active NIST level (downgrade)
  UnknownParticipant,
  KeyMismatch,           // key fingerprint does not match registered key
  StaleTimestamp,
  BadSignature,
  Replay,                // order id not strictly increasing for participant
  Malformed,
};
const char* to_string(VerifyStatus s) noexcept;

// Constant-time byte comparison: runtime depends only on n, never on where
// (or whether) the buffers differ.
bool ct_equal(const std::uint8_t* a, const std::uint8_t* b, std::size_t n) noexcept;

// A decoded, not-yet-trusted message from the wire.
struct SignedEnvelope {
  MsgKind kind;
  OrderId id;
  ParticipantId participant;
  Side side;
  Price price;
  Qty qty;
  std::uint64_t ts_ns;
  SigAlg alg;
  const std::uint8_t* key_fp;      // kKeyFpLen bytes
  const std::uint8_t* sig;
  std::size_t sig_len;
  std::uint32_t wire_bytes;        // full frame size on the wire
};

struct VerifyProfile {
  std::uint64_t verify_ns = 0;     // ML-DSA verify only
  std::uint64_t verify_ticks = 0;
  std::uint64_t gate_ns = 0;       // whole gate including policy checks
};

struct SigBench {
  const char* name;
  const char* backend = "liboqs";
  bool available = false;
  std::uint64_t keygen_ns = 0, sign_ns = 0, verify_ns = 0;   // medians
  std::uint64_t verify_p99_ns = 0;
  std::size_t pk_bytes = 0, sk_bytes = 0, sig_bytes = 0;
  int iterations = 0;
};

struct KemBench {
  const char* name;
  const char* backend = "liboqs";
  bool available = false;
  std::uint64_t keygen_ns = 0, encaps_ns = 0, decaps_ns = 0;  // medians
  std::size_t pk_bytes = 0, sk_bytes = 0, ct_bytes = 0, ss_bytes = 0;
  int iterations = 0;
};

class PqcEngine {
 public:
  PqcEngine();
  ~PqcEngine();
  PqcEngine(const PqcEngine&) = delete;
  PqcEngine& operator=(const PqcEngine&) = delete;

  // Trusted provisioning channel: binds a participant to a public key.
  bool register_key(ParticipantId p, SigAlg alg, const std::uint8_t* pk, std::size_t len) noexcept;
  void clear_keys() noexcept;

  VerifyStatus verify(const SignedEnvelope& env, VerifyProfile& prof) noexcept;

  // Minimum accepted PQC level: MlDsa65 (NIST cat 3) or MlDsa87 (NIST cat 5).
  void set_min_level(SigAlg a) noexcept { min_level_ = a; }
  SigAlg min_level() const noexcept { return min_level_; }
  void set_freshness_window_ns(std::uint64_t w) noexcept { window_ns_ = w; }

  std::size_t sig_bytes(SigAlg a) const noexcept;
  std::size_t pk_bytes(SigAlg a) const noexcept;
  std::size_t registered_keys() const noexcept { return registered_; }
  std::size_t key_store_bytes() const noexcept { return sizeof(KeySlot) * kMaxParticipants * 2; }

  static void key_fingerprint(const std::uint8_t* pk, std::size_t len, std::uint8_t out[kKeyFpLen]) noexcept;

  // Off-hot-path microbenchmarks (fresh keys, `iters` iterations each).
  static SigBench bench_sig(SigAlg alg, int iters);
  static KemBench bench_kem(const char* oqs_name, const char* label, int iters);

 private:
  struct KeySlot {
    bool present = false;
    std::uint8_t fp[kKeyFpLen]{};
    std::uint16_t pk_len = 0;
    std::uint8_t pk[kMaxPkBytes]{};
  };
  OQS_SIG* sig_for(SigAlg a) const noexcept;
  static int alg_slot(SigAlg a) noexcept { return a == SigAlg::MlDsa87 ? 1 : 0; }

  OQS_SIG* dsa65_ = nullptr;
  OQS_SIG* dsa87_ = nullptr;
  std::unique_ptr<std::array<KeySlot, 2>[]> keys_;   // [participant][alg]
  std::unique_ptr<OrderId[]> last_id_;               // replay high-water mark per participant
  std::size_t registered_ = 0;
  SigAlg min_level_ = SigAlg::MlDsa65;
  std::uint64_t window_ns_ = 5'000'000'000ull;
};

}  // namespace aether
