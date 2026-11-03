require("dotenv").config();

// Text models taken from your own listModels output
const CANDIDATES = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];

const TIMEOUT_MS = 20000; // give each model 20 seconds

async function tryModel(apiKey, model) {
  const started = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: 'Reply with only this JSON: {"ok": true}' }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    const ms = Date.now() - started;
    const data = await response.json();

    if (!response.ok) {
      const message = data.error ? data.error.message.slice(0, 90) : "unknown error";
      return `${model}: HTTP ${response.status} in ${ms} ms - ${message}`;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "(no text)";
    return `${model}: OK in ${ms} ms - ${text.trim().slice(0, 40)}`;
  } catch (error) {
    return `${model}: ${error.name === "TimeoutError" ? "TIMEOUT (over 20 s)" : error.message}`;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("GEMINI_API_KEY is not set");
    return;
  }

  for (const model of CANDIDATES) {
    console.log(await tryModel(apiKey, model));
  }
  console.log("Done.");
}

main();