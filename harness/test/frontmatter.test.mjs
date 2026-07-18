// Юнит-тесты чистого парсера frontmatter (io: none). Раннер: node --test.
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseFrontmatter } from "../frontmatter.mjs"

test("скаляр + тело", () => {
  const { data, body } = parseFrontmatter("---\nname: foo\nversion: \"1.0\"\n---\nтело\n")
  assert.equal(data.name, "foo")
  assert.equal(data.version, "1.0") // кавычки снимаются
  assert.equal(body.trim(), "тело")
})

test("flow-массив [a, b]", () => {
  const { data } = parseFrontmatter("---\nskills: [alpha, beta, gamma]\n---\n")
  assert.deepEqual(data.skills, ["alpha", "beta", "gamma"])
})

test("пустой flow-массив []", () => {
  const { data } = parseFrontmatter("---\nblocked_by: []\n---\n")
  assert.deepEqual(data.blocked_by, [])
})

test("block-массив (key:\\n  - a\\n  - b)", () => {
  const { data } = parseFrontmatter("---\noutputs:\n  - src/x/Wrapper.java\n  - src/x/util/Logic.java\n---\n")
  assert.deepEqual(data.outputs, ["src/x/Wrapper.java", "src/x/util/Logic.java"])
})

test("block-массив, затем ключ верхнего уровня (поп до корня)", () => {
  const { data } = parseFrontmatter("---\ninputs:\n  - a.md\n  - b.md\nio: none\n---\n")
  assert.deepEqual(data.inputs, ["a.md", "b.md"])
  assert.equal(data.io, "none") // не проглочен block-массивом
})

test("block-массив с кавычками элементов", () => {
  const { data } = parseFrontmatter("---\nskills:\n  - \"db-io\"\n  - 'db-schema'\n---\n")
  assert.deepEqual(data.skills, ["db-io", "db-schema"])
})

test("тикет-заголовок block-style (реальный кейс pzdc) парсится", () => {
  const src = "---\nid: \"01\"\ntype: module\nblocked_by: []\noutputs:\n  - src/main/A.java\n  - src/main/util/B.java\nio: n/a\n---\nтело\n"
  const { data } = parseFrontmatter(src)
  assert.equal(data.type, "module")
  assert.deepEqual(data.outputs, ["src/main/A.java", "src/main/util/B.java"])
  assert.deepEqual(data.blocked_by, [])
})

test("вложенная карта (2 пробела)", () => {
  const { data } = parseFrontmatter("---\npermission:\n  read: allow\n  bash:\n    \"*\": deny\n---\n")
  assert.equal(data.permission.read, "allow")
  assert.equal(data.permission.bash["*"], "deny")
})

test("без frontmatter → data:null, body=текст", () => {
  const src = "# просто markdown\nбез заголовка"
  const { data, body } = parseFrontmatter(src)
  assert.equal(data, null)
  assert.equal(body, src)
})

test("CRLF-устойчивость", () => {
  const { data } = parseFrontmatter("---\r\nid: 05\r\ntype: module\r\n---\r\nтело\r\n")
  assert.equal(data.id, "05")
  assert.equal(data.type, "module")
})
