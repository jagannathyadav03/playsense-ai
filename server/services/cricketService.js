const { sampleMatch } = require("../data/sampleMatch");
const { buildBalls, buildBallsFromTokens, calculateScoreboard } = require("../utils/cricketUtils");
const { calculateResult } = require("../utils/resultUtils");
const { detectAnomalies } = require("./anomalyService");
const { calculateMomentum } = require("./momentumService");

const allMatches = [sampleMatch];

// Match details without the raw scripted overs
function getMatchInfo(match) {
  const { overs, ...info } = match;
  return info;
}

function findMatch(matchId) {
  return allMatches.find((match) => match.id === matchId) || null;
}

// upTo = how many ball events to include. Missing or invalid = all of them.
function sliceBalls(allBalls, upTo) {
  if (Number.isInteger(upTo) && upTo >= 0) {
    return allBalls.slice(0, upTo);
  }
  return allBalls;
}

function getMatches() {
  return allMatches.map(getMatchInfo);
}

function getMatchState(matchId, upTo) {
  const match = findMatch(matchId);
  if (!match) return null;

  const allBalls = buildBalls(match.overs);
  const balls = sliceBalls(allBalls, upTo);

  return {
    match: getMatchInfo(match),
    scoreboard: calculateScoreboard(match, balls),
    ballsDelivered: balls.length,
    totalBallEvents: allBalls.length,
  };
}

function getTimeline(matchId, upTo) {
  const match = findMatch(matchId);
  if (!match) return null;

  return sliceBalls(buildBalls(match.overs), upTo);
}

// Fills in safe defaults so missing fields don't crash the calculation
function normalizeMatchSetup(match) {
  return {
    battingTeam: match.battingTeam || "Batting team",
    bowlingTeam: match.bowlingTeam || "Bowling team",
    maxOvers: Number(match.maxOvers) || 20,
    target: Number(match.target) || null,
  };
}

// Rejects balls that were entered after the innings or match was already over.
function checkNoBallsAfterTheEnd(matchSetup, balls) {
  for (let i = 0; i < balls.length - 1; i++) {
    const result = calculateResult(matchSetup, balls.slice(0, i + 1));
    if (result.status !== "IN_PROGRESS") {
      throw new Error(
        `The innings was already over after ball ${i + 1} (${result.headline}). Remove the extra balls.`
      );
    }
  }
}

// Analyzes a manually entered feed. Nothing is stored on the server.
function analyzeFeed(matchSetup, tokens) {
  const balls = buildBallsFromTokens(tokens);
  checkNoBallsAfterTheEnd(matchSetup, balls);

  return {
    scoreboard: calculateScoreboard(matchSetup, balls),
    balls,
    anomalies: detectAnomalies(matchSetup, balls),
    momentum: calculateMomentum(matchSetup, balls),
    result: calculateResult(matchSetup, balls),
  };
}

module.exports = { getMatches, getMatchState, getTimeline, analyzeFeed, normalizeMatchSetup };