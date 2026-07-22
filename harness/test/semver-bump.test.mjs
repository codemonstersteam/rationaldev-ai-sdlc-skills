// Ядро тег-автоматики транка (io: none): parseTag/latestRelease/touchesProduct/weightFrom/nextTag/canaryTag.
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseTag, latestRelease, isPlumbing, touchesProduct, weightFrom, nextTag, canaryTag } from "../../ci/semver-bump.mjs"

test("parseTag: и голый X.Y.Z, и v-префикс — форма запоминается", () => {
  assert.deepEqual(parseTag("1.4.2"), { prefix: "", major: 1, minor: 4, patch: 2, pre: null, build: null })
  assert.deepEqual(parseTag("v1.4.2"), { prefix: "v", major: 1, minor: 4, patch: 2, pre: null, build: null })
  assert.equal(parseTag("1.4"), null)
  assert.equal(parseTag("release-1.4.2"), null, "произвольный префикс — не SemVer-тег")
  assert.equal(parseTag(""), null)
})

// DISCRIMINATING: форму диктует РЕПО, а не инструмент. Если parseTag отвергает `v1.2.3`,
// latestRelease=null и модуль сеет параллельную нумерацию с нуля рядом с живыми тегами.
test("nextTag: v-префикс репо СОХРАНЯЕТСЯ, а не подменяется голым", () => {
  const r = nextTag({ weight: "patch", files: ["src/a.go"], tags: ["v1.2.0", "v1.3.4"] })
  assert.equal(r.tag, "v1.3.5")
})

test("nextTag: форму диктует ПОСЛЕДНИЙ релизный тег (осознанный переход подхватывается)", () => {
  assert.equal(nextTag({ weight: "patch", files: ["src/a.go"], tags: ["1.2.0", "v1.3.4"] }).tag, "v1.3.5")
  assert.equal(nextTag({ weight: "patch", files: ["src/a.go"], tags: ["v1.2.0", "1.3.4"] }).tag, "1.3.5")
})

test("parseTag: pre-release/build — расширения формата, вес не меняют", () => {
  assert.equal(parseTag("1.4.3-canary.2").pre, "canary.2")
  assert.equal(parseTag("1.4.3+build.7").build, "build.7")
})

test("latestRelease: канарейки НЕ двигают базу версии", () => {
  assert.deepEqual(latestRelease(["1.4.2", "1.4.3-canary.1", "1.4.3-canary.9"]),
    { prefix: "", major: 1, minor: 4, patch: 2, pre: null, build: null })
})

test("latestRelease: сортировка ЧИСЛОВАЯ, не лексикографическая (1.10.0 > 1.9.0)", () => {
  assert.equal(latestRelease(["1.9.0", "1.10.0"]).minor, 10)
  assert.equal(latestRelease(["1.2.9", "1.2.10"]).patch, 10)
})

test("latestRelease: мусор и отсутствие тегов", () => {
  assert.equal(latestRelease([]), null)
  assert.equal(latestRelease(["release-2024", "not-a-tag"]), null)
})

test("isPlumbing: заведомая инфра — да", () => {
  for (const p of [".github/workflows/ci.yml", "README.md", "docs/design/x.md", "Dockerfile",
                   "Makefile", "go.sum", ".gitignore", "package-lock.json", "LICENSE"])
    assert.equal(isPlumbing(p), true, p)
})

test("isPlumbing: продуктовый код и контракт — НЕТ (fail-closed на неизвестном)", () => {
  for (const p of ["src/order.go", "internal/api/handler.py", "harness/gen-agents.mjs",
                   "api-specification/openapi.yaml", "go.mod"])
    assert.equal(isPlumbing(p), false, p)
})

test("touchesProduct: смешанный diff → продуктовый (хоть один файл)", () => {
  assert.equal(touchesProduct(["README.md", "src/order.go"]), true)
  assert.equal(touchesProduct(["README.md", "docs/a.md"]), false)
  assert.equal(touchesProduct([]), false)
})

test("weightFrom: Conventional Commits в заголовке PR", () => {
  assert.equal(weightFrom({ title: "fix: округление сходится к контракту" }), "patch")
  assert.equal(weightFrom({ title: "feat: новый эндпоинт /report" }), "minor")
  assert.equal(weightFrom({ title: "fix(httpapi): мусор после JSON" }), "patch", "scope не мешает")
})

// DISCRIMINATING: `!` ПОБЕЖДАЕТ тип — иначе багфикс, ломающий совместимость, уехал бы в patch.
test("weightFrom: '!' побеждает тип → major", () => {
  assert.equal(weightFrom({ title: "fix!: сменили формат ответа" }), "major")
  assert.equal(weightFrom({ title: "feat!: убрали v1" }), "major")
  assert.equal(weightFrom({ title: "fix(api)!: …" }), "major", "scope + bang")
})

test("weightFrom: футер BREAKING CHANGE в теле → major", () => {
  assert.equal(weightFrom({ title: "fix: x", body: "детали\n\nBREAKING CHANGE: убрано поле unit" }), "major")
})

test("weightFrom: НЕ гадаем — не-CC заголовок и веса-нейтральные типы → null", () => {
  assert.equal(weightFrom({ title: "починил округление" }), null, "не Conventional Commits")
  assert.equal(weightFrom({ title: "chore: бамп зависимостей" }), null)
  assert.equal(weightFrom({ title: "docs: правка README" }), null)
  assert.equal(weightFrom({ title: "" }), null)
  assert.equal(weightFrom({}), null)
})

test("nextTag: три веса от одной базы", () => {
  const tags = ["1.0.0", "1.4.2"]
  assert.equal(nextTag({ weight: "patch", files: ["src/a.go"], tags }).tag, "1.4.3")
  assert.equal(nextTag({ weight: "minor", files: ["src/a.go"], tags }).tag, "1.5.0")
  assert.equal(nextTag({ weight: "major", files: ["src/a.go"], tags }).tag, "2.0.0")
})

test("nextTag: no-bump на плумбинге (решение оператора — версию не двигаем)", () => {
  const r = nextTag({ weight: "patch", files: [".github/workflows/ci.yml", "README.md"], tags: ["1.4.2"] })
  assert.equal(r.tag, null)
  assert.match(r.reason, /no-bump/)
})

test("nextTag: смешанный diff бампает (fail-closed)", () => {
  assert.equal(nextTag({ weight: "patch", files: ["README.md", "src/a.go"], tags: ["1.4.2"] }).tag, "1.4.3")
})

test("nextTag: нет weight-сигнала → тега нет, причина названа (CI не гадает)", () => {
  const r = nextTag({ weight: null, files: ["src/a.go"], tags: ["1.4.2"] })
  assert.equal(r.tag, null)
  assert.match(r.reason, /weight/)
})

// DISCRIMINATING: greenfield ОБЪЯВЛЯЕТ 1.0.0, а не бампает базу — иначе первый релиз вертикали
// уехал бы в 1.4.3 от случайных тегов, оставшихся в репо.
test("nextTag: greenfield → 1.0.0 (форма — по репо)", () => {
  assert.equal(nextTag({ weight: "greenfield", files: ["src/a.go"], tags: [] }).tag, "v1.0.0",
    "тегов нет — форму брать не у кого: дефолт `v` (решение оператора)")
  assert.equal(nextTag({ weight: "greenfield", files: ["src/a.go"], tags: ["1.4.2"] }).tag, "1.0.0")
  assert.equal(nextTag({ weight: "greenfield", files: ["src/a.go"], tags: ["v0.9.0"] }).tag, "v1.0.0")
  assert.equal(nextTag({ weight: "greenfield", files: ["README.md"], tags: [] }).tag, null, "плумбинг не релизится")
})

test("nextTag: chore/unclear веса не несут → тега нет", () => {
  assert.equal(nextTag({ weight: "chore", files: ["src/a.go"], tags: ["1.4.2"] }).tag, null)
  assert.equal(nextTag({ weight: "unclear", files: ["src/a.go"], tags: ["1.4.2"] }).tag, null)
})

test("nextTag: тегов нет → первый тег бампается ПО ВЕСУ от 0.0.0 (не захардкоженный 0.1.0)", () => {
  assert.equal(nextTag({ weight: "patch", files: ["src/a.go"], tags: [] }).tag, "v0.0.1")
  assert.equal(nextTag({ weight: "minor", files: ["src/a.go"], tags: [] }).tag, "v0.1.0")
  assert.equal(nextTag({ weight: "major", files: ["src/a.go"], tags: [] }).tag, "v1.0.0")
  assert.equal(nextTag({ weight: "patch", files: ["src/a.go"], tags: ["1.0.0-canary.1"] }).tag, "v0.0.1",
    "одни канарейки = релизной базы нет → seed по весу")
})

test("nextTag: major из 0.x поднимает до 1.0.0", () => {
  assert.equal(nextTag({ weight: "major", files: ["src/a.go"], tags: ["0.9.7"] }).tag, "1.0.0")
})

test("canaryTag: нумерация с 1 и инкремент от максимума", () => {
  assert.equal(canaryTag("1.4.3", ["1.4.2"]), "1.4.3-canary.1")
  assert.equal(canaryTag("1.4.3", ["1.4.3-canary.1", "1.4.3-canary.2"]), "1.4.3-canary.3")
  assert.equal(canaryTag("1.4.3", ["1.4.3-canary.9", "1.4.3-canary.10"]), "1.4.3-canary.11", "числовой максимум, не строковый")
  assert.equal(canaryTag("1.4.3", ["1.5.0-canary.7"]), "1.4.3-canary.1", "чужие канарейки не считаются")
})
