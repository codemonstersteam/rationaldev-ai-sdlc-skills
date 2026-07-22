// close-run pure core: planClose (guards + tag delegation) · ledgerEntry (self-sufficient) · WIPE list.
import { test } from "node:test"
import assert from "node:assert/strict"
import { planClose, ledgerEntry, WIPE } from "../close-run.mjs"

const bump = ({ weight, files }) =>
  weight === "patch" && files.some((f) => f.startsWith("src/")) ? { tag: "0.1.0", reason: "seed" }
  : { tag: null, reason: "no-bump: plumbing" }

test("planClose: guards — gate2, merge, weight — each STOPs", () => {
  assert.match(planClose({ gate2: false, merged: true, weight: "patch", bump }).stop, /Gate #2/)
  assert.match(planClose({ gate2: true, merged: false, weight: "patch", bump }).stop, /not merged/)
  assert.match(planClose({ gate2: true, merged: true, weight: "", bump }).stop, /weight/)
})

test("planClose: all guards pass → delegates the tag decision, no own arithmetic", () => {
  const r = planClose({ gate2: true, merged: true, weight: "patch", files: ["src/x.java"], tags: [], bump })
  assert.equal(r.stop, null)
  assert.equal(r.tag, "0.1.0")
})

test("planClose: plumbing → null tag is NOT a stop (normal outcome)", () => {
  const r = planClose({ gate2: true, merged: true, weight: "patch", files: [".github/ci.yml"], tags: [], bump })
  assert.equal(r.stop, null)
  assert.equal(r.tag, null)
})

test("ledgerEntry: self-sufficient — task text inline, survives change-dir deletion", () => {
  const e = ledgerEntry({ ts: "2026-01-01T00:00:00Z", slug: "fix-x", weight: "patch",
    pr: "https://…/pull/2", mergeSha: "abc123", tag: "0.1.0", reason: "seed", task: "fix leaked set" })
  assert.match(e, /fix-x/); assert.match(e, /patch/); assert.match(e, /abc123/)
  assert.match(e, /fix leaked set/, "task described in text, not by a link into the change-dir")
})

test("ledgerEntry: no tag → records the no-bump reason, not an empty tag", () => {
  const e = ledgerEntry({ ts: "t", slug: "s", weight: "patch", pr: "p", mergeSha: "m", tag: null, reason: "plumbing" })
  assert.match(e, /no-bump: plumbing/)
})

test("WIPE: erases run-state, keeps decisions.log", () => {
  assert.ok(WIPE.includes(".agent/gates"))
  assert.ok(WIPE.includes(".agent/planner/mode"))
  assert.ok(!WIPE.some((p) => p.includes("decisions.log")), "trace is never wiped")
})
