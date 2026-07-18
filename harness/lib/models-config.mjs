// Загрузка/merge конфига моделей (self-update T5). Клон потребляется read-only → кастомизация тиров
// живёт в ЛОКАЛЬНОМ override ВНЕ клона (путь из $RATIONALDEV_MODELS), чтобы `rationaldev update`
// (ff-pull pristine-клона) не конфликтовал. merge — чистый; fs-загрузка отдельно.
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

// Глубокий merge: override выигрывает на листьях; объекты сливаются, массивы/скаляры заменяются. Чистый.
export function mergeModelsConfig(base, override) {
  if (override == null || typeof override !== "object" || Array.isArray(override)) return base
  if (base == null || typeof base !== "object" || Array.isArray(base)) return override
  const out = { ...base }
  for (const k of Object.keys(override)) {
    const b = out[k], o = override[k]
    out[k] = (b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b) && !Array.isArray(o))
      ? mergeModelsConfig(b, o) : o
  }
  return out
}

// Клон-дефолт (<cloneRoot>/models.config.json) ← локальный override (RATIONALDEV_MODELS, вне клона).
// Битый/отсутствующий override → тихо дефолт (клон всегда рабочий).
export function loadModelsConfig(cloneRoot, overridePath = process.env.RATIONALDEV_MODELS) {
  const base = JSON.parse(readFileSync(join(cloneRoot, "models.config.json"), "utf8"))
  if (overridePath && existsSync(overridePath)) {
    try { return mergeModelsConfig(base, JSON.parse(readFileSync(overridePath, "utf8"))) } catch { /* битый override → дефолт */ }
  }
  return base
}
