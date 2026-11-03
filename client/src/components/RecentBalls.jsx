function chipColor(ball) {
  if (ball.isWicket) return "bg-brand text-white";
  if (!ball.isLegal) return "bg-amber-400 text-black";
  if (ball.totalRuns >= 4) return "bg-good text-white";
  if (ball.totalRuns === 0) return "bg-gray-200 text-ink";
  return "bg-gray-500 text-white";
}

function RecentBalls({ balls }) {
  const recent = balls.slice(-18);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-line p-5">
      <p className="font-semibold mb-3">This over and the last few</p>
      {recent.length === 0 ? (
        <p className="text-muted text-sm">No balls entered yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {recent.map((ball) => (
            <span
              key={ball.id}
              className={`min-w-9 h-9 px-1 rounded-full flex items-center justify-center text-xs font-bold ${chipColor(ball)}`}
            >
              {ball.token.toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentBalls;