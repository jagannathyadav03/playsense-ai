import { useState } from "react";

const inputStyle =
  "w-full border border-line rounded-lg px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand/40";

function MatchSetup({ onStart }) {
  const [battingTeam, setBattingTeam] = useState("India");
  const [bowlingTeam, setBowlingTeam] = useState("New Zealand");
  const [maxOvers, setMaxOvers] = useState(20);
  const [target, setTarget] = useState("");

  function handleStart() {
    onStart({
      battingTeam: battingTeam.trim() || "Batting team",
      bowlingTeam: bowlingTeam.trim() || "Bowling team",
      maxOvers: Number(maxOvers) || 20,
      target: target === "" ? null : Number(target),
    });
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="bg-brand text-white">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight">PlaySense</h1>
          <p className="text-sm text-white/80">Understand the moments that change a match</p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-line p-5 space-y-4">
          <h2 className="font-bold text-lg">Set up the innings</h2>

          <label className="block text-sm font-medium">
            Batting team
            <input className={inputStyle} value={battingTeam} onChange={(e) => setBattingTeam(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Bowling team
            <input className={inputStyle} value={bowlingTeam} onChange={(e) => setBowlingTeam(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Overs in the innings
            <input className={inputStyle} type="number" value={maxOvers} onChange={(e) => setMaxOvers(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Target (chasing only; leave blank for the first innings)
            <input
              className={inputStyle}
              type="number"
              placeholder="First innings score + 1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>

          <button
            onClick={handleStart}
            className="w-full bg-brand hover:bg-brand-dark text-white rounded-full py-3 font-bold"
          >
            Start entering balls
          </button>
        </div>
      </main>
    </div>
  );
}

export default MatchSetup;