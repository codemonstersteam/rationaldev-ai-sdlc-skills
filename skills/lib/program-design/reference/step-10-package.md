<!-- program-design · step 10 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 10. Assemble the design package

**In:** all artifacts from Steps 1–9. **Out:** folder `.agent/planner/design/<slug>/` with the full design package.

The planner's final artifact — the folder `.agent/planner/design/<slug>/`:

```
.agent/planner/design/<slug>/
├── intent.md              # one phrase + context
├── slices.md              # slice table
├── messages.md            # message catalog with types
├── slices/
│   ├── 01-<slice>.md      # module tree (adapter → head → logic → I/O)
│   │                      #   + contracts + antecedents/consequents + tests
│   ├── 02-<slice>.md
│   └── ...
├── infrastructure.md      # app infrastructure module:
│                          #   HTTP server / broker consumer /
│                          #   gRPC server / cron — depending on
│                          #   the slices' input types
├── contracts-graph.md     # module call graph + consistency reconciliation
│                          #   (see Step 9)
└── backlog.md             # tickets for the implementer (see below)
```

#### Two locations — working package vs published durable docs

- **`.agent/planner/design/<slug>/`** (above) = the planner's **working package** — slice cards,
  messages, contracts-graph, infrastructure, backlog, devlog, handoff. Ephemeral; drives review and
  handoff.
- **`docs/design/<slice>/`** (committed to the service repo) = the **published durable design**,
  authored by the owning skills and reviewed at Gate #1:
  - `module-tree.md` — module tree + head-pipe pseudocode (this skill, Step 3);
  - `c4.md` — C2 + C3 in Mermaid (`c4` skill, stage 9);
  - `use-case.md` — fully-dressed Cockburn use case (`cockburn-use-case` skill, stage 2);
  - `contracts.md` — module contracts + compatibility (this skill, Steps 5/9).

The working slice card **links** these published docs — it does not duplicate them. See
[`docs/05_REPO_STRUCTURE.md`](../../../docs/05_REPO_STRUCTURE.md) and
[`docs/04_PLANNING_PIPELINE.md`](../../../docs/04_PLANNING_PIPELINE.md).
