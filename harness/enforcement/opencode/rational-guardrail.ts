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
  const root = (worktree as string) || (directory as string) || process.cwd()
  const agentDir = join(root, ".agent")
  const logPath = join(agentDir, "decisions.log")
  const gate1 = join(agentDir, "gates", "gate1.approved")
  const review = join(agentDir, "plan-reviewer", "plan-review.md")

  const exists = async (p: string) => {
    try { await access(p); return true } catch { return false }
  }

  return {
    // Gate #1: жёсткий стоп на делегировании implementer до апрува плана.
    "tool.execute.before": async (input: any, output: any) => {
      if (input?.tool !== "task") return
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
      await mkdir(join(agentDir, "gates"), { recursive: true })
      const role = pickRole(input?.args)
      const ts = new Date().toISOString()
      const title = String(output?.title ?? output?.metadata?.title ?? "").slice(0, 120)
      await appendFile(logPath, `${ts}\trole=${role}\tvia=opencode-plugin\t${title}\n`)
    },
  }
}
