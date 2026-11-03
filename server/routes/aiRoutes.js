const express = require("express");
const aiController = require("../controllers/aiController");

const router = express.Router();

router.post("/explain", aiController.explain);

module.exports = router;