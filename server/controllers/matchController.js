const cricketService = require("../services/cricketService");

// Reads ?upTo=30 from the URL. Returns undefined if missing or not a number.
function readUpTo(query) {
  if (query.upTo === undefined) return undefined;
  const value = parseInt(query.upTo, 10);
  return Number.isNaN(value) ? undefined : value;
}

function listMatches(req, res) {
  res.json(cricketService.getMatches());
}

function getMatch(req, res) {
  const state = cricketService.getMatchState(req.params.matchId, readUpTo(req.query));
  if (!state) return res.status(404).json({ error: "Match not found" });
  res.json(state);
}

function getTimeline(req, res) {
  const timeline = cricketService.getTimeline(req.params.matchId, readUpTo(req.query));
  if (!timeline) return res.status(404).json({ error: "Match not found" });
  res.json(timeline);
}

const MAX_TOKENS = 400; // a T20 innings is well under this

function analyzeFeed(req, res) {
  const { match, tokens } = req.body || {};

  if (!match || !Array.isArray(tokens)) {
    return res.status(400).json({ error: "Send { match: {...}, tokens: [...] }" });
  }
  if (tokens.length > MAX_TOKENS) {
    return res.status(400).json({ error: `Too many balls (max ${MAX_TOKENS})` });
  }

  // Fill in safe defaults so missing fields don't crash the calculation
  const matchSetup = {
    battingTeam: match.battingTeam || "Batting team",
    bowlingTeam: match.bowlingTeam || "Bowling team",
    maxOvers: Number(match.maxOvers) || 20,
    target: Number(match.target) || null,
  };

  try {
    res.json(cricketService.analyzeFeed(matchSetup, tokens));
  } catch (error) {
    // parseBallToken throws on a bad token, e.g. Invalid ball token: "x"
    res.status(400).json({ error: error.message });
  }
}

module.exports = { listMatches, getMatch, getTimeline, analyzeFeed };