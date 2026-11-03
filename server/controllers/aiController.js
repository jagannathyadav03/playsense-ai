const aiService = require("../services/aiservice");
const cricketService = require("../services/cricketService");

const MAX_TOKENS = 400;

async function explain(req, res) {
  const { match, tokens, alertId } = req.body || {};

  if (!match || !Array.isArray(tokens) || typeof alertId !== "string") {
    return res.status(400).json({ error: "Send { match, tokens: [...], alertId }" });
  }
  if (tokens.length > MAX_TOKENS) {
    return res.status(400).json({ error: `Too many balls (max ${MAX_TOKENS})` });
  }

  try {
    const setup = cricketService.normalizeMatchSetup(match);
    const result = await aiService.explainAlert(setup, tokens, alertId);
    if (!result) return res.status(404).json({ error: "Alert not found" });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

module.exports = { explain };