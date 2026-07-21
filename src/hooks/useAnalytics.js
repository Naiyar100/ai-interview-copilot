import { useCallback, useEffect, useRef, useState } from "react";
import { getAnalyticsOverview } from "../services/api";

const initialFilters = {
  preset: "30d", startDate: "", endDate: "", role: "", interviewType: "", difficulty: "",
  status: "", category: "", resumeId: "", voiceMode: "", scoreMin: "", scoreMax: "",
  aggregation: "day", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

export default function useAnalytics() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  const load = useCallback(async ({ immediate = false } = {}) => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    if (data) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await getAnalyticsOverview(filters, controller.signal);
      if (requestId === requestRef.current) setData(response.data);
    } catch (requestError) {
      if (requestError.name !== "AbortError" && requestId === requestRef.current) setError(requestError.message || "Analytics could not load");
    } finally {
      if (requestId === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
    return () => controller.abort();
  }, [filters, data]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 280);
    return () => { clearTimeout(timer); requestRef.current += 1; };
  // Loading intentionally follows the normalized filter object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value, ...(name === "preset" && value !== "custom" ? { startDate: "", endDate: "" } : {}) }));
  const clearFilters = () => setFilters((current) => ({ ...initialFilters, timezone: current.timezone }));
  const applyView = (viewFilters) => setFilters({ ...initialFilters, ...viewFilters, timezone: viewFilters.timezone || initialFilters.timezone });
  return { data, filters, setFilter, clearFilters, applyView, loading, refreshing, error, retry: () => load({ immediate: true }) };
}
