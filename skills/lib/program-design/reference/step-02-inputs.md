<!-- program-design · step 02 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 2. List the slice inputs

**In:** the task in one phrase + the API contract. **Out:** slice table (input type, identifier, slice name).

One external input = one vertical slice. The input type follows the integration:

- **HTTP endpoint** — for synchronous APIs.
- **Broker topic/queue** — for asynchronous events.
- **gRPC method** — for typed synchronous calls.
- **CLI / cron / file trigger** — for batch and background tasks.

If an input is not yet in the contract (`OpenAPI` for sync, `AsyncAPI` for async) — design it
with the operator. The parameters to freeze depend on the type: HTTP — method, path, auth,
idempotency; broker — topic/queue, message schema, DLQ behavior; gRPC — method and proto schema.

Freeze the table:

| # | Input type | Identifier | Slice (name) | Short description |
|---|-----------|---------------|-------------|------------------|

Where "Input type" is `HTTP` / `Broker` / `gRPC` / `CLI`, and "Identifier" is
`POST /v1/registrations` for HTTP, `registrations.created` (topic) for Broker,
`RegistrationService.Create` for gRPC, `registrations:cleanup` for cron.
