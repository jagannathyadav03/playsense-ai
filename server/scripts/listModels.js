require("dotenv").config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const configured = process.env.GEMINI_MODEL || "(not set, the app uses its default)";

  console.log("Key found:", apiKey ? "yes" : "NO");
  console.log("Configured model:", configured);
  if (!apiKey) return;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
    { headers: { "x-goog-api-key": apiKey } }
  );
  console.log("HTTP status:", response.status);

  const data = await response.json();
  if (!response.ok) {
    console.log(data.error ? data.error.message : data);
    return;
  }

  // Only models that can generate text
  const names = (data.models || [])
    .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
    .map((model) => model.name.replace("models/", ""));

  console.log("Configured model is in the list:", names.includes(process.env.GEMINI_MODEL) ? "yes" : "NO");
  console.log("Models that can generate text:");
  names.forEach((name) => console.log("  " + name));
}

main();