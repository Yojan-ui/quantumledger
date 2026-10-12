#include "aether/ClassicalBaseline.hpp"

#include <algorithm>
#include <vector>

#if defined(AETHER_HAVE_OPENSSL)
#include <openssl/core_names.h>
#include <openssl/evp.h>
#include <openssl/x509.h>
#elif defined(__APPLE__)
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#endif

namespace aether {

#if defined(AETHER_HAVE_OPENSSL)
namespace {

constexpr const char* kBackend = "OpenSSL " OPENSSL_VERSION_STR;

std::uint64_t median(std::vector<std::uint64_t>& v) {
  if (v.empty()) return 0;
  std::nth_element(v.begin(), v.begin() + std::ptrdiff_t(v.size() / 2), v.end());
  return v[v.size() / 2];
}
std::uint64_t p99(std::vector<std::uint64_t> v) {
  if (v.empty()) return 0;
  std::sort(v.begin(), v.end());
  return v[std::min(v.size() - 1, std::size_t(0.99 * double(v.size())))];
}

struct PKey {
  EVP_PKEY* k = nullptr;
  explicit PKey(EVP_PKEY* p) : k(p) {}
  ~PKey() { EVP_PKEY_free(k); }
  PKey(const PKey&) = delete;
  PKey& operator=(const PKey&) = delete;
};

// Raw public key size as it would travel in a handshake: uncompressed EC
// point (65 B) or PKCS#1 RSAPublicKey DER (270 B).
std::size_t pub_bytes(EVP_PKEY* k, bool ec) {
  if (ec) {
    std::size_t n = 0;
    EVP_PKEY_get_octet_string_param(k, OSSL_PKEY_PARAM_ENCODED_PUBLIC_KEY, nullptr, 0, &n);
    return n;
  }
  return std::size_t(std::max(0, i2d_PublicKey(k, nullptr)));
}
std::size_t priv_bytes(EVP_PKEY* k) { return std::size_t(std::max(0, i2d_PrivateKey(k, nullptr))); }

template <class Gen>
SigBench bench_evp_sig(const char* name, Gen gen, bool ec, int iters, int kg_iters) {
  SigBench r;
  r.name = name;
  r.backend = kBackend;
  std::vector<std::uint64_t> kg, sg, vf;
  EVP_PKEY* last = nullptr;
  for (int i = 0; i < kg_iters; ++i) {
    EVP_PKEY_free(last);
    const auto t = now_ns();
    last = gen();
    kg.push_back(now_ns() - t);
  }
  if (!last) return r;
  PKey key(last);
  std::uint8_t msg[32]{}, sig[512];
  std::size_t max_len = 0;
  EVP_MD_CTX* ctx = EVP_MD_CTX_new();
  for (int i = 0; i < iters / 5; ++i) {   // untimed warm-up, mirrors the liboqs bench
    std::size_t len = sizeof sig;
    EVP_DigestSignInit(ctx, nullptr, EVP_sha256(), nullptr, key.k);
    EVP_DigestSign(ctx, sig, &len, msg, sizeof msg);
    EVP_MD_CTX_reset(ctx);
  }
  for (int i = 0; i < iters; ++i) {
    for (int j = 0; j < 32; ++j) msg[j] = std::uint8_t(i * 31 + j);
    std::size_t len = sizeof sig;
    auto t = now_ns();
    const bool s_ok = EVP_DigestSignInit(ctx, nullptr, EVP_sha256(), nullptr, key.k) == 1 &&
                      EVP_DigestSign(ctx, sig, &len, msg, sizeof msg) == 1;
    sg.push_back(now_ns() - t);
    EVP_MD_CTX_reset(ctx);
    t = now_ns();
    const bool v_ok = EVP_DigestVerifyInit(ctx, nullptr, EVP_sha256(), nullptr, key.k) == 1 &&
                      EVP_DigestVerify(ctx, sig, len, msg, sizeof msg) == 1;
    vf.push_back(now_ns() - t);
    EVP_MD_CTX_reset(ctx);
    if (!s_ok || !v_ok) { EVP_MD_CTX_free(ctx); return r; }
    max_len = std::max(max_len, len);   // DER ECDSA varies 70–72 B
  }
  EVP_MD_CTX_free(ctx);
  r.available = true;
  r.iterations = iters;
  r.keygen_ns = median(kg);
  r.sign_ns = median(sg);
  r.verify_p99_ns = p99(vf);
  r.verify_ns = median(vf);
  r.pk_bytes = pub_bytes(key.k, ec);
  r.sk_bytes = priv_bytes(key.k);
  r.sig_bytes = max_len;
  return r;
}

bool derive(EVP_PKEY* priv, EVP_PKEY* peer, std::uint8_t* out, std::size_t* len) {
  EVP_PKEY_CTX* c = EVP_PKEY_CTX_new(priv, nullptr);
  const bool ok = c && EVP_PKEY_derive_init(c) == 1 && EVP_PKEY_derive_set_peer(c, peer) == 1 &&
                  EVP_PKEY_derive(c, out, len) == 1;
  EVP_PKEY_CTX_free(c);
  return ok;
}

}  // namespace

SigBench bench_ecdsa_p256(int iters) {
  return bench_evp_sig("ECDSA-P256", [] { return EVP_EC_gen("P-256"); }, true, iters, std::max(1, iters / 4));
}

SigBench bench_rsa2048(int iters) {
  // RSA key generation is tens of ms per key; sample it a handful of times only.
  return bench_evp_sig("RSA-2048", [] { return EVP_RSA_gen(2048); }, false, iters, 3);
}

KemBench bench_ecdh_p256(int iters) {
  KemBench r;
  r.name = "ECDH-P256";
  r.backend = kBackend;
  std::vector<std::uint64_t> kg, en, de;
  std::uint8_t ss1[64], ss2[64];
  std::size_t n1 = 0;
  for (int i = 0; i < iters; ++i) {
    auto t = now_ns();
    PKey server(EVP_EC_gen("P-256"));
    kg.push_back(now_ns() - t);
    // "encaps": ephemeral client key + ECDH against the server's static key
    t = now_ns();
    PKey eph(EVP_EC_gen("P-256"));
    n1 = sizeof ss1;
    const bool ok1 = derive(eph.k, server.k, ss1, &n1);
    en.push_back(now_ns() - t);
    // "decaps": server derives the same secret from the ephemeral public key
    t = now_ns();
    std::size_t n2 = sizeof ss2;
    const bool ok2 = derive(server.k, eph.k, ss2, &n2);
    de.push_back(now_ns() - t);
    if (!ok1 || !ok2 || n1 != n2 || !ct_equal(ss1, ss2, n1)) return r;
    if (i == 0) {
      r.pk_bytes = r.ct_bytes = pub_bytes(server.k, true);
      r.sk_bytes = priv_bytes(server.k);
      r.ss_bytes = n1;
    }
  }
  r.available = true;
  r.iterations = iters;
  r.keygen_ns = median(kg);
  r.encaps_ns = median(en);
  r.decaps_ns = median(de);
  return r;
}

#elif defined(__APPLE__)
namespace {

std::uint64_t median(std::vector<std::uint64_t>& v) {
  if (v.empty()) return 0;
  std::nth_element(v.begin(), v.begin() + std::ptrdiff_t(v.size() / 2), v.end());
  return v[v.size() / 2];
}
std::uint64_t p99(std::vector<std::uint64_t> v) {
  if (v.empty()) return 0;
  std::sort(v.begin(), v.end());
  return v[std::min(v.size() - 1, std::size_t(0.99 * double(v.size())))];
}

template <class T>
struct CF {   // minimal RAII for CoreFoundation objects
  T ref = nullptr;
  CF() = default;
  explicit CF(T r) : ref(r) {}
  ~CF() { if (ref) CFRelease(ref); }
  CF(const CF&) = delete;
  CF& operator=(const CF&) = delete;
  operator T() const { return ref; }
};

SecKeyRef make_key(CFStringRef type, int bits) {
  CF<CFMutableDictionaryRef> attrs(
      CFDictionaryCreateMutable(nullptr, 0, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks));
  CF<CFNumberRef> n(CFNumberCreate(nullptr, kCFNumberIntType, &bits));
  CFDictionarySetValue(attrs, kSecAttrKeyType, type);
  CFDictionarySetValue(attrs, kSecAttrKeySizeInBits, n);
  return SecKeyCreateRandomKey(attrs, nullptr);
}

std::size_t external_size(SecKeyRef k) {
  CF<CFDataRef> d(SecKeyCopyExternalRepresentation(k, nullptr));
  return d ? std::size_t(CFDataGetLength(d)) : 0;
}

SigBench bench_sec_sig(const char* name, CFStringRef type, int bits, SecKeyAlgorithm alg, int iters, int kg_iters) {
  SigBench r;
  r.name = name;
  r.backend = "Security.framework";
  std::vector<std::uint64_t> kg, sg, vf;
  SecKeyRef priv = nullptr;
  for (int i = 0; i < kg_iters; ++i) {
    if (priv) CFRelease(priv);
    const auto t = now_ns();
    priv = make_key(type, bits);
    kg.push_back(now_ns() - t);
  }
  if (!priv) return r;
  CF<SecKeyRef> sk(priv);
  CF<SecKeyRef> pk(SecKeyCopyPublicKey(sk));

  std::uint8_t msg[32];
  std::size_t sig_len = 0;
  for (int i = 0; i < iters; ++i) {
    for (int j = 0; j < 32; ++j) msg[j] = std::uint8_t(i * 31 + j);
    CF<CFDataRef> m(CFDataCreate(nullptr, msg, sizeof msg));
    auto t = now_ns();
    CF<CFDataRef> sig(SecKeyCreateSignature(sk, alg, m, nullptr));
    sg.push_back(now_ns() - t);
    if (!sig) return r;
    sig_len = std::max(sig_len, std::size_t(CFDataGetLength(sig)));   // DER ECDSA varies 70–72 B
    t = now_ns();
    const bool ok = SecKeyVerifySignature(pk, alg, m, sig, nullptr);
    vf.push_back(now_ns() - t);
    if (!ok) return r;
  }
  r.available = true;
  r.iterations = iters;
  r.keygen_ns = median(kg);
  r.sign_ns = median(sg);
  r.verify_p99_ns = p99(vf);
  r.verify_ns = median(vf);
  r.pk_bytes = external_size(pk);
  r.sk_bytes = external_size(sk);
  r.sig_bytes = sig_len;
  return r;
}

}  // namespace

SigBench bench_ecdsa_p256(int iters) {
  return bench_sec_sig("ECDSA-P256", kSecAttrKeyTypeECSECPrimeRandom, 256,
                       kSecKeyAlgorithmECDSASignatureMessageX962SHA256, iters, std::max(1, iters / 4));
}

SigBench bench_rsa2048(int iters) {
  // RSA key generation is ~100 ms per key; sample it a handful of times only.
  return bench_sec_sig("RSA-2048", kSecAttrKeyTypeRSA, 2048, kSecKeyAlgorithmRSASignatureMessagePKCS1v15SHA256,
                       iters, 3);
}

KemBench bench_ecdh_p256(int iters) {
  KemBench r;
  r.name = "ECDH-P256";
  r.backend = "Security.framework";
  std::vector<std::uint64_t> kg, en, de;
  CF<CFDictionaryRef> params(CFDictionaryCreate(nullptr, nullptr, nullptr, 0, &kCFTypeDictionaryKeyCallBacks,
                                                &kCFTypeDictionaryValueCallBacks));
  std::size_t pk_bytes = 0, sk_bytes = 0, ss_bytes = 0;
  for (int i = 0; i < iters; ++i) {
    auto t = now_ns();
    CF<SecKeyRef> server(make_key(kSecAttrKeyTypeECSECPrimeRandom, 256));
    kg.push_back(now_ns() - t);
    if (!server) return r;
    CF<SecKeyRef> server_pub(SecKeyCopyPublicKey(server));

    // "encaps": client makes an ephemeral key and derives the shared secret
    t = now_ns();
    CF<SecKeyRef> eph(make_key(kSecAttrKeyTypeECSECPrimeRandom, 256));
    CF<CFDataRef> ss1(SecKeyCopyKeyExchangeResult(eph, kSecKeyAlgorithmECDHKeyExchangeStandard, server_pub, params, nullptr));
    en.push_back(now_ns() - t);
    CF<SecKeyRef> eph_pub(SecKeyCopyPublicKey(eph));

    // "decaps": server derives the same secret from the ephemeral public key
    t = now_ns();
    CF<CFDataRef> ss2(SecKeyCopyKeyExchangeResult(server, kSecKeyAlgorithmECDHKeyExchangeStandard, eph_pub, params, nullptr));
    de.push_back(now_ns() - t);
    if (!ss1 || !ss2 || !CFEqual(ss1, ss2)) return r;
    if (i == 0) {
      pk_bytes = external_size(server_pub);
      sk_bytes = external_size(server);
      ss_bytes = std::size_t(CFDataGetLength(ss1));
    }
  }
  r.available = true;
  r.iterations = iters;
  r.keygen_ns = median(kg);
  r.encaps_ns = median(en);
  r.decaps_ns = median(de);
  r.pk_bytes = pk_bytes;
  r.sk_bytes = sk_bytes;
  r.ct_bytes = pk_bytes;
  r.ss_bytes = ss_bytes;
  return r;
}

#else

SigBench bench_ecdsa_p256(int) { SigBench r; r.name = "ECDSA-P256"; r.backend = "unavailable"; return r; }
SigBench bench_rsa2048(int) { SigBench r; r.name = "RSA-2048"; r.backend = "unavailable"; return r; }
KemBench bench_ecdh_p256(int) { KemBench r; r.name = "ECDH-P256"; r.backend = "unavailable"; return r; }

#endif

}  // namespace aether
