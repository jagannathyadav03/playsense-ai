const express = require("express");
const matchController = require("../controllers/matchController");

const router = express.Router();

router.get("/", matchController.listMatches);
router.get("/:matchId", matchController.getMatch);
router.get("/:matchId/timeline", matchController.getTimeline);
router.post("/analyze", matchController.analyzeFeed);

module.exports = router;