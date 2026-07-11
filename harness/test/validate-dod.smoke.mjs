// Смоук чистых/fs-хелперов validate-dod. Запуск: node harness/test/validate-dod.smoke.mjs
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { collectFiles, missingArtifacts, missingReadmeSections, staleMarkerHits } from "../validate-dod.mjs"

let pass = 0
const dir = await mkdtemp(join(tmpdir(), "dod-smoke-"))

// полный «зелёный» сервис
await mkdir(join(dir, "api-specification"), { recursive: true })
await writeFile(join(dir, "api-specification", "openapi.yaml"), "openapi: 3.0.0\n")
await mkdir(join(dir, "component-tests", "features"), { recursive: true })
await writeFile(join(dir, "component-tests", "service.Dockerfile"), "FROM golang\n")   // Dockerfile-вариант
await writeFile(join(dir, "component-tests", "docker-compose.test.yml"), "services: {}\n")
await mkdir(join(dir, "component-tests", "scripts"), { recursive: true })
await writeFile(join(dir, "component-tests", "scripts", "run-tests.sh"), "#!/bin/sh\n")
await writeFile(join(dir, "component-tests", "features", "list.feature"), "Feature: x\n")
await writeFile(join(dir, "README.md"),
  "# svc\n## API\n`GET /services`\n## Build & Run\n`go build`\n## Карта режимов отказа\n| code | ... |\n")
// мусорные дерева, которые обход обязан пропустить
await mkdir(join(dir, ".git"), { recursive: true }); await writeFile(join(dir, ".git", "x"), "z")
await mkdir(join(dir, "vendor"), { recursive: true }); await writeFile(join(dir, "vendor", "y.go"), "z")

const files = collectFiles(dir)

// A. обход пропускает .git/vendor
assert.ok(!files.some((f) => f.startsWith(".git")), ".git должен быть пропущен"); pass++
assert.ok(!files.some((f) => f.startsWith("vendor")), "vendor должен быть пропущен"); pass++

// B. все 6 обязательных артефактов найдены (Dockerfile-вариант + compose под component-tests/)
assert.deepEqual(missingArtifacts(files), [], "полный сервис — ничего не отсутствует"); pass++

// C. README со всеми секциями → пусто
assert.deepEqual(missingReadmeSections("## API\nGET /x\n## Run\n## Карта режимов отказа\n"), []); pass++

// D. README без карты отказа → её и репортим
assert.deepEqual(missingReadmeSections("## API\nGET /x\n## Run\n"), ["Карта режимов отказа"]); pass++

// E. убрать openapi + run-tests → оба в missing
const partial = files.filter((f) => !/openapi|run-tests/.test(f))
const miss = missingArtifacts(partial)
assert.ok(miss.includes("OpenAPI contract") && miss.includes("run-tests.sh"), `missing=${miss}`); pass++

// F. пустой сервис → все 6 артефактов отсутствуют
assert.equal(missingArtifacts([]).length, 6); pass++

// G. стейл-маркеры: state-маркер в .feature ловится как cls=state, TODO в README как future
await writeFile(join(dir, "component-tests", "features", "list.feature"),
  "Feature: x\n  # сервис не реализован (placeholder 501) → RED\n")
await writeFile(join(dir, "README.md"),
  "# svc\n## API\nGET /x\n## Run\n## Карта режимов отказа\nTODO: добавить кэш потом\n")
const hits = staleMarkerHits(dir, collectFiles(dir))
const state = hits.filter((h) => h.cls === "state")
const future = hits.filter((h) => h.cls === "future")
assert.ok(state.some((h) => /\.feature$/.test(h.file) && h.label === "placeholder"), `state-hit не найден: ${JSON.stringify(hits)}`); pass++
assert.ok(state.some((h) => h.label === "not-implemented"), "«не реализован» → not-implemented"); pass++
assert.ok(future.some((h) => h.label === "TODO" && /README/.test(h.file)), "TODO в README → future"); pass++

// H. чистый артефакт без маркеров → пусто
await writeFile(join(dir, "component-tests", "features", "clean.feature"), "Feature: clean\n  Scenario: ok\n")
assert.equal(staleMarkerHits(dir, ["component-tests/features/clean.feature"]).length, 0); pass++

await rm(dir, { recursive: true, force: true })
console.log(`PASS ${pass}/11 — validate-dod smoke`)
