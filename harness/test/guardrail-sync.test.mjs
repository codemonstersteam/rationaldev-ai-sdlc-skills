// Drift-guard: инлайн-копия чистых функций в rational-guardrail.mjs ДОЛЖНА совпадать с ../enforcement/shared.mjs.
// Плагин self-contained (не импортит shared.mjs, чтобы opencode не резолвил внешнее в изоляции), но логика —
// единый источник. Этот тест ловит рассинхрон: гоняет обе копии на одних входах, требует равенства.
import { test } from "node:test"
import assert from "node:assert/strict"
import * as S from "../enforcement/shared.mjs"
import * as P from "../enforcement/opencode/rational-guardrail.mjs"

test("константы идентичны shared.mjs", () => {
  assert.equal(P.GATE_MARK, S.GATE_MARK)
  assert.equal(P.DESIGN_DIR, S.DESIGN_DIR)
  assert.equal(P.CHORES_DIR, S.CHORES_DIR)
  assert.equal(P.CHORE_PLAN_FILE, S.CHORE_PLAN_FILE)
  assert.equal(P.PLAN_REVIEW_MARK, S.PLAN_REVIEW_MARK)
  assert.deepEqual([...P.PIPELINE].sort(), [...S.PIPELINE].sort())
  assert.deepEqual([...P.IMPLEMENTERS].sort(), [...S.IMPLEMENTERS].sort())
  assert.deepEqual([...P.TRUNK_BRANCHES].sort(), [...S.TRUNK_BRANCHES].sort())
  assert.deepEqual(P.ROLE_KEYS, S.ROLE_KEYS)
})

// (fn-имя, [входы...]) — гоняем shared vs plugin, требуем равный результат.
const cases = [
  ["pickRole", [{ subagent: "hughes" }], [{ agent: "gilb" }], [{}], ["x"]],
  ["normRole", ["@Hughes "], ["  IZI"]],
  ["isImplementer", ["hughes"], ["izi"], ["@wirth-tester"]],
  ["inPipeline", ["gilb"], ["general"], ["git-hand"]],
  ["requiresFrontDoor", ["gilb"], ["wirth-triage"]],
  ["branchFromHead", ["ref: refs/heads/main\n"], ["ref: refs/heads/feat/x\n"], ["deadbeef"], [""]],
  ["isTrunkBranch", ["main"], ["master"], ["feat/x"], [""]],
  ["isChoreMode", ["chore"], [" chore "], ["﻿chore"], ["foo"]],
  ["writesGateMarker", ["touch .agent/gates/gate1.approved"], ["echo x > .agent/gates/gate1.approved"], ["ls .agent/gates/gate1.approved"]],
  ["doneGreenTicketId", ['echo "ticket-05 slice green" >> .agent/planner/done.log'], ["ls x"]],
  ["parseTicketOutputs", ["outputs: [a.go, b.go]"], ["no outputs here"]],
  ["isOperatorApproval", ["GATE1 APPROVE"], ["gate1   approve slice-01"], ["go ahead"]],
  ["gateMarkerContent", [{ timestamp: "t", source: "s", prompt: "p\tq", planHash: "h" }], [{ timestamp: "t", source: "s", prompt: "" }]],
  ["toolCallSignature", ["read", { path: "x", b: 1 }], ["edit", { content: "z", path: "f" }]],
]

for (const [fn, ...inputs] of cases) {
  test(`${fn} — plugin ≡ shared на ${inputs.length} векторах`, () => {
    for (const args of inputs) {
      const got = P[fn](...args), want = S[fn](...args)
      assert.deepEqual(got, want, `${fn}(${JSON.stringify(args)}): plugin=${JSON.stringify(got)} shared=${JSON.stringify(want)}`)
    }
  })
}

test("hasChorePlan — plugin ≡ shared", () => {
  const dirs = () => ["001-x"], ok = (r) => r === "docs/chores/001-x/CHORE-PLAN.md", no = () => false
  assert.equal(P.hasChorePlan(dirs, ok), S.hasChorePlan(dirs, ok))
  assert.equal(P.hasChorePlan(dirs, no), S.hasChorePlan(dirs, no))
})

test("planReadyForApproval — plugin ≡ shared", () => {
  const rev = (set) => (r) => set.has(r)
  const v1 = [rev(new Set([".agent/plan-reviewer/plan-review.md"])), () => [], () => []]
  const v2 = [rev(new Set(["docs/design/slice-01/PLAN.md"])), () => ["slice-01"], () => []]
  const v3 = [rev(new Set(["docs/chores/001/CHORE-PLAN.md"])), () => [], () => ["001"]]
  const v4 = [rev(new Set()), () => ["s"], () => ["c"]]
  for (const v of [v1, v2, v3, v4]) assert.equal(P.planReadyForApproval(...v), S.planReadyForApproval(...v))
})

test("detectLoop — plugin ≡ shared", () => {
  for (const sigs of [["a", "a", "a", "a", "a"], ["a", "b", "a", "b"], ["r", "e", "r", "e", "r", "e"], ["x"]])
    assert.equal(P.detectLoop(sigs), S.detectLoop(sigs))
})
