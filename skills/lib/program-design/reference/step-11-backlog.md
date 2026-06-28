<!-- program-design · step 11 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 11. Build the ticket backlog

**In:** the assembled design package from Step 10. **Out:** `backlog.md` — one ticket per slice with a concrete DoD.

One ticket = one slice.

**Hard rule: the template below is a skeleton, not the final text.** Each generic DoD item MUST
be replaced with specifics from the already-completed steps. Placeholders in a finished ticket
are a sign Step 11 isn't done.

Substitution table:

| DoD item (template) | Where to take the specifics |
|---|---|
| "ingress adapter implemented" | Name the function and file from `infrastructure.md` (Step 7) |
| "constructors … implemented" | List the concrete `NewT` from the slice card (Step 3/5) |
| "logic modules implemented" | List the concrete functions from the slice card (Step 3) |
| "I/O module isolates…" | Name the I/O object and its methods (Step 6) |
| "head module implemented" | Name `Process<Slice>` and the file `head.go` (Step 3) |
| "slice wired" | Name the concrete file and entry point from `infrastructure.md` (Step 7) |
| "unit tests by formula" | Insert the total from the Step 8.1 table with a per-module breakdown |
| "component test green" | Name the concrete scenarios from `.feature` (Step 8.3/8.4) and the run command |

**The ticket template and a filled example are in [`ticket-template.md`](ticket-template.md)**
(opened at this step, not kept in context permanently).

**Action (mandatory):** open `ticket-template.md`, copy the needed template into `backlog.md`
verbatim, then replace each placeholder `<…>` with specifics per the substitution table above.
Don't reproduce the template from memory — copy from the file.
