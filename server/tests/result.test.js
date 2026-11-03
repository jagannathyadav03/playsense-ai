const test = require("node:test");
const assert = require("node:assert");
const { buildBallsFromTokens } = require("../utils/cricketUtils");
const { calculateResult } = require("../utils/resultUtils");
const cricketService = require("../services/cricketService");

const base = { battingTeam: "A", bowlingTeam: "B", maxOvers: 20, target: null };

function result(tokenText, overrides = {}) {
  const balls = buildBallsFromTokens(tokenText.split(" ").filter(Boolean));
  return calculateResult({ ...base, ...overrides }, balls);
}

test("an innings that is not finished is in progress", () => {
  assert.strictEqual(result("1 1").status, "IN_PROGRESS");
});

test("the first innings ends when the side is all out", () => {
  const r = result("W W W W W W W W W W");
  assert.strictEqual(r.status, "INNINGS_COMPLETE");
  assert.strictEqual(r.finalScore, "0/10");
  assert.strictEqual(r.nextTarget, 1);
});

test("the first innings ends when the overs are finished", () => {
  const r = result("1 1 1 1 1 1", { maxOvers: 1 });
  assert.strictEqual(r.status, "INNINGS_COMPLETE");
  assert.strictEqual(r.finalScore, "6/0");
  assert.strictEqual(r.nextTarget, 7);
});

test("a chase that reaches the target is won by the batting side", () => {
  const r = result("4 1", { target: 5 });
  assert.strictEqual(r.status, "MATCH_COMPLETE");
  assert.strictEqual(r.winner, "A");
  assert.strictEqual(r.headline, "A won by 10 wickets");
});

test("a win with one wicket in hand says wicket, not wickets", () => {
  const r = result("W W W W W W W W W 3", { target: 3 });
  assert.strictEqual(r.headline, "A won by 1 wicket");
});

test("a wide can finish the chase", () => {
  const r = result("2 wd", { target: 3 });
  assert.strictEqual(r.status, "MATCH_COMPLETE");
  assert.strictEqual(r.winner, "A");
});

test("a chase that falls short is won by the bowling side", () => {
  const r = result("1 1 1 1 1 1", { maxOvers: 1, target: 10 });
  assert.strictEqual(r.winner, "B");
  assert.strictEqual(r.headline, "B won by 3 runs");
});

test("a side that is all out chasing loses by the right margin", () => {
  const r = result("W W W W W W W W W W", { target: 100 });
  assert.strictEqual(r.headline, "B won by 99 runs");
});

test("finishing one run short of the target is a tie", () => {
  const r = result("1 1 1 1 1 1", { maxOvers: 1, target: 7 });
  assert.strictEqual(r.isTie, true);
  assert.strictEqual(r.winner, null);
  assert.strictEqual(r.headline, "Match tied");
});

test("balls entered after the innings ended are rejected", () => {
  const tokens = "1 1 1 1 1 1 1".split(" ");
  assert.throws(
    () => cricketService.analyzeFeed({ ...base, maxOvers: 1 }, tokens),
    /already over/
  );
});