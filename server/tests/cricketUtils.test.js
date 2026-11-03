const test = require("node:test");
const assert = require("node:assert");
const { parseBallToken, buildBallsFromTokens, calculateScoreboard } = require("../utils/cricketUtils");

const match = { battingTeam: "A", bowlingTeam: "B", maxOvers: 20, target: null };

test("a bye is a legal ball with extras and no bat runs", () => {
  const ball = parseBallToken("b2");
  assert.strictEqual(ball.isLegal, true);
  assert.strictEqual(ball.extras, 2);
  assert.strictEqual(ball.runsOffBat, 0);
  assert.strictEqual(ball.extraType, "bye");
});

test("a leg-bye is marked as a leg-bye", () => {
  assert.strictEqual(parseBallToken("lb1").extraType, "legbye");
});

test("a run-out with runs is a legal wicket ball carrying those runs", () => {
  const ball = parseBallToken("w2");
  assert.strictEqual(ball.isWicket, true);
  assert.strictEqual(ball.isLegal, true);
  assert.strictEqual(ball.runsOffBat, 2);
});

test("a wicket on a wide is not a legal ball", () => {
  const ball = parseBallToken("wdw");
  assert.strictEqual(ball.isWicket, true);
  assert.strictEqual(ball.isLegal, false);
  assert.strictEqual(ball.extras, 1);
});

test("a wicket on a no-ball is not a legal ball", () => {
  const ball = parseBallToken("nbw");
  assert.strictEqual(ball.isWicket, true);
  assert.strictEqual(ball.isLegal, false);
});

test("invalid tokens are rejected", () => {
  assert.throws(() => parseBallToken("b5"), /Invalid ball token/);
  assert.throws(() => parseBallToken("b0"), /Invalid ball token/);
  assert.throws(() => parseBallToken("w4"), /Invalid ball token/);
  assert.throws(() => parseBallToken("x"), /Invalid ball token/);
});

test("scoreboard adds runs, wickets and legal balls correctly", () => {
  const balls = buildBallsFromTokens(["b2", "w1", "lb1", "wdw", "nbw"]);
  const scoreboard = calculateScoreboard(match, balls);
  assert.strictEqual(scoreboard.runs, 6);
  assert.strictEqual(scoreboard.wickets, 3);
  assert.strictEqual(scoreboard.legalBalls, 3);
});

test("over numbers come from legal balls, so extras stay in the right over", () => {
  const balls = buildBallsFromTokens(["0", "0", "0", "0", "0", "wd", "0", "1"]);
  assert.strictEqual(balls[5].over, 1); // wide after 5 legal balls: still over 1
  assert.strictEqual(balls[6].over, 1); // 6th legal ball: still over 1
  assert.strictEqual(balls[7].over, 2); // next ball starts over 2
});