# P9 — реализация, тикеты и общий контракт

Источник — [`../../harness-hardening-and-onboarding.md`](../../harness-hardening-and-onboarding.md) §P9.
Работа порезана на 4 пакета по **владению файлами** — субагенты не пересекаются, каждый в своём worktree.

| Пакет | Владеет файлами | Тикеты |
|---|---|---|
| **A — роли и флоу** | `harness/agents/_shared/*.md`, `docs/flows/*.md`, прогон `gen-agents.mjs` (перезаписывает `agents/{claude,codex,opencode}/*`, `skills/roles/*`, `AGENTS.codex.md`) | [A](./ticket-A-roles.md) |
| **B — close-run** | `harness/close-run.mjs`, `harness/test/close-run.test.mjs` | [B](./ticket-B-close-run.md) |
| **C — enforcement** | `harness/enforcement/**`, тесты `plan-ready`/`guardrail-sync`/`claude-hooks.smoke` | [C](./ticket-C-enforcement.md) |
| **D — валидаторы и тулинг** | `harness/validate-contract-diff.mjs`, `harness/validate-layout.mjs`, `harness/lib/validators.mjs`, тесты `validators`/`contract-diff`, `ci/recipes/*` | [D](./ticket-D-validators.md) |

## Общий контракт (согласован между пакетами — менять только всем сразу)

1. **`validate-contract-diff` — CLI.** `node harness/validate-contract-diff.mjs <specPath|repoRoot>` → **одно**
   поведение: breaking → **exit 2**, аддитивно → 0, неоценимо (нет инструмента/формата) → **STOP exit 2**
   (fail-closed) с командой установки. **Флага `--require-additive` больше нет.** Пакет **D** реализует;
   пакет **A** убирает `--require-additive` из текстов флоу/ролей и вписывает, что дифф — диспетчер по формату
   (OpenAPI→`oasdiff`, AsyncAPI→`asyncapi diff`, JSON Schema→встроенный).
2. **`/debt/` (репо-корень).** Файл долга — `/debt/task-NNN.md`, `NNN` = следующий свободный 3-значный id
   (`ls /debt/`; пусто → `001`). Инвариант: `/debt/` пустой = чисто. **D** (`validate-layout.mjs`) при
   неприменимости инварианта раскладки печатает уведомление и **идемпотентно** пишет такой файл (не плодить
   дубликат для той же причины), exit 0 (не блокирует). **B** (`close-run.mjs`) удаляет `/debt/task-NNN.md`
   **только** если прогон нёс маркер `.agent/planner/resolves-debt` = `task-NNN` (закрытие именно этого долга);
   иначе не трогает. `/debt/` вне `.agent/`, поэтому вайп прогона его не сносит.
3. **Вайп прогона — инверсия.** **B**: `close-run.mjs` стирает `.agent/` **целиком**, сохраняя только явный
   белый список (кандидат — `.agent/memory.md`; проверить, действительно ли переживает задачу — если нет,
   список пуст).

## Правила для всех пакетов

- Ветка от свежего `feat/harness-hardening-p9`. **Трогать только свои файлы.** Если правка требует чужого файла
  (особенно чужого тест-файла) — **STOP, доложить**, не редактировать. Пересечения сводит оркестратор при мерже.
- Источник правды ролей — `harness/agents/_shared/*.md`; проекции генерятся `gen-agents.mjs` (только пакет A
  его запускает).
- Каждый SKILL/роль ≤300 строк. Формулировки плотные, в стиле файла.
- **Тесты обязательны** на каждое изменение поведения; в своём worktree прогнать `node --test harness/test/*.mjs`
  зелёным (baseline — 254). Ничего не коммитить в общие ветки без указания; коммит в свой worktree — да.
- Декомпозицию и тесты обосновывать дизайном (Parnas/Wirth), не лимитом модели.
