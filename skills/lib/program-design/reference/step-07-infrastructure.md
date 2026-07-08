<!-- program-design · step 07 detail. Opened via the Step-index in ../SKILL.md. Do not edit apart from SKILL.md. -->

### Step 7. Describe the app infrastructure module

**In:** the slices with their inputs and I/O objects. **Out:** `infrastructure.md` — program assembly and entry-point wiring.

The infrastructure module is one per program, the technical root. Its composition depends on
which input types the service has (see Step 2):

- initializes shared dependencies (DB pool, broker client, logger, configuration);
- if there are HTTP slices — brings up the HTTP server and registers routes, each leading to its
  slice's ingress adapter;
- if there are Broker slices — brings up the broker consumer and subscribes the ingress adapters
  to their topics/queues;
- if there are gRPC slices — brings up the gRPC server and registers the ingress adapters as
  handlers of their methods;
- if there are CLI/cron slices — registers the entry points in the scheduler or CLI router;
- passes the slice its initialized dependencies via DI / parameters.

This module has **no business logic**, not a single line. Its job is to assemble the program
from ready slices and bring it up. No orchestration between slices — impossible by construction,
because the slices are independent.

**Config flags are loaded and validated here (boot).** Every configuration flag / deployment policy
from the data dictionary (`requirements-intake` §7) is loaded and validated at startup; an invalid value
→ **fail fast, no serving, exit non-zero, `CONFIG_INVALID`** (a boot precondition, not a runtime branch).
A slice node that reads a policy/flag from its `Deps` **MUST** trace to such a config-dictionary field —
a behavior-changing flag with no config-dictionary entry is a hidden knob (an untraced config or
gold-plating); if the policy is genuinely unresolved it is an operator **open question**, not a knob
invented at design time.

This module is tested not by units (nothing to test in pure form) but by component tests that
check each slice through its real input — an HTTP request for an HTTP slice, a message publish to
the broker for a Broker slice, a gRPC call for a gRPC slice.

Don't confuse it with the **slice head module** (see Step 3): that's a logic module, the pipe
orchestrator of a specific slice, written per slice.
