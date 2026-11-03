# PlaySense AI

**Every match has moments that change everything. PlaySense helps fans understand them.**

PlaySense AI spots unusual moments in a cricket match (collapses, boundary bursts, dot-ball squeezes), tracks which side seems to be gaining control, and explains why it matters in plain language.

- **Live demo:** https://YOUR-APP.vercel.app
- **Hosting note:** the app runs on free tiers. The first load after a quiet period can take up to a minute while the server wakes up.
- **Data mode:** balls are entered by hand and the app says so (an amber *Manual Feed* strip). It is **not** a live data feed.

---

## 1. The fan problem

Fans can see the scoreboard, but they often cannot tell:

- why a team's situation suddenly changed,
- whether what just happened was statistically unusual,
- which side is gaining or losing control,
- what to watch next.

## 2. How PlaySense helps

PlaySense is built around one capability: **detecting unexpected moments and explaining why they matter.** It has three engines.

| Engine | What it does | Who does the work |
|---|---|---|
| Anomaly Detection | Flags unusual sequences, each with evidence and a context-aware severity | Deterministic backend code (no AI) |
| Momentum Analyzer | A transparent 0-100 index showing which side appears to be gaining control, with the factors behind it | Deterministic backend code (no AI) |
| AI Storyteller | Turns a detected event into a short explanation: what happened, why it is unusual, why it matters, what to watch | Gemini, checked by a verifier |

**The architectural rule:** the backend is the source of truth for every number and every detection. The language model only explains events the backend has already found. It never calculates statistics or decides what counts as an anomaly.

---

## 3. How it works

```
Browser (React)                              Backend (Express)
+--------------------------+                 +------------------------------------+
| Manual feed: tap a ball  |   POST          | cricketUtils   parse tokens,       |
| (0,1,4,W,wd,nb...)       | /api/matches/   |                legal balls,        |
|                          |  analyze        |                scoreboard          |
| Ball list is kept in     | --------------> | anomalyService  3 rules            |
| the browser              |                 | momentumService 6 factors          |
|                          | <-------------- | resultUtils     innings / match   |
| Scoreboard, momentum,    |  scoreboard,    |                 result             |
| alerts, result banner    |  balls, alerts, +------------------------------------+
|                          |  momentum,
| "Explain this" button    |  result         +------------------------------------+
|                          |   POST          | aiService                          |
|                          | /api/ai/explain | 1. rebuild facts for that alert    |
|                          | --------------> | 2. ask Gemini for JSON             |
|                          | <-------------- | 3. verify numbers, names, wording  |
+--------------------------+  explanation    | 4. else fall back to a template    |
                                             +------------------------------------+
```

**Stateless backend.** The browser keeps the list of balls (and saves it locally), and sends the whole list to the backend each time. The backend recomputes everything from scratch and stores nothing. Consequences:

- A sleeping or restarted free-tier server loses no match data.
- The same input always gives the same alerts and the same alert IDs, which is how duplicate alerts are avoided.
- Undo is simply removing the last ball.

---

## 4. The engines in detail

### 4.1 Anomaly Detection

Every alert has a type, a severity, a title, a description, **evidence**, the reasons behind its severity, and a stable ID. Thresholds are configurable in `server/config/detectionConfig.js`.

Wides and no-balls are handled correctly: they add runs but are not legal deliveries, so they never push events out of a "last six balls" window.

| Rule | Fires when | Severity |
|---|---|---|
| **Multiple wickets** | 2 or more wickets fall within the last 6 legal balls | Starts at MEDIUM. +2 for 3 or more wickets in the window, +1 if already 5 or more wickets down, +1 in the last 5 overs, +1 if chasing at 9 or more an over |
| **Dot-ball pressure** | 4 or more legal balls in a row go for no runs (wides and no-balls with nothing off the bat do not break the streak) | Starts at LOW. +1 for 5 dots, +2 for 6 or more, +1 if chasing at 9 or more an over |
| **Boundary burst** | 3 or more fours or sixes off the bat within the last 6 legal balls (byes for four do not count) | Starts at LOW. +1 for 4 or more boundaries, +1 in the last 5 overs, +1 if the chase was at 9 or more an over before the burst |

Severity is a visible points score (0 = LOW, 1 = MEDIUM, 2 or more = HIGH) and every alert lists why it got that level. This separates **unusual** (the rule fired) from **important** (context raised the severity).

Duplicate control: alert IDs are derived from the triggering ball. A growing burst only creates a new alert when it gets bigger, and a dot-ball streak is one alert marked "still going" until it ends.

### 4.2 Momentum Analyzer

A **batting momentum index** from 0 to 100 (50 is balanced); the bowling index is 100 minus the batting index. It uses a rolling window of the last 12 legal balls compared with earlier play.

| Factor | What it measures | Weight |
|---|---|---|
| Scoring rate | Runs per over in the window versus the earlier innings (or an assumed par of 8 early on) | 25% |
| Wickets | Wickets in the window | 25% |
| Boundaries | Share of recent balls that were fours or sixes | 15% |
| Dot balls | Share of recent legal balls with no runs | 15% |
| Required rate | Whether the required run rate is falling or rising (chasing only; weights are rescaled otherwise) | 10% |
| Partnership | Legal balls since the last wicket | 10% |

The app shows each factor's contribution in index points, the trend over the last 6 balls, and a timeline chart.

**It is not a win predictor.** It describes recent play. The score is a heuristic and is labelled as one in the interface and in the API response. All weights and scales live in `server/config/momentumConfig.js`.

### 4.3 AI Storyteller (Gemini)

For an alert, the backend rebuilds the facts at that moment (score, overs, target, required rate, evidence, rule description, recent deliveries, momentum) and asks Gemini to return four fields. Facts and interpretation are shown separately in the UI.

The model is told to use only the supplied facts, copy numbers exactly, avoid arithmetic, use cautious wording for interpretation, and never predict a winner. No player names exist in the data, so none can be used.

**Every answer is verified before it is shown:**

| Check | Catches |
|---|---|
| Each number must appear in the supplied facts | Invented scores and statistics |
| Number words (two, three, five, ...) must be supported by the facts | "three wickets" when the facts say 2 |
| Capitalised words in mid-sentence must be team names | Invented player names |
| Certainty phrases are rejected ("will win", "guaranteed") | Outcome predictions |
| All four fields present and short | Malformed or rambling answers |

If Gemini is unavailable, times out, is rate limited, or fails verification, a **deterministic template explanation** is shown instead, with the real reason displayed. The template passes the same verification as Gemini's output, and this is tested.

Operational details: the model name is configuration (`GEMINI_MODEL`), successful answers are cached, there is a 45-second timeout, and a 60-second cooldown after a rate-limit response.

**Limits of the verifier (stated plainly):** it checks numbers, names and wording. It cannot judge whether the tactical interpretation is *good*. It can miss an invented name at the very start of a sentence, and it skips the words "four" and "six" because they are also cricket terms.

---

## 5. Manual Feed

Each ball is one token:

| Token | Meaning | Legal ball |
|---|---|---|
| `0` to `6` | Runs off the bat | yes |
| `W` | Wicket | yes |
| `W1`, `W2`, `W3` | Run-out after that many completed runs | yes |
| `wd`, `wd2`, `wd4` | Wide (total extras) | no |
| `nb`, `nb1`, `nb4`, `nb6` | No-ball plus runs off the bat | no |
| `b1`..`b4`, `lb1`..`lb4` | Byes, leg-byes | yes |
| `wdw`, `nbw` | Wicket on a wide, on a no-ball | no |

The interface has a button for each, an **Undo**, a **Copy balls** button, and a paste box that loads a whole list (for example `1 0 4 W wd 2`). Input is saved in the browser, so a refresh loses nothing.

**Results.** The backend detects when an innings ends (all out, overs finished) or the match ends (target reached, or the chase falls short, or the scores finish level), shows the winner and margin, and **stops accepting balls**. The first innings offers a **Start second innings** button that swaps the teams and sets the target. The backend also rejects any balls entered after the end.

---

## 6. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Recharts, Axios |
| Backend | Node.js, Express |
| AI | Google Gemini API (free tier), called from the backend only |
| Hosting | Vercel (frontend), Render (backend) |
| Tests | Node's built-in test runner |

No database. State lives in the browser, by design.

---

## 7. API

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Health check; reports whether AI is configured (never the key) |
| `POST /api/matches/analyze` | Body `{ match, tokens }`. Returns `scoreboard`, `balls`, `anomalies`, `momentum`, `result` |
| `POST /api/ai/explain` | Body `{ match, tokens, alertId }`. Returns the explanation, its source (`gemini` or `template`), the reason for any fallback, and the facts used |
| `GET /api/matches`, `/api/matches/:id`, `/api/matches/:id/timeline` | Endpoints for the scripted sample match |

Example `match` object: `{ "battingTeam": "India", "bowlingTeam": "New Zealand", "maxOvers": 20, "target": null }`

Protections: request size limit, a general rate limit, a stricter limit on AI routes (they spend the Gemini quota), restricted CORS in production, and JSON error responses.

---

## 8. Run it locally

Requires Node.js 20 or newer.

**Backend**

```bash
cd server
npm install
# copy .env.example to .env and fill in your key
npm run dev        # http://localhost:5000
```

`server/.env`:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
```

Model names change. Run `node scripts/listModels.js` to see which models your key can use, and `node scripts/testModels.js` to time them. The app works without a key: explanations fall back to the template.

**Frontend**

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

To point the frontend at another backend, set `VITE_API_URL`.

**Tests**

```bash
cd server
npm test
```

Tests cover the legal-ball and extras logic, every token, each anomaly rule (including window boundaries, wides, escalation, duplicate control and configurable thresholds), momentum calculations, innings and match results, the AI verifier, the template fallback, JSON parsing, and invalid or missing data.

---

## 9. Deployment

- **Backend (Render, free web service):** root directory `server`, build `npm install`, start `npm start`, health check `/api/health`. Environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `CLIENT_ORIGIN` (the exact address of the frontend).
- **Frontend (Vercel):** root directory `client`, environment variable `VITE_API_URL` set to the backend address, then redeploy (Vite bakes it in at build time).
- **Cold starts:** free Render services sleep after 15 minutes without traffic. The frontend sends a wake-up request as soon as the page opens and shows a "connecting" message.
- **Before deploying:** `node scripts/checkCase.js` checks every `require()` path against the real file names, letter for letter (see lessons learned).

---

## 10. Design decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| Detection and statistics are deterministic code, never the LLM | Explainable, testable, no invented numbers | Less flexible than asking a model to "find interesting things" |
| LLM answers are verified, with a template fallback | The feature always works and never shows unchecked numbers | Some valid answers are rejected, and the verifier cannot judge tactical quality |
| Momentum is a transparent weighted heuristic, not a win predictor | Honest and explainable | The weights are assumed (see section 11) |
| Manual Feed instead of a live data API | Free live ball-by-ball feeds were unreliable or unavailable, and a demo should not depend on them | Needs a person to enter balls |
| Backend stateless, ball list kept in the browser | Survives free-tier sleeps and restarts, deterministic alert IDs | The whole list is re-sent on every change (fine for one T20 innings) |
| No database | Nothing here needs persistent storage yet | No match history across devices |
| Two explanation sources, always labelled | The reader can see whether text came from Gemini or a template | Slightly more UI |

---

## 11. Validation and honest limitations

**What was done.** I replayed the 2nd India v New Zealand T20I by entering it ball by ball, to exercise the whole app end to end on real match data. This was a **smoke test, not an accuracy evaluation.**

**What was not done.** The momentum weights, the scales behind them, and every detection threshold are **assumed values chosen by hand** from cricket intuition. They have not been trained or calibrated against data, and the project makes no claim that they are optimal. There is no measured accuracy figure.

**What I would do next: calibrate on the Cricsheet T20 dataset.** Cricsheet publishes free, open ball-by-ball data for thousands of T20 internationals, in JSON and CSV (check its licence and attribution terms before reuse). Because the backend already speaks "ball tokens", converting those matches is straightforward. The plan:

1. Convert Cricsheet T20I innings into the app's token format.
2. Measure real baselines: boundary, dot-ball and wicket rates by match phase (powerplay, middle overs, death overs).
3. Replace hand-picked thresholds with data-driven ones, for example flagging a six-ball window only when it is beyond the 95th percentile for that phase.
4. Fit and test the momentum weights on held-out matches, for example by checking how well the index at a given ball relates to the runs and wickets that follow, and compare against a naive baseline.
5. Publish the measured results here.

Even after calibration, momentum would remain a **descriptive heuristic**, not a probability of winning.

**Other limitations**

- Input is manual, so the quality of the output depends on the quality of the entry. Byes combined with no-balls and penalty runs are not supported.
- No individual player data (names, batter and bowler figures). Explanations therefore speak about "the batters" and "the bowling side".
- The first request after a quiet period is slow on the free hosting tier.
- The verifier has the blind spots listed in section 4.3.

---

## 12. Lessons learned

- **Windows is case-insensitive, Linux is not.** A mis-capitalised `require` worked locally and crashed the first Render deploy. Added `scripts/checkCase.js`.
- **Models get retired, and some hang.** The first Gemini model returned a "no longer available" error, and the next one timed out. The model name is now configuration, the real error is shown in the interface, and `scripts/testModels.js` times the candidates.
- **The verifier needed tuning against real output.** It flagged "Zealand's" as an invented name. Possessives are now normalised, with a regression test.
- **Parsing model output defensively matters.** The parser now ignores "thought" parts, strips surrounding text, and reports the finish reason when a reply is cut off.
- **Tests that never ran are worse than no tests.** An early empty test file reported "pass". Tests are now checked by name and count.

---

## 13. Roadmap

1. Calibrate thresholds and momentum weights on Cricsheet data (section 11).
2. Replace manual entry with a live ball-by-ball feed, if a reliable source is available.
3. **Optional batter and bowler details** (striker, bowler per over) and a player-impact line in explanations, which is the natural bridge to fantasy-sports users who think in players.
4. Two further detection rules, designed but not built: **scoring-rate collapse** (recent run rate against an earlier baseline) and **dominant bowling spell** (wickets, dots and runs conceded over a spell).
5. Ask PlaySense (questions grounded in the current match), Catch Me Up summaries, What-if simulator.

---

## 14. Responsible use

PlaySense explains what has happened in a match. It does not predict results, and it does not give betting or fantasy-team advice. The visual style is inspired by fantasy-sports apps and is not affiliated with any brand.

## 15. AI tools used

- **Google Gemini** writes the runtime explanations, from backend-supplied facts only, behind the verifier described above.
- **Claude** was used as a coding mentor and reviewer while building the project (architecture review, code review, debugging help). All logic is covered by tests and was run and checked locally.

---

## Project structure

```
playsense-ai/
  client/                  React + Vite frontend
    src/
      api.js               calls to the backend
      App.jsx              state, saving, wiring
      components/          Scoreboard, BallInput, RecentBalls, MomentumMeter,
                           AnomalyList, ResultBanner, MatchSetup
  server/
    server.js              Express app, CORS, rate limits
    config/                detectionConfig.js, momentumConfig.js
    controllers/           matchController.js, aiController.js
    routes/                matchRoutes.js, aiRoutes.js
    services/              cricketService, anomalyService, momentumService, aiService
    utils/                 cricketUtils.js (tokens, legal balls, scoreboard), resultUtils.js
    data/                  sampleMatch.js (scripted scenario)
    scripts/               listModels.js, testModels.js, checkCase.js
    tests/                 unit tests
```
