// Исполняемый смоук OpenCode-плагина enforcement (--hard).
// Запуск: node harness/enforcement/opencode/guardrail.smoke.ts  (Node >= 23)

process.env.RATIONALDEV_UPDATE = "off"   // не дёргать self-update autocheck из плагина в тестах (сетевой side-effect)
import assert from "node:assert/strict"
import { mkdtemp, writeFile, mkdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RationalGuardrail } from "./rational-guardrail.ts"

const task = (role: string) => ({ tool: "task", args: { subagent: role } })

async function run() {
  let pass = 0
  const dir = await mkdtemp(join(tmpdir(), "rg-smoke-"))
  const hooks: any = await RationalGuardrail({ directory: dir, worktree: dir } as any)

  // A0. Фронтдор (poka-yoke): пока нет brd.md, роутить можно ТОЛЬКО @gilb
  await hooks["tool.execute.before"](task("gilb"), { args: { subagent: "gilb" } }); pass++
  await assert.rejects(
    () => hooks["tool.execute.before"](task("wirth-triage"), { args: { subagent: "wirth-triage" } }),
    /Фронтдор не пройден/,
  ); pass++
  await assert.rejects(
    () => hooks["tool.execute.before"](task("wirth-planner"), { args: { subagent: "wirth-planner" } }),
    /Фронтдор не пройден/,
  ); pass++

  // грил пройден (brd.md есть) → пайплайн открывается
  await mkdir(join(dir, ".agent", "planner"), { recursive: true })
  await writeFile(join(dir, ".agent", "planner", "brd.md"), "# BRD\n")

  // A. Gate #1 блокирует implementer без апрува (brd.md уже есть — ловим именно Gate #1)
  await assert.rejects(
    () => hooks["tool.execute.before"](task("hughes"), { args: { subagent: "hughes" } }),
    /Gate #1/,
  ); pass++

  // B. Прочие роли проходят свободно
  await hooks["tool.execute.before"](task("wirth-planner"), { args: { subagent: "wirth-planner" } }); pass++

  // B2. Делегация ВНЕ пайплайн-набора (@general / general-purpose) блокируется в источнике (мис-роут)
  await assert.rejects(
    () => hooks["tool.execute.before"](task("general"), { args: { subagent: "general" } }),
    /вне пайплайн-набора/,
  ); pass++
  await assert.rejects(
    () => hooks["tool.execute.before"](task("general-purpose"), { args: { subagent: "general-purpose" } }),
    /вне пайплайн-набора/,
  ); pass++

  // C. После апрува implementer проходит
  await mkdir(join(dir, ".agent", "plan-reviewer"), { recursive: true })
  await writeFile(join(dir, ".agent", "plan-reviewer", "plan-review.md"), "OK")
  await mkdir(join(dir, ".agent", "gates"), { recursive: true })
  await writeFile(join(dir, ".agent", "gates", "gate1.approved"), "")
  await hooks["tool.execute.before"](task("hughes"), { args: { subagent: "hughes" } }); pass++

  // C2. mode=chore: implementer требует DURABLE chore-план docs/chores/<slug>/CHORE-PLAN.md (не .agent/),
  // вместо plan-review.md (изолированный каталог). mode-маркер остаётся run-state в .agent/planner/mode.
  const cdir = await mkdtemp(join(tmpdir(), "rg-chore-"))
  const chooks: any = await RationalGuardrail({ directory: cdir, worktree: cdir } as any)
  await mkdir(join(cdir, ".agent", "planner"), { recursive: true })
  await writeFile(join(cdir, ".agent", "planner", "brd.md"), "# BRD\n")
  await writeFile(join(cdir, ".agent", "planner", "mode"), "chore")
  await mkdir(join(cdir, ".agent", "gates"), { recursive: true })
  await writeFile(join(cdir, ".agent", "gates", "gate1.approved"), "")
  await assert.rejects(
    () => chooks["tool.execute.before"](task("hughes"), { args: { subagent: "hughes" } }),
    /CHORE-PLAN/,
  ); pass++
  await mkdir(join(cdir, "docs", "chores", "001-ci-on-pr"), { recursive: true })
  await writeFile(join(cdir, "docs", "chores", "001-ci-on-pr", "CHORE-PLAN.md"), "# plan\n")
  await chooks["tool.execute.before"](task("hughes"), { args: { subagent: "hughes" } }); pass++
  await rm(cdir, { recursive: true, force: true })

  // D. decisions.log пишется на делегирование
  await hooks["tool.execute.after"](task("wirth-planner"), { title: "design slice 01" })
  const log = await readFile(join(dir, ".agent", "decisions.log"), "utf8")
  assert.match(log, /role=wirth-planner/); assert.match(log, /via=opencode-plugin/); pass++

  // E. Не-task инструменты игнорируются
  const before = (await readFile(join(dir, ".agent", "decisions.log"), "utf8")).length
  await hooks["tool.execute.after"]({ tool: "read", args: {} }, {})
  const after = (await readFile(join(dir, ".agent", "decisions.log"), "utf8")).length
  assert.equal(before, after); pass++

  // H. bash: ЗАПИСЬ маркера gate1 (самоакцепт) блокируется
  const bash = (c: string) => hooks["tool.execute.before"]({ tool: "bash", args: { command: c } }, { args: { command: c } })
  await assert.rejects(() => bash("touch .agent/gates/gate1.approved"), /Маркер Gate #1/); pass++
  await assert.rejects(() => bash("echo ok > .agent/gates/gate1.approved"), /Маркер Gate #1/); pass++

  // I. bash: ЧТЕНИЕ-верификация маркера РАЗРЕШЕНА (izi должен мочь проверить — иначе ложный цикл)
  await bash("test -f .agent/gates/gate1.approved && echo EXISTS"); pass++
  await bash("ls .agent/gates/gate1.approved 2>/dev/null"); pass++

  // J. poka-yoke: done.log green-маркер принимается ТОЛЬКО если объявленные outputs тикета существуют+непусты
  const slug = "slice-01-demo"
  const tdir = join(dir, "docs", "design", slug, "tickets")
  await mkdir(tdir, { recursive: true })
  await writeFile(join(tdir, "ticket-05.md"),
    `---\nid: 05\ntype: module\nslice: ${slug}\nblocked_by: [01]\ninputs: [x]\noutputs: [internal/demo/logic.go]\nio: none\nskills: []\n---\n`)
  const doneMark = `echo "ticket-05 ${slug} green" >> .agent/planner/done.log`
  // J1: объявленный output отсутствует → deny
  await assert.rejects(() => bash(doneMark), /poka-yoke/); pass++
  // J2: output создан и непуст → маркер разрешён
  await mkdir(join(dir, "internal", "demo"), { recursive: true })
  await writeFile(join(dir, "internal", "demo", "logic.go"), "package demo\n")
  await bash(doneMark); pass++
  // J3: output существует, но ПУСТ → deny
  await writeFile(join(dir, "internal", "demo", "logic.go"), "")
  await assert.rejects(() => bash(doneMark), /poka-yoke/); pass++

  // J4: (work-scoped) тикет ЖИВЁТ в change-папке changes/<slug>/tickets/ — poka-yoke его РЕЗОЛВИТ
  // (доработка не в slice/tickets/). Объявленный output отсутствует → deny.
  const chTdir = join(dir, "docs", "design", slug, "changes", "001-precision", "tickets")
  await mkdir(chTdir, { recursive: true })
  await writeFile(join(chTdir, "ticket-07.md"),
    `---\nid: 07\ntype: module\nslice: ${slug}\nblocked_by: []\ninputs: [x]\noutputs: [internal/demo/round.go]\nio: none\nskills: []\n---\n`)
  const chMark = `echo "ticket-07 ${slug} green" >> .agent/planner/done.log`
  await assert.rejects(() => bash(chMark), /poka-yoke/); pass++            // output нет → deny (тикет найден в changes/)
  await writeFile(join(dir, "internal", "demo", "round.go"), "package demo\n")
  await bash(chMark); pass++                                              // output создан → allow

  // F. Регресс (баг "/"): directory="/" НЕ используется как корень → фоллбэк на cwd, без EROFS-краша.
  const origCwd = process.cwd()
  const cwdTmp = await mkdtemp(join(tmpdir(), "ra-cwd-"))
  process.chdir(cwdTmp)
  try {
    const h2: any = await RationalGuardrail({ directory: "/", worktree: "/" } as any)
    await h2["tool.execute.after"](task("wirth-planner"), { title: "root-fallback" })
    const l2 = await readFile(join(cwdTmp, ".agent", "decisions.log"), "utf8")
    assert.match(l2, /role=wirth-planner/, "при directory='/' лог должен писаться в cwd, не в /")
    pass++
  } finally {
    process.chdir(origCwd)
    await rm(cwdTmp, { recursive: true, force: true })
  }

  // G. Регресс: аудит best-effort — недоступный для записи корень НЕ валит делегирование.
  const h3: any = await RationalGuardrail({ directory: "/dev/null/nope", worktree: undefined } as any)
  await h3["tool.execute.after"](task("wirth-planner"), { title: "best-effort" })
  pass++

  // K. (T09b) session.error → нативно будим izi (clearPrompt+append+submit); дебаунс ПО СЕССИИ.
  const calls = { clear: 0, append: 0, submit: 0, text: "" }
  const mockClient = { tui: {
    clearPrompt: async () => { calls.clear++ },
    appendPrompt: async ({ body }: any) => { calls.append++; calls.text = body.text },
    submitPrompt: async () => { calls.submit++ },
  } }
  const h4: any = await RationalGuardrail({ directory: dir, worktree: dir, client: mockClient } as any)
  await h4.event({ event: { type: "session.error", properties: { sessionID: "s1" } } })
  assert.equal(calls.clear, 1); assert.equal(calls.append, 1); assert.equal(calls.submit, 1); pass++
  assert.match(calls.text, /продолжи/); pass++
  await h4.event({ event: { type: "session.idle", properties: {} } })          // не session.error → игнор
  assert.equal(calls.append, 1); pass++
  await h4.event({ event: { type: "session.error", properties: { sessionID: "s1" } } })  // дебаунс той же сессии
  assert.equal(calls.append, 1); pass++
  await h4.event({ event: { type: "session.error", properties: { sessionID: "s2" } } })  // другая сессия → будит
  assert.equal(calls.append, 2); pass++
  // headless (нет client.tui) — не падает
  const h5: any = await RationalGuardrail({ directory: dir, worktree: dir } as any)
  await h5.event({ event: { type: "session.error", properties: {} } }); pass++

  // L. (T09b) watchdog-конфиг .opencode/rational.config.json переопределяет дефолты (развязка end-to-end)
  await mkdir(join(dir, ".opencode"), { recursive: true })
  await writeFile(join(dir, ".opencode", "rational.config.json"), JSON.stringify({ nudgeText: "CUSTOM-NUDGE", nudgeCooldownMs: 5 }))
  const c2 = { text: "" }
  const mc2 = { tui: { clearPrompt: async () => {}, appendPrompt: async ({ body }: any) => { c2.text = body.text }, submitPrompt: async () => {} } }
  const h6: any = await RationalGuardrail({ directory: dir, worktree: dir, client: mc2 } as any)
  await h6.event({ event: { type: "session.error", properties: { sessionID: "x" } } })
  assert.equal(c2.text, "CUSTOM-NUDGE"); pass++

  // M. anti-loop: субагент долбит одно действие без прогресса → блок (свежий инстанс, фронтдор не при чём)
  const hLoop: any = await RationalGuardrail({ directory: dir, worktree: dir } as any)
  const rd = (p: string) => hLoop["tool.execute.before"]({ tool: "read", args: { path: p } }, {})
  await rd("x"); await rd("x"); await rd("x"); await rd("x")            // 4 подряд — ещё не петля (порог 5)
  await assert.rejects(() => rd("x"), /anti-loop/); pass++                // 5-й одинаковый → петля
  // прогресс (иной вызов) не ложно-срабатывает; после сброса счётчик с нуля
  await rd("a"); await rd("b"); await rd("a"); await rd("b"); pass++      // разнообразно → без броска
  // цикл период-2 (read↔edit одного файла) повторённый 3 раза → петля
  const hLoop2: any = await RationalGuardrail({ directory: dir, worktree: dir } as any)
  const ed = (p: string) => hLoop2["tool.execute.before"]({ tool: "edit", args: { path: p, content: "z" } }, {})
  const re = (p: string) => hLoop2["tool.execute.before"]({ tool: "read", args: { path: p } }, {})
  await re("f"); await ed("f"); await re("f"); await ed("f"); await re("f")
  await assert.rejects(() => ed("f"), /anti-loop/); pass++
  // task-делегации НЕ трекаются анти-петлёй (гейтятся отдельно): повтор task не бросает anti-loop
  const hLoop3: any = await RationalGuardrail({ directory: dir, worktree: dir } as any)
  await mkdir(join(dir, ".agent", "planner"), { recursive: true })
  for (let i = 0; i < 6; i++) await hLoop3["tool.execute.before"](task("wirth-planner"), { args: { subagent: "wirth-planner" } })
  pass++

  // N. (git-workflow) On-trunk poka-yoke: реализатор на транке блокируется («сначала @git-hand mode=start»);
  // @git-hand НЕ реализатор → режет ветку сам, проходит. Паритет с claude-хуком (claude-hooks.smoke.mjs 1.7).
  // Изолированный корень с .git/HEAD; фронтдор пройден (brd.md), чтобы ловить именно on-trunk, не грил.
  const ndir = await mkdtemp(join(tmpdir(), "rg-ontrunk-"))
  await mkdir(join(ndir, ".agent", "planner"), { recursive: true })
  await writeFile(join(ndir, ".agent", "planner", "brd.md"), "# BRD\n")
  await mkdir(join(ndir, ".git"), { recursive: true })
  const nhooks: any = await RationalGuardrail({ directory: ndir, worktree: ndir } as any)
  // HEAD на транке → реализатор заблокирован, @git-hand (не реализатор) проходит
  await writeFile(join(ndir, ".git", "HEAD"), "ref: refs/heads/main\n")
  await assert.rejects(
    () => nhooks["tool.execute.before"](task("hughes"), { args: { subagent: "hughes" } }),
    /Старт на транке/,
  ); pass++
  await nhooks["tool.execute.before"](task("git-hand"), { args: { subagent: "git-hand" } }); pass++
  // HEAD на рабочей ветке → on-trunk НЕ срабатывает: hughes упирается уже в Gate #1, не в транк (детект специфичен)
  await writeFile(join(ndir, ".git", "HEAD"), "ref: refs/heads/chore/x\n")
  await assert.rejects(
    () => nhooks["tool.execute.before"](task("hughes"), { args: { subagent: "hughes" } }),
    /Gate #1/,
  ); pass++
  await rm(ndir, { recursive: true, force: true })

  await rm(dir, { recursive: true, force: true })
  console.log(`PASS ${pass}/37 — opencode guardrail smoke`)
}

run().catch((e) => { console.error("FAIL:", e?.message ?? e); process.exit(1) })
