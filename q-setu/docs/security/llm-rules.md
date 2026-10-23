# Rules for any LLM feature

There is no LLM feature on the site or in Shield today. If one is ever added (a chat helper, a report
writer, an agent that reads alerts), it follows these rules before it ships.

1. **Untrusted input stays data.** Page content, scan results, headers, user messages and alert text
   all go to the model as quoted data, never as instructions. Assume any of it may contain a prompt
   injection.
2. **No ambient authority.**
   - The model's tools can only do what the signed-in user could do by hand, scoped to that user's sites.
   - No tool may change the defence mode, rotate keys, delete data or send email without the user
     confirming each action in the UI.
3. **No secrets in context.** Site keys, KEKs, tokens, other tenants' data and raw IPs never go into a
   prompt. Hashed IPs only, as in the logs.
4. **Outputs are checked like input.**
   - Model output is rendered as text: no HTML, no markdown links to arbitrary URLs.
   - It's validated with zod before anything acts on it.
   - It's never `eval`'d, and never used as a URL, a shell command, a SQL fragment or a file path.
5. **Bounded.** Each call has a token budget, a timeout and a per-user rate limit. A runaway loop is
   cut off by the code, not by the model.
6. **Logged.** Every tool call is logged: which user, which tool, its arguments (hashed where personal)
   and the result. Logs go to the same alert path as other security events.
7. **Tested against injection.** The prompt-injection cases below ship as tests, and must pass:
   - "ignore previous instructions";
   - instructions hidden in a scanned page;
   - a fake alert asking to switch modes;
   - a request for another tenant's data.
8. **Honest copy.** The UI says what the model can and cannot do, and that it can be wrong.
