import type { Plugin } from "@opencode-ai/plugin"
import { appendFile, mkdir, access } from "node:fs/promises"
import { join } from "node:path"

// --hard enforcement для OpenCode. Делает ПРИНУДИТЕЛЬНЫМ то, что промпты рекомендуют:
//   1) decisions.log — пишется на каждое делегирование роли (аудит), без участия агента;
//   2) Gate #1 — нельзя делегировать implementer без ревью плана и апрува оператора.

const ROLE_KEYS = ["subagent", "subagentType", "subagent_type", "agent", "agentType"]

function pickRole(args: unknown): string {
  if (!args || typeof args !== "object") return "unknown"
  const a = args as Record<string, unknown>
  for (const k of ROLE_KEYS) if (typeof a[k] === "string") return a[k] as string
  return "unknown"
}

export const RationalGuardrail: Plugin = async ({ directory, worktree }) => {
  // Резолв корня проекта: пропускаем "/" (под headless `opencode run` directory/worktree
  // может быть "/" — read-only → EROFS и ложная блокировка) и пустые; фоллбэк на
  // process.cwd() (каталог запуска opencode = каталог проекта).
  const pick = (...c: unknown[]) =>
    c.find((p): p is string => typeof p === "string" && p.length > 0 && p !== "/")
  const root = pick(worktree, directory) ?? process.cwd()
  const agentDir = join(root, ".agent")
  const logPath = join(agentDir, "decisions.log")
  const gate1 = join(agentDir, "gates", "gate1.approved")
  const review = join(agentDir, "plan-reviewer", "plan-review.md")

  const exists = async (p: string) => {
    try { await access(p); return true } catch { return false }
  }

  // Строка, по которой ловим попытку агента создать/тронуть маркер Gate #1.
  const GATE_MARK = ".agent/gates/gate1.approved"

  return {
    // Gate #1: жёсткий стоп на делегировании implementer до апрува плана.
    "tool.execute.before": async (input: any, output: any) => {
      const tool = input?.tool
      const args = output?.args ?? input?.args ?? {}

      // (0) Маркер Gate #1 ставит ТОЛЬКО оператор вне сессии. Агент не может его
      // создавать/трогать — иначе human-gate обходится самоакцептом (найдено на dry-run).
      if (tool === "bash") {
        const cmd = String((args as any).command ?? "")
        if (cmd.includes(GATE_MARK)) {
          throw new Error(
            "[rational-guardrail] Маркер Gate #1 (" + GATE_MARK + ") ставит ТОЛЬКО оператор " +
            "вне сессии. Агенту создавать/трогать его запрещено — на Gate #1 задай question и жди.",
          )
        }
      }
      if (tool === "write" || tool === "edit") {
        const p = String((args as any).filePath ?? (args as any).path ?? "")
        if (p.includes(GATE_MARK)) {
          throw new Error(
            "[rational-guardrail] Маркер Gate #1 (" + GATE_MARK + ") нельзя ставить через write/edit " +
            "агента — только оператор вне сессии.",
          )
        }
      }

      if (tool !== "task") return
      const role = pickRole(output?.args ?? input?.args)
      if (role !== "implementer") return
      if (!(await exists(review)) || !(await exists(gate1))) {
        throw new Error(
          "[rational-guardrail] Gate #1 не пройден: требуется " +
          ".agent/plan-reviewer/plan-review.md и апрув оператора " +
          "(.agent/gates/gate1.approved) перед делегированием implementer.",
        )
      }
    },

    // Гарантированный decisions.log: каждое завершённое делегирование роли.
    "tool.execute.after": async (input: any, output: any) => {
      if (input?.tool !== "task") return
      try {
        await mkdir(join(agentDir, "gates"), { recursive: true })
        const role = pickRole(input?.args)
        const ts = new Date().toISOString()
        const title = String(output?.title ?? output?.metadata?.title ?? "").slice(0, 120)
        await appendFile(logPath, `${ts}\trole=${role}\tvia=opencode-plugin\t${title}\n`)
      } catch {
        // Аудит best-effort: сбой записи (например EROFS) НЕ валит делегирование.
      }
    },
  }
}
