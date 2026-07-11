# run.ps1 — Windows-смоук харнеса (зеркало harness/smoke/run.sh для PowerShell).
# Проверяет нативную установку (install.ps1, копирование) и Node-хуки enforcement
# в среде, где POSIX-sh недоступен. Запуск: pwsh -File harness/smoke/run.ps1
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("harness-smoke-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
$script:pass = 0
function Ok { $script:pass++ }
function Fail($m) { Write-Host "FAIL: $m"; exit 1 }

# Хуки резолвят корень как CLAUDE_PROJECT_DIR || cwd — снимем, чтобы корнем была cwd теста.
Remove-Item Env:CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue

# проекции/индекс актуальны (node — кросс-платформенно)
node "$Repo/harness/gen-agents.mjs" | Out-Null
node "$Repo/harness/gen-skill-index.mjs" --check | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "skill-index устарел" }; Ok

# --- Claude: раскладка ---
$P = Join-Path $Tmp 'claude'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" claude -Project $P -NoInput | Out-Null
if ((Get-ChildItem "$P/.claude/agents/*.md").Count -ne 17) { Fail "claude: ролей не 17" }; Ok
if (-not (Test-Path "$P/.claude/skills/memory/SKILL.md")) { Fail "claude: нет скилла memory" }; Ok
if (-not (Test-Path "$P/CLAUDE.md")) { Fail "claude: нет CLAUDE.md" }; Ok

# --- OpenCode / Codex: раскладка ---
$P = Join-Path $Tmp 'opencode'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" opencode -Project $P -NoInput | Out-Null
if ((Get-ChildItem "$P/.opencode/agent/*.md").Count -ne 17) { Fail "opencode: агентов не 17" }; Ok
if (-not (Test-Path "$P/AGENTS.md")) { Fail "opencode: нет AGENTS.md" }; Ok

$P = Join-Path $Tmp 'codex'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" codex -Project $P -NoInput | Out-Null
if ((Get-ChildItem "$P/.agents/roles/*.md").Count -ne 17) { Fail "codex: ролей не 17" }; Ok
if (-not (Select-String -Path "$P/AGENTS.md" -Pattern 'Hughes' -Quiet)) { Fail "codex: в AGENTS.md нет блоков ролей" }; Ok

# --- Недеструктивность: существующий AGENTS.md ---
$P = Join-Path $Tmp 'existing'; New-Item -ItemType Directory -Force -Path $P | Out-Null
Set-Content "$P/AGENTS.md" 'ORIGINAL OPERATOR RULES'
& pwsh -File "$Repo/install.ps1" codex -Project $P -NoInput | Out-Null
if (@(Get-Content "$P/AGENTS.md")[0] -ne 'ORIGINAL OPERATOR RULES') { Fail "existing AGENTS.md затёрт" }; Ok
if (-not (Test-Path "$P/AGENTS.harness.md")) { Fail "инструкции харнеса не рядом" }; Ok

# === enforcement (--hard) ===
$P = Join-Path $Tmp 'cl-hard'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" claude -Project $P -Hard -NoInput | Out-Null
if (-not (Test-Path "$P/.claude/hooks/gate-check.mjs")) { Fail "claude --hard: нет хука gate-check.mjs" }; Ok
if (-not (Select-String -Path "$P/.claude/settings.json" -Pattern 'PreToolUse' -Quiet)) { Fail "settings без хуков" }; Ok
if (-not (Select-String -Path "$P/.claude/settings.json" -Pattern 'gate-check.mjs' -Quiet)) { Fail "settings не ссылается на .mjs" }; Ok

$GC = "$Repo/harness/enforcement/claude/gate-check.mjs"
$LD = "$Repo/harness/enforcement/claude/log-decision.mjs"

# gate-check: hughes без апрува → блок (exit 2)
$D = Join-Path $Tmp 'gate-block'; New-Item -ItemType Directory -Force -Path $D | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"hughes"}}' | node $GC 2>$null
if ($LASTEXITCODE -eq 0) { Pop-Location; Fail "gate не заблокировал hughes без апрува" }; Ok
Pop-Location

# gate-check: hughes с апрувом → проход (exit 0)
$D = Join-Path $Tmp 'gate-pass'
New-Item -ItemType Directory -Force -Path "$D/.agent/plan-reviewer" | Out-Null
New-Item -ItemType Directory -Force -Path "$D/.agent/gates" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/plan-reviewer/plan-review.md" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/gates/gate1.approved" | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"hughes"}}' | node $GC
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "gate заблокировал при апруве" }; Ok
Pop-Location

# gate-check: planner проходит свободно
$D = Join-Path $Tmp 'gate-planner'; New-Item -ItemType Directory -Force -Path $D | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"planner"}}' | node $GC
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "gate заблокировал planner" }; Ok
Pop-Location

# log-decision: дописывает decisions.log
$D = Join-Path $Tmp 'loghook'; New-Item -ItemType Directory -Force -Path $D | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"planner"}}' | node $LD
Pop-Location
if (-not (Select-String -Path "$D/.agent/decisions.log" -Pattern 'role=planner' -Quiet)) { Fail "log-decision не записал роль" }; Ok
if (-not (Select-String -Path "$D/.agent/decisions.log" -Pattern 'via=claude-hook' -Quiet)) { Fail "log-decision без via" }; Ok

# Раздача моделей по ролям (тир + оверрайд + наследование), самовосстановление конфига
node "$Repo/component-tests/model-distribution/run.mjs" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "model-distribution: роли получили неверные модели" }; Ok

Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
Write-Host "PASS $script:pass — harness smoke Windows (install.ps1 + Node-хуки + модели)"
