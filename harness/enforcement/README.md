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
   Маркер ставит **хук/плагин** по явному токену оператора `GATE1 APPROVE` (чат или пункт меню) —
   и только когда план собран. Агенту запись маркера (`touch`/`>`/write/edit) заблокирована.
2. **Gate #2 (мерж).** Делегирование `@ledger` (закрытие прогона: тег → `docs/changes/LEDGER.md` →
   вайп `.agent/`) запрещено, пока нет `.agent/gates/gate2.approved`. Маркер ставит хук/плагин по
   токену `GATE2 APPROVE` — и только когда работа дошла до мержа (`gate1.approved` + `.agent/vcs/branch`);
   provenance — PR-референс из реплики. Самозапись агентом заблокирована так же, как на Gate #1.
   Второй рубеж — сам `harness/close-run.mjs` (`STOP: Gate #2 not approved`).
3. **decisions.log.** Каждое делегирование роли дописывает строку в `.agent/decisions.log`
   (роль, источник `via=`, время) — без участия модели.

## Проверка

```sh
node harness/enforcement/opencode/guardrail.smoke.ts   # OpenCode-плагин
./harness/smoke/run.sh                                  # установка + enforcement-смоук
```

См. также «База vs `--hard`» в `docs/story-harness/README.md`.
