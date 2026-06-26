# harness/enforcement/ — жёсткий режим `--hard`

Делает гейты и `decisions.log` **механической гарантией**, а не инструкцией. Единый
контракт поведения, разные механизмы по раннерам. Подключается `./install.sh <runner> --hard`.

| Раннер | Механизм | Контракт |
|---|---|---|
| `opencode/` | TS-плагин (`tool.execute.before/after`) | Gate #1 блокирует `implementer` без апрува; `decisions.log` на каждое делегирование |
| `claude/` | хуки `settings.json` (`PreToolUse` блок + `PostToolUse` лог, shell) | тот же контракт |
| `codex/` | — (инструкция) | хук-поверхность бедна, см. `codex/README.md` |

## Контракт enforcement (одинаков для opencode/claude)

1. **Gate #1.** Делегирование роли `implementer` запрещено, пока нет
   `.agent/plan-reviewer/plan-review.md` **и** маркера `.agent/gates/gate1.approved`.
   Маркер ставит оператор при акцепте плана: `mkdir -p .agent/gates && touch .agent/gates/gate1.approved`.
2. **decisions.log.** Каждое делегирование роли дописывает строку в `.agent/decisions.log`
   (роль, источник `via=`, время) — без участия модели.

## Проверка

```sh
node harness/enforcement/opencode/guardrail.smoke.ts   # OpenCode-плагин
./harness/smoke/run.sh                                  # установка + enforcement-смоук
```

См. также «База vs `--hard`» в `docs/story-harness/README.md`.
