/**
 * AI calls must go through a server-side endpoint.
 * Do not place provider API keys in VITE_* variables: client bundles are public.
 */
export async function askAITutor({ message, level = "A1", history = [], signal } = {}) {
  if (!message?.trim()) throw new Error("Please enter a question.");
  const endpoint = import.meta.env.VITE_AI_API_URL || "/api/ai/tutor";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message.trim(), level, history }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `AI request failed (${response.status}).`);
  }
  const data = await response.json();
  if (!data.reply) throw new Error("The AI service returned an empty response.");
  return data.reply;
}
