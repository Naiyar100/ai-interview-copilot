import "./Analytics.css";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useAnalytics from "../hooks/useAnalytics";
import { useTheme } from "../context/ThemeContext";
import {
  compareAnalyticsInterviews, createAnalyticsView, deleteAnalyticsView, downloadBase64File,
  exportAnalytics, getAnalyticsViews, getInterviews, updateAnalyticsView,
} from "../services/api";
import {
  BreakdownPanels, ComparisonPanel, KPIGrid, ProgressRecommendations, QualityTimePanels,
  ReadinessPanels, TopicMastery, TrendPanels, VoiceResumePanels, EvidencePanels,
} from "../components/Analytics/AnalyticsSections";

const presets = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["6m", "6 months"], ["12m", "12 months"], ["all", "All time"], ["custom", "Custom"]];
const filterKeys = ["role", "interviewType", "difficulty", "status", "category", "resumeId", "voiceMode", "scoreMin", "scoreMax"];

function AnalyticsFilters({ filters, data, setFilter, clearFilters, open, setOpen }) {
  const active = filterKeys.filter((key) => filters[key] !== "").length;
  return <aside className={`analytics-filter-panel ${open ? "open" : ""}`} aria-label="Analytics filters">
    <div className="filter-panel-head"><div><strong>Filters</strong><span>{active} active</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close filters">×</button></div>
    <label>Date range<select value={filters.preset} onChange={(event) => setFilter("preset", event.target.value)}>{presets.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    {filters.preset === "custom" && <div className="custom-dates"><label>Start<input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} /></label><label>End<input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} /></label></div>}
    <label>Target role<select value={filters.role} onChange={(event) => setFilter("role", event.target.value)}><option value="">All roles</option>{data?.filters.available.roles.map((role) => <option key={role}>{role}</option>)}</select></label>
    <label>Interview type<select value={filters.interviewType} onChange={(event) => setFilter("interviewType", event.target.value)}><option value="">All types</option>{["Technical", "Behavioral", "Mixed"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Difficulty<select value={filters.difficulty} onChange={(event) => setFilter("difficulty", event.target.value)}><option value="">All difficulties</option>{["Easy", "Medium", "Hard"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Status<select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="completed">Completed</option></select></label>
    <label>Question category<select value={filters.category} onChange={(event) => setFilter("category", event.target.value)}><option value="">All categories</option>{data?.filters.available.categories.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Resume used<select value={filters.resumeId} onChange={(event) => setFilter("resumeId", event.target.value)}><option value="">Any resume</option>{data?.filters.available.resumes.map((resume) => <option value={resume.id} key={resume.id}>{resume.name}</option>)}</select></label>
    <label>Answer mode<select value={filters.voiceMode} onChange={(event) => setFilter("voiceMode", event.target.value)}><option value="">Voice and text</option><option value="voice">Voice</option><option value="text">Text</option></select></label>
    <div className="score-range"><label>Min score<input type="number" min="0" max="100" value={filters.scoreMin} onChange={(event) => setFilter("scoreMin", event.target.value)} /></label><label>Max score<input type="number" min="0" max="100" value={filters.scoreMax} onChange={(event) => setFilter("scoreMax", event.target.value)} /></label></div>
    <label>Trend grouping<select value={filters.aggregation} onChange={(event) => setFilter("aggregation", event.target.value)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
    <button type="button" className="analytics-secondary" onClick={clearFilters}>Clear all filters</button>
  </aside>;
}

function AnalyticsSkeleton() {
  return <div className="analytics-loading" role="status" aria-label="Loading analytics"><div className="analytics-skeleton hero" /><div className="analytics-skeleton-grid">{Array.from({ length: 8 }, (_, index) => <div className="analytics-skeleton" key={index} />)}</div><div className="analytics-skeleton chart" /></div>;
}

function Analytics() {
  const { data, filters, setFilter, clearFilters, applyView, loading, refreshing, error, retry } = useAnalytics();
  const { preference, setPreference } = useTheme();
  const [filterOpen, setFilterOpen] = useState(false);
  const [views, setViews] = useState([]);
  const [viewName, setViewName] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    Promise.all([getAnalyticsViews(), getInterviews({ limit: 50, sortBy: "completedAt", sortOrder: "desc" })])
      .then(([saved, history]) => { setViews(saved.data.views); setInterviews(history.data.interviews); })
      .catch((requestError) => setActionError(requestError.message));
  }, []);

  const activeFilters = useMemo(() => filterKeys.filter((key) => filters[key] !== "").map((key) => `${key}: ${filters[key]}`), [filters]);

  const runExport = async (format) => {
    setActionError(""); setNotice("Preparing export…");
    try { const response = await exportAnalytics(format, filters); downloadBase64File(response.data); setNotice(`${format.toUpperCase()} report downloaded.`); }
    catch (requestError) { setNotice(""); setActionError(requestError.message); }
  };
  const saveView = async () => {
    if (!viewName.trim()) return;
    setActionError("");
    try { const response = await createAnalyticsView(viewName, filters); setViews((current) => [response.data.view, ...current]); setViewName(""); setNotice("Analytics view saved."); }
    catch (requestError) { setActionError(requestError.message); }
  };
  const removeView = async (view) => {
    if (!window.confirm(`Delete the saved view “${view.name}”?`)) return;
    try { await deleteAnalyticsView(view.id); setViews((current) => current.filter((item) => item.id !== view.id)); }
    catch (requestError) { setActionError(requestError.message); }
  };
  const renameView = async (view) => {
    const name = window.prompt("Rename saved analytics view", view.name)?.trim();
    if (!name || name === view.name) return;
    try {
      const response = await updateAnalyticsView(view.id, { name });
      setViews((current) => current.map((item) => item.id === view.id ? response.data.view : item));
    } catch (requestError) { setActionError(requestError.message); }
  };
  const compare = async () => {
    setCompareLoading(true); setActionError("");
    try { const response = await compareAnalyticsInterviews(selected); setComparison(response.data.interviews); }
    catch (requestError) { setActionError(requestError.message); }
    finally { setCompareLoading(false); }
  };

  return <main className="analytics-page">
    <div className="analytics-backdrop" aria-hidden="true" />
    <header className="analytics-topbar"><Link className="analytics-brand" to="/dashboard"><span>AI</span><strong>Interview Copilot</strong></Link><nav aria-label="Primary"><Link to="/dashboard">Dashboard</Link><Link to="/interview/history">Interviews</Link><Link className="active" to="/analytics" aria-current="page">Analytics</Link><Link to="/resumes">Resumes</Link></nav><label className="analytics-theme"><span className="sr-only">Color theme</span><select aria-label="Color theme" value={preference} onChange={(event) => setPreference(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></header>
    <div className="analytics-layout">
      <AnalyticsFilters filters={filters} data={data} setFilter={setFilter} clearFilters={clearFilters} open={filterOpen} setOpen={setFilterOpen} />
      {filterOpen && <button type="button" className="filter-scrim" aria-label="Close filters" onClick={() => setFilterOpen(false)} />}
      <div className="analytics-main">
        <section className="analytics-header"><div><span className="analytics-kicker">Performance intelligence</span><h1>Analytics Center</h1><p>Turn your interview history into focused, evidence-based next steps.</p>{data?.generatedAt && <small>Last updated {new Date(data.generatedAt).toLocaleString()} {data.cache?.hit && "· cached"}</small>}</div><div className="analytics-header-actions"><button type="button" className="analytics-secondary filter-button" onClick={() => setFilterOpen(true)}>Filters {activeFilters.length ? `(${activeFilters.length})` : ""}</button><button type="button" className="analytics-secondary" onClick={retry} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button><details className="export-menu"><summary className="analytics-primary">Export</summary><button type="button" onClick={() => runExport("pdf")}>PDF report</button><button type="button" onClick={() => runExport("csv")}>CSV data</button><button type="button" onClick={() => runExport("json")}>JSON data</button></details></div></section>
        <section className="saved-view-bar" aria-label="Saved analytics views"><div className="saved-list"><strong>Saved views</strong>{views.map((view) => <span key={view.id}><button type="button" onClick={() => applyView(view.filters)}>{view.name}</button><button type="button" aria-label={`Rename ${view.name} saved view`} onClick={() => renameView(view)}>Edit</button><button type="button" aria-label={`Delete ${view.name} saved view`} onClick={() => removeView(view)}>×</button></span>)}</div><div className="save-view"><label><span className="sr-only">Saved view name</span><input value={viewName} maxLength="60" placeholder="Name this view" onChange={(event) => setViewName(event.target.value)} /></label><button type="button" onClick={saveView} disabled={!viewName.trim()}>Save view</button></div></section>
        {activeFilters.length > 0 && <div className="filter-summary"><span>Active filters</span>{activeFilters.map((item) => <small key={item}>{item}</small>)}<button type="button" onClick={clearFilters}>Clear all</button></div>}
        {(notice || actionError) && <div className={actionError ? "analytics-notice error" : "analytics-notice"} role={actionError ? "alert" : "status"}>{actionError || notice}<button type="button" aria-label="Dismiss message" onClick={() => { setNotice(""); setActionError(""); }}>×</button></div>}
        {loading && !data ? <AnalyticsSkeleton /> : error && !data ? <section className="analytics-fatal" role="alert"><span>Unable to load analytics</span><h2>Performance data is temporarily unavailable</h2><p>{error}</p><button type="button" className="analytics-primary" onClick={retry}>Try again</button></section> : data && <>
          {error && <div className="analytics-notice error" role="alert">Some analytics could not refresh: {error}</div>}
          <section className="analytics-summary"><div><span>{data.range.startDate || "All time"} — {data.range.endDate || "Today"}</span><h2>{data.narrative}</h2></div><strong>{data.summary.averageScore == null ? "—" : `${data.summary.averageScore}%`}<small>average score</small></strong></section>
          {!data.dataAvailability.interviews ? <section className="analytics-new-user"><span>01</span><h2>Your analytics journey starts with an interview</h2><p>No interviews match this range. Complete a tailored practice session to unlock trends, topic mastery, readiness, and recommendations.</p><Link className="analytics-primary" to="/interview/setup">Start an interview</Link></section> : <>
            <KPIGrid summary={data.summary} />
            <TrendPanels data={data} />
            <TopicMastery topics={data.topicMastery} weaknesses={data.weaknesses} heatmap={data.topicHeatmap} />
            <EvidencePanels data={data} />
            <BreakdownPanels data={data} />
            <QualityTimePanels data={data} />
            <VoiceResumePanels data={data} />
            <ReadinessPanels data={data} />
            <ProgressRecommendations data={data} />
            <ComparisonPanel interviews={interviews} selected={selected} setSelected={setSelected} comparison={comparison} onCompare={compare} loading={compareLoading} />
          </>}
        </>}
      </div>
    </div>
  </main>;
}

export default Analytics;
