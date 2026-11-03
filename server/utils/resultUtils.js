const MAX_WICKETS = 10;

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Says whether the innings (or the whole match) is over, using the balls so far.
// match needs: battingTeam, bowlingTeam, maxOvers, and target (null in the first innings).
function calculateResult(match, balls) {
  const runs = balls.reduce((sum, ball) => sum + ball.totalRuns, 0);
  const wickets = balls.filter((ball) => ball.isWicket).length;
  const legalBalls = balls.filter((ball) => ball.isLegal).length;
  const maxBalls = match.maxOvers * 6;
  const finalScore = `${runs}/${wickets}`;
  const chasing = Boolean(match.target);
  const inningsOver = wickets >= MAX_WICKETS || legalBalls >= maxBalls;

  // The chasing side reached the target
  if (chasing && runs >= match.target) {
    const wicketsLeft = MAX_WICKETS - wickets;
    const ballsLeft = maxBalls - legalBalls;
    return {
      status: "MATCH_COMPLETE",
      winner: match.battingTeam,
      isTie: false,
      headline: `${match.battingTeam} won by ${plural(wicketsLeft, "wicket")}`,
      detail: `Chased ${match.target} with ${plural(ballsLeft, "ball")} to spare.`,
      finalScore,
      nextTarget: null,
    };
  }

  if (!inningsOver) {
    return {
      status: "IN_PROGRESS",
      winner: null,
      isTie: false,
      headline: null,
      detail: null,
      finalScore,
      nextTarget: null,
    };
  }

  // The chase ended without reaching the target
  if (chasing) {
    if (runs === match.target - 1) {
      return {
        status: "MATCH_COMPLETE",
        winner: null,
        isTie: true,
        headline: "Match tied",
        detail: "The scores are level. A super over would normally decide it.",
        finalScore,
        nextTarget: null,
      };
    }
    const margin = match.target - 1 - runs;
    return {
      status: "MATCH_COMPLETE",
      winner: match.bowlingTeam,
      isTie: false,
      headline: `${match.bowlingTeam} won by ${plural(margin, "run")}`,
      detail: `${match.battingTeam} finished on ${finalScore} chasing ${match.target}.`,
      finalScore,
      nextTarget: null,
    };
  }

  // First innings is over
  return {
    status: "INNINGS_COMPLETE",
    winner: null,
    isTie: false,
    headline: `${match.battingTeam} finished on ${finalScore}`,
    detail: `${match.bowlingTeam} need ${runs + 1} to win.`,
    finalScore,
    nextTarget: runs + 1,
  };
}

module.exports = { calculateResult, MAX_WICKETS };