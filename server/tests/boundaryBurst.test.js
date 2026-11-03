const test = require("node:test");
const assert = require("node:assert");
const { buildBallsFromTokens } = require("../utils/cricketUtils");
const { detectAnomalies } = require("../services/anomalyService");

const baseMatch = { battingTeam: "A", bowlingTeam: "B", maxOvers: 20, target: null };

function run(tokenText, matchOverrides = {}, config) {
  const balls = buildBallsFromTokens(tokenText.split(" ").filter(Boolean));
  return detectAnomalies({ ...baseMatch, ...matchOverrides }, balls, config);
}

const bursts = (alerts) => alerts.filter((a) => a.type === "BOUNDARY_BURST");

test("three boundaries inside six legal balls raise one LOW alert", () => {
  const alerts = bursts(run("4 0 6 0 4"));
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].evidence.boundaries, 3);
  assert.strictEqual(alerts[0].evidence.fours, 2);
  assert.strictEqual(alerts[0].evidence.sixes, 1);
  assert.strictEqual(alerts[0].severity, "LOW");
});

test("two boundaries are not enough", () => {
  assert.strictEqual(bursts(run("4 0 0 6")).length, 0);
});

test("boundaries more than six legal balls apart do not add up", () => {
  assert.strictEqual(bursts(run("4 0 0 0 0 0 4 0 0 0 0 0 4")).length, 0);
});

test("wides between boundaries do not push them out of the window", () => {
  assert.strictEqual(bursts(run("4 0 0 0 wd wd wd wd wd 6 4")).length, 1);
});

test("a growing burst escalates once per extra boundary", () => {
  const alerts = bursts(run("4 4 4 4"));
  assert.strictEqual(alerts.length, 2);
  assert.strictEqual(alerts[0].severity, "LOW");
  assert.strictEqual(alerts[1].severity, "MEDIUM");
});

test("a long burst does not repeat the same alert", () => {
  const alerts = bursts(run("4 4 4 4 4 4 4 4 4 4"));
  assert.strictEqual(alerts.length, 4);
  assert.strictEqual(alerts[3].evidence.boundaries, 6);
});

test("alert ids stay the same when more balls arrive", () => {
  const before = bursts(run("4 0 6 0 4")).map((a) => a.id);
  const after = bursts(run("4 0 6 0 4 1 1")).map((a) => a.id);
  assert.deepStrictEqual(before, after);
});

test("a burst when the chase was slipping away is more severe", () => {
  const alerts = bursts(run("4 0 6 0 4", { target: 200 }));
  assert.strictEqual(alerts[0].severity, "MEDIUM");
});

test("a burst in the last five overs is more severe", () => {
  const alerts = bursts(run("0 ".repeat(90) + "4 6 4"));
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].severity, "MEDIUM");
});

test("the threshold is configurable", () => {
  const alerts = bursts(run("4 0 6 0 4", {}, { boundaryBurst: { minBoundaries: 4 } }));
  assert.strictEqual(alerts.length, 0);
});

test("byes for four are not boundaries off the bat", () => {
  assert.strictEqual(bursts(run("b4 b4 b4 b4")).length, 0);
});