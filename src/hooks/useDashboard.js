import { useCallback, useEffect, useState } from "react";
import { getDashboardOverview } from "../services/api";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export default function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (signal) => {
    try {
      const response = await getDashboardOverview({ timezone, signal });
      setData(response.data);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load dashboard data");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialRequest = window.setTimeout(() => loadDashboard(controller.signal), 0);
    const refresh = () => loadDashboard();
    window.addEventListener("focus", refresh);
    window.addEventListener("interviews:changed", refresh);
    return () => {
      controller.abort();
      window.clearTimeout(initialRequest);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("interviews:changed", refresh);
    };
  }, [loadDashboard]);

  return { data, loading, error, retry: () => { setLoading(true); loadDashboard(); }, refresh: loadDashboard, timezone };
}
