import { useEffect, useState } from "react";
import { analyzeFeed, wakeBackend } from "./api";
import MatchSetup from "./components/MatchSetup";
import Scoreboard from "./components/Scoreboard";
import BallInput from "./components/BallInput";
import RecentBalls from "./components/RecentBalls";
import MomentumMeter from "./components/MomentumMeter";
import AnomalyList from "./components/AnomalyList";
import ResultBanner from "./components/ResultBanner";

const STORAGE_KEY = "playsense-feed";

// Reads the saved match from the browser, if there is one.
function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.setup && Array.isArray(saved.tokens)) return saved;
  } catch (error) {
    // Storage unavailable or corrupted: start fresh
  }
  return { setup: null, tokens: [] };
}

function App() {
  const [setup, setSetup] = useState(() => loadSaved().setup);
  const [tokens, setTokens] = useState(() => loadSaved().tokens);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  // Save the match in the browser whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ setup, tokens }));
    } catch (storageError) {
      // Ignore: the app still works, it just won't survive a refresh
    }
  }, [setup, tokens]);

  // Ask the backend to analyze the balls whenever they change
  useEffect(() => {
    if (!setup) return;

    let cancelled = false; // ignores out-of-date replies if you tap quickly
    analyzeFeed(setup, tokens)
      .then((result) => {
        if (!cancelled) {
          setAnalysis(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [setup, tokens]);

  // Wake the free-tier server as soon as the page opens
  useEffect(() => {
    wakeBackend();
  }, []);

  const result = analysis ? analysis.result : null;
  const isOver = Boolean(result) && result.status !== "IN_PROGRESS";

  function startMatch(newSetup) {
    setSetup(newSetup);
    setTokens([]);
    setAnalysis(null);
  }

  function startSecondInnings() {
    startMatch({
      battingTeam: setup.bowlingTeam,
      bowlingTeam: setup.battingTeam,
      maxOvers: setup.maxOvers,
      target: result.nextTarget,
      firstInnings: `${setup.battingTeam} ${result.finalScore}`,
    });
  }

  function addBall(token) {
    if (isOver) return; // entry is closed
    setTokens((current) => [...current, token]);
  }

  function undoBall() {
    setTokens((current) => current.slice(0, -1));
  }

  function resetMatch() {
    if (window.confirm("Clear all balls and set up a new match?")) {
      setSetup(null);
      setTokens([]);
      setAnalysis(null);
    }
  }

  // Returns an error message, or null if the balls were loaded.
  async function loadBalls(text) {
    const newTokens = text.split(/[\s,]+/).filter(Boolean);
    if (newTokens.length === 0) return "Nothing to load";

    try {
      await analyzeFeed(setup, newTokens); // the backend validates the tokens
    } catch (err) {
      return err.message;
    }
    setTokens(newTokens);
    return null;
  }

  if (!setup) {
    return <MatchSetup onStart={startMatch} />;
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="bg-brand text-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-xl font-extrabold tracking-tight">PlaySense</h1>
          <p className="text-xs text-white/80">Understand the moments that change a match</p>
        </div>
      </header>
      <div className="bg-amber-100 text-amber-900 text-xs font-semibold">
        <div className="max-w-3xl mx-auto px-4 py-1">
          MANUAL FEED: balls are entered by hand. This is not a live data feed.
        </div>
      </div>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {error && <p className="text-brand font-semibold">{error}</p>}

        {!analysis && !error && (
          <p className="text-muted text-sm">
            Connecting to the analysis server. The free server can take up to a minute to wake up.
          </p>
        )}

        <ResultBanner result={result} onStartSecondInnings={startSecondInnings} />
        {analysis && <Scoreboard scoreboard={analysis.scoreboard} firstInnings={setup.firstInnings} />}

        <BallInput
          onAddBall={addBall}
          onUndo={undoBall}
          onReset={resetMatch}
          onLoadBalls={loadBalls}
          ballCount={tokens.length}
          tokens={tokens}
          locked={isOver}
        />

        <RecentBalls balls={analysis ? analysis.balls : []} />
        {analysis && <MomentumMeter momentum={analysis.momentum} />}
        {analysis && <AnomalyList anomalies={analysis.anomalies || []} setup={setup} tokens={tokens} />}
      </main>
    </div>
  );
}

export default App;