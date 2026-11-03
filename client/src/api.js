import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Wakes the backend early. The free hosting plan puts it to sleep when idle.
export function wakeBackend() {
  axios.get(`${API_URL}/api/health`, { timeout: 90000 }).catch(() => {
    // Ignore: the real requests will show an error if the server is really down
  });
}

// Sends the match setup and ball tokens to the backend for analysis.
export async function analyzeFeed(match, tokens) {
  try {
    const response = await axios.post(
      `${API_URL}/api/matches/analyze`,
      { match, tokens },
      { timeout: 90000 }
    );
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error("Cannot reach the backend");
  }
}

// Asks the backend to explain one alert.
export async function explainAlert(match, tokens, alertId) {
  try {
    const response = await axios.post(
      `${API_URL}/api/ai/explain`,
      { match, tokens, alertId },
      { timeout: 60000 }
    );
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error("Cannot reach the backend");
  }
}