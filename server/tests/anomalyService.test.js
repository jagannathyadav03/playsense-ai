const test = require("node:test");
const assert = require("node:assert");
const { buildBallsFromTokens } = require("../utils/cricketUtils");
const { detectAnomalies } = require("../services/anomalyService");

const baseMatch = { battingTeam: "A", bowlingTeam: "B", maxOvers: 20, target: null };

// Turns "1 W 0 W" into alerts, using the same path as the real app
function run(tokenText, matchOverrides = {}, config) {
  const balls = buildBallsFromTokens(tokenText.split(" ").filter(Boolean));
  return detectAnomalies({ ...baseMatch, ...matchOverrides }, balls, config);
}

const ofType = (alerts, type) => alerts.filter((a) => a.type === type);

// ---------- Multiple wickets ----------

test("two wickets within six legal balls raise one alert", () => {
  const alerts = ofType(run("1 W 0 W"), "MULTIPLE_WICKETS");
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].evidence.wickets, 2);
  assert.strictEqual(alerts[0].severity, "MEDIUM");
});

test("wickets exactly six legal balls apart are not a collapse", () => {
  assert.strictEqual(ofType(run("W 0 0 0 0 0 W"), "MULTIPLE_WICKETS").length, 0);
});

test("wides do not push a wicket out of the window", () => {
  const alerts = ofType(run("W wd wd wd wd wd wd 0 0 0 0 W"), "MULTIPLE_WICKETS");
  assert.strictEqual(alerts.length, 1);
});

test("a third wicket escalates to HIGH", () => {
  const alerts = ofType(run("W W W"), "MULTIPLE_WICKETS");
  assert.strictEqual(alerts.length, 2);
  assert.strictEqual(alerts[0].severity, "MEDIUM");
  assert.strictEqual(alerts[1].severity, "HIGH");
});

test("alert ids stay the same when more balls arrive", () => {
  const before = run("1 W 0 W").map((a) => a.id);
  const after = run("1 W 0 W 1 1").map((a) => a.id);
  assert.deepStrictEqual(before, after);
});

test("thresholds are configurable", () => {
  const alerts = run("1 W 0 W", {}, { multipleWickets: { minWickets: 3 } });
  assert.strictEqual(ofType(alerts, "MULTIPLE_WICKETS").length, 0);
});

// ---------- Dot-ball pressure ----------

test("four dots in a row raise a LOW alert", () => {
  const alerts = ofType(run("0 0 0 0"), "DOT_BALL_PRESSURE");
  assert.strictEqual(alerts.length, 1);
  assert.strictEqual(alerts[0].evidence.consecutiveDots, 4);
  assert.strictEqual(alerts[0].severity, "LOW");
  assert.strictEqual(alerts[0].ongoing, true);
});

test("three dots are not enough", () => {
  assert.strictEqual(ofType(run("0 0 0"), "DOT_BALL_PRESSURE").length, 0);
});

test("a wide inside the streak does not break it", () => {
  const alerts = ofType(run("0 0 wd 0 0"), "DOT_BALL_PRESSURE");
  assert.strictEqual(alerts.length, 1);
});

test("a scoring ball breaks the streak", () => {
  assert.strictEqual(ofType(run("0 0 1 0 0"), "DOT_BALL_PRESSURE").length, 0);
});

test("a no-ball with runs off the bat breaks the streak", () => {
  assert.strictEqual(ofType(run("0 0 nb4 0 0"), "DOT_BALL_PRESSURE").length, 0);
});

test("dots in a big chase are more severe", () => {
  const alerts = ofType(run("0 0 0 0 0", { target: 200 }), "DOT_BALL_PRESSURE");
  assert.strictEqual(alerts[0].severity, "HIGH");
});

// ---------- Invalid or incomplete data ----------

test("empty or missing ball lists return no alerts", () => {
  assert.deepStrictEqual(detectAnomalies(baseMatch, []), []);
  assert.deepStrictEqual(detectAnomalies(baseMatch, null), []);
  assert.deepStrictEqual(detectAnomalies(baseMatch, undefined), []);
});