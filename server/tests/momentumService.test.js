const test = require("node:test");
const assert = require("node:assert");
const { buildBallsFromTokens } = require("../utils/cricketUtils");
const { calculateMomentum } = require("../services/momentumService");

const baseMatch = { battingTeam: "A", bowlingTeam: "B", maxOvers: 20, target: null };

function run(tokenText, matchOverrides = {}) {
  const balls = buildBallsFromTokens(tokenText.split(" ").filter(Boolean));
  return calculateMomentum({ ...baseMatch, ...matchOverrides }, balls);
}

test("momentum is not ready before 6 legal balls", () => {
  const result = run("1 1 1 1 1");
  assert.strictEqual(result.ready, false);
  assert.strictEqual(result.current, null);
});

test("wides do not count towards the minimum number of balls", () => {
  assert.strictEqual(run("wd wd wd wd wd wd").ready, false);
});

test("a boundary burst gives the batting side the edge", () => {
  const result = run("4 6 4 1 4 6 1 4 1 6 4 4");
  assert.strictEqual(result.ready, true);
  assert.ok(result.current.battingIndex >= 60);
  assert.match(result.current.label, /Batting side/);
});

test("wickets and dots give the bowling side the edge", () => {
  const result = run("0 W 0 W 0 0 0 1 0 0 0 W");
  assert.ok(result.current.battingIndex <= 40);
  assert.match(result.current.label, /Bowling side/);
});

test("batting and bowling momentum add up to 100", () => {
  const { current } = run("1 0 4 W 1 1 0 2 6 0");
  assert.strictEqual(current.battingIndex + current.bowlingIndex, 100);
});

test("factor points explain the index", () => {
  const { current } = run("4 6 4 1 4 6 1 4 1 6 4 4");
  const total = current.factors.reduce((sum, f) => sum + f.points, 0);
  assert.ok(Math.abs(total - (current.battingIndex - 50)) <= 1);
});

test("the required-rate factor appears only when chasing", () => {
  const chasing = run("0 0 0 0 0 0", { target: 150 });
  const batting = run("0 0 0 0 0 0");
  assert.ok(chasing.current.factors.some((f) => f.key === "requiredRate"));
  assert.ok(!batting.current.factors.some((f) => f.key === "requiredRate"));
});

test("a burst after a quiet spell shows batting momentum improving", () => {
  const result = run("0 0 0 0 0 0 0 0 0 0 0 0 4 4 4 4 4 4");
  assert.strictEqual(result.current.trend, "BATTING_IMPROVING");
  assert.ok(result.history.length > 0);
});

test("missing data returns not ready instead of crashing", () => {
  assert.strictEqual(calculateMomentum(baseMatch, null).ready, false);
  assert.strictEqual(calculateMomentum(null, []).ready, false);
});