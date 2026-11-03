const { calculateScoreboard, formatOvers } = require("../utils/cricketUtils");
const { withMomentumDefaults } = require("../config/momentumConfig");

const DISCLAIMER =
  "Momentum is a simple heuristic built from recent play. It is not a win probability.";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(number, places) {
  const factor = 10 ** places;
  return Math.round(number * factor) / factor;
}

function countLegal(balls) {
  return balls.filter((ball) => ball.isLegal).length;
}

// Splits the balls into "recent" (the last N legal balls) and "earlier".
// Wides and no-balls stay with the over they were bowled in.
function splitWindow(balls, windowBalls) {
  const legalTotal = countLegal(balls);
  if (legalTotal <= windowBalls) return { recent: balls, earlier: [] };

  const windowStart = legalTotal - windowBalls;
  const cut = balls.findIndex((ball) => ball.isLegal && ball.legalBallsBowled === windowStart);
  return { recent: balls.slice(cut + 1), earlier: balls.slice(0, cut + 1) };
}

function summarise(balls) {
  return {
    legal: countLegal(balls),
    runs: balls.reduce((sum, ball) => sum + ball.totalRuns, 0),
    wickets: balls.filter((ball) => ball.isWicket).length,
    boundaries: balls.filter((ball) => ball.runsOffBat === 4 || ball.runsOffBat === 6).length,
    dots: balls.filter((ball) => ball.isLegal && ball.totalRuns === 0).length,
  };
}

function ratePerOver(stats) {
  return stats.legal > 0 ? stats.runs / (stats.legal / 6) : 0;
}

// Calculates the momentum index and factor breakdown at the end of these balls.
function computeSnapshot(match, balls, config) {
  const w = config.weights;
  const legalTotal = countLegal(balls);
  const { recent, earlier } = splitWindow(balls, config.windowBalls);
  const recentStats = summarise(recent);
  const earlierStats = summarise(earlier);
  const factors = [];

  function addFactor(key, label, weight, value, detail) {
    factors.push({ key, label, weight, value: clamp(value, -1, 1), detail });
  }

  // 1. Scoring rate: recent vs earlier (or assumed par early in the innings)
  const recentRate = ratePerOver(recentStats);
  const usePar = earlierStats.legal < 6;
  const baselineRate = usePar ? config.parRunRate : ratePerOver(earlierStats);
  addFactor(
    "scoringRate",
    "Scoring rate",
    w.scoringRate,
    (recentRate - baselineRate) / config.scoringRateScale,
    `${roundTo(recentRate, 1)} runs/over in the last ${recentStats.legal} balls vs ${roundTo(baselineRate, 1)} ${usePar ? "(assumed par)" : "earlier"}`
  );

  // 2. Wickets in the window
  addFactor(
    "wickets",
    "Wickets",
    w.wickets,
    -recentStats.wickets * 0.5,
    `${recentStats.wickets} wicket(s) in the last ${recentStats.legal} legal balls`
  );

  // 3. Boundaries
  const boundaryRate = recentStats.legal > 0 ? recentStats.boundaries / recentStats.legal : 0;
  addFactor(
    "boundaries",
    "Boundaries",
    w.boundaries,
    (boundaryRate - config.typicalBoundaryRate) / config.boundaryScale,
    `${recentStats.boundaries} boundary ball(s) in the last ${recentStats.legal} legal balls`
  );

  // 4. Dot balls
  const dotRate = recentStats.legal > 0 ? recentStats.dots / recentStats.legal : 0;
  addFactor(
    "dotBalls",
    "Dot balls",
    w.dotBalls,
    (config.typicalDotRate - dotRate) / config.dotScale,
    `${recentStats.dots} dot ball(s) out of ${recentStats.legal}`
  );

  // 5. Required run rate direction (only when chasing)
  if (match.target) {
    const before = calculateScoreboard(match, earlier).requiredRunRate;
    const now = calculateScoreboard(match, balls).requiredRunRate;
    if (before !== null && now !== null) {
      addFactor(
        "requiredRate",
        "Required rate",
        w.requiredRate,
        (before - now) / config.rrrScale,
        `Required rate went from ${before} to ${now}`
      );
    }
  }

  // 6. Partnership stability: legal balls since the last wicket
  let lastWicket = null;
  for (let i = balls.length - 1; i >= 0; i--) {
    if (balls[i].isWicket) {
      lastWicket = balls[i];
      break;
    }
  }
  const ballsSinceWicket = lastWicket ? legalTotal - lastWicket.legalBallsBowled : legalTotal;
  addFactor(
    "partnership",
    "Partnership",
    w.partnership,
    clamp((ballsSinceWicket - config.partnershipBalls) / config.partnershipScale, -0.5, 1),
    `${ballsSinceWicket} legal balls since the last wicket`
  );

  // Combine: weighted average, then scale to 0-100 around 50
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = factors.reduce((sum, f) => sum + f.weight * f.value, 0) / totalWeight;
  const battingIndex = Math.round(clamp(50 + score * 50, 0, 100));

  return {
    battingIndex,
    windowBalls: recentStats.legal,
    factors: factors.map((f) => ({
      key: f.key,
      label: f.label,
      detail: f.detail,
      value: roundTo(f.value, 2),
      share: roundTo(f.weight / totalWeight, 2),
      points: roundTo((f.weight / totalWeight) * f.value * 50, 1),
    })),
  };
}

function describe(index, config) {
  if (index >= config.clearEdgeIndex) return "Batting side appears to be gaining control";
  if (index <= 100 - config.clearEdgeIndex) return "Bowling side appears to be gaining control";
  return "The contest looks balanced right now";
}

function notReady(message) {
  return { ready: false, message, current: null, history: [], disclaimer: DISCLAIMER };
}

function calculateMomentum(match, balls, userConfig) {
  const config = withMomentumDefaults(userConfig);

  if (!match || !Array.isArray(balls)) return notReady("Match data is missing.");

  const legalTotal = countLegal(balls);
  if (legalTotal < config.minBalls) {
    return notReady(`Momentum needs at least ${config.minBalls} legal balls (${legalTotal} so far).`);
  }

  // Momentum after every legal ball: this feeds the chart
  const history = [];
  balls.forEach((ball, index) => {
    if (!ball.isLegal || ball.legalBallsBowled < config.minBalls) return;
    const snapshot = computeSnapshot(match, balls.slice(0, index + 1), config);
    history.push({
      ballId: ball.id,
      legalBalls: ball.legalBallsBowled,
      over: formatOvers(ball.legalBallsBowled),
      battingIndex: snapshot.battingIndex,
      bowlingIndex: 100 - snapshot.battingIndex,
    });
  });

  const snapshot = computeSnapshot(match, balls, config);

  // Trend: compare with the score a few balls ago
  const earlierPoint = history.find((h) => h.legalBalls === legalTotal - config.trendBalls);
  let trend = "NOT_ENOUGH_DATA";
  let change = null;
  if (earlierPoint) {
    change = snapshot.battingIndex - earlierPoint.battingIndex;
    if (change >= config.trendThreshold) trend = "BATTING_IMPROVING";
    else if (change <= -config.trendThreshold) trend = "BOWLING_IMPROVING";
    else trend = "STEADY";
  }

  return {
    ready: true,
    message: null,
    current: {
      battingTeam: match.battingTeam,
      bowlingTeam: match.bowlingTeam,
      battingIndex: snapshot.battingIndex,
      bowlingIndex: 100 - snapshot.battingIndex,
      label: describe(snapshot.battingIndex, config),
      trend,
      trendChange: change,
      windowBalls: snapshot.windowBalls,
      factors: snapshot.factors,
    },
    history,
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculateMomentum };