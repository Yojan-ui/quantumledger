# Secrets to rotate

**None.** No real secret has ever been committed to this repository.

## How this was checked (2026-10-14)

- `gitleaks git --log-opts="--all"` (gitleaks 8.30.1, the official release, checksum-verified) over
  every commit on every branch: 6 findings, all `generic-api-key` matches on the text
  `key_exchange_group = X25519MLKEM768` (and `X25519`) in `apps/web/data/scan-cache.json`. Those are
  TLS group names from cached public scans: **false positives**.
- `git log --all -- '**/.data'` is empty. The local demo KMS files (`apps/web/.data/kms.kek`,
  `keystore.json`) and `.env*` files have always been git-ignored.
- No `NEXT_PUBLIC_` variable holds anything sensitive. The built browser bundle (`.next/static`)
  contains none of `ADMIN_PASSWORD`, `QSETU_KMS_KEK`, `RESEND_API_KEY`, `DATABASE_URL` or
  `UPSTASH_REDIS*`.

## If a secret is ever committed

Deleting it in a new commit does **not** remove it: it stays in the history, in every clone and in
GitHub's caches. Instead:

1. **Rotate it first.** Issue a new value at the provider and revoke the old one:
   - `ADMIN_PASSWORD`: change it. That also invalidates every admin session, because the session
     token is derived from it.
   - `SESSION_SECRET`: change it. Every demo session is reissued automatically.
   - `QSETU_KMS_KEK`: generate a new 32-byte key (`openssl rand -hex 32`), then re-wrap the keystore
     with it. Treat every key it wrapped as exposed and rotate them (`POST /api/keys/rotate`, admin).
   - `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, the password in `DATABASE_URL`, and the
     `ALERT_WEBHOOK_URL` / `TURNSTILE_SECRET_KEY` values: revoke them in the provider's dashboard
     and issue new ones.
2. Then add it to this file with the date, the commit, and the rotation done.
3. Optionally rewrite history (`git filter-repo`) and force-push. Only after rotating, because the
   old value must be assumed copied.

The CI workflow runs gitleaks on every PR (phase 5), so a new leak is caught before merge.
