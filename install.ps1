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
  [switch]$Hard,
  [switch]$NoInput
)
$ErrorActionPreference = 'Stop'
$Bundle = $PSScriptRoot
$Lib = Join-Path $Bundle 'skills/lib'

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

$instrNote = Place-Instruction $instrSrc $instrDst

# --- enforcement (-Hard) ---
$hardMsg = 'off (enforcement инструкцией)'
if ($Hard) {
  $adapter = Join-Path $Bundle "harness/enforcement/$Runner"
  switch ($Runner) {
    'opencode' {
      $pdir = if ($Global) { Join-Path $env:APPDATA 'opencode/plugins' } else { Join-Path $Project '.opencode/plugins' }
      New-Item -ItemType Directory -Force -Path $pdir | Out-Null
      Copy-Item (Join-Path $adapter 'rational-guardrail.ts') (Join-Path $pdir 'rational-guardrail.ts') -Force
      $hardMsg = "on → OpenCode-плагин ($pdir/rational-guardrail.ts)"
    }
    'claude' {
      $cbase = if ($Global) { Join-Path $HOME '.claude' } else { Join-Path $Project '.claude' }
      $hooks = Join-Path $cbase 'hooks'
      New-Item -ItemType Directory -Force -Path $hooks | Out-Null
      Copy-Item (Join-Path $adapter 'gate-check.mjs')   (Join-Path $hooks 'gate-check.mjs') -Force
      Copy-Item (Join-Path $adapter 'log-decision.mjs') (Join-Path $hooks 'log-decision.mjs') -Force
      $gc = 'node "' + (Join-Path $hooks 'gate-check.mjs') + '"'
      $ld = 'node "' + (Join-Path $hooks 'log-decision.mjs') + '"'
      $settings = [ordered]@{ hooks = [ordered]@{
        PreToolUse  = @(@{ matcher = 'Task'; hooks = @(@{ type = 'command'; command = $gc }) })
        PostToolUse = @(@{ matcher = 'Task'; hooks = @(@{ type = 'command'; command = $ld }) })
      } }
      $json = $settings | ConvertTo-Json -Depth 8
      $sjPath = Join-Path $cbase 'settings.json'
      if (Test-Path $sjPath) {
        $json | Set-Content -Encoding UTF8 (Join-Path $cbase 'settings.harness.json')
        $hardMsg = "on → хуки в $hooks; settings.json есть → слей $cbase/settings.harness.json вручную"
      } else {
        $json | Set-Content -Encoding UTF8 $sjPath
        $hardMsg = "on → Claude-хуки ($sjPath)"
      }
    }
    'codex' { $hardMsg = 'инструкция (Codex без жёсткого enforce — harness/enforcement/codex/README.md)' }
  }
}

$skCount = (Get-ChildItem $skillsDst -ErrorAction SilentlyContinue | Measure-Object).Count
$agCount = (Get-ChildItem $agentsDst -ErrorAction SilentlyContinue | Measure-Object).Count
$modelsMsg = 'см. harness/models.config.json'
try {
  $t = (Get-Content (Join-Path $Bundle 'harness/models.config.json') -Raw | ConvertFrom-Json).$Runner.tiers
  $f = { param($v) if ($v) { $v } else { '(наследует)' } }
  $modelsMsg = "large=$(& $f $t.large) medium=$(& $f $t.medium) small=$(& $f $t.small)"
} catch {}
Write-Host "rationaldev harness -> $Runner ($(if ($Global) {'global'} else {'project'}))"
Write-Host "  agents/roles: $agentsDst ($agCount)"
Write-Host "  skills:       $skillsDst ($skCount)"
Write-Host "  models:       $modelsMsg"
Write-Host "  instructions: $instrNote"
Write-Host "  hard mode:    $hardMsg"
Write-Host ''
Write-Host "Точка входа — роль 'orchestrator'. Дальше: запусти $Runner в проекте."
