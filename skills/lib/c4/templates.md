# c4 · templates — C2/C3 Mermaid blocks (companion)

> Companion к [`SKILL.md`](./SKILL.md). Читай **когда рисуешь** `c4.md` (роль-дизайнер):
> готовые Mermaid-шаблоны C2/C3 + пример head-pipe + foundations. Ревьюер (`mills`) сверяет
> по Hard rules в `SKILL.md` и это НЕ читает.

## C2 — Container (template)

One deployable unit + honestly-reused libraries as external containers. Fill from the stack.

```mermaid
C4Container
    title <service> — Container
    Person(actor, "<primary actor>", "")
    System_Boundary(s, "<service>") {
        Container(app, "<deployable unit>", "<tech>", "<one-line role>")
        Container_Ext(lib, "<reused library>", "<lang> lib", "<what it does>")
    }
    ContainerDb(store, "<datastore>", "<tech>", "<what it holds>")
    System_Ext(ext, "<external system>", "<what/why>")
    Rel(actor, app, "<action>", "<protocol>")
    Rel(app, store, "reads/writes", "<driver>")
    Rel(app, ext, "<call>", "<protocol>")
```

## C3 — Component = the slice's module tree (template)

Dependencies point **inward**: ingress → head → {logic, I/O}. Logic knows nothing of
cobra/http/os/time; I/O objects implement interfaces declared by the head. **Every node here is a
module from `module-tree.md`; the `io:` tag from the contract decides logic vs I/O.**

```mermaid
C4Component
    title <service> — Component (slice <name>)
    Container_Boundary(app, "<deployable unit>") {
        Component(ingress, "<ingress adapter>", "ingress", "parse only → typed Request")
        Component(head, "<Process...>", "head — ROP pipe", "linear orchestration, no business branching")
        Component(logic, "<logic modules>", "logic: constructors + pure fns", "validation; invalid input not built")
        Component(store, "<Store>", "I/O (io: db)", "pipe — no transformations")
        Component(client, "<Client>", "I/O (io: http/llm)", "pipe — no transformations")
    }
    System_Ext(ext, "<external system/lib>", "")
    Rel(ingress, head, "calls")
    Rel(head, logic, "NewX / validate")
    Rel(head, store, "Load/Save")
    Rel(head, client, "Fetch")
    Rel(client, ext, "uses")
```

Below C3, one line of the **head-pipe flow** (from `module-tree.md`):

```
cmd → ProcessSlice → Store.Load → NewX → Client.Fetch → buildResponse → result
```

## Foundations

C4 model (Brown) — C1 context / C2 container / C3 component; Mermaid `C4*` diagrams. Example layout:
[`pinout-openapi/docs/design/contract-validate/c4.md`](https://github.com/codemonstersteam/pinout-openapi/blob/main/docs/design/contract-validate/c4.md)
(registry: [`docs/templates/README.md`](../../../docs/templates/README.md)). Pairs with
`program-design` (module tree = C3) and `cockburn-use-case` (neighbor use case).
