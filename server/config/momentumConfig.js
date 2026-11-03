// Every number that shapes the momentum score lives here.
const defaultMomentumConfig = {
  windowBalls: 12, // "recent" = the last 12 legal balls (two overs)
  minBalls: 6, // no momentum score before this many legal balls
  trendBalls: 6, // compare with the score this many legal balls ago
  trendThreshold: 8, // index points of change needed to call a trend
  clearEdgeIndex: 60, // 60 or more = batting edge, 40 or less = bowling edge

  parRunRate: 8, // assumed typical T20 rate, used until there is an earlier baseline
  scoringRateScale: 6, // runs/over difference that counts as "a full swing"
  typicalBoundaryRate: 0.15,
  boundaryScale: 0.3,
  typicalDotRate: 0.35,
  dotScale: 0.3,
  rrrScale: 3, // change in required rate that counts as "a full swing"
  partnershipBalls: 12, // a partnership this old is "neutral"
  partnershipScale: 24,

  weights: {
    scoringRate: 0.25,
    wickets: 0.25,
    boundaries: 0.15,
    dotBalls: 0.15,
    requiredRate: 0.1,
    partnership: 0.1,
  },
};

function withMomentumDefaults(config = {}) {
  return {
    ...defaultMomentumConfig,
    ...config,
    weights: { ...defaultMomentumConfig.weights, ...config.weights },
  };
}

module.exports = { defaultMomentumConfig, withMomentumDefaults };