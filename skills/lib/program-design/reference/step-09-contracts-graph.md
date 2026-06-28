<!-- program-design · step 09 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 9. Reconcile the consistency of all module contracts

**In:** all contracts, messages, signatures. **Out:** `contracts-graph.md` — a consistent call graph per slice.

By now all modules, all messages, all signatures are described. Before assembling the design
package — a mandatory reconciliation: **no module may reference a struct or signature that
doesn't exist**, and **no consequent of module A may contradict the antecedent of module B** that
A calls.

Without this step the implementer hits the mismatch at compile time (wrong struct) or at test
time (a constructor antecedent fails because the previous module returned something else).
Cheaper to find the mismatch on paper.

Reconciliation is done through the **slice's module call graph**. One graph per slice + one
shared graph over the message catalog.

#### 9.1. Message catalog: transitive closure

Walk `messages.md` and check:

- each field of each struct has a declared type;
- if the type is another struct from the catalog, it too is described;
- if the type is constructor-validated (`Email`, `Handle`, `BirthDate`), it explicitly describes
  a constructor `NewT(...) -> (T, error)`.

No "define later" and no `TODO: clarify type` in the catalog.

#### 9.2. Slice call graph

For each slice draw (ASCII or mermaid) a graph: which module calls whom and what it passes. The
arrow carries a **struct name**, not an informal description. **Each slice module is a separate
graph node**; don't collapse "all constructors" or "all I/O" into one box — you lose the
reconciliation.

Example (registration slice):

```
ingress adapter (HTTP / Broker / gRPC / CLI)
   |
   | parses to: Request
   v
slice head module (processRegistration)
   |
   |-- (1) NewRegistrationCommand(Request) -> (RegistrationCommand, error)
   |       calls constructors: NewHandle, NewEmail, NewBirthDate
   |
   |-- (2) loadExistingUser(handle Handle, db) -> (Maybe<User>, error)
   |       I/O #1: read from DB
   |
   |-- (3) buildChallenge(cmd RegistrationCommand) -> Challenge
   |       pure logic function
   |
   |-- (4) persistChallenge(challenge Challenge, db) -> error
   |       I/O #2: write to DB
   |
   |-- (5) publishRegistrationStarted(challenge Challenge, broker) -> error
   |       I/O #3: publish to broker
   |
   |-- (6) buildResponse(challenge Challenge) -> RegistrationResponse
   |       pure logic function
   v
ingress adapter (formats RegistrationResponse into the HTTP/Broker/gRPC response)
```

Visible: the validation constructor (1), three I/O modules (2, 4, 5), two pure logic functions
(3, 6). The graph shows at once which integrations the slice has and in what order they're called.

#### 9.3. Reconciliation checklist

For each graph arrow check **six items**:

1. **The arrow's type exists** in `messages.md` or the language's standard library.
2. **The arrow's signature name matches** what's recorded in the receiving module's card. Not
   "createRegistration" in one place and "registerUser" in another.
3. **Sender's consequent ⊆ receiver's antecedent.** What module A guarantees on output must
   fully satisfy what module B requires on input. If A guarantees "email non-empty" but B
   requires "email non-empty and confirmed" — a mismatch, B will fail.
4. **Error type consistent.** If A can return `ErrEmailInvalid` but B doesn't handle that error
   class — a mismatch, the error leaks past the handler.
5. **Gherkin scenario coverage.** Each Then-step of each slice Gherkin scenario maps onto a
   concrete graph node or an ingress-adapter mapping (the table from Step 8.4). If a Then finds
   no node — a mismatch between the executable spec and the design. If a graph node is mentioned
   by no Then — the node is a deletion candidate (dead logic), or Gherkin is missing a scenario.
   Both cases — return to Step 3 or Step 5, not "we'll fix it in implementation".
6. **One data argument per node.** On each node's input arrow — exactly one domain struct / DTO /
   void. If there are several input arrows (a node gets 2+ data arguments) — a Step 3 violation of
   the "single argument hard rule": return to Step 3, introduce a domain entity and a constructor
   node. Dependencies (`*sql.DB`, `clock.Clock`, config) are **not** shown on the graph arrows —
   they're in the module contract's `Dependencies:`.

#### 9.4. Record the reconciliation

The reconciliation result goes in `.agent/planner/design/<slug>/contracts-graph.md`:

- ASCII or mermaid graph per slice;
- arrow table: "who calls", "whom it calls", "what it passes", "what it gets back", "error
  classes";
- an explicit `[x] consistent` mark under each slice.

If any checklist item mismatches — **return to Step 5** (module contracts) and fix. Not "we'll
fix it in implementation" — fix in the spec, then re-run 9.1–9.3.

The step is done when all arrows of all graphs are marked `[x] consistent` and
`contracts-graph.md` is frozen.
