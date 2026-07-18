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

// Вывести тиры {large, small} из ЕДИНСТВЕННОГО кастомного провайдера global-конфига. Зачем: клон-дефолт
// = openrouter/*, а у оператора провайдер иной (llm-platform) → проекции агентов битые. При install деривим
// тиры из реального провайдера → binding ok by construction (без ручного RATIONALDEV_MODELS-ритуала).
// Эвристика имени: large = первая модель с large-хинтом, small = первая с small-хинтом; фолбэк — первая/
// последняя объявленная. Возвращает {provider, large, small} ИЛИ null (0 или >1 кастомных провайдеров с
// моделями — неоднозначно, install НЕ угадывает, а предупреждает). Registry-провайдер (openrouter, без
// baseURL) не деривим: там любые модели резолвятся из реестра, дефолт и так свяжется. Чистая (io: none).
const LARGE_HINT = /frontier|large|\bpro\b|opus|max|ultra|sonnet|glm-[5-9]|70b|72b|qwen3-max/i
const SMALL_HINT = /flash|mini|small|chat|haiku|lite|nano|\b7b\b|\b8b\b|27b|32b/i
export function deriveTiersFromProvider(globalCfg) {
  const providers = (globalCfg && globalCfg.provider && typeof globalCfg.provider === "object") ? globalCfg.provider : {}
  const custom = Object.entries(providers).filter(([, p]) =>
    p && p.options && typeof p.options.baseURL === "string" && p.options.baseURL &&
    p.models && typeof p.models === "object" && Object.keys(p.models).length > 0)
  if (custom.length !== 1) return null
  const [pid, p] = custom[0]
  const ids = Object.keys(p.models)
  const large = ids.find((m) => LARGE_HINT.test(m)) || ids[0]
  const small = ids.find((m) => SMALL_HINT.test(m)) || ids[ids.length - 1]
  return { provider: pid, large: `${pid}/${large}`, small: `${pid}/${small}` }
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
