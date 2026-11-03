import { useState } from "react";

const MAIN_BUTTONS = ["0", "1", "2", "3", "4", "6", "W", "wd", "nb"];
const EXTRA_BUTTONS = ["wd2", "nb1", "nb2", "nb4", "nb6", "b1", "lb1", "w1", "w2", "wdw", "nbw"];

function buttonStyle(token) {
  const isWicket = token === "W" || /^w[1-3]$/.test(token) || token === "wdw" || token === "nbw";
  if (isWicket) return "bg-brand hover:bg-brand-dark text-white";
  if (token.startsWith("wd") || token.startsWith("nb")) return "bg-amber-400 hover:bg-amber-300 text-black";
  if (token.startsWith("b") || token.startsWith("lb")) return "bg-sky-100 hover:bg-sky-200 text-sky-900";
  if (token === "4" || token === "6") return "bg-good hover:opacity-90 text-white";
  return "bg-gray-100 hover:bg-gray-200 text-ink";
}

const disabledStyle = "disabled:opacity-40 disabled:cursor-not-allowed";

function BallInput({ onAddBall, onUndo, onReset, onLoadBalls, ballCount, tokens, locked }) {
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");

  async function handleLoad() {
    const message = await onLoadBalls(pasteText);
    if (message) {
      setPasteError(message);
    } else {
      setPasteError("");
      setPasteText("");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-line p-5 space-y-4">
      <p className="font-semibold">Enter the next ball</p>

      {locked && (
        <p className="text-sm bg-gray-100 rounded-lg px-3 py-2">
          Entry is closed. Use Undo to correct a mistake, or start the next innings or a new match.
        </p>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
        {MAIN_BUTTONS.map((token) => (
          <button
            key={token}
            disabled={locked}
            onClick={() => onAddBall(token)}
            className={`rounded-xl py-3 font-bold ${buttonStyle(token)} ${disabledStyle}`}
          >
            {token.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {EXTRA_BUTTONS.map((token) => (
          <button
            key={token}
            disabled={locked}
            onClick={() => onAddBall(token)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${buttonStyle(token)} ${disabledStyle}`}
          >
            {token.toUpperCase()}
          </button>
        ))}
        <span className="text-xs text-muted">
          WD2 wide+1 · NB4 no-ball+4 off the bat · B1 bye · LB1 leg-bye · W1/W2 run-out after runs · WDW wicket on a wide · NBW wicket on a no-ball
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onUndo}
          disabled={ballCount === 0}
          className={`border border-line hover:bg-gray-100 rounded-full px-4 py-2 text-sm font-semibold ${disabledStyle}`}
        >
          Undo last ball
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(tokens.join(" "))}
          disabled={ballCount === 0}
          className={`border border-line hover:bg-gray-100 rounded-full px-4 py-2 text-sm font-semibold ${disabledStyle}`}
        >
          Copy balls
        </button>
        <button
          onClick={onReset}
          className="border border-brand text-brand hover:bg-brand hover:text-white rounded-full px-4 py-2 text-sm font-semibold"
        >
          New match
        </button>
      </div>

      <div>
        <textarea
          className="w-full border border-line rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
          rows={2}
          placeholder="Paste balls, e.g.  1 0 4 W wd 2 1 nb4  (Load replaces the current balls)"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button
          onClick={handleLoad}
          className="mt-1 border border-line hover:bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold"
        >
          Load balls
        </button>
        {pasteError && <p className="text-brand text-sm mt-1">{pasteError}</p>}
      </div>
    </div>
  );
}

export default BallInput;