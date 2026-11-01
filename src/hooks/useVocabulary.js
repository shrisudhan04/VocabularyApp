import { useCallback, useEffect, useState } from "react";
import { loadVocabulary, saveVocabulary } from "../services/learningService";

export default function useVocabulary({ storeName, key }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setItems(await loadVocabulary(storeName, key)); setError(""); }
    catch (e) { setError(e.message || "Unable to load vocabulary."); }
    finally { setLoading(false); }
  }, [storeName, key]);
  useEffect(() => { refresh(); }, [refresh]);
  const persist = useCallback(async next => {
    const value = typeof next === "function" ? next(items) : next;
    await saveVocabulary(storeName, key, value);
    setItems(value);
    return value;
  }, [items, storeName, key]);
  return { items, setItems: persist, loading, error, refresh };
}
