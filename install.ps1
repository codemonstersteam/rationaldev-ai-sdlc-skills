# install.ps1 — нативный установщик харнеса rationaldev для Windows (PowerShell 5+).
# POSIX-аналог — install.sh. На Windows симлинки требуют админ/developer-mode, поэтому
# раскладка идёт КОПИРОВАНИЕМ (после обновления харнеса перезапусти установку).
#
#   ./install.ps1 <claude|codex|opencode> [-Global | -Project <dir>] [-Hard] [-NoInput]
#
#   ./install.ps1 claude -Project . -Hard      # в текущий проект + Node-хуки (Gate #1)
#   ./install.ps1 opencode -Global             # глобально
#   ./install.ps1 claude -Project . -NoInput   # без интерактива (модели — из конфига как есть)
#
# Источник правды: skills/lib + harness/agents. Хуки enforcement — на Node (.mjs),
# работают одинаково в PowerShell/cmd/bash. При установке интерактивно спрашивает
# 3 модели (large/medium/small) → harness/models.config.json + перегенерация проекций.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('claude', 'codex', 'opencode')][string]$Runner,
  [switch]$Global,
  [string]$Project = (Get-Location).Path,
  [switch]$Hard,   # оставлен для совместимости (enforcement и так вкл по умолчанию)
  [switch]$Soft,   # отключить enforcement
  [switch]$NoInput
)
$ErrorActionPreference = 'Stop'
$Bundle = $PSScriptRoot
$Lib = Join-Path $Bundle 'skills/lib'

# --- модели: дефолтный override-путь ВНЕ клона (клон pristine для `rationaldev update`) — для ВСЕХ раннеров ---
# Правки моделей (configure-models) пишутся в override, а не в клон-дефолт. Один файл на все раннеры (конфиг
# раннер-агностичен: top-level ключ = раннер). Оператор задал RATIONALDEV_MODELS сам — уважаем. Зеркало install.sh.
$RdModelsDefaulted = $false
if (-not $env:RATIONALDEV_MODELS) {
  $cfgBase = if ($env:XDG_CONFIG_HOME) { $env:XDG_CONFIG_HOME } else { Join-Path $HOME '.config' }
  $env:RATIONALDEV_MODELS = Join-Path $cfgBase 'rationaldev/models.json'
  $RdModelsDefaulted = $true
}

# --- модели: интерактивная настройка тиров + перегенерация проекций ---
# configure-models сам молчит, если stdin не TTY; gen-agents идемпотентен.
if (Get-Command node -ErrorAction SilentlyContinue) {
  if (-not $NoInput) { node (Join-Path $Bundle 'harness/configure-models.mjs') $Runner }
  node (Join-Path $Bundle 'harness/gen-agents.mjs') | Out-Null
} else {
  Write-Host '  node не найден — модели/проекции не обновлены (правь harness/models.config.json, затем node harness/gen-agents.mjs)'
}

function Copy-Skills($dst) {
  New-Item -ItemType Directory -Force -Path (Join-Path $dst 'reference') | Out-Null
  Get-ChildItem -LiteralPath $Lib | ForEach-Object {
    if ($_.PSIsContainer -and (Test-Path (Join-Path $_.FullName 'SKILL.md'))) {
      Copy-Item $_.FullName (Join-Path $dst $_.Name) -Recurse -Force
    } elseif (-not $_.PSIsContainer) {
      Copy-Item $_.FullName (Join-Path $dst "reference/$($_.Name)") -Force
    }
  }
}
function Copy-Agents($dst, $src) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Get-ChildItem -LiteralPath $src -Filter *.md | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $dst $_.Name) -Force
  }
}
function Place-Instruction($src, $dst) {
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  if (Test-Path $dst) {
    $alt = Join-Path (Split-Path $dst) ((Split-Path $dst -LeafBase) + '.harness.md')
    Copy-Item $src $alt -Force
    return "существующий $(Split-Path $dst -Leaf) НЕ тронут → $(Split-Path $alt -Leaf) (подключи вручную)"
  }
  Copy-Item $src $dst -Force
  return $dst
}

switch ($Runner) {
  'claude' {
    $base = if ($Global) { Join-Path $HOME '.claude' } else { Join-Path $Project '.claude' }
    Copy-Agents (Join-Path $base 'agents') (Join-Path $Bundle 'harness/agents/claude')
    Copy-Skills (Join-Path $base 'skills')
    $agentsDst = Join-Path $base 'agents'; $skillsDst = Join-Path $base 'skills'
    $instrSrc = Join-Path $Bundle 'harness/instructions/CLAUDE.md'
    $instrDst = if ($Global) { Join-Path $HOME '.claude/CLAUDE.md' } else { Join-Path $Project 'CLAUDE.md' }
  }
  'opencode' {
    $base = if ($Global) { Join-Path $env:APPDATA 'opencode' } else { Join-Path $Project '.opencode' }
    Copy-Agents (Join-Path $base 'agent') (Join-Path $Bundle 'harness/agents/opencode')
    Copy-Skills (Join-Path $base 'skills')
    $agentsDst = Join-Path $base 'agent'; $skillsDst = Join-Path $base 'skills'
    $instrSrc = Join-Path $Bundle 'harness/instructions/AGENTS.opencode.md'
    $instrDst = if ($Global) { Join-Path $base 'AGENTS.md' } else { Join-Path $Project 'AGENTS.md' }
  }
  'codex' {
    $root = if ($Global) { $HOME } else { $Project }
    Copy-Agents (Join-Path $root '.agents/roles') (Join-Path $Bundle 'harness/agents/codex')
    Copy-Skills (Join-Path $root '.agents/skills')
    $agentsDst = Join-Path $root '.agents/roles'; $skillsDst = Join-Path $root '.agents/skills'
    $instrSrc = Join-Path $Bundle 'harness/instructions/AGENTS.codex.md'
    $instrDst = if ($Global) { Join-Path $HOME '.codex/AGENTS.md' } else { Join-Path $Project 'AGENTS.md' }
  }
}

# --- валидаторы харнеса в проект (роли/mills зовут `node harness/validate-*.mjs` из cwd проекта) ---
if (-not $Global) {
  $hdir = Join-Path $Project 'harness'
  New-Item -ItemType Directory -Force -Path $hdir | Out-Null
  # glob, НЕ хардкод-список — иначе новые валидаторы/progress не долетают в проект (был Windows-баг):
  # ВСЕ validate-*.mjs + progress.mjs + scaffold.sh + target-profiles.json.
  $srcs = @(Get-ChildItem (Join-Path $Bundle 'harness') -Filter 'validate-*.mjs' | ForEach-Object FullName)
  $srcs += @('progress.mjs', 'scaffold.sh', 'target-profiles.json') | ForEach-Object { Join-Path $Bundle "harness/$_" }
  foreach ($src in $srcs) {
    if (-not (Test-Path $src)) { continue }
    $lnk = Join-Path $hdir (Split-Path $src -Leaf)
    if (Test-Path $lnk) { Remove-Item -Force $lnk }
    New-Item -ItemType SymbolicLink -Path $lnk -Target $src | Out-Null
  }
}

$instrNote = Place-Instruction $instrSrc $instrDst

# --- enforcement (-Hard) ---
$hardMsg = 'off (enforcement инструкцией)'
if (-not $Soft) {
  $adapter = Join-Path $Bundle "harness/enforcement/$Runner"
  switch ($Runner) {
    'opencode' {
      $pdir = if ($Global) { Join-Path $env:APPDATA 'opencode/plugins' } else { Join-Path $Project '.opencode/plugins' }
      New-Item -ItemType Directory -Force -Path $pdir | Out-Null
      # Плагин — self-contained .mjs (НЕ .ts): opencode грузит напрямую. Чистим старую .ts-копию (был баг:
      # копировали rational-guardrail.ts, которого нет → Copy-Item падал, гардрейл на Windows не ставился).
      Copy-Item (Join-Path $adapter 'rational-guardrail.mjs') (Join-Path $pdir 'rational-guardrail.mjs') -Force
      Remove-Item (Join-Path $pdir 'rational-guardrail.ts') -Force -ErrorAction SilentlyContinue
      # общая enforcement-логика (../shared.mjs, plugin импортит её) — рядом (copy → нужен реальный файл в destination)
      Copy-Item (Join-Path $Bundle 'harness/enforcement/shared.mjs') (Join-Path (Split-Path $pdir) 'shared.mjs') -Force
      $hardMsg = "on → OpenCode-плагин ($pdir/rational-guardrail.mjs, self-contained)"
    }
    'claude' {
      $cbase = if ($Global) { Join-Path $HOME '.claude' } else { Join-Path $Project '.claude' }
      $hooks = Join-Path $cbase 'hooks'
      New-Item -ItemType Directory -Force -Path $hooks | Out-Null
      Copy-Item (Join-Path $adapter 'gate-check.mjs')   (Join-Path $hooks 'gate-check.mjs') -Force
      Copy-Item (Join-Path $adapter 'gate-bash.mjs')    (Join-Path $hooks 'gate-bash.mjs') -Force
      Copy-Item (Join-Path $adapter 'gate-approve.mjs') (Join-Path $hooks 'gate-approve.mjs') -Force
      Copy-Item (Join-Path $adapter 'log-decision.mjs') (Join-Path $hooks 'log-decision.mjs') -Force
      # общая enforcement-логика (../shared.mjs, хуки импортят её) — рядом (copy → нужен реальный файл в destination)
      Copy-Item (Join-Path $Bundle 'harness/enforcement/shared.mjs') (Join-Path $cbase 'shared.mjs') -Force
      $gc = 'node "' + (Join-Path $hooks 'gate-check.mjs') + '"'
      $gb = 'node "' + (Join-Path $hooks 'gate-bash.mjs') + '"'
      $ga = 'node "' + (Join-Path $hooks 'gate-approve.mjs') + '"'
      $ld = 'node "' + (Join-Path $hooks 'log-decision.mjs') + '"'
      # permissions: ПОЛНЫЙ доступ субагентам (defaultMode bypassPermissions — без промптов; столл-на-промпте
      # убивает автономный прогон). allow-лист — безопасная деградация. Хуки (PreToolUse) работают НЕЗАВИСИМО
      # от режима и держат фронтдор/Gate #1/poka-yoke даже здесь.
      $settings = [ordered]@{
        permissions = [ordered]@{
          defaultMode = 'bypassPermissions'
          allow = @('Bash(go *)','Bash(gofmt *)','Bash(node *)','Bash(sh *)','Bash(bash *)','Bash(docker *)','Bash(docker compose *)','Bash(git *)','Bash(perl *)','Bash(tar *)','Bash(curl *)','Bash(jq *)','Bash(grep *)','Bash(rg *)','Bash(cat *)','Bash(ls *)','Bash(find *)','Bash(head *)','Bash(tail *)','Bash(wc *)','Bash(awk *)','Bash(sed *)','Bash(echo *)','Bash(printf *)','Bash(test *)','Bash(mkdir *)','Bash(cp *)','Bash(mv *)','Bash(rm *)','Bash(touch *)','Bash(chmod *)','Bash(xargs *)','Bash(pwd)')
        }
        hooks = [ordered]@{
        PreToolUse  = @(
          @{ matcher = 'Task'; hooks = @(@{ type = 'command'; command = $gc }) },
          @{ matcher = 'Bash'; hooks = @(@{ type = 'command'; command = $gb }) }
        )
        PostToolUse = @(@{ matcher = 'Task'; hooks = @(@{ type = 'command'; command = $ld }) })
        UserPromptSubmit = @(@{ hooks = @(@{ type = 'command'; command = $ga }) })
      } }
      $json = $settings | ConvertTo-Json -Depth 8
      $sjPath = Join-Path $cbase 'settings.json'
      $harnessPath = Join-Path $cbase 'settings.harness.json'
      # Управляемый шаблон → settings.harness.json (эталон merge/doctor), затем СЛИВАЕМ в реальный settings.json
      # (hooks + permissions), не затирая пользовательские добавления. Идемпотентно. Зеркало install.sh.
      $json | Set-Content -Encoding UTF8 $harnessPath
      $merged = $false
      if (Get-Command node -ErrorAction SilentlyContinue) {
        node (Join-Path $Bundle 'harness/merge-claude-settings.mjs') merge $sjPath $harnessPath 2>$null
        if ($LASTEXITCODE -eq 0) { $merged = $true }
      }
      if ($merged) {
        $hardMsg = "on → Claude-хуки слиты в $sjPath (управляемый блок; пользовательское сохранено)"
      } elseif (Test-Path $sjPath) {
        $hardMsg = "on → хуки в $hooks; node нет для merge → слей $harnessPath вручную"
      } else {
        $json | Set-Content -Encoding UTF8 $sjPath
        $hardMsg = "on → Claude-хуки ($sjPath)"
      }
    }
    'codex' { $hardMsg = 'инструкция (Codex без жёсткого enforce — harness/enforcement/codex/README.md)' }
  }
}

# --- pristine-клон: восстановить сгенерённую грязь при активном override ------------------------------------
# gen-agents перегенерил проекции В КЛОНЕ; при override (кастомные модели) их `model:` расходится с коммитом →
# клон грязный → `rationaldev update` откажет. На Windows Copy-Agents УЖЕ скопировал кастомные проекции в
# проект, так что клон нужно лишь ВЕРНУТЬ в чистое (git checkout сгенерённых путей). Дефолт (override-файла
# нет/пуст) → проекции == коммит → no-op. Не git → нечего восстанавливать. Зеркало install.sh.
$modelsPristineNote = ''
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $Bundle '.git') -PathType Container) -and
    $env:RATIONALDEV_MODELS -and (Test-Path $env:RATIONALDEV_MODELS) -and ((Get-Item $env:RATIONALDEV_MODELS).Length -gt 0)) {
  $dirty = git -C $Bundle status --porcelain -- harness/agents skills/roles 2>$null
  if ($dirty) {
    git -C $Bundle checkout -- harness/agents skills/roles 2>$null
    $modelsPristineNote = "override-модели скопированы в проект; клон восстановлен pristine"
  }
}

$skCount = (Get-ChildItem $skillsDst -ErrorAction SilentlyContinue | Measure-Object).Count
$agCount = (Get-ChildItem $agentsDst -ErrorAction SilentlyContinue | Measure-Object).Count
$modelsMsg = 'см. harness/models.config.json'
try {
  # override-merged (loadModelsConfig учитывает RATIONALDEV_MODELS) — реальные модели, не клон-дефолт.
  $modelsMsg = node -e 'import(process.argv[1]).then(m=>{const c=m.loadModelsConfig(process.argv[2])[process.argv[3]]||{};const t=c.tiers||{};const f=v=>v||"(наследует)";process.stdout.write(`large=${f(t.large)} medium=${f(t.medium)} small=${f(t.small)}`)})' (Join-Path $Bundle 'harness/lib/models-config.mjs') (Join-Path $Bundle 'harness') $Runner
} catch {}
Write-Host "rationaldev harness -> $Runner ($(if ($Global) {'global'} else {'project'}))"
Write-Host "  agents/roles: $agentsDst ($agCount)"
Write-Host "  skills:       $skillsDst ($skCount)"
Write-Host "  models:       $modelsMsg"
if ($env:RATIONALDEV_MODELS) {
  Write-Host "  models-override: $env:RATIONALDEV_MODELS (клон pristine)"
  if ($modelsPristineNote) { Write-Host "                → $modelsPristineNote" }
  if ($RdModelsDefaulted) { Write-Host "                → добавь в профиль: `$env:RATIONALDEV_MODELS=$env:RATIONALDEV_MODELS" }
}
Write-Host "  instructions: $instrNote"
Write-Host "  hard mode:    $hardMsg"
Write-Host ''
Write-Host "Точка входа — роль 'izi' (запусти: $Runner --agent izi)."
