// Интерактивная настройка моделей тиров (large/medium/small) для раннера —
// пишет harness/models.config.json. Кросс-платформенно (Node, Win/macOS/Linux).
//
//   node harness/configure-models.mjs <claude|opencode|codex>
//
// Спрашивает три модели; Enter — оставить текущее значение; пустой ввод на пустом
// текущем — модель не задаётся (роль наследует модель пользователя раннера).
// Если stdin НЕ интерактивен (CI/смоук/пайп) — ничего не спрашивает и конфиг не трогает,
// чтобы установка не зависала. Пер-ролевые оверрайды (roles) не трогаются — правь вручную.

import { writeFileSync } from "node:fs"
import { createInterface } from "node:readline"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadModelsConfig } from "./lib/models-config.mjs"

const runner = process.argv[2]
const ROOT = dirname(fileURLToPath(import.meta.url))
const CLONE_CONFIG = join(ROOT, "models.config.json")
// pristine-клон (T5): если задан локальный override RATIONALDEV_MODELS (ВНЕ клона) — правки моделей
// пишем ТУДА (клон остаётся чистым для `rationaldev update`); иначе — в клон (как раньше).
const OVERRIDE = process.env.RATIONALDEV_MODELS
const CONFIG = OVERRIDE || CLONE_CONFIG

const RUNNERS = ["claude", "opencode", "codex"]
if (!RUNNERS.includes(runner)) {
  console.error(`configure-models: неизвестный раннер '${runner}' (ожидается ${RUNNERS.join("/")})`)
  process.exit(1)
}

// База = клон-дефолт ← существующий override (сохраняем прежние правки при повторном запуске).
const cfg = loadModelsConfig(ROOT)
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

console.log(`\nНазначение моделей для раннера '${runner}' — ДВА тира (harness/models.config.json).`)
console.log("Имена произвольны — модель твоего провайдера. Enter оставляет текущее значение.")
console.log("large = суждение (планирование/ревью/приёмка) · small = исполнение (реализация/тесты/git).\n")

// Два тира: large (суждение) + small (исполнение); medium схлопывается в small.
const large = await ask("large — суждение", tiers.large)
const small = await ask("small — исполнение", tiers.small || tiers.medium)
rl.close()

cfg[runner].tiers = { large, medium: small, small }   // medium = small (2-тира-модель)
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n")

const show = (v) => (v ? v : "(наследует модель пользователя)")
console.log(`\n${OVERRIDE ? "override" : "models.config.json"} обновлён для '${runner}' (2 тира):`)
console.log(`  large=${show(large)}  small=${show(small)}  (medium=small)`)
