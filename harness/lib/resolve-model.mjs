// Чистый резолвинг модели/температуры роли (io: none). config параметром → тестируемо без fs.
// Резолвинг: roles[<роль>] > tiers[<тир>] > null (null → model опущен, раннер берёт модель юзера).

export function resolveModel(config, runner, role, tier) {
  const cfg = config && config[runner]
  if (!cfg) return null
  const byRole = cfg.roles && cfg.roles[role]
  if (typeof byRole === "string" && byRole.trim()) return byRole.trim()
  const byTier = cfg.tiers && cfg.tiers[tier]
  if (typeof byTier === "string" && byTier.trim()) return byTier.trim()
  return null
}

// Температура: temperature.roles[<роль>] > temperature[<тир>] > null (null → дефолт из _shared).
export function resolveTemp(config, runner, role, tier) {
  const cfg = config && config[runner]
  if (!cfg || !cfg.temperature) return null
  const byRole = cfg.temperature.roles && cfg.temperature.roles[role]
  if (typeof byRole === "number") return byRole
  const byTier = cfg.temperature[tier]
  if (typeof byTier === "number") return byTier
  return null
}
