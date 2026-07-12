// Смоук чистых/fs-хелперов validate-dod. Запуск: node harness/test/validate-dod.smoke.mjs
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { collectFiles, missingArtifacts, missingReadmeSections, staleMarkerHits, loadProfile } from "../validate-dod.mjs"

// профили для проверки хелперов (совпадают с harness/target-profiles.json)
const SERVICE = { shape: "service", contract: ["openapi.yaml"], readme_sections: ["failure-map", "api", "build-run"] }
const CLI = { shape: "cli", contract: ["config.schema.json", "report.schema.json"], readme_sections: ["failure-map", "usage", "build-run"] }

let pass = 0
const dir = await mkdtemp(join(tmpdir(), "dod-smoke-"))

// полный «зелёный» сервис
await mkdir(join(dir, "api-specification"), { recursive: true })
await writeFile(join(dir, "api-specification", "openapi.yaml"), "openapi: 3.0.0\n")
await mkdir(join(dir, "component-tests", "features"), { recursive: true })
await writeFile(join(dir, "component-tests", "service.Dockerfile"), "FROM golang\n")
await writeFile(join(dir, "component-tests", "docker-compose.test.yml"), "services: {}\n")
await mkdir(join(dir, "component-tests", "scripts"), { recursive: true })
await writeFile(join(dir, "component-tests", "scripts", "run-tests.sh"), "#!/bin/sh\n")
await writeFile(join(dir, "component-tests", "features", "list.feature"), "Feature: x\n")
await writeFile(join(dir, "README.md"),
  "# svc\n## API\n`GET /services`\n## Build & Run\n`go build`\n## Карта режимов отказа\n| code | ... |\n")
await mkdir(join(dir, ".git"), { recursive: true }); await writeFile(join(dir, ".git", "x"), "z")
await mkdir(join(dir, "vendor"), { recursive: true }); await writeFile(join(dir, "vendor", "y.go"), "z")

const files = collectFiles(dir)

// A. обход пропускает .git/vendor
assert.ok(!files.some((f) => f.startsWith(".git")), ".git пропущен"); pass++
assert.ok(!files.some((f) => f.startsWith("vendor")), "vendor пропущен"); pass++

// B. service-профиль: полный сервис → ничего не отсутствует
assert.deepEqual(missingArtifacts(files, SERVICE), [], "полный сервис — ок"); pass++

// C. README со всеми секциями (service) → пусто
assert.deepEqual(missingReadmeSections("## API\nGET /x\n## Run\n## Карта режимов отказа\n", SERVICE.readme_sections), []); pass++

// D. README без карты отказа → её ключ и репортим
assert.deepEqual(missingReadmeSections("## API\nGET /x\n## Run\n", SERVICE.readme_sections), ["failure-map"]); pass++

// E. убрать openapi + run-tests → contract:openapi.yaml + run-tests.sh в missing
const partial = files.filter((f) => !/openapi|run-tests/.test(f))
const miss = missingArtifacts(partial, SERVICE)
assert.ok(miss.includes("contract: openapi.yaml") && miss.includes("run-tests.sh"), `missing=${miss}`); pass++

// F. пустой service → 5 fixed + 1 contract(openapi) = 6
assert.equal(missingArtifacts([], SERVICE).length, 6); pass++

// F2. пустой cli → 5 fixed + 2 contract(config+report) = 7
assert.equal(missingArtifacts([], CLI).length, 7); pass++

// F3. cli-контракт: наличие config.schema+report.schema → в missing только fixed, не contract
const cliFiles = ["api-specification/config.schema.json", "api-specification/report.schema.json"]
assert.ok(!missingArtifacts(cliFiles, CLI).some((m) => m.startsWith("contract:")), "cli contract найден"); pass++

// F4. cli README требует usage, НЕ api: текст с usage проходит, с api-но-без-usage — падает
assert.deepEqual(missingReadmeSections("## Usage\ntool run cfg\n## Run\n## Карта режимов отказа\n", CLI.readme_sections), []); pass++
assert.deepEqual(missingReadmeSections("## API\nGET /x\n## Run\n## Карта режимов отказа\n", CLI.readme_sections), ["usage"]); pass++

// G. loadProfile: нет маркера → service (default); маркер cli → cli
assert.equal(loadProfile(dir).shape, "service", "нет .agent/planner/target → service"); pass++
await mkdir(join(dir, ".agent", "planner"), { recursive: true })
await writeFile(join(dir, ".agent", "planner", "target"), "cli\n")
assert.equal(loadProfile(dir).shape, "cli", "маркер cli → cli"); pass++
assert.deepEqual(loadProfile(dir).contract, CLI.contract, "cli-профиль несёт config+report schema"); pass++

// H. стейл-маркеры: state в .feature, TODO в README
await writeFile(join(dir, "component-tests", "features", "list.feature"),
  "Feature: x\n  # сервис не реализован (placeholder 501) → RED\n")
await writeFile(join(dir, "README.md"),
  "# svc\n## API\nGET /x\n## Run\n## Карта режимов отказа\nTODO: добавить кэш потом\n")
const hits = staleMarkerHits(dir, collectFiles(dir))
assert.ok(hits.some((h) => h.cls === "state" && h.label === "placeholder" && /\.feature$/.test(h.file)), "placeholder в feature"); pass++
assert.ok(hits.some((h) => h.cls === "state" && h.label === "not-implemented"), "«не реализован»"); pass++
assert.ok(hits.some((h) => h.cls === "future" && h.label === "TODO" && /README/.test(h.file)), "TODO future"); pass++

// I. чистый артефакт без маркеров → пусто
await writeFile(join(dir, "component-tests", "features", "clean.feature"), "Feature: clean\n  Scenario: ok\n")
assert.equal(staleMarkerHits(dir, ["component-tests/features/clean.feature"]).length, 0); pass++

await rm(dir, { recursive: true, force: true })
console.log(`PASS ${pass}/18 — validate-dod smoke (profile-driven)`)
