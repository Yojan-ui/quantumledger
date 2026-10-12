#include "aether/PqcEngine.hpp"

#include <oqs/oqs.h>

#include <algorithm>
#include <cstring>
#include <vector>

namespace aether {

const char* to_string(VerifyStatus s) noexcept {
  switch (s) {
    case VerifyStatus::Ok:                 return "OK";
    case VerifyStatus::ClassicalRejected:  return "CLASSICAL_SIG_REJECTED";
    case VerifyStatus::AlgPolicy:          return "DOWNGRADE_BELOW_POLICY";
    case VerifyStatus::UnknownParticipant: return "UNKNOWN_PARTICIPANT";
    case VerifyStatus::KeyMismatch:        return "KEY_FINGERPRINT_MISMATCH";
    case VerifyStatus::StaleTimestamp:     return "STALE_TIMESTAMP";
    case VerifyStatus::BadSignature:       return "BAD_SIGNATURE";
    case VerifyStatus::Replay:             return "REPLAY";
    case VerifyStatus::Malformed:          return "MALFORMED";
  }
  return "?";
}

bool ct_equal(const std::uint8_t* a, const std::uint8_t* b, std::size_t n) noexcept {
  // Accumulate every byte difference; the volatile sink stops the compiler
  // from turning this into an early-exit memcmp.
  volatile std::uint8_t acc = 0;
  for (std::size_t i = 0; i < n; ++i) acc = std::uint8_t(acc | (a[i] ^ b[i]));
  // Map 0 -> 1, nonzero -> 0 without a data-dependent branch.
  return ((std::uint32_t(acc) - 1u) >> 31) & 1u;
}

PqcEngine::PqcEngine()
    : keys_(std::make_unique<std::array<KeySlot, 2>[]>(kMaxParticipants)),
      last_id_(std::make_unique<OrderId[]>(kMaxParticipants)) {
  OQS_init();
  dsa65_ = OQS_SIG_new(OQS_SIG_alg_ml_dsa_65);
  dsa87_ = OQS_SIG_new(OQS_SIG_alg_ml_dsa_87);
}

PqcEngine::~PqcEngine() {
  OQS_SIG_free(dsa65_);
  OQS_SIG_free(dsa87_);
}

OQS_SIG* PqcEngine::sig_for(SigAlg a) const noexcept {
  return a == SigAlg::MlDsa65 ? dsa65_ : a == SigAlg::MlDsa87 ? dsa87_ : nullptr;
}

std::size_t PqcEngine::sig_bytes(SigAlg a) const noexcept {
  const OQS_SIG* s = sig_for(a);
  return s ? s->length_signature : 0;
}
std::size_t PqcEngine::pk_bytes(SigAlg a) const noexcept {
  const OQS_SIG* s = sig_for(a);
  return s ? s->length_public_key : 0;
}

void PqcEngine::key_fingerprint(const std::uint8_t* pk, std::size_t len, std::uint8_t out[kKeyFpLen]) noexcept {
  std::uint8_t h[32];
  OQS_SHA3_sha3_256(h, pk, len);
  std::memcpy(out, h, kKeyFpLen);
}

bool PqcEngine::register_key(ParticipantId p, SigAlg alg, const std::uint8_t* pk, std::size_t len) noexcept {
  if (p == 0 || p >= kMaxParticipants || !is_pqc(alg) || len != pk_bytes(alg)) return false;
  KeySlot& k = keys_[p][alg_slot(alg)];
  if (!k.present) ++registered_;
  k.present = true;
  k.pk_len = std::uint16_t(len);
  std::memcpy(k.pk, pk, len);
  key_fingerprint(pk, len, k.fp);
  return true;
}

void PqcEngine::clear_keys() noexcept {
  for (std::size_t i = 0; i < kMaxParticipants; ++i) {
    keys_[i][0].present = keys_[i][1].present = false;
    last_id_[i] = 0;
  }
  registered_ = 0;
}

VerifyStatus PqcEngine::verify(const SignedEnvelope& env, VerifyProfile& prof) noexcept {
  const std::uint64_t t0 = now_ns();
  auto done = [&](VerifyStatus s) {
    prof.gate_ns = now_ns() - t0;
    return s;
  };

  if (env.alg == SigAlg::EcdsaP256 || env.alg == SigAlg::Rsa2048) return done(VerifyStatus::ClassicalRejected);
  if (!is_pqc(env.alg)) return done(VerifyStatus::Malformed);
  if (min_level_ == SigAlg::MlDsa87 && env.alg == SigAlg::MlDsa65) return done(VerifyStatus::AlgPolicy);

  if (env.participant == 0 || env.participant >= kMaxParticipants) return done(VerifyStatus::UnknownParticipant);
  const KeySlot& key = keys_[env.participant][alg_slot(env.alg)];
  if (!key.present) return done(VerifyStatus::UnknownParticipant);
  if (!ct_equal(env.key_fp, key.fp, kKeyFpLen)) return done(VerifyStatus::KeyMismatch);

  const std::uint64_t wall = wall_ns();
  const std::uint64_t skew = wall > env.ts_ns ? wall - env.ts_ns : env.ts_ns - wall;
  if (skew > window_ns_) return done(VerifyStatus::StaleTimestamp);

  OQS_SIG* s = sig_for(env.alg);
  if (env.sig_len != s->length_signature) return done(VerifyStatus::BadSignature);

  const Digest d = order_digest(env.kind, env.id, env.participant, env.side, env.price, env.qty, env.ts_ns);
  const std::uint64_t v0 = now_ns();
  const std::uint64_t k0 = read_ticks();
  const OQS_STATUS rc = OQS_SIG_verify(s, d.data(), d.size(), env.sig, env.sig_len, key.pk);
  prof.verify_ticks = read_ticks() - k0;
  prof.verify_ns = now_ns() - v0;
  if (rc != OQS_SUCCESS) return done(VerifyStatus::BadSignature);

  if (env.kind == MsgKind::NewOrder) {
    OrderId& hw = last_id_[env.participant];
    if (env.id <= hw) return done(VerifyStatus::Replay);
    hw = env.id;
  }
  return done(VerifyStatus::Ok);
}

// ---------------------------------------------------------------------------
// Benchmarks

namespace {
std::uint64_t median(std::vector<std::uint64_t>& v) {
  if (v.empty()) return 0;
  std::nth_element(v.begin(), v.begin() + std::ptrdiff_t(v.size() / 2), v.end());
  return v[v.size() / 2];
}
std::uint64_t pct(std::vector<std::uint64_t> v, double p) {
  if (v.empty()) return 0;
  std::sort(v.begin(), v.end());
  return v[std::min(v.size() - 1, std::size_t(p * double(v.size())))];
}
}  // namespace

SigBench PqcEngine::bench_sig(SigAlg alg, int iters) {
  SigBench r;
  r.name = sig_alg_name(alg);
  OQS_SIG* s = OQS_SIG_new(alg == SigAlg::MlDsa87 ? OQS_SIG_alg_ml_dsa_87 : OQS_SIG_alg_ml_dsa_65);
  if (!s) return r;
  std::vector<std::uint8_t> pk(s->length_public_key), sk(s->length_secret_key), sig(s->length_signature);
  std::vector<std::uint64_t> kg, sg, vf;
  const int kg_iters = std::max(1, iters / 4);
  for (int i = 0; i < kg_iters; ++i) {
    const auto t = now_ns();
    OQS_SIG_keypair(s, pk.data(), sk.data());
    kg.push_back(now_ns() - t);
  }
  std::uint8_t msg[32];
  for (int i = 0; i < iters / 5; ++i) {   // warm caches / branch predictors; untimed
    std::size_t len = 0;
    OQS_SIG_sign(s, sig.data(), &len, msg, sizeof msg, sk.data());
    OQS_SIG_verify(s, msg, sizeof msg, sig.data(), len, pk.data());
  }
  for (int i = 0; i < iters; ++i) {
    for (int j = 0; j < 32; ++j) msg[j] = std::uint8_t(i * 31 + j);
    std::size_t len = 0;
    auto t = now_ns();
    OQS_SIG_sign(s, sig.data(), &len, msg, sizeof msg, sk.data());
    sg.push_back(now_ns() - t);
    t = now_ns();
    const bool ok = OQS_SIG_verify(s, msg, sizeof msg, sig.data(), len, pk.data()) == OQS_SUCCESS;
    vf.push_back(now_ns() - t);
    if (!ok) { OQS_SIG_free(s); return r; }
  }
  r.available = true;
  r.iterations = iters;
  r.verify_p99_ns = pct(vf, 0.99);
  r.keygen_ns = median(kg);
  r.sign_ns = median(sg);
  r.verify_ns = median(vf);
  r.pk_bytes = s->length_public_key;
  r.sk_bytes = s->length_secret_key;
  r.sig_bytes = s->length_signature;
  OQS_SIG_free(s);
  return r;
}

KemBench PqcEngine::bench_kem(const char* oqs_name, const char* label, int iters) {
  KemBench r;
  r.name = label;
  OQS_KEM* k = OQS_KEM_new(oqs_name);
  if (!k) return r;
  std::vector<std::uint8_t> pk(k->length_public_key), sk(k->length_secret_key), ct(k->length_ciphertext),
      ss1(k->length_shared_secret), ss2(k->length_shared_secret);
  std::vector<std::uint64_t> kg, en, de;
  for (int i = 0; i < iters; ++i) {
    auto t = now_ns();
    OQS_KEM_keypair(k, pk.data(), sk.data());
    kg.push_back(now_ns() - t);
    t = now_ns();
    OQS_KEM_encaps(k, ct.data(), ss1.data(), pk.data());
    en.push_back(now_ns() - t);
    t = now_ns();
    OQS_KEM_decaps(k, ss2.data(), ct.data(), sk.data());
    de.push_back(now_ns() - t);
    if (!ct_equal(ss1.data(), ss2.data(), ss1.size())) { OQS_KEM_free(k); return r; }
  }
  r.available = true;
  r.iterations = iters;
  r.keygen_ns = median(kg);
  r.encaps_ns = median(en);
  r.decaps_ns = median(de);
  r.pk_bytes = k->length_public_key;
  r.sk_bytes = k->length_secret_key;
  r.ct_bytes = k->length_ciphertext;
  r.ss_bytes = k->length_shared_secret;
  OQS_KEM_free(k);
  return r;
}

}  // namespace aether
