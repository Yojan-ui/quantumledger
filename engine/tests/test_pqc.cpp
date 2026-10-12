// PQC gate: valid ML-DSA orders pass; tampering, classical algorithms,
// downgrades, key substitution, staleness and replays are each rejected
// with the precise reason.

#include <oqs/oqs.h>

#include <cstdio>
#include <cstdlib>
#include <vector>

#include "aether/PqcEngine.hpp"

using namespace aether;

#define CHECK(c)                                                         \
  do {                                                                   \
    if (!(c)) {                                                          \
      std::fprintf(stderr, "%s:%d CHECK failed: %s\n", __FILE__, __LINE__, #c); \
      std::exit(1);                                                      \
    }                                                                    \
  } while (0)

struct Signer {
  OQS_SIG* s;
  std::vector<std::uint8_t> pk, sk;
  std::uint8_t fp[kKeyFpLen];
  explicit Signer(const char* alg) : s(OQS_SIG_new(alg)), pk(s->length_public_key), sk(s->length_secret_key) {
    OQS_SIG_keypair(s, pk.data(), sk.data());
    PqcEngine::key_fingerprint(pk.data(), pk.size(), fp);
  }
  ~Signer() { OQS_SIG_free(s); }
  std::vector<std::uint8_t> sign(const SignedEnvelope& e) const {
    const Digest d = order_digest(e.kind, e.id, e.participant, e.side, e.price, e.qty, e.ts_ns);
    std::vector<std::uint8_t> sig(s->length_signature);
    std::size_t len = 0;
    OQS_SIG_sign(s, sig.data(), &len, d.data(), d.size(), sk.data());
    sig.resize(len);
    return sig;
  }
};

int main() {
  CHECK(ct_equal(reinterpret_cast<const std::uint8_t*>("abcd"), reinterpret_cast<const std::uint8_t*>("abcd"), 4));
  CHECK(!ct_equal(reinterpret_cast<const std::uint8_t*>("abcd"), reinterpret_cast<const std::uint8_t*>("abce"), 4));

  PqcEngine eng;
  Signer desk(OQS_SIG_alg_ml_dsa_65), attacker(OQS_SIG_alg_ml_dsa_65), desk87(OQS_SIG_alg_ml_dsa_87);
  CHECK(eng.register_key(7, SigAlg::MlDsa65, desk.pk.data(), desk.pk.size()));
  CHECK(eng.register_key(7, SigAlg::MlDsa87, desk87.pk.data(), desk87.pk.size()));
  CHECK(!eng.register_key(7, SigAlg::MlDsa65, desk.pk.data(), 10));

  SignedEnvelope e{};
  e.kind = MsgKind::NewOrder;
  e.id = 100;
  e.participant = 7;
  e.side = Side::Buy;
  e.price = 1'000'000;
  e.qty = 50'000;
  e.ts_ns = wall_ns();
  e.alg = SigAlg::MlDsa65;
  e.key_fp = desk.fp;
  auto sig = desk.sign(e);
  e.sig = sig.data();
  e.sig_len = sig.size();
  VerifyProfile prof;

  CHECK(eng.verify(e, prof) == VerifyStatus::Ok);
  CHECK(prof.verify_ns > 0);
  CHECK(eng.verify(e, prof) == VerifyStatus::Replay);          // same id again

  e.id = 101;                                                  // id changed after signing
  CHECK(eng.verify(e, prof) == VerifyStatus::BadSignature);

  auto sig101 = desk.sign(e);
  e.sig = sig101.data();
  e.price += 100;                                              // price tampered in flight
  CHECK(eng.verify(e, prof) == VerifyStatus::BadSignature);
  e.price -= 100;
  e.side = Side::Sell;                                         // side flipped in flight
  CHECK(eng.verify(e, prof) == VerifyStatus::BadSignature);
  e.side = Side::Buy;
  CHECK(eng.verify(e, prof) == VerifyStatus::Ok);

  // Attacker signs with their own key and claims desk 7, presenting their own
  // key fingerprint: refused by the constant-time fingerprint binding.
  e.id = 102;
  auto asig = attacker.sign(e);
  e.sig = asig.data();
  e.key_fp = attacker.fp;
  CHECK(eng.verify(e, prof) == VerifyStatus::KeyMismatch);
  // ...or copies desk 7's public fingerprint: the ML-DSA signature fails.
  e.key_fp = desk.fp;
  CHECK(eng.verify(e, prof) == VerifyStatus::BadSignature);

  e.alg = SigAlg::EcdsaP256;
  CHECK(eng.verify(e, prof) == VerifyStatus::ClassicalRejected);
  e.alg = SigAlg::MlDsa65;

  e.participant = 999;
  CHECK(eng.verify(e, prof) == VerifyStatus::UnknownParticipant);
  e.participant = 7;

  e.ts_ns -= 60'000'000'000ull;
  CHECK(eng.verify(e, prof) == VerifyStatus::StaleTimestamp);

  // Policy raised to NIST category 5: ML-DSA-65 is now a downgrade.
  eng.set_min_level(SigAlg::MlDsa87);
  e.ts_ns = wall_ns();
  e.id = 103;
  auto s65 = desk.sign(e);
  e.sig = s65.data();
  CHECK(eng.verify(e, prof) == VerifyStatus::AlgPolicy);
  e.alg = SigAlg::MlDsa87;
  e.key_fp = desk87.fp;
  auto s87 = desk87.sign(e);
  e.sig = s87.data();
  e.sig_len = s87.size();
  CHECK(eng.verify(e, prof) == VerifyStatus::Ok);

  // Cancels are signed under a distinct message kind.
  SignedEnvelope cx{};
  cx.kind = MsgKind::Cancel;
  cx.id = 103;
  cx.participant = 7;
  cx.ts_ns = wall_ns();
  cx.alg = SigAlg::MlDsa87;
  cx.key_fp = desk87.fp;
  auto cs = desk87.sign(cx);
  cx.sig = cs.data();
  cx.sig_len = cs.size();
  CHECK(eng.verify(cx, prof) == VerifyStatus::Ok);
  cx.kind = MsgKind::NewOrder;                                 // cancel sig reused as order
  CHECK(eng.verify(cx, prof) == VerifyStatus::BadSignature);

  std::puts("pqc: all tests passed");
  return 0;
}
