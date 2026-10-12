// libaetherpqc — C ABI used by the Python bridge (ctypes) to act as the
// institutional clients: ML-DSA key generation + order signing over the exact
// same canonical digest the engine verifies, and ML-KEM for the harvest
// simulation. Return value convention: 0 == success.

#include <oqs/oqs.h>

#include <cstring>

#include "aether/OrderDigest.hpp"
#include "aether/PqcEngine.hpp"

using namespace aether;

namespace {

const char* sig_name(int alg) {
  return alg == int(SigAlg::MlDsa65) ? OQS_SIG_alg_ml_dsa_65 : alg == int(SigAlg::MlDsa87) ? OQS_SIG_alg_ml_dsa_87 : nullptr;
}
const char* kem_name(int level) {
  return level == 768 ? OQS_KEM_alg_ml_kem_768 : level == 1024 ? OQS_KEM_alg_ml_kem_1024 : nullptr;
}

// OQS_SIG / OQS_KEM objects are immutable descriptors; build them once.
struct Ctx {
  OQS_SIG* dsa65;
  OQS_SIG* dsa87;
  OQS_KEM* kem768;
  OQS_KEM* kem1024;
  Ctx() {
    OQS_init();
    dsa65 = OQS_SIG_new(OQS_SIG_alg_ml_dsa_65);
    dsa87 = OQS_SIG_new(OQS_SIG_alg_ml_dsa_87);
    kem768 = OQS_KEM_new(OQS_KEM_alg_ml_kem_768);
    kem1024 = OQS_KEM_new(OQS_KEM_alg_ml_kem_1024);
  }
};
Ctx& ctx() {
  static Ctx c;
  return c;
}
OQS_SIG* sig(int alg) {
  return alg == int(SigAlg::MlDsa65) ? ctx().dsa65 : alg == int(SigAlg::MlDsa87) ? ctx().dsa87 : nullptr;
}
OQS_KEM* kem(int level) { return level == 768 ? ctx().kem768 : level == 1024 ? ctx().kem1024 : nullptr; }

int sign_digest(int alg, const std::uint8_t* sk, const Digest& d, std::uint8_t* sig_out, std::size_t* sig_len) {
  OQS_SIG* s = sig(alg);
  if (!s) return -1;
  return OQS_SIG_sign(s, sig_out, sig_len, d.data(), d.size(), sk) == OQS_SUCCESS ? 0 : -2;
}

}  // namespace

extern "C" {

__attribute__((visibility("default"))) const char* aep_liboqs_version() { return OQS_VERSION_TEXT; }

__attribute__((visibility("default"))) int aep_sig_sizes(int alg, std::size_t* pk, std::size_t* sk, std::size_t* sg) {
  if (!sig_name(alg)) return -1;
  OQS_SIG* s = sig(alg);
  *pk = s->length_public_key;
  *sk = s->length_secret_key;
  *sg = s->length_signature;
  return 0;
}

__attribute__((visibility("default"))) int aep_sig_keypair(int alg, std::uint8_t* pk, std::uint8_t* sk) {
  OQS_SIG* s = sig(alg);
  if (!s) return -1;
  return OQS_SIG_keypair(s, pk, sk) == OQS_SUCCESS ? 0 : -2;
}

__attribute__((visibility("default"))) void aep_key_fingerprint(const std::uint8_t* pk, std::size_t len, std::uint8_t* out16) {
  PqcEngine::key_fingerprint(pk, len, out16);
}

__attribute__((visibility("default"))) void aep_order_digest(int kind, std::uint64_t id, std::uint16_t participant,
                                                             int side, std::int64_t price, std::int64_t qty,
                                                             std::uint64_t ts_ns, std::uint8_t* out32) {
  const Digest d = order_digest(MsgKind(kind), id, participant, Side(side & 1), price, qty, ts_ns);
  std::memcpy(out32, d.data(), d.size());
}

__attribute__((visibility("default"))) int aep_sign_order(int alg, const std::uint8_t* sk, std::uint64_t id,
                                                          std::uint16_t participant, int side, std::int64_t price,
                                                          std::int64_t qty, std::uint64_t ts_ns, std::uint8_t* sig_out,
                                                          std::size_t* sig_len) {
  return sign_digest(alg, sk, order_digest(MsgKind::NewOrder, id, participant, Side(side & 1), price, qty, ts_ns),
                     sig_out, sig_len);
}

__attribute__((visibility("default"))) int aep_sign_cancel(int alg, const std::uint8_t* sk, std::uint64_t id,
                                                           std::uint16_t participant, std::uint64_t ts_ns,
                                                           std::uint8_t* sig_out, std::size_t* sig_len) {
  return sign_digest(alg, sk, order_digest(MsgKind::Cancel, id, participant, Side::Buy, 0, 0, ts_ns), sig_out, sig_len);
}

__attribute__((visibility("default"))) int aep_kem_sizes(int level, std::size_t* pk, std::size_t* sk, std::size_t* ct,
                                                         std::size_t* ss) {
  if (!kem_name(level)) return -1;
  OQS_KEM* k = kem(level);
  *pk = k->length_public_key;
  *sk = k->length_secret_key;
  *ct = k->length_ciphertext;
  *ss = k->length_shared_secret;
  return 0;
}

__attribute__((visibility("default"))) int aep_kem_keypair(int level, std::uint8_t* pk, std::uint8_t* sk) {
  OQS_KEM* k = kem(level);
  if (!k) return -1;
  return OQS_KEM_keypair(k, pk, sk) == OQS_SUCCESS ? 0 : -2;
}

__attribute__((visibility("default"))) int aep_kem_encaps(int level, const std::uint8_t* pk, std::uint8_t* ct,
                                                          std::uint8_t* ss) {
  OQS_KEM* k = kem(level);
  if (!k) return -1;
  return OQS_KEM_encaps(k, ct, ss, pk) == OQS_SUCCESS ? 0 : -2;
}

__attribute__((visibility("default"))) int aep_kem_decaps(int level, const std::uint8_t* sk, const std::uint8_t* ct,
                                                          std::uint8_t* ss) {
  OQS_KEM* k = kem(level);
  if (!k) return -1;
  return OQS_KEM_decaps(k, ss, ct, sk) == OQS_SUCCESS ? 0 : -2;
}

// Arbitrary-message ML-DSA (used by the QuantumLedger proof log to sign Merkle roots).
__attribute__((visibility("default"))) int aep_sig_sign_msg(int alg, const std::uint8_t* sk, const std::uint8_t* msg,
                                                            std::size_t msg_len, std::uint8_t* sig_out,
                                                            std::size_t* sig_len) {
  OQS_SIG* s = sig(alg);
  if (!s) return -1;
  return OQS_SIG_sign(s, sig_out, sig_len, msg, msg_len, sk) == OQS_SUCCESS ? 0 : -2;
}

__attribute__((visibility("default"))) int aep_sig_verify_msg(int alg, const std::uint8_t* pk, const std::uint8_t* msg,
                                                              std::size_t msg_len, const std::uint8_t* sig_in,
                                                              std::size_t sig_len) {
  OQS_SIG* s = sig(alg);
  if (!s) return -1;
  return OQS_SIG_verify(s, msg, msg_len, sig_in, sig_len, pk) == OQS_SUCCESS ? 0 : -2;
}

}  // extern "C"
