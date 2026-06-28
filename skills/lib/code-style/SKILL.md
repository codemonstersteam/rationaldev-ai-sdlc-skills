---
name: code-style
description: Organization coding conventions + mandatory implementation practices — feature toggles (new code OFF by default), idempotency, observability (logs/metrics/tracing without PII), error handling, secrets from vault. Apply during IMPLEMENTATION (implementer) and CODE REVIEW (fixer). This is a template — fill the `<...>` placeholders with your organization's real conventions. Do NOT apply for project decomposition (program-design / architecture).
version: "1.0"
---

# code-style — coding conventions and mandatory practices

The agent writes code consistently with the organization's codebase and follows mandatory practices.

> This is a template. Fill the `<...>` placeholders with your organization's real conventions.

## General principles

- **Readability over brevity.** Code is written once, read many times.
- **Match the existing module.** Read neighboring files before writing and follow their style, even if your personal preference differs.
- **Small, single-responsibility functions.**
- **Explicit over implicit.** No magic, hidden side effects, or non-obvious global state.

## Conventions (fill in for your organization)

- **Languages and versions:** `<e.g. Java 21 / Kotlin, Go 1.22, TypeScript 5.x>`
- **Formatting:** auto-format is mandatory (`<spotless / gofmt / prettier>`); an unformatted PR does not pass.
- **Naming:** `<camelCase for variables, PascalCase for types, ...>`
- **Linters:** `<checkstyle / golangci-lint / eslint>` — config lives in the repo; do not disable rules locally.
- **Project structure:** `<hexagonal / layered — describe>`

## Mandatory practices

### Feature toggles
**All new functionality MUST be guarded by a feature toggle, OFF by default.** The feature ships to production disabled and is opened to a fraction of the audience.

```
if (featureToggle.isEnabled("payment-email-notifications", context)) {
    // new code
}
```
The toggle MUST be registered in the toggle-management system. The toggle name lives in the plan.

### Idempotency
All state-changing operations MUST be idempotent. Use an idempotency key from the request/event. Reprocessing MUST NOT create a duplicate.

### Observability
- **Logging:** structured logs, correct levels, no PII/secrets (see skill security).
- **Metrics:** key operations instrumented (counters, latency).
- **Tracing:** propagate the correlation/trace id through every call.

### Error handling
- MUST NOT swallow exceptions silently.
- Distinguish retryable from non-retryable errors (critical for queues).
- Error messages MUST NOT expose sensitive data.

### Configuration
- No hardcoded environment, endpoints, or secrets. Everything from config/vault.

## MUST NOT

- Commented-out "dead" code in a PR.
- `TODO`/`FIXME` without a ticket.
- Disabling a linter rule locally without justification.
- Changing tests just to pass CI — escalate via fixer (Linger).
- Introducing heavy dependencies without justification in the plan.

## Output artifact

Code in the PR + a short PR description:

```markdown
## What was done
Implementation of FT-1, FT-2 (email notifications on the payment.completed event).

## Feature toggle
payment-email-notifications (OFF by default)

## Compliance
- [x] Auto-format passed
- [x] Linter clean
- [x] New functionality behind a toggle
- [x] Idempotent on payment_id
- [x] Logs without PII
- [x] Only libraries from the tech radar
```

## Self-check checklist

- [ ] Style matches the neighboring module code
- [ ] Auto-format and linter passed, rules not disabled
- [ ] New functionality behind a feature toggle
- [ ] State-changing operations are idempotent
- [ ] Logs/metrics/tracing in place, no PII
- [ ] No hardcoded configuration or secrets
- [ ] No dead code and no TODO without a ticket
