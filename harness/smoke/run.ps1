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

# Ожидаемое число ролей — из ИСТОЧНИКА ПРАВДЫ (_shared/*.md), не магическое число (зеркало run.sh).
$NRoles = (Get-ChildItem "$Repo/harness/agents/_shared/*.md").Count
node "$Repo/harness/gen-skill-index.mjs" --check | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "skill-index устарел" }; Ok

# --- Claude: раскладка ---
$P = Join-Path $Tmp 'claude'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" claude -Project $P -NoInput | Out-Null
if ((Get-ChildItem "$P/.claude/agents/*.md").Count -ne $NRoles) { Fail "claude: ролей не $NRoles" }; Ok
if (-not (Test-Path "$P/.claude/skills/memory/SKILL.md")) { Fail "claude: нет скилла memory" }; Ok
if (-not (Test-Path "$P/CLAUDE.md")) { Fail "claude: нет CLAUDE.md" }; Ok

# --- OpenCode / Codex: раскладка ---
$P = Join-Path $Tmp 'opencode'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" opencode -Project $P -NoInput | Out-Null
if ((Get-ChildItem "$P/.opencode/agent/*.md").Count -ne $NRoles) { Fail "opencode: агентов не $NRoles" }; Ok
if (-not (Test-Path "$P/AGENTS.md")) { Fail "opencode: нет AGENTS.md" }; Ok

$P = Join-Path $Tmp 'codex'; New-Item -ItemType Directory -Force -Path $P | Out-Null
& pwsh -File "$Repo/install.ps1" codex -Project $P -NoInput | Out-Null
if ((Get-ChildItem "$P/.agents/roles/*.md").Count -ne $NRoles) { Fail "codex: ролей не $NRoles" }; Ok
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

# gate-check: фронтдор — без brd.md роутить можно ТОЛЬКО @gilb
$D = Join-Path $Tmp 'frontdoor'; New-Item -ItemType Directory -Force -Path $D | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"wirth-triage"}}' | node $GC 2>$null
if ($LASTEXITCODE -eq 0) { Pop-Location; Fail "фронтдор не заблокировал триаж без brd.md" }; Ok
'{"tool_input":{"subagent_type":"gilb"}}' | node $GC
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "фронтдор заблокировал gilb" }; Ok
Pop-Location

# gate-check: hughes без апрува → блок (brd.md есть, ловим Gate #1)
$D = Join-Path $Tmp 'gate-block'; New-Item -ItemType Directory -Force -Path "$D/.agent/planner" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/planner/brd.md" | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"hughes"}}' | node $GC 2>$null
if ($LASTEXITCODE -eq 0) { Pop-Location; Fail "gate не заблокировал hughes без апрува" }; Ok
Pop-Location

# gate-check: hughes с апрувом → проход (brd + plan-review + gate1)
$D = Join-Path $Tmp 'gate-pass'
New-Item -ItemType Directory -Force -Path "$D/.agent/plan-reviewer" | Out-Null
New-Item -ItemType Directory -Force -Path "$D/.agent/gates" | Out-Null
New-Item -ItemType Directory -Force -Path "$D/.agent/planner" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/plan-reviewer/plan-review.md" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/gates/gate1.approved" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/planner/brd.md" | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"hughes"}}' | node $GC
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "gate заблокировал при апруве" }; Ok
Pop-Location

# gate-check: mode=chore — implementer требует CHORE-PLAN.md вместо plan-review.md
$D = Join-Path $Tmp 'gate-chore'
New-Item -ItemType Directory -Force -Path "$D/.agent/gates" | Out-Null
New-Item -ItemType Directory -Force -Path "$D/.agent/planner" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/planner/brd.md" | Out-Null
# UTF-8 без BOM (как пишет агент) — Set-Content на Windows добавляет BOM/UTF-16, ломая сравнение mode.
[System.IO.File]::WriteAllText((Join-Path $D '.agent/planner/mode'), 'chore')
New-Item -ItemType File -Force -Path "$D/.agent/gates/gate1.approved" | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"hughes"}}' | node $GC 2>$null
if ($LASTEXITCODE -eq 0) { Pop-Location; Fail "chore: gate пропустил без CHORE-PLAN.md" }; Ok
New-Item -ItemType Directory -Force -Path "$D/docs/chores/001-ci-on-pr" | Out-Null
New-Item -ItemType File -Force -Path "$D/docs/chores/001-ci-on-pr/CHORE-PLAN.md" | Out-Null
'{"tool_input":{"subagent_type":"hughes"}}' | node $GC
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "chore: gate заблокировал при durable CHORE-PLAN.md + gate1" }; Ok
Pop-Location

# gate-check: не-implementer после фронтдора (brd.md есть) проходит
$D = Join-Path $Tmp 'gate-planner'; New-Item -ItemType Directory -Force -Path "$D/.agent/planner" | Out-Null
New-Item -ItemType File -Force -Path "$D/.agent/planner/brd.md" | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"wirth-planner"}}' | node $GC
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "gate заблокировал wirth-planner" }; Ok
Pop-Location

# log-decision: дописывает decisions.log
$D = Join-Path $Tmp 'loghook'; New-Item -ItemType Directory -Force -Path $D | Out-Null
Push-Location $D
'{"tool_input":{"subagent_type":"wirth-planner"}}' | node $LD
Pop-Location
if (-not (Select-String -Path "$D/.agent/decisions.log" -Pattern 'role=wirth-planner' -Quiet)) { Fail "log-decision не записал роль" }; Ok
if (-not (Select-String -Path "$D/.agent/decisions.log" -Pattern 'via=claude-hook' -Quiet)) { Fail "log-decision без via" }; Ok

# Раздача моделей по ролям (тир + оверрайд + наследование), самовосстановление конфига
node "$Repo/component-tests/model-distribution/run.mjs" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "model-distribution: роли получили неверные модели" }; Ok

Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
Write-Host "PASS $script:pass — harness smoke Windows (install.ps1 + Node-хуки + модели)"
