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
├── c4.md                  # C4: C2 (container) + C3 (module tree) in
│                          #   Mermaid + system Cockburn use case
│                          #   (Step 3 "C4 by levels", Step 8.6); C1 — on the landing
└── backlog.md             # tickets for the implementer (see below)
```
