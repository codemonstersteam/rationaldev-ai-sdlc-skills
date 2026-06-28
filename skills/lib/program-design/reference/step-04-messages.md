<!-- program-design · step 04 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 4. Describe the message catalog

**In:** the module trees from Step 3. **Out:** the message catalog — all data types and `Result<T, Error>`.

All data structures exchanged between modules inside a slice:

- `Request` — unvalidated input from the adapter. Public fields, no domain rules.
- `Command` / `Entity` / `DTO` — a validated domain object. **Unexported fields. Created only
  through the constructor** `NewT(...) -> (T, error)`, which checks the domain rules. If the
  rules don't hold — the struct isn't created.
- `Event` — a fact for the broker/observers.
- `Error` — a failure description.
- `Result<T, Error>` — the result: success with T or an error.

**Signature rule:** in `Result` always state both type parameters: `Result<Client, Error>`, not
`Result<Client>`.

**Note for Go.** In Go the idiomatic equivalent of `Result<T, Error>` is the return pair
`(T, error)`. Wherever the spec says `Result<T, Error>`, in Go code it means a function
returning `(T, error)`. Same semantics: success with T or an error. Don't introduce a generic
type `Result[T any]` in Go projects — it breaks the language idiom and adds nothing over the
standard pair.

#### Error model (explicit, documented)

`messages.md` freezes the **full error model**, not just the `Error` type:

- **code dictionary** `error.code` (machine-readable), a closed enumeration;
- **diagnostic fields**: `code` / `message` (human) / `location` (where) / `context` (details);
- **mapping `code → exit` (CLI) or `code → HTTP status`** — as a table; the same one is
  consumed by `documentation` (Pass A5b, failure table) and the ingress/egress;
- **visibility rule:** an unchecked / partial result / degradation is **visible** in the output
  (its own code or a non-zero exit), **not masked as success**. "Couldn't check" ≠ "compatible/ok".

This dictionary is the single source for the README failure table and for the system use case's
Extensions (Step 8): one failure mode = one code = one Extension.
