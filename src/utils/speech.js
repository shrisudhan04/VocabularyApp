export function speakGerman(phrase) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "de-DE";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}