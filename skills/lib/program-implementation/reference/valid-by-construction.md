<!-- program-implementation · valid-by-construction recipe. Rule: program-design step-03. Enforced: harness/validate-constructors.mjs -->

### Valid by construction — the canonical Go value-object

A domain struct is valid **by its type**: illegal states cannot be built. The Go analog of a Java
private constructor = **unexported fields + a single exported factory returning `Result<T, Error>`**.
Every field is validated against its domain/range; no field passes unchecked.

Each field is **either** its own validated value-object **or** a primitive range-checked in the factory:

```go
// domain.go — unexported fields; only getters escape the package
type Platform    struct{ v string }
type ServiceName struct{ v string }
type ServiceEntry struct {
	platform Platform
	service  ServiceName
}
func (e ServiceEntry) Platform() string { return e.platform.v }

// logic.go — one factory per value-object; assemble only from already-valid parts
func NewPlatform(raw string) (Platform, error) {
	if !isKnownPlatform(raw) {                    // range: a fixed enum set
		return Platform{}, fmt.Errorf("%w: platform %q", ErrStoreMalformed, raw)
	}
	return Platform{v: raw}, nil
}
func NewServiceName(raw string) (ServiceName, error) {
	if strings.TrimSpace(raw) == "" {             // range: non-empty
		return ServiceName{}, fmt.Errorf("%w: empty service", ErrStoreMalformed)
	}
	return ServiceName{v: raw}, nil
}
func NewServiceEntry(raw RawServiceEntry) (ServiceEntry, error) {
	p, err := NewPlatform(raw.Platform);   if err != nil { return ServiceEntry{}, err }
	s, err := NewServiceName(raw.Service); if err != nil { return ServiceEntry{}, err }
	return ServiceEntry{platform: p, service: s}, nil
}
```

`ServiceEntry` cannot exist with an invalid `service` — both fields passed their factory. The valid
range comes from the **data dictionary** (`requirements-intake` §7), never invented here.

**wire-DTO lives only at the boundaries.** `RawServiceEntry`/`*Request`/`*Response` have **exported**
fields + `json:`/`yaml:` tags and are **unvalidated by design** — they carry bytes across the **ingress**
edge (the adapter parses the request) and the **egress** edge (the I/O object reads the store /
serializes the response). They are legitimate **only** there; nothing deeper than the edge may hold a
DTO. The ingress adapter / I/O object parses a DTO, then a factory (`NewX`) turns it into a domain
value-object — **past the edge, only valid-by-construction types exist**.

**Enforced by `harness/validate-constructors.mjs`** (implementation-time gate): (1) unexported fields,
(2) a `NewX` factory exists, (3) the factory has a validating guard (not pass-through), (4) no naked
`T{...}` outside `NewX`. Per-field completeness is proven by the unit-test formula (`1 + Σ branches`).
