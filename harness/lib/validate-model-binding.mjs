// Валидация связки «тир/роль → модель → провайдер» (io: none, config параметром — тестируемо без fs).
// Ловит ВИСЯЧИЕ ссылки: models.config ссылается на `openrouter/glm-5.2`, а в global opencode-конфиге
// провайдера `openrouter` нет (там `llm-platform`) → opencode молча не сможет вызвать агента. Валидатор —
// ДО gen-agents (в configure-models) и ПОСЛЕ установки (install.sh MODELS_MSG). Не блокирует CI/неинтерактив.
//
// runnerCfg = models.config.json[<runner>] = { tiers:{large,medium,small}, roles:{<role>:model} }
// globalCfg = ~/.config/opencode/opencode.jsonc = { provider: { <id>: { options?:{baseURL?}, models?:{ <id>:{limit:{context,output}} } } } }
//
// Различаем провайдера по наличию options.baseURL:
//   • custom (baseURL задан, прокси/self-hosted) → модели ОБЯЗАНЫ быть объявлены в provider.<id>.models с лимитами.
//   • registry-backed (нет baseURL, напр. openrouter/anthropic) → opencode знает модели из реестра, объявление не нужно.
// Провайдер не найден вообще — ошибка в любом случае (opencode не резолвит).

export function validateModelBinding(runnerCfg, globalCfg) {
  const providers = (globalCfg && globalCfg.provider && typeof globalCfg.provider === "object") ? globalCfg.provider : {}
  const entries = []
  const tiers = (runnerCfg && runnerCfg.tiers) || {}
  for (const t of ["large", "medium", "small"]) if (typeof tiers[t] === "string" && tiers[t].trim()) entries.push({ role: `tier:${t}`, model: tiers[t].trim() })
  const roles = (runnerCfg && runnerCfg.roles) || {}
  for (const r of Object.keys(roles)) if (typeof roles[r] === "string" && roles[r].trim()) entries.push({ role: `role:${r}`, model: roles[r].trim() })

  const missing = []
  for (const { role, model } of entries) {
    const i = model.indexOf("/")
    if (i < 0) { missing.push({ role, provider: null, model, reason: "нет провайдер-префикса (ожидается <providerId>/<modelId>)" }); continue }
    const provider = model.slice(0, i), modelId = model.slice(i + 1)
    const p = providers[provider]
    if (!p) { missing.push({ role, provider, model, reason: `провайдер '${provider}' не найден в global opencode.jsonc` }); continue }
    const isCustom = !!(p.options && typeof p.options.baseURL === "string" && p.options.baseURL)
    const m = p.models && p.models[modelId]
    if (!m) {
      if (isCustom) missing.push({ role, provider, model, reason: `модель '${modelId}' не объявлена у кастомного провайдера '${provider}' (нужен provider.${provider}.models[<id>].limit)` })
      // registry-backed → opencode знает модель из реестра, объявление не требуется
      continue
    }
    const lim = m.limit
    if (!(lim && Number.isFinite(lim.context) && Number.isFinite(lim.output)))
      missing.push({ role, provider, model, reason: `у модели '${modelId}' нет limit.context/limit.output` })
  }
  return { ok: missing.length === 0, missing }
}
