# Incident runbook

What to do when something is wrong: an attack, a leak, or Shield blocking real visitors. Keep this short
enough to follow under stress. Copy the timeline section into the incident notes as you go.

## 0. The switches

| Switch                        | Where                                                                                                             | Effect                                            | Undo               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| Shield Edge defence mode      | `curl -X POST http://<edge-admin>:9790/mode?m=monitor` (private network only)                                     | Stop blocking at once; keep scoring and reporting | `?m=protect`       |
| Defence off entirely          | `?m=off`                                                                                                          | No scoring at all; TLS and proxying carry on      | `?m=monitor`       |
| Middleware defence mode       | the `mode` option (read it from an env var such as `QSETU_SHIELD_MODE`), set to `monitor` or `off`, then redeploy | Same, for `@qsetu/shield` in an app               | set back, redeploy |
| Take the edge out of the path | DNS: point the CNAME back at the origin (TTL applies)                                                             | Traffic bypasses Shield Edge (and loses PQ TLS)   | point it back      |
| Roll back a release           | redeploy the previous image tag / commit (`git revert`, then deploy)                                              | Previous code                                     | redeploy the fix   |
| Website admin                 | unset `ADMIN_PASSWORD`, redeploy                                                                                  | Admin off entirely                                | set it again       |

**If in doubt, go to monitor.** Monitor mode can't hurt real visitors, and it keeps the evidence.

## 1. Real visitors are being blocked or challenged

1. **Stop the harm.** Switch to `monitor` (above).
2. **Find out why.** Look at the `guard` events in the edge logs, or the dashboard's alerts: the `reasons`
   field says which signals fired, such as "many requests fail" or "browser UA, non-browser TLS".
3. **Common causes:**
   - **A shared office or carrier-grade NAT IP.** The /24 view needs 8× more than one IP to count, but one
     busy IP can still trip limits. Raise the limits or exempt the path.
   - **A webhook or health check from a service.** Add it to `exempt`.
   - **A real `/admin` route listed as a honeypot.** Remove it from `EDGE_HONEYPOTS`.
4. **Fix, verify, go back to `protect`.** Watch for 30 minutes.

## 2. An attack is under way

1. **Look.** The dashboard's alerts and live metrics show:
   - the request rate;
   - the top reasons;
   - honeypot, trap and canary hits;
   - which networks are involved.
2. **If the site is still up, let the engine work.** Consider moving to `strict`: the same steps happen at
   lower scores.
3. **A canary key was used:** someone scraped a place only crawlers read.
   - Rotate whatever that page held.
   - Find how they reached it: the trap path, a leaked bundle, a public repository.
4. **The origin is overwhelmed:**
   - Scale the origin, or put a CDN cache in front of static assets.
   - Shield Edge isn't a volumetric DDoS service. For floods of tens of Gbit/s you need your provider's
     DDoS protection upstream.
5. **Keep the evidence.** Save the edge logs and the dashboard's alert export for the period.

## 3. A secret may have leaked

Follow `docs/security/rotate.md` for each secret. In order:

1. Anything that grants access: `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`, `API_TOKEN`, `SESSION_SECRET`, the
   database URL.
2. Then `SHIELD_KEK`. Re-encrypt the certificate store with the new KEK, then restart the edges.
3. Then the site keys.

Check `git log` and gitleaks: was it committed? If so, rotating the secret is the fix. Rewriting history
isn't.

## 4. A dependency is compromised (supply chain)

1. Pin the last good version, then `pnpm install` and redeploy.
2. Check the lockfile diff of the bad release, and the CycloneDX SBOM from CI, for where the package
   reaches.
3. If it ran in CI or production, treat every secret it could read as leaked (section 3).

## 5. Afterwards

Within a week, write down:

- what happened, with a timeline;
- what worked;
- what didn't;
- one or two concrete changes.

Update this runbook if a step was missing or wrong.

## Timeline template

```
HH:MM  noticed: ...
HH:MM  switched to monitor / off / bypass
HH:MM  cause found: ...
HH:MM  fix deployed: ...
HH:MM  back to protect; watched until HH:MM
```
