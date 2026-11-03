const test = require("node:test");
const assert = require("node:assert");
const cricketService = require("../services/cricketService");
const { explainAlert, buildFacts, verifyExplanation, templateExplanation } = require("../services/aiservice");

const setup = { battingTeam: "India", bowlingTeam: "New Zealand", maxOvers: 20, target: null };

// Builds real facts for the first alert in a list of tokens
function factsFor(tokenText, matchSetup = setup) {
  const analysis = cricketService.analyzeFeed(matchSetup, tokenText.split(" "));
  return buildFacts(matchSetup, analysis, analysis.anomalies[0]);
}

const smallFacts = { match: { battingTeam: "India", bowlingTeam: "New Zealand" }, wickets: 2, window: 6, score: "1/2" };

const goodAnswer = {
  whatHappened: "2 wickets fell in the last 6 balls.",
  whyUnusual: "That is a quick pair of wickets.",
  whyItMatters: "This could put pressure on the new batters.",
  watchNext: "Watch how the next over goes.",
};

test("an answer that uses only supplied facts passes", () => {
  assert.deepStrictEqual(verifyExplanation(goodAnswer, smallFacts), []);
});

test("an invented number is rejected", () => {
  const answer = { ...goodAnswer, whatHappened: "3 wickets fell in the last 6 balls." };
  assert.ok(verifyExplanation(answer, smallFacts).some((issue) => issue.includes("3")));
});

test("an unsupported number word is rejected", () => {
  const answer = { ...goodAnswer, whatHappened: "Three wickets fell quickly." };
  assert.ok(verifyExplanation(answer, smallFacts).some((issue) => issue.includes("three")));
});

test("an invented player name is rejected", () => {
  const answer = { ...goodAnswer, whyItMatters: "The loss of Kohli could hurt." };
  assert.ok(verifyExplanation(answer, smallFacts).some((issue) => issue.includes("Kohli")));
});

test("overconfident wording is rejected", () => {
  const answer = { ...goodAnswer, whyItMatters: "India will win from here." };
  assert.ok(verifyExplanation(answer, smallFacts).some((issue) => issue.includes("will win")));
});

test("a missing field is rejected", () => {
  const { watchNext, ...incomplete } = goodAnswer;
  assert.ok(verifyExplanation(incomplete, smallFacts).some((issue) => issue.includes("watchNext")));
});

test("a field that is too long is rejected", () => {
  const answer = { ...goodAnswer, whyUnusual: "a".repeat(400) };
  assert.ok(verifyExplanation(answer, smallFacts).length > 0);
});

test("the template for a collapse passes the same verification", () => {
  const facts = factsFor("1 W 0 W");
  assert.deepStrictEqual(verifyExplanation(templateExplanation(facts), facts), []);
});

test("the template for a boundary burst in a chase passes verification", () => {
  const facts = factsFor("4 0 6 0 4", { ...setup, target: 200 });
  assert.deepStrictEqual(verifyExplanation(templateExplanation(facts), facts), []);
});

test("the template for dot-ball pressure passes verification", () => {
  const facts = factsFor("0 0 0 0 0");
  assert.deepStrictEqual(verifyExplanation(templateExplanation(facts), facts), []);
});

test("without an API key the explanation falls back to the template", async () => {
  delete process.env.GEMINI_API_KEY;
  const result = await explainAlert(setup, ["1", "W", "0", "W"], "MULTIPLE_WICKETS-4");
  assert.strictEqual(result.source, "template");
  assert.match(result.fallbackReason, /GEMINI_API_KEY/);
  assert.ok(result.explanation.whatHappened.length > 0);
});

test("an unknown alert id returns null", async () => {
  assert.strictEqual(await explainAlert(setup, ["1"], "NOPE-1"), null);
});

test("a team name with a possessive is not treated as an invented name", () => {
  const answer = {
    ...goodAnswer,
    whyItMatters: "That could help New Zealand's bowlers and India's batters.",
  };
  assert.deepStrictEqual(verifyExplanation(answer, smallFacts), []);
});