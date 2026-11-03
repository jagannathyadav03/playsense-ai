// Turns one text token like "4", "W", "wd", "nb2" into a structured ball.
function parseBallToken(token) {
    const t = String(token).trim().toLowerCase();

    if (/^[0-6]$/.test(t)) {
        return { runsOffBat: Number(t), extras: 0, extraType: null, isWicket: false, isLegal: true };
    }

    if (t === "w") {
        return { runsOffBat: 0, extras: 0, extraType: null, isWicket: true, isLegal: true };
    }

    // wide: "wd" = 1 extra, "wd2" = 2 extras in total
    const wide = t.match(/^wd(\d)?$/);
    if (wide) {
        const extras = wide[1] ? Number(wide[1]) : 1;
        return { runsOffBat: 0, extras, extraType: "wide", isWicket: false, isLegal: false };
    }

    // no-ball: always 1 extra, plus optional runs off the bat ("nb4")
    const noBall = t.match(/^nb(\d)?$/);
    if (noBall) {
        const runsOffBat = noBall[1] ? Number(noBall[1]) : 0;
        return { runsOffBat, extras: 1, extraType: "noball", isWicket: false, isLegal: false };
    }

    // bye or leg-bye: "b1".."b4", "lb1".."lb4" (legal ball, runs are extras)
    const byes = t.match(/^(b|lb)([1-4])$/);
    if (byes) {
        return {
            runsOffBat: 0,
            extras: Number(byes[2]),
            extraType: byes[1] === "b" ? "bye" : "legbye",
            isWicket: false,
            isLegal: true,
        };
    }

    // run-out after completing runs: "w1".."w3"
    const runOut = t.match(/^w([1-3])$/);
    if (runOut) {
        return { runsOffBat: Number(runOut[1]), extras: 0, extraType: null, isWicket: true, isLegal: true };
    }

    // wicket on a wide, or on a no-ball
    if (t === "wdw") {
        return { runsOffBat: 0, extras: 1, extraType: "wide", isWicket: true, isLegal: false };
    }
    if (t === "nbw") {
        return { runsOffBat: 0, extras: 1, extraType: "noball", isWicket: true, isLegal: false };
    }


    throw new Error(`Invalid ball token: "${token}"`);
}

// Turns the scripted overs into a flat list of ball events.
function buildBalls(overs) {
    const balls = [];
    let legalBallsBowled = 0;

    overs.forEach((over, overIndex) => {
        const tokens = over.balls.split(/\s+/).filter(Boolean);

        tokens.forEach((token) => {
            const parsed = parseBallToken(token);
            if (parsed.isLegal) legalBallsBowled += 1;

            balls.push({
                id: balls.length + 1,
                over: overIndex + 1,
                bowler: over.bowler,
                token,
                ...parsed,
                totalRuns: parsed.runsOffBat + parsed.extras,
                legalBallsBowled, // legal balls bowled up to and including this one
            });
        });
    });

    return balls;
}

// 75 legal balls -> "12.3"
function formatOvers(legalBalls) {
    return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function roundTo2(number) {
    return Math.round(number * 100) / 100;
}

// Works out the scoreboard from the balls bowled so far.
// "target" means the runs the chasing team needs in total to win.
function calculateScoreboard(match, balls) {
    const runs = balls.reduce((sum, ball) => sum + ball.totalRuns, 0);
    const wickets = balls.filter((ball) => ball.isWicket).length;
    const legalBalls = balls.filter((ball) => ball.isLegal).length;
    const runRate = legalBalls > 0 ? roundTo2(runs / (legalBalls / 6)) : 0;

    const scoreboard = {
        battingTeam: match.battingTeam,
        bowlingTeam: match.bowlingTeam,
        runs,
        wickets,
        legalBalls,
        overs: formatOvers(legalBalls),
        maxOvers: match.maxOvers,
        runRate,
        target: match.target || null,
        runsNeeded: null,
        ballsRemaining: null,
        requiredRunRate: null,
    };

    if (match.target) {
        const ballsRemaining = match.maxOvers * 6 - legalBalls;
        const runsNeeded = match.target - runs;
        scoreboard.runsNeeded = runsNeeded;
        scoreboard.ballsRemaining = ballsRemaining;
        scoreboard.requiredRunRate =
            ballsRemaining > 0 ? roundTo2(runsNeeded / (ballsRemaining / 6)) : null;
    }

    return scoreboard;
}

// Turns a flat list of tokens (["1","W","wd",...]) into ball events.
// The over number is worked out from the legal balls bowled so far.
function buildBallsFromTokens(tokens) {
    const balls = [];
    let legalBallsBowled = 0;

    tokens.forEach((token) => {
        const parsed = parseBallToken(token);
        const over = Math.floor(legalBallsBowled / 6) + 1;
        if (parsed.isLegal) legalBallsBowled += 1;

        balls.push({
            id: balls.length + 1,
            over,
            token: String(token).trim().toLowerCase(),
            ...parsed,
            totalRuns: parsed.runsOffBat + parsed.extras,
            legalBallsBowled,
        });
    });

    return balls;
}



module.exports = { parseBallToken, buildBalls, formatOvers, calculateScoreboard, buildBallsFromTokens };