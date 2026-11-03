const cricketService = require("./cricketService");
const { calculateScoreboard } = require("../utils/cricketUtils");
const { calculateMomentum } = require("./momentumService");
const { defaultConfig } = require("../config/detectionConfig");

const CACHE_LIMIT = 200;
const cache = new Map();
let coolDownUntil = 0; // after a rate limit, skip Gemini until this time (ms)

const REQUIRED_FIELDS = ["whatHappened", "whyUnusual", "whyItMatters", "watchNext"];
const MAX_FIELD_LENGTH = 350;

const CERTAINTY_PHRASES = [
    "will win", "will lose", "guarantee", "certainly", "definitely",
    "for sure", "is sure to", "no chance", "cannot win", "can't win", "game over",
];

// "four" and "six" are left out because they are also cricket words ("a six").
const NUMBER_WORDS = {
    two: 2, three: 3, five: 5, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12,
};

// ---------- Facts ----------

// Plain-English description of when each rule fires (uses the real thresholds).
function ruleSummary(type) {
    const c = defaultConfig;
    if (type === "MULTIPLE_WICKETS") {
        return `Raised when ${c.multipleWickets.minWickets} or more wickets fall within the last ${c.multipleWickets.windowBalls} legal deliveries.`;
    }
    if (type === "DOT_BALL_PRESSURE") {
        return `Raised when ${c.dotBallPressure.minConsecutiveDots} or more legal deliveries in a row go for no runs.`;
    }
    if (type === "BOUNDARY_BURST") {
        return `Raised when ${c.boundaryBurst.minBoundaries} or more fours or sixes come off the bat within the last ${c.boundaryBurst.windowBalls} legal deliveries.`;
    }
    return "Raised by a PlaySense detection rule.";
}

// Everything the AI is allowed to know, measured at the moment of the alert.
function buildFacts(setup, analysis, alert) {
    const ballsUpToAlert = analysis.balls.filter((ball) => ball.id <= alert.ballId);
    const scoreboard = calculateScoreboard(setup, ballsUpToAlert);
    const momentum = calculateMomentum(setup, ballsUpToAlert);

    let momentumFacts = null;
    if (momentum.ready) {
        const c = momentum.current;
        const biggest = [...c.factors]
            .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
            .slice(0, 2)
            .map((f) => `${f.label}: ${f.detail}`);
        momentumFacts = {
            battingIndex: c.battingIndex,
            bowlingIndex: c.bowlingIndex,
            label: c.label,
            trend: c.trend,
            biggestFactors: biggest,
        };
    }

    return {
        match: {
            battingTeam: scoreboard.battingTeam,
            bowlingTeam: scoreboard.bowlingTeam,
            scoreAtAlert: `${scoreboard.runs}/${scoreboard.wickets}`,
            oversAtAlert: scoreboard.overs,
            maxOvers: scoreboard.maxOvers,
            currentRunRate: scoreboard.runRate,
            target: scoreboard.target,
            runsNeeded: scoreboard.runsNeeded,
            ballsRemaining: scoreboard.ballsRemaining,
            requiredRunRate: scoreboard.requiredRunRate,
        },
        alert: {
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            evidence: alert.evidence,
            rule: ruleSummary(alert.type),
            severityReasons: alert.severityReasons,
        },
        recentDeliveries: ballsUpToAlert.slice(-12).map((ball) => ball.token.toUpperCase()),
        momentum: momentumFacts,
        notAvailable: "Player names are not available in this data.",
    };
}

// ---------- Template fallback (no AI involved) ----------

const TEMPLATES = {
    MULTIPLE_WICKETS: {
        matters: "Losing wickets in quick succession can put pressure on the batters still to come.",
        next: "Watch how the new batters start and whether the scoring rate recovers.",
    },
    DOT_BALL_PRESSURE: {
        matters: "A run of dot balls can build pressure and sometimes pushes batters into a risky shot.",
        next: "Watch whether the batters find a single to release the pressure or take a risk.",
    },
    BOUNDARY_BURST: {
        matters: "A burst of boundaries can shift momentum towards the batting side quickly.",
        next: "Watch whether the bowling side changes its plan in the next over.",
    },
};

const GENERIC_TEMPLATE = {
    matters: "This could change how the next few overs play out.",
    next: "Watch the next over to see whether this continues.",
};

function templateExplanation(facts) {
    const { match, alert } = facts;
    const text = TEMPLATES[alert.type] || GENERIC_TEMPLATE;
    const chaseNote =
        match.target !== null && match.requiredRunRate !== null
            ? ` The required rate is ${match.requiredRunRate} an over.`
            : "";

    return {
        whatHappened: `${alert.description} ${match.battingTeam} were ${match.scoreAtAlert} after ${match.oversAtAlert} overs.`,
        whyUnusual: alert.rule,
        whyItMatters: text.matters + chaseNote,
        watchNext: text.next,
    };
}

// ---------- Gemini ----------

function buildPrompt(facts) {
    return `You are the explanation writer for PlaySense AI, a cricket match intelligence tool.
A deterministic backend has already detected the event below. Your job is ONLY to explain it.

STRICT RULES
- Use only facts in the FACTS JSON. Never invent scores, wickets, player names or statistics. No player names are provided, so say "the batters" or "the bowling side".
- Write every number as digits and copy it exactly from the facts. Do not do arithmetic.
- whatHappened and whyUnusual may contain only facts or the rule description from the facts.
- whyItMatters and watchNext are interpretation: use cautious words such as could, may, might, appears. Never say an outcome is certain. Do not predict who will win.
- If the facts are not enough to say something, say so briefly.
- Each field is 1 or 2 short sentences in plain language for cricket fans.

Return ONLY a JSON object with exactly these keys: whatHappened, whyUnusual, whyItMatters, watchNext

FACTS:
${JSON.stringify(facts, null, 2)}`;
}

async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); // give up after 20 seconds

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            let detail = "";
            try {
                const body = await response.json();
                if (body.error && body.error.message) detail = `: ${body.error.message}`;
            } catch (parseError) {
                // no readable error body
            }
            const error = new Error(`Gemini returned HTTP ${response.status} for model ${model}${detail}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Gemini returned no text");
        return text;
    } finally {
        clearTimeout(timer);
    }
}

function parseJson(text) {
    try {
        return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (error) {
        throw new Error("Gemini did not return valid JSON");
    }
}

// ---------- Verification ----------

// Returns a list of problems. An empty list means the explanation passed.
function verifyExplanation(explanation, facts) {
    if (!explanation || typeof explanation !== "object") {
        return ["The answer was not a JSON object"];
    }

    const issues = [];
    REQUIRED_FIELDS.forEach((field) => {
        if (typeof explanation[field] !== "string" || !explanation[field].trim()) {
            issues.push(`Missing field: ${field}`);
        }
    });
    if (issues.length > 0) return issues;

    REQUIRED_FIELDS.forEach((field) => {
        if (explanation[field].length > MAX_FIELD_LENGTH) issues.push(`${field} is too long`);
    });

    const text = REQUIRED_FIELDS.map((field) => explanation[field]).join(" ");
    const lower = text.toLowerCase();

    // 1. Every number must appear somewhere in the facts
    const allowedNumbers = new Set(
        (JSON.stringify(facts).match(/\d+(?:\.\d+)?/g) || []).map(Number)
    );
    (text.match(/\d+(?:\.\d+)?/g) || []).forEach((raw) => {
        if (!allowedNumbers.has(Number(raw))) {
            issues.push(`The number ${raw} is not in the supplied facts`);
        }
    });

    // 2. Number words (two, three...) must be supported too
    Object.entries(NUMBER_WORDS).forEach(([word, value]) => {
        if (new RegExp(`\\b${word}\\b`).test(lower) && !allowedNumbers.has(value)) {
            issues.push(`The word "${word}" is not supported by the facts`);
        }
    });

    // 3. Capitalised words in the middle of a sentence must be team names
    const allowedWords = new Set(
        [facts.match && facts.match.battingTeam, facts.match && facts.match.bowlingTeam]
            .filter(Boolean)
            .join(" ")
            .split(/\s+/)
            .map((word) => word.toLowerCase())
    );
    text.split(/(?<=[.!?])\s+/).forEach((sentence) => {
        sentence
            .split(/\s+/)
            .slice(1) // the first word of a sentence is always capitalised
            .forEach((word) => {
                // "Zealand's" becomes "Zealand": drop the possessive before checking
                const clean = word.replace(/['’]s\b/gi, "").replace(/[^A-Za-z]/g, "");
                if (/^[A-Z][a-z]+$/.test(clean) && !allowedWords.has(clean.toLowerCase())) {
                    issues.push(`Possible invented name: "${clean}"`);
                }
            });
    });

    // 4. No promises about the outcome
    CERTAINTY_PHRASES.forEach((phrase) => {
        if (lower.includes(phrase)) issues.push(`Overconfident wording: "${phrase}"`);
    });

    return issues;
}

// ---------- Main entry point ----------

async function explainAlert(setup, tokens, alertId) {
    const analysis = cricketService.analyzeFeed(setup, tokens);
    const alert = analysis.anomalies.find((a) => a.id === alertId);
    if (!alert) return null;

    const facts = buildFacts(setup, analysis, alert);

    // The same balls and the same alert always give the same cache key
    const cacheKey = `${alert.id}|${tokens.slice(0, alert.ballId).join(",")}|${JSON.stringify(alert.evidence)}`;
    if (cache.has(cacheKey)) return { ...cache.get(cacheKey), cached: true };

    let explanation = null;
    let source = "template";
    let fallbackReason = null;
    let issues = [];

    if (Date.now() < coolDownUntil) {
        fallbackReason = "Gemini is cooling down after a rate limit";
    } else {
        try {
            const parsed = parseJson(await callGemini(buildPrompt(facts)));
            issues = verifyExplanation(parsed, facts);
            if (issues.length === 0) {
                explanation = {
                    whatHappened: parsed.whatHappened.trim(),
                    whyUnusual: parsed.whyUnusual.trim(),
                    whyItMatters: parsed.whyItMatters.trim(),
                    watchNext: parsed.watchNext.trim(),
                };
                source = "gemini";
            } else {
                fallbackReason = "Gemini's answer failed verification";
            }
        } catch (error) {
            if (error.status === 429) {
                coolDownUntil = Date.now() + 60 * 1000;
                fallbackReason = "Gemini rate limit reached";
            } else {
                fallbackReason = `Gemini unavailable: ${error.message}`;
            }
        }
    }

    if (!explanation) explanation = templateExplanation(facts);

    const result = { alertId, source, fallbackReason, verificationIssues: issues, explanation, facts };

    if (source === "gemini") {
        if (cache.size >= CACHE_LIMIT) cache.clear();
        cache.set(cacheKey, result);
    }
    return result;
}

module.exports = { explainAlert, buildFacts, verifyExplanation, templateExplanation };