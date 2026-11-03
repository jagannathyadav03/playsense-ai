const sampleMatch = {
  id: "demo-1",
  title: "Scripted scenario: Team Beta chasing 160",
  mode: "DEMO", // never present this as live data
  format: "T20",
  maxOvers: 20,
  battingTeam: "Team Beta",
  bowlingTeam: "Team Alpha",
  target: 160,
  overs: [
    { bowler: "Bowler A", balls: "1 0 4 0 1 1" },
    { bowler: "Bowler B", balls: "0 1 1 2 0 1" },
    { bowler: "Bowler A", balls: "1 0 wd 1 W 1 1" },
    { bowler: "Bowler B", balls: "2 1 4 0 1 0" },
    { bowler: "Bowler A", balls: "1 1 0 4 1 nb 0" },
    { bowler: "Bowler B", balls: "0 1 6 1 0 2" },
    { bowler: "Bowler C", balls: "4 6 4 1 4 0" },
    { bowler: "Bowler D", balls: "6 4 wd 1 4 1 0" },
    { bowler: "Bowler A", balls: "1 W 0 W 0 0" },
    { bowler: "Bowler B", balls: "0 0 0 1 0 0" },
    { bowler: "Bowler C", balls: "0 0 0 0 W 0" },
    { bowler: "Bowler D", balls: "1 4 0 1 1 2" },
  ],
};

module.exports = { sampleMatch };