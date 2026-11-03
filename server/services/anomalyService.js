const { calculateScoreboard, formatOvers } = require("../utils/cricketUtils");
const { withDefaults } = require("../config/detectionConfig");

// 0 points = LOW, 1 = MEDIUM, 2 or more = HIGH
function levelFromPoints(points) {
  if (points >= 2) return "HIGH";
  if (points === 1) return "MEDIUM";
  return "LOW";
}

function isUnderRatePressure(scoreboard, highRequiredRate) {
  return (
    scoreboard.target !== null &&
    scoreboard.requiredRunRate !== null &&
    scoreboard.requiredRunRate >= highRequiredRate
  );
}

function isDeathOver(overNumber, match, severityConfig) {
  return overNumber >= match.maxOvers - severityConfig.deathOvers + 1;
}

// Rule 1: two or more wickets within the last few legal deliveries
function detectMultipleWickets(match, balls, config) {
  const { windowBalls, minWickets } = config.multipleWickets;
  const rules = config.severity;
  const alerts = [];

  balls.forEach((ball, index) => {
    if (!ball.isWicket) return;

    const ballsSoFar = balls.slice(0, index + 1);

    // Only legal balls count towards the window, so wides and no-balls
    // never push a wicket out of it.
    const windowStart = ball.legalBallsBowled - windowBalls;
    const ballsInWindow = ballsSoFar.filter((b) => b.legalBallsBowled > windowStart);
    const wicketsInWindow = ballsInWindow.filter((b) => b.isWicket).length;

    if (wicketsInWindow < minWickets) return;

    const scoreboard = calculateScoreboard(match, ballsSoFar);
    const runsInWindow = ballsInWindow.reduce((sum, b) => sum + b.totalRuns, 0);
    const ballsAnalyzed = Math.min(windowBalls, ball.legalBallsBowled);

    // Severity: start at 1 point, then add context
    let points = 1;
    const reasons = ["Wickets in a short spell (+1)"];

    if (wicketsInWindow >= rules.bigCollapseWickets) {
      points += 2;
      reasons.push(`${wicketsInWindow} wickets inside the window (+2)`);
    }
    if (scoreboard.wickets >= rules.deepWicketCount) {
      points += 1;
      reasons.push(`Already ${scoreboard.wickets} wickets down (+1)`);
    }
    if (isDeathOver(ball.over, match, rules)) {
      points += 1;
      reasons.push("Late in the innings (+1)");
    }
    if (isUnderRatePressure(scoreboard, rules.highRequiredRate)) {
      points += 1;
      reasons.push(`Chasing with required rate ${scoreboard.requiredRunRate} (+1)`);
    }

    alerts.push({
      id: `MULTIPLE_WICKETS-${ball.id}`,
      type: "MULTIPLE_WICKETS",
      severity: levelFromPoints(points),
      title: "Possible batting collapse",
      description: `${wicketsInWindow} wickets fell in the last ${ballsAnalyzed} legal deliveries.`,
      evidence: {
        wickets: wicketsInWindow,
        ballsAnalyzed,
        runsInWindow,
        scoreAtTime: `${scoreboard.runs}/${scoreboard.wickets}`,
      },
      severityReasons: reasons,
      ballId: ball.id,
      timestamp: formatOvers(scoreboard.legalBalls),
      ongoing: false,
    });
  });

  return alerts;
}

// Rule 2: several dot balls in a row
function detectDotBallPressure(match, balls, config) {
  const { minConsecutiveDots } = config.dotBallPressure;
  const rules = config.severity;
  const alerts = [];

  let dots = 0;
  let firstDot = null;
  let lastDotIndex = -1;

  // Called when a streak ends, or when we run out of balls
  function finishStreak(isOngoing) {
    if (dots >= minConsecutiveDots) {
      const scoreboard = calculateScoreboard(match, balls.slice(0, lastDotIndex + 1));

      let points = 0;
      const reasons = [];

      if (dots >= minConsecutiveDots + 2) {
        points += 2;
        reasons.push(`${dots} dots in a row (+2)`);
      } else if (dots === minConsecutiveDots + 1) {
        points += 1;
        reasons.push(`${dots} dots in a row (+1)`);
      } else {
        reasons.push(`${dots} dots in a row (+0)`);
      }

      if (isUnderRatePressure(scoreboard, rules.highRequiredRate)) {
        points += 1;
        reasons.push(`Chasing with required rate ${scoreboard.requiredRunRate} (+1)`);
      }

      alerts.push({
        id: `DOT_BALL_PRESSURE-${firstDot.id}`, // stable: tied to where the streak started
        type: "DOT_BALL_PRESSURE",
        severity: levelFromPoints(points),
        title: "Dot-ball pressure",
        description: `${dots} dot balls in a row.`,
        evidence: {
          consecutiveDots: dots,
          requiredRunRate: scoreboard.requiredRunRate,
          scoreAtTime: `${scoreboard.runs}/${scoreboard.wickets}`,
        },
        severityReasons: reasons,
        ballId: balls[lastDotIndex].id,
        timestamp: formatOvers(scoreboard.legalBalls),
        ongoing: isOngoing,
      });
    }

    dots = 0;
    firstDot = null;
    lastDotIndex = -1;
  }

  balls.forEach((ball, index) => {
    const isDot = ball.isLegal && ball.totalRuns === 0;
    // A wide, or a no-ball with nothing off the bat, neither extends nor breaks a streak
    const isNeutral = !ball.isLegal && ball.runsOffBat === 0;

    if (isDot) {
      if (dots === 0) firstDot = ball;
      dots += 1;
      lastDotIndex = index;
    } else if (!isNeutral) {
      finishStreak(false); // a scoring ball ends the streak
    }
  });
  finishStreak(true); // a streak still running when the balls end

  return alerts;
}

// Rule 3: a burst of boundaries (4s and 6s off the bat) in a short window
function isBoundary(ball) {
  return ball.runsOffBat === 4 || ball.runsOffBat === 6;
}

function detectBoundaryBurst(match, balls, config) {
  const { windowBalls, minBoundaries } = config.boundaryBurst;
  const rules = config.severity;
  const alerts = [];
  let lastAlert = null; // remembers the last alert so a long burst is not repeated

  balls.forEach((ball, index) => {
    if (!isBoundary(ball)) return;

    const ballsSoFar = balls.slice(0, index + 1);
    const windowStart = ball.legalBallsBowled - windowBalls;
    const ballsInWindow = ballsSoFar.filter((b) => b.legalBallsBowled > windowStart);
    const boundaries = ballsInWindow.filter(isBoundary).length;

    if (boundaries < minBoundaries) return;

    // Only alert again if the burst has grown since the last alert
    const lastAlertStillInWindow = lastAlert && lastAlert.legalBalls > windowStart;
    if (lastAlertStillInWindow && boundaries <= lastAlert.boundaries) return;

    const scoreboard = calculateScoreboard(match, ballsSoFar);
    const ballsBeforeWindow = ballsSoFar.filter((b) => b.legalBallsBowled <= windowStart);
    const scoreboardBefore = calculateScoreboard(match, ballsBeforeWindow);
    const runsInWindow = ballsInWindow.reduce((sum, b) => sum + b.totalRuns, 0);
    const ballsAnalyzed = Math.min(windowBalls, ball.legalBallsBowled);

    // Severity: starts LOW, context adds points
    let points = 0;
    const reasons = [`${boundaries} boundaries in the window (+0)`];

    if (boundaries >= minBoundaries + 1) {
      points += 1;
      reasons.push(`${boundaries} boundaries is a bigger burst (+1)`);
    }
    if (isDeathOver(ball.over, match, rules)) {
      points += 1;
      reasons.push("Late in the innings (+1)");
    }
    if (isUnderRatePressure(scoreboardBefore, rules.highRequiredRate)) {
      points += 1;
      reasons.push(`Chase was at ${scoreboardBefore.requiredRunRate} an over before the burst (+1)`);
    }

    alerts.push({
      id: `BOUNDARY_BURST-${ball.id}`,
      type: "BOUNDARY_BURST",
      severity: levelFromPoints(points),
      title: "Boundary burst",
      description: `${boundaries} boundaries in the last ${ballsAnalyzed} legal deliveries.`,
      evidence: {
        boundaries,
        fours: ballsInWindow.filter((b) => b.runsOffBat === 4).length,
        sixes: ballsInWindow.filter((b) => b.runsOffBat === 6).length,
        ballsAnalyzed,
        runsInWindow,
        scoreAtTime: `${scoreboard.runs}/${scoreboard.wickets}`,
      },
      severityReasons: reasons,
      ballId: ball.id,
      timestamp: formatOvers(scoreboard.legalBalls),
      ongoing: false,
    });

    lastAlert = { legalBalls: ball.legalBallsBowled, boundaries };
  });

  return alerts;
}

// Runs every rule and returns alerts in the order they happened.
function detectAnomalies(match, balls, userConfig) {
  if (!match || !Array.isArray(balls) || balls.length === 0) return [];

  const config = withDefaults(userConfig);
  const alerts = [
    ...detectMultipleWickets(match, balls, config),
    ...detectDotBallPressure(match, balls, config),
    ...detectBoundaryBurst(match, balls, config),
  ];

  alerts.sort((a, b) => a.ballId - b.ballId);
  return alerts;
}

module.exports = { detectAnomalies };