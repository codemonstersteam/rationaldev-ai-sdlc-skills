// CLI-обёртка валидатора связки тир/роль→модель→провайдер. Ядро (чистое) — lib/validate-model-binding.mjs.
//   node harness/validate-model-binding.mjs <runner> [--brief]
// Читает models.config.json (бандл) + global ~/.config/opencode/opencode.jsonc. НЕ блокирует (exit 0);
// печатает висячие ссылки (reason) + машинную строку `BINDING: ok|fail N` (её парсит install.sh).
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { validateModelBinding } from "./lib/validate-model-binding.mjs"

const ROOT = dirname(fileURLToPath(import.meta.url))
const runner = (process.argv[2] && !process.argv[2].startsWith("--")) ? process.argv[2] : "opencode"
const brief = process.argv.includes("--brief")

// Терпимый JSONC (opencode использует "//"-КЛЮЧИ = валидный JSON; иначе снимаем строчные/блок-комменты, хвост-запятые).
function parseJsonc(text) {
  try { return JSON.parse(text) } catch { /* очистим */ }
  try { return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) } catch { return null }
}

const models = JSON.parse(readFileSync(join(ROOT, "models.config.json"), "utf8"))
const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
const gJsonc = join(xdg, "opencode", "opencode.jsonc"), gJson = join(xdg, "opencode", "opencode.json")
const gPath = existsSync(gJsonc) ? gJsonc : (existsSync(gJson) ? gJson : null)
const global = gPath ? (parseJsonc(readFileSync(gPath, "utf8")) || {}) : {}

const { ok, missing } = validateModelBinding(models[runner] || {}, global)

if (!brief && !ok) {
  console.error(`Модель-биндинг '${runner}' — ВИСЯЧИЕ ссылки (opencode не сможет вызвать агентов):`)
  for (const m of missing) console.error(`  ✗ ${m.role} → ${m.model}: ${m.reason}`)
  console.error(`  Провайдер настраивается в global ${gPath || "~/.config/opencode/opencode.jsonc"}; модели тиров — configure-models.`)
}
// машинная строка для install.sh
console.log(ok ? "BINDING: ok" : `BINDING: fail ${missing.length}`)
