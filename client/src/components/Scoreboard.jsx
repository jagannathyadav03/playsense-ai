function Stat({ label, value }) {
  return (
    <div className="bg-page rounded-xl px-3 py-2 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function Scoreboard({ scoreboard, firstInnings }) {
  const s = scoreboard;
  const isChasing = s.target !== null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-line overflow-hidden">
      <div className="bg-ink text-white px-5 py-2 text-sm flex justify-between">
        <span className="font-semibold">{s.battingTeam} batting</span>
        <span className="text-white/70">{s.bowlingTeam} bowling</span>
      </div>

      <div className="p-5">
        <p className="text-5xl font-extrabold">
          {s.runs}/{s.wickets}{" "}
          <span className="text-lg font-medium text-muted">
            ({s.overs}/{s.maxOvers} ov)
          </span>
        </p>
        {firstInnings && <p className="text-sm text-muted mt-1">1st innings: {firstInnings}</p>}

        <div className={`grid gap-2 mt-4 ${isChasing ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          <Stat label="Run rate" value={s.runRate} />
          {isChasing ? (
            <>
              <Stat label="Target" value={s.target} />
              <Stat label="Need" value={`${s.runsNeeded} off ${s.ballsRemaining}`} />
              <Stat label="Required rate" value={s.requiredRunRate ?? "-"} />
            </>
          ) : (
            <Stat label="Wickets in hand" value={10 - s.wickets} />
          )}
        </div>
      </div>
    </div>
  );
}

export default Scoreboard;