import { useState } from "react";
import { explainAlert } from "../api";

const SEVERITY_STYLE = {
  HIGH: "bg-brand text-white",
  MEDIUM: "bg-amber-400 text-black",
  LOW: "bg-gray-300 text-ink",
};

function ExplanationBox({ state }) {
  if (!state) return null;
  if (state.loading) return <p className="text-sm text-muted mt-2">Writing explanation...</p>;
  if (state.error) return <p className="text-sm text-brand mt-2">{state.error}</p>;

  const { explanation, source, fallbackReason, verificationIssues } = state.data;

  return (
    <div className="mt-3 border-t border-line pt-3 space-y-3 text-sm">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase text-muted">Facts</p>
        <p>
          <b>What happened:</b> {explanation.whatHappened}
        </p>
        <p>
          <b>Why it is unusual:</b> {explanation.whyUnusual}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase text-muted">Interpretation (not certain)</p>
        <p>
          <b>Why it matters:</b> {explanation.whyItMatters}
        </p>
        <p>
          <b>Watch next:</b> {explanation.watchNext}
        </p>
      </div>
      <p className="text-xs text-muted">
        {source === "gemini"
          ? "Written by Gemini and checked against the match data."
          : `Template explanation (${fallbackReason}).`}
        {verificationIssues.length > 0 && ` Failed checks: ${verificationIssues.join("; ")}`}
      </p>
    </div>
  );
}

function AnomalyList({ anomalies, setup, tokens }) {
  const [explanations, setExplanations] = useState({});
  const newestFirst = [...anomalies].reverse();

  async function handleExplain(alert) {
    const key = `${alert.id}:${alert.ballId}`;
    setExplanations((current) => ({ ...current, [key]: { loading: true } }));
    try {
      const data = await explainAlert(setup, tokens, alert.id);
      setExplanations((current) => ({ ...current, [key]: { data } }));
    } catch (error) {
      setExplanations((current) => ({ ...current, [key]: { error: error.message } }));
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-line p-5">
      <h2 className="font-semibold mb-3">Match Intelligence</h2>

      {newestFirst.length === 0 && (
        <p className="text-muted text-sm">No unusual moments detected yet.</p>
      )}

      <div className="space-y-3">
        {newestFirst.map((alert) => {
          const key = `${alert.id}:${alert.ballId}`;
          return (
            <div key={alert.id} className="bg-gray-50 border border-line rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEVERITY_STYLE[alert.severity]}`}>
                  {alert.severity}
                </span>
                <b>{alert.title}</b>
                {alert.ongoing && <span className="text-xs text-amber-600">still going</span>}
                <span className="text-xs text-muted ml-auto">{alert.timestamp} ov</span>
              </div>
              <p className="text-sm mt-1">{alert.description}</p>
              <p className="text-xs text-muted mt-2">
                Evidence:{" "}
                {Object.entries(alert.evidence)
                  .map(([name, value]) => `${name}: ${value ?? "-"}`)
                  .join(" · ")}
              </p>
              <p className="text-xs text-muted">
                Why this severity: {alert.severityReasons.join("; ")}
              </p>

              {!explanations[key] && (
                <button
                  onClick={() => handleExplain(alert)}
                  className="mt-2 border border-brand text-brand hover:bg-brand hover:text-white rounded-full px-3 py-1 text-sm font-semibold"
                >
                  Explain this
                </button>
              )}
              <ExplanationBox state={explanations[key]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AnomalyList;