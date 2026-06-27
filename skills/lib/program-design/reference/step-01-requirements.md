<!-- program-design · step 01 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 1. Confirm the FRD from requirements-intake

**In:** the FRD `requirements/<slug>.md` from the `requirements-intake` skill.
**Out:** a verified FRD whose problem statement fits one phrase.

Requirements are not invented here — they arrive as an **FRD** produced by the
`requirements-intake` skill (business requirement → actors/interfaces → Cockburn system use
cases → draft contract + failure-mode map). Confirm it carries:

- a **problem statement** in one phrase (if it won't fit one phrase, the task is too big —
  cut it into sub-tasks or take one part);
- one **use case** per external input, each with Main Success Scenario + Extensions;
- the **interfaces** (HTTP/gRPC/broker/CLI) and the systems the program talks to.

You **MUST stop** and run `requirements-intake` first if only a one-line "intent" exists
with no FRD, or the use cases / interfaces are missing — design does not start from one
phrase.
