import { Link } from "react-router-dom";
import { BarChart, EmptyAnalytics, RadarChart, ScoreDistribution, TrendChart } from "./AnalyticsCharts";

const formatValue = (value, suffix = "") => value == null ? "—" : `${value}${suffix}`;

export function KPIGrid({ summary }) {
  const items = [
    ["Interviews", summary.totalInterviews, "totalInterviews"], ["Completed", summary.completedInterviews, "completedInterviews"],
    ["Completion", formatValue(summary.completionRate, "%"), "completionRate"], ["Average score", formatValue(summary.averageScore, "%"), "averageScore"],
    ["Highest score", formatValue(summary.highestScore, "%"), "highestScore"], ["Median score", formatValue(summary.medianScore, "%"), "averageScore"],
    ["Questions answered", summary.questionsAnswered, "questionsAnswered"], ["Question score", formatValue(summary.averageQuestionScore, "%"), "averageQuestionScore"],
    ["Practice time", formatValue(summary.totalPracticeMinutes, "m"), "totalPracticeMinutes"], ["Current streak", formatValue(summary.currentStreak, "d"), null],
    ["Goal completion", formatValue(summary.goalCompletionRate, "%"), null], ["Voice usage", formatValue(summary.voiceUsageRate, "%"), null],
  ];
  return <section className="analytics-kpis" aria-label="Key performance indicators">{items.map(([label, value, comparisonKey]) => {
    const comparison = comparisonKey ? summary.comparisons?.[comparisonKey] : null;
    return <article key={label}><span>{label}</span><strong>{value}</strong>{comparison?.absolute != null ? <small className={comparison.direction}> {comparison.direction === "up" ? "↑" : comparison.direction === "down" ? "↓" : "–"} {Math.abs(comparison.absolute)} vs previous</small> : <small>Selected period</small>}</article>;
  })}</section>;
}

export function TrendPanels({ data }) {
  const activity = data.activityTrend.map((item) => ({ label: item.period, value: item.interviewsCompleted }));
  return <div className="analytics-grid two">
    <section className="analytics-card wide"><div className="analytics-card-head"><div><span>Performance</span><h2>Score trend</h2></div><small>{data.filters.aggregation} aggregation</small></div><TrendChart data={data.performanceTrend} /></section>
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Activity</span><h2>Completed interviews</h2></div></div><BarChart data={activity.slice(-12)} title="Interview activity" /></section>
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Skills</span><h2>Supported dimensions</h2></div></div><RadarChart data={data.skillRadar} /></section>
  </div>;
}

export function TopicMastery({ topics, weaknesses, heatmap }) {
  if (!topics.length) return <section className="analytics-card"><h2>Topic mastery</h2><EmptyAnalytics title="No topic evidence yet" description="Generate evaluations with structured question topics to unlock mastery insights." /></section>;
  return <section className="analytics-card analytics-topic-section"><div className="analytics-card-head"><div><span>Skills intelligence</span><h2>Topic mastery</h2></div><small>{topics.length} measured topics</small></div>
    <div className="topic-table-wrap"><table><thead><tr><th>Topic</th><th>Score</th><th>Attempts</th><th>Mastery</th><th>Trend</th><th>Confidence</th><th>Next action</th></tr></thead><tbody>{topics.slice(0, 12).map((topic) => <tr key={topic.topic}><th>{topic.topic}</th><td>{topic.averageScore}%</td><td>{topic.attempts}</td><td><span className={`mastery ${topic.mastery.toLowerCase().replace(" ", "-")}`}>{topic.mastery}</span></td><td>{topic.trend == null ? "—" : `${topic.trend > 0 ? "+" : ""}${topic.trend}`}</td><td>{topic.confidence}</td><td>{topic.nextAction}</td></tr>)}</tbody></table></div>
    {heatmap.length > 0 && <div className="topic-heatmap" aria-label="Topic performance heatmap">{heatmap.slice(0, 40).map((cell) => <div key={`${cell.topic}-${cell.period}`} style={{ "--heat": cell.averageScore / 100 }} title={`${cell.topic}, ${cell.period}: ${cell.averageScore}% across ${cell.attempts} attempts`}><span>{cell.topic}</span><i>{cell.averageScore}</i><small>{cell.period}</small></div>)}</div>}
    {weaknesses.length > 0 && <div className="evidence-strip"><strong>Priority weaknesses</strong>{weaknesses.map((topic) => <span key={topic.topic}>{topic.topic} · {topic.averageScore}% · {topic.confidence} confidence</span>)}</div>}
  </section>;
}

const AnalysisTable = ({ title, eyebrow, rows, firstLabel }) => <section className="analytics-card"><div className="analytics-card-head"><div><span>{eyebrow}</span><h2>{title}</h2></div></div>{rows.length ? <div className="topic-table-wrap"><table><thead><tr><th>{firstLabel}</th><th>Interviews</th><th>Avg score</th><th>Completion</th><th>Duration</th><th>Trend</th></tr></thead><tbody>{rows.map((row) => <tr key={row.value}><th>{row.value}</th><td>{row.interviews}</td><td>{formatValue(row.averageScore, "%")}</td><td>{row.completionRate}%</td><td>{formatValue(row.averageDurationMinutes, "m")}</td><td>{row.trend == null ? "—" : `${row.trend > 0 ? "+" : ""}${row.trend}`}</td></tr>)}</tbody></table></div> : <EmptyAnalytics title={`No ${title.toLowerCase()} data`} description="No interviews match this analysis." />}</section>;

export function BreakdownPanels({ data }) {
  return <div className="analytics-grid two">
    <AnalysisTable title="Difficulty analysis" eyebrow="Challenge level" rows={data.difficultyAnalysis} firstLabel="Difficulty" />
    <AnalysisTable title="Interview type analysis" eyebrow="Format" rows={data.interviewTypeAnalysis} firstLabel="Type" />
  </div>;
}

export function EvidencePanels({ data }) {
  const renderInsights = (items, emptyTitle) => items.length ? <div className="insight-list">{items.map((item) => <article key={item.topic}><div><strong>{item.topic}</strong><span>{item.averageScore}% · {item.attempts} attempts</span></div><b>{item.confidence}</b><p>{item.nextAction}</p></article>)}</div> : <EmptyAnalytics title={emptyTitle} description="More evaluated topic attempts are needed for reliable evidence." />;
  const dimensions = data.communicationTechnical;
  return <div className="analytics-grid two">
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Evidence</span><h2>Strengths and weaknesses</h2></div></div><div className="strength-weak-grid"><div><h3>Strongest topics</h3>{renderInsights(data.strengths, "No proven strengths yet")}</div><div><h3>Priority weaknesses</h3>{renderInsights(data.weaknesses, "No measured weaknesses yet")}</div></div></section>
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Evaluation dimensions</span><h2>Communication vs technical</h2></div></div><div className="mini-metrics"><div><strong>{formatValue(dimensions.technicalScore, "%")}</strong><span>Technical</span></div><div><strong>{formatValue(dimensions.communicationScore, "%")}</strong><span>Communication</span></div><div><strong>{formatValue(dimensions.clarityScore, "%")}</strong><span>Clarity</span></div><div><strong>{formatValue(dimensions.completenessScore, "%")}</strong><span>Completeness</span></div></div><p className="analytics-note">{dimensions.note}</p></section>
  </div>;
}

export function QualityTimePanels({ data }) {
  const quality = data.answerQuality; const practice = data.practiceTime;
  return <div className="analytics-grid two">
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Answer quality</span><h2>Response patterns</h2></div></div><div className="mini-metrics"><div><strong>{formatValue(quality.averageAnswerWords)}</strong><span>Avg words</span></div><div><strong>{formatValue(quality.averageQuestionScore, "%")}</strong><span>Avg score</span></div><div><strong>{quality.unansweredPercentage}%</strong><span>Unanswered</span></div><div><strong>{quality.topicCoverage}</strong><span>Topics covered</span></div></div><ScoreDistribution data={quality.scoreDistribution} /><p className="analytics-note">{quality.note}</p></section>
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Practice time</span><h2>Time investment</h2></div></div><div className="mini-metrics"><div><strong>{practice.totalMinutes}m</strong><span>Total</span></div><div><strong>{formatValue(practice.averageSessionMinutes, "m")}</strong><span>Average</span></div><div><strong>{formatValue(practice.longestSessionMinutes, "m")}</strong><span>Longest</span></div><div><strong>{practice.mostActiveDay || "—"}</strong><span>Active day</span></div></div><BarChart data={practice.byInterviewType} labelKey="label" valueKey="minutes" suffix="m" title="Practice time" /></section>
  </div>;
}

export function VoiceResumePanels({ data }) {
  const voice = data.voiceAnalytics; const resume = data.resumeAnalytics;
  return <div className="analytics-grid two">
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Voice mode</span><h2>Voice analytics</h2></div></div>{data.dataAvailability.voice ? <><div className="mini-metrics"><div><strong>{voice.completed}</strong><span>Completed</span></div><div><strong>{voice.usageRate}%</strong><span>Usage</span></div><div><strong>{formatValue(voice.averageTranscriptWords)}</strong><span>Transcript words</span></div><div><strong>{formatValue(voice.averageVoiceScore, "%")}</strong><span>Voice score</span></div></div><p className="analytics-note">{voice.note}</p></> : <EmptyAnalytics title="No voice sessions yet" description="Complete a voice-mode interview to see transcript and usage insights." />}</section>
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Resume history</span><h2>Resume improvement</h2></div><Link to="/resumes">Manage resumes</Link></div>{data.dataAvailability.resumes ? <><div className="mini-metrics"><div><strong>{resume.currentScore}%</strong><span>{resume.scoreLabel}</span></div><div><strong>{resume.versions}</strong><span>Versions</span></div><div><strong>{resume.scoreChange == null ? "—" : `${resume.scoreChange > 0 ? "+" : ""}${resume.scoreChange}`}</strong><span>Change</span></div><div><strong>{resume.keywordCount}</strong><span>Keywords</span></div></div>{resume.history?.length > 1 && <div className="resume-history">{resume.history.map((item) => <span key={item.id}><strong>{item.name}</strong><b>{item.score}%</b><small>{new Date(item.analyzedAt).toLocaleDateString()}</small></span>)}</div>}<p className="analytics-note">{resume.note}</p></> : <EmptyAnalytics title="No resume history" description="Upload a PDF resume to unlock completeness and keyword-coverage analytics." />}</section>
  </div>;
}

export function ReadinessPanels({ data }) {
  return <div className="analytics-grid two">
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Role readiness</span><h2>Preparation estimates</h2></div></div>{data.roleReadiness.length ? <div className="readiness-list">{data.roleReadiness.slice(0, 6).map((role) => <article key={role.role}><div><strong>{role.role}</strong><span>{role.readinessLevel} · {role.confidence} confidence</span></div><b>{role.readinessScore}%</b><div className="readiness-track"><i style={{ width: `${role.readinessScore}%` }} /></div>{role.nextSteps[0] && <small>{role.nextSteps[0]}</small>}</article>)}</div> : <EmptyAnalytics title="No role readiness yet" description="Complete evaluated interviews to calculate explainable readiness estimates." />}<p className="analytics-disclaimer">Readiness is an estimate based on your practice data, not a hiring prediction.</p></section>
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Company preparation</span><h2>Profile readiness</h2></div></div>{data.summary.evaluatedInterviews ? <div className="company-grid">{data.companyReadiness.map((company) => <article key={company.company}><strong>{company.company}</strong><b>{company.readinessScore}%</b><small>{company.confidence} confidence · {company.evidenceCount} evaluated</small></article>)}</div> : <EmptyAnalytics title="Not enough company evidence" description="Company preparation profiles activate after evaluated interviews." />}<p className="analytics-disclaimer">Preparation readiness is not a hiring probability.</p></section>
  </div>;
}

export function ProgressRecommendations({ data }) {
  const consistency = data.consistency; const xp = data.gamification.xp; const badges = data.gamification.badges;
  return <div className="analytics-grid two">
    <section className="analytics-card"><div className="analytics-card-head"><div><span>Consistency & progression</span><h2>Practice momentum</h2></div></div><div className="mini-metrics"><div><strong>{consistency.weeklyConsistencyScore}%</strong><span>Consistency</span></div><div><strong>{consistency.activeDays}</strong><span>Active days</span></div><div><strong>{xp.earnedInPeriod} XP</strong><span>Period XP</span></div><div><strong>Level {xp.currentLevel}</strong><span>{xp.progressToNextLevel}/250 XP</span></div></div><BarChart data={xp.sourceBreakdown.map((item) => ({ label: item.type.replaceAll("_", " "), value: item.xp }))} title="XP sources" /><p className="analytics-note">Consistency formula: 40% active days, 30% goals, 20% session spacing, 10% current streak. {badges.totalEarned} of {Math.round(badges.totalEarned / Math.max(badges.categoryCompletion, 1) * 100)} badges earned.</p></section>
    <section className="analytics-card recommendation-card"><div className="analytics-card-head"><div><span>Next best actions</span><h2>Recommendations</h2></div></div><div className="recommendation-list">{data.recommendations.map((item) => <article key={item.title}><b className={item.priority.toLowerCase()}>{item.priority}</b><div><strong>{item.title}</strong><p>{item.explanation}</p><small>Evidence: {item.evidence}</small></div><Link to={item.actionRoute}>{item.actionLabel}</Link></article>)}</div></section>
  </div>;
}

export function ComparisonPanel({ interviews, selected, setSelected, comparison, onCompare, loading }) {
  return <section className="analytics-card" id="comparison"><div className="analytics-card-head"><div><span>Interview comparison</span><h2>Compare 2–4 sessions</h2></div><button type="button" className="analytics-primary compact" onClick={onCompare} disabled={selected.length < 2 || loading}>{loading ? "Comparing…" : "Compare"}</button></div>
    {interviews.length ? <><div className="comparison-picker">{interviews.slice(0, 12).map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={!selected.includes(item.id) && selected.length >= 4} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span>{item.role}</span><small>{item.difficulty} · {formatValue(item.score, "%")}</small></label>)}</div>{comparison.length ? <div className="topic-table-wrap"><table><thead><tr><th>Interview</th><th>Score</th><th>Duration</th><th>Completion</th><th>Categories</th></tr></thead><tbody>{comparison.map((item) => <tr key={item.id}><th>{item.role}</th><td>{formatValue(item.overallScore, "%")}</td><td>{formatValue(item.durationMinutes, "m")}</td><td>{item.answerCompletion}%</td><td>{item.categories.join(", ") || "—"}</td></tr>)}</tbody></table></div> : <EmptyAnalytics title="Choose interviews to compare" description="Select two to four owned interviews, then compare their scores and answer completion." />}</> : <EmptyAnalytics title="No interviews available" description="Create interviews before using the comparison tool." />}
  </section>;
}
