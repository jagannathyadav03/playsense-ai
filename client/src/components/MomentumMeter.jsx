import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

const TREND_TEXT = {
  BATTING_IMPROVING: "Batting side improving",
  BOWLING_IMPROVING: "Bowling side improving",
  STEADY: "Steady",
  NOT_ENOUGH_DATA: "Trend needs a few more balls",
};

const cardStyle = "bg-white rounded-2xl shadow-sm border border-line p-5";

function MomentumMeter({ momentum }) {
  if (!momentum) return null;

  if (!momentum.ready) {
    return (
      <div className={cardStyle}>
        <h2 className="font-semibold mb-1">Momentum</h2>
        <p className="text-muted text-sm">{momentum.message}</p>
      </div>
    );
  }

  const c = momentum.current;

  return (
    <div className={`${cardStyle} space-y-4`}>
      <h2 className="font-semibold">Momentum Meter</h2>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>
            {c.battingTeam} (batting): <b>{c.battingIndex}</b>
          </span>
          <span>
            {c.bowlingTeam} (bowling): <b>{c.bowlingIndex}</b>
          </span>
        </div>
        <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
          <div className="bg-good" style={{ width: `${c.battingIndex}%` }} />
          <div className="bg-sky-500" style={{ width: `${c.bowlingIndex}%` }} />
        </div>
        <p className="text-sm mt-2">
          {c.label}. <span className="text-muted">Trend: {TREND_TEXT[c.trend]}</span>
          {c.trendChange !== null && (
            <span className="text-muted">
              {" "}
              ({c.trendChange > 0 ? "+" : ""}
              {c.trendChange} over the last 6 balls)
            </span>
          )}
        </p>
      </div>

      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={momentum.history}>
            <XAxis dataKey="over" stroke="#9ca3af" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} />
            <Tooltip />
            <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="battingIndex" name="Batting momentum" stroke="#1f9d55" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-sm text-muted mb-2">What is moving the score (index points from 50)</p>
        <div className="space-y-1">
          {c.factors.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <b>{f.label}</b> <span className="text-muted">{f.detail}</span>
              </span>
              <span className={f.points >= 0 ? "text-good font-semibold" : "text-sky-600 font-semibold"}>
                {f.points > 0 ? "+" : ""}
                {f.points}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">{momentum.disclaimer}</p>
    </div>
  );
}

export default MomentumMeter;