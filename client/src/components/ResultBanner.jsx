function ResultBanner({ result, onStartSecondInnings }) {
  if (!result || result.status === "IN_PROGRESS") return null;

  if (result.status === "MATCH_COMPLETE") {
    return (
      <div className="bg-brand text-white rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-bold tracking-widest text-white/80">MATCH COMPLETE</p>
        <p className="text-2xl font-extrabold mt-1">{result.headline}</p>
        <p className="text-sm text-white/90 mt-1">{result.detail}</p>
      </div>
    );
  }

  return (
    <div className="bg-ink text-white rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold tracking-widest text-white/70">INNINGS COMPLETE</p>
      <p className="text-2xl font-extrabold mt-1">{result.headline}</p>
      <p className="text-sm text-white/80 mt-1">{result.detail}</p>
      <p className="text-xs text-white/60 mt-2">
        Tip: click Copy balls first if you want to save this innings.
      </p>
      <button
        onClick={onStartSecondInnings}
        className="mt-3 bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-2 font-bold"
      >
        Start second innings (target {result.nextTarget})
      </button>
    </div>
  );
}

export default ResultBanner;