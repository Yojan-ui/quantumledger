#pragma once
// Classical (pre-quantum) baselines measured on the same machine so every
// comparison in the HUD is apples-to-apples. Preferred backend is OpenSSL 3
// libcrypto (what production classical stacks actually run). If OpenSSL is not
// found at configure time, macOS falls back to Security.framework — note its
// SecKey API adds ~1 ms of per-call overhead to EC operations, so the backend
// name is always reported alongside the numbers.

#include "aether/PqcEngine.hpp"

namespace aether {

SigBench bench_ecdsa_p256(int iters);
SigBench bench_rsa2048(int iters);
KemBench bench_ecdh_p256(int iters);   // ephemeral ECDH framed as a KEM: ct == ephemeral public key

}  // namespace aether
