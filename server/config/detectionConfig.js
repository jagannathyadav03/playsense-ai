// All thresholds live here so they can be tuned without touching the logic.
const defaultConfig = {
  multipleWickets: {
    windowBalls: 6, // look at the last 6 legal deliveries
    minWickets: 2, // this many wickets inside the window triggers an alert
  },
  dotBallPressure: {
    minConsecutiveDots: 4,
  },
  boundaryBurst: {
    windowBalls: 6, // look at the last 6 legal deliveries
    minBoundaries: 3, // this many 4s or 6s inside the window triggers an alert
  },
  severity: {
    bigCollapseWickets: 3, // wickets in the window that make a collapse "big"
    deepWicketCount: 5, // the team is already this many wickets down
    deathOvers: 5, // the last N overs of the innings
    highRequiredRate: 9, // runs per over; chasing at or above this is "under pressure"
  },
};

// Lets callers override only the values they care about.
function withDefaults(config = {}) {
  return {
    multipleWickets: { ...defaultConfig.multipleWickets, ...config.multipleWickets },
    dotBallPressure: { ...defaultConfig.dotBallPressure, ...config.dotBallPressure },
    boundaryBurst: { ...defaultConfig.boundaryBurst, ...config.boundaryBurst },
    severity: { ...defaultConfig.severity, ...config.severity },
  };
}

module.exports = { defaultConfig, withDefaults };