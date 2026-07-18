// Настройка opencode-конфигов при установке харнеса в проект.
//   node setup-opencode.mjs <projectDir> <bundleRoot>
// Раскладка (решено с оператором):
//   GLOBAL  ~/.config/opencode/opencode.jsonc — провайдер (baseURL+apiKey). Спрашиваем, если пусто.
//   PROJECT <projectDir>/opencode.jsonc        — МИНИМУМ: permission (autonomous) + plugin (rational-guardrail,
//                                                относительным путём). Провайдера/моделей тут НЕТ. omo НЕТ.
//   Модели ролей — frontmatter (models.config → gen-agents), НЕ здесь.
// omo (oh-my-openagent) гарантированно отсутствует в global (варнинг/чистка) и в project (вычищаем из plugin).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { createInterface } from "node:readline"
import { join, dirname } from "node:path"
import { homedir } from "node:os"

const projectDir = process.argv[2] || process.cwd()
const bundleRoot = process.argv[3] || join(dirname(new URL(import.meta.url).pathname), "..")
const OMO = "oh-my-openagent"
const PLUGIN_REL = "./.opencode/plugins/rational-guardrail.ts"

// Терпимый разбор JSONC: сначала как JSON (opencode использует "//"-КЛЮЧИ, это валидный JSON);
// если не вышло — срезаем строчные //-комменты (не трогая "://" в строках), блок-комменты и хвостовые запятые.
function parseJsonc(text) {
  try { return JSON.parse(text) } catch { /* попробуем очистить */ }
  const cleaned = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1")
  try { return JSON.parse(cleaned) } catch { return null }
}

const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
const globalDir = join(xdg, "opencode")
const globalJsonc = join(globalDir, "opencode.jsonc")
const globalJson = join(globalDir, "opencode.json")
const globalPath = existsSync(globalJsonc) ? globalJsonc : (existsSync(globalJson) ? globalJson : globalJsonc)

const interactive = process.stdin.isTTY && process.env.RATIONALDEV_NOINPUT !== "1"
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null
const ask = (label, def) => new Promise((res) => {
  if (!rl) return res(def || "")
  rl.question(`  ${label}${def ? ` [${def}]` : ""}: `, (a) => res(a.trim() || def || ""))
})

let notes = []

// ── 1. GLOBAL: omo-чек ────────────────────────────────────────────────────
let global = existsSync(globalPath) ? (parseJsonc(readFileSync(globalPath, "utf8")) || {}) : {}
const globalPlugins = Array.isArray(global.plugin) ? global.plugin : []
if (globalPlugins.some((p) => String(p).includes(OMO))) {
  notes.push(`⚠ GLOBAL ${globalPath} объявляет omo (${OMO}) — он ПЕРЕХВАТЫВАЕТ модель харнеса.`)
  if (interactive) {
    const yes = (await ask("  Убрать omo из global plugin? (y/N)", "N")).toLowerCase().startsWith("y")
    if (yes) {
      global.plugin = globalPlugins.filter((p) => !String(p).includes(OMO))
      if (!global.plugin.length) delete global.plugin
      mkdirSync(globalDir, { recursive: true })
      writeFileSync(globalPath, JSON.stringify(global, null, 2) + "\n")
      notes.push(`✓ omo удалён из ${globalPath}`)
    }
  } else notes.push("  (нельзя убрать без интерактива — сделай вручную)")
}

// ── 2. GLOBAL: провайдер ──────────────────────────────────────────────────
const hasProvider = global.provider && typeof global.provider === "object" && Object.keys(global.provider).length > 0
if (hasProvider) {
  notes.push(`✓ GLOBAL провайдер уже настроен: ${Object.keys(global.provider).join(", ")}`)
} else if (interactive) {
  console.log("\nВ global (~/.config/opencode) нет провайдера — настроим (auth шарится на все проекты).")
  const name = await ask("Провайдер (id, напр. openrouter)", "openrouter")
  const baseURL = await ask("baseURL (Enter — дефолт провайдера)", "")
  const apiKey = await ask("API-ключ (или {env:VAR})", "")
  const options = {}
  if (baseURL) options.baseURL = baseURL
  if (apiKey) options.apiKey = apiKey
  global.provider = { ...(global.provider || {}), [name]: { options } }
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(globalPath, JSON.stringify(global, null, 2) + "\n")
  notes.push(`✓ GLOBAL провайдер '${name}' записан в ${globalPath}`)
} else {
  notes.push(`⚠ GLOBAL провайдера нет и нет интерактива — задай его в ${globalPath} вручную (иначе opencode не достучится до модели).`)
}

// ── 3. PROJECT: минимальный opencode.jsonc (permission + plugin, без omo/провайдера/моделей) ──
const tmpl = parseJsonc(readFileSync(join(bundleRoot, "harness", "templates", "opencode.tmpl.jsonc"), "utf8"))
const projJsonc = join(projectDir, "opencode.jsonc")
const projJson = join(projectDir, "opencode.json")
const projPath = existsSync(projJson) ? projJson : projJsonc
const existing = existsSync(projPath) ? (parseJsonc(readFileSync(projPath, "utf8")) || {}) : {}

const merged = { ...existing }
merged.$schema = existing.$schema || tmpl.$schema
merged.permission = existing.permission || tmpl.permission          // своё permission не трогаем
// plugin: гарантируем rational-guardrail относительным путём И вычищаем omo
const curPlugins = Array.isArray(existing.plugin) ? existing.plugin : []
const noOmo = curPlugins.filter((p) => !String(p).includes(OMO))
merged.plugin = noOmo.some((p) => String(p).includes("rational-guardrail")) ? noOmo : [...noOmo, PLUGIN_REL]

mkdirSync(projectDir, { recursive: true })
writeFileSync(projPath, JSON.stringify(merged, null, 2) + "\n")
notes.push(`✓ PROJECT ${projPath}: permission + plugin (${PLUGIN_REL}), omo отсутствует`)

if (rl) rl.close()
console.log(notes.map((n) => "  " + n).join("\n"))
