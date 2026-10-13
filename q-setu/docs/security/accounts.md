# Accounts: two-factor and least privilege (for the founder, by hand)

Automated attackers go after *access* as much as code: a phished or reused password on GitHub or
Vercel is a full compromise, whatever the code does. Work through this list once, then check it
every quarter.

## Turn on 2FA (use an authenticator app or a passkey, not SMS)

- [ ] **GitHub:** Settings → Password and authentication → Two-factor authentication. Prefer a
      passkey or security key. Save the recovery codes in a password manager.
- [ ] **GitHub organisation (if any):** Settings → Authentication security → *Require two-factor
      authentication* for all members.
- [ ] **Vercel** (or wherever the site is hosted: Render, Fly…): Account Settings → Authentication
      → enable 2FA. For a team: require 2FA for all members.
- [ ] **Domain registrar** (where the domain was bought): enable 2FA *and* registrar lock
      (transfer lock), so nobody can move the domain or its DNS.
- [ ] **DNS provider** (Cloudflare, if separate from the registrar): enable 2FA.
- [ ] **Database provider** (Neon / Supabase / Railway): enable 2FA.
- [ ] **Email provider** (Resend) and the mailbox behind `SECURITY_CONTACT`: enable 2FA.
- [ ] **Upstash** (rate limits) and **Cloudflare Turnstile** (bot protection): enable 2FA.
- [ ] **npm** (only if packages are ever published): `npm profile enable-2fa auth-and-writes`.
- [ ] Store every recovery code in a password manager, not in a file in this repository.

## Least privilege for each key

| Secret | Give it only | How |
| --- | --- | --- |
| `RESEND_API_KEY` | Sending, from one domain | Resend → API Keys → permission *Sending access*, restricted to your domain (not *Full access*). |
| `DATABASE_URL` | Its own database | A dedicated role that owns only this app's schema; not the provider's admin/owner role; no `SUPERUSER`/`CREATEDB`. |
| `UPSTASH_REDIS_REST_TOKEN` | One database used only for rate limits | A separate Upstash database, so a leaked token can't touch anything else. (The limiter writes counters, so it can't be read-only.) |
| `TURNSTILE_SECRET_KEY` | One widget | A widget restricted to your hostnames. |
| `ALERT_WEBHOOK_URL` | Posting to one channel | A dedicated incoming webhook for a private alerts channel. |
| GitHub Actions `GITHUB_TOKEN` | Read | The workflows set `permissions: contents: read` (plus `security-events: write` only for CodeQL). |
| Vercel / deploy tokens | One project | Scope tokens to the one project; set an expiry. |
| `ADMIN_PASSWORD` | One person | 20+ random characters from a password manager; change it when anyone with access leaves. |

## Hygiene

- [ ] Remove old collaborators and unused deploy keys from GitHub and Vercel.
- [ ] Turn on GitHub *secret scanning* and *push protection* (Settings → Code security).
- [ ] Turn on Dependabot alerts (the `dependabot.yml` from phase 5 handles updates).
- [ ] Use a different password for each account above; never reuse one.
