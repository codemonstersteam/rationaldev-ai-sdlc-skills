// Интерактивная настройка моделей тиров (large/medium/small) для раннера —
// пишет harness/models.config.json. Кросс-платформенно (Node, Win/macOS/Linux).
//
//   node harness/configure-models.mjs <claude|opencode|codex>
//
// Спрашивает три модели; Enter — оставить текущее значение; пустой ввод на пустом
// текущем — модель не задаётся (роль наследует модель пользователя раннера).
// Если stdin НЕ интерактивен (CI/смоук/пайп) — ничего не спрашивает и конфиг не трогает,
// чтобы установка не зависала. Пер-ролевые оверрайды (roles) не трогаются — правь вручную.

import { readFileSync, writeFileSync } from "node:fs"
import { createInterface } from "node:readline"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const runner = process.argv[2]
const ROOT = dirname(fileURLToPath(import.meta.url))
const CONFIG = join(ROOT, "models.config.json")

const RUNNERS = ["claude", "opencode", "codex"]
if (!RUNNERS.includes(runner)) {
  console.error(`configure-models: неизвестный раннер '${runner}' (ожидается ${RUNNERS.join("/")})`)
  process.exit(1)
}

const cfg = JSON.parse(readFileSync(CONFIG, "utf8"))
if (!cfg[runner]) cfg[runner] = { tiers: {}, roles: {} }
if (!cfg[runner].tiers) cfg[runner].tiers = {}

// Не интерактивно (нет TTY) — молча выходим, конфиг как есть.
if (!process.stdin.isTTY) process.exit(0)

const tiers = cfg[runner].tiers
const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (label, def) =>
  new Promise((res) =>
    rl.question(`  ${label}${def ? ` [${def}]` : " (Enter — наследовать)"}: `, (a) => res(a.trim() || def || "")),
  )

console.log(`\nНазначение моделей для раннера '${runner}' (harness/models.config.json).`)
console.log("Имена произвольны — модель твоего провайдера. Enter оставляет текущее значение.\n")

const large = await ask("Большая модель (large)", tiers.large)
const medium = await ask("Средняя модель (medium)", tiers.medium)
const small = await ask("Малая модель (small)", tiers.small)
rl.close()

cfg[runner].tiers = { large, medium, small }
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n")

const show = (v) => (v ? v : "(наследует модель пользователя)")
console.log(`\nmodels.config.json обновлён для '${runner}':`)
console.log(`  large=${show(large)}  medium=${show(medium)}  small=${show(small)}`)
