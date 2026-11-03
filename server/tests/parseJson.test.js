const test = require("node:test");
const assert = require("node:assert");
const { parseJson } = require("../services/aiService");

test("JSON surrounded by extra words is extracted", () => {
  const result = parseJson('Here you go: {"a": 1} Hope that helps.', "STOP");
  assert.deepStrictEqual(result, { a: 1 });
});

test("JSON inside code fences is extracted", () => {
  const result = parseJson('```json\n{"a": 2}\n```', "STOP");
  assert.deepStrictEqual(result, { a: 2 });
});

test("a cut-off reply fails and reports the finish reason", () => {
  assert.throws(() => parseJson('{"a": ', "MAX_TOKENS"), /MAX_TOKENS/);
});