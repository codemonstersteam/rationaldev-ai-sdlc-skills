// Исполняемый смоук OpenCode-плагина enforcement (--hard).
// Запуск: node harness/enforcement/opencode/guardrail.smoke.ts  (Node >= 23)

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

  // A. Gate #1 блокирует implementer без апрува
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

  await rm(dir, { recursive: true, force: true })
  console.log(`PASS ${pass}/13 — opencode guardrail smoke`)
}

run().catch((e) => { console.error("FAIL:", e?.message ?? e); process.exit(1) })
