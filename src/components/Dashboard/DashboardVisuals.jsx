import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "./DashboardWidgets";

const METRICS = {
  interviewsCompleted: { label: "Interviews completed", suffix: "" },
  questionsAnswered: { label: "Questions answered", suffix: "" },
  averageScore: { label: "Average score", suffix: "%" },
  practiceMinutes: { label: "Practice minutes", suffix: "m" },
};

export function WeeklyProgressChart({ data }) {
  const [metric, setMetric] = useState("questionsAnswered");
  const values = data.map((item) => item[metric] || 0);
  const max = Math.max(...values, 1);
  const hasData = values.some((value) => value > 0);
  const config = METRICS[metric];
  return (
    <section className="dash-card chart-card">
      <div className="section-heading"><div><span>Last seven days</span><h2>Weekly progress</h2></div><label className="metric-select"><span className="sr-only">Chart metric</span><select value={metric} onChange={(event) => setMetric(event.target.value)}>{Object.entries(METRICS).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select></label></div>
      {hasData ? <><div className="bar-chart" role="img" aria-label={`${config.label} for the last seven days`}>
        {data.map((day) => <div className="bar-column" key={day.date} title={`${day.date}: ${day[metric] ?? 0}${config.suffix}`}><span className="bar-value">{day[metric] ?? 0}{config.suffix}</span><div><i style={{ height: `${Math.max(((day[metric] || 0) / max) * 100, day[metric] ? 8 : 0)}%` }} /></div><small>{new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}</small></div>)}
      </div><details className="chart-data"><summary>Accessible data table</summary><table><thead><tr><th>Date</th><th>{config.label}</th></tr></thead><tbody>{data.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day[metric] ?? 0}{config.suffix}</td></tr>)}</tbody></table></details></> : <EmptyState title="No activity this week" description="Your chart will appear after you answer questions or complete an interview." action="Start interview" />}
    </section>
  );
}

export function ActivityHeatmap({ data }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  const hasData = data.some((item) => item.count > 0 || item.activityCount > 0);
  return <section className="dash-card heatmap-card"><div className="section-heading"><div><span>Last 12 weeks</span><h2>Practice consistency</h2></div></div>{hasData ? <><div className="heatmap-scroll"><div className="heatmap-grid" role="img" aria-label="Twelve week interview activity heatmap">{data.map((day) => { const intensity = day.count ? Math.ceil(day.count / max * 4) : day.activityCount ? 1 : 0; return <span className={`heat-${intensity}`} key={day.date} title={`${day.date}: ${day.count} questions answered, ${day.activityCount} activities`} aria-label={`${day.date}: ${day.count} questions answered`} />; })}</div></div><div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i className={`heat-${level}`} key={level} />)}<span>More</span></div></> : <EmptyState title="No practice activity yet" description="Your consistency map begins with your first answered question." action="Start interview" />}</section>;
}

export function CalendarWidget({ activity }) {
  const [selected, setSelected] = useState(activity.at(-1)?.date || "");
  const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
  const currentMonth = monthFormatter.format(new Date());
  const activityMap = useMemo(() => new Map(activity.map((item) => [item.date, item])), [activity]);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const selectedActivity = activityMap.get(selected);
  return <section className="dash-card calendar-card"><div className="section-heading"><div><span>Activity calendar</span><h2>{currentMonth}</h2></div></div><div className="calendar-weekdays">{"SMTWTFS".split("").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`; const active = activityMap.has(date); return <button type="button" className={`${active ? "active" : ""} ${selected === date ? "selected" : ""}`} onClick={() => setSelected(date)} key={date} aria-label={`${date}${active ? ", activity recorded" : ", no activity"}`}>{index + 1}</button>; })}</div><div className="calendar-summary">{selectedActivity ? <><strong>{selectedActivity.date}</strong><span>{selectedActivity.count} questions · {selectedActivity.activityCount} activities</span></> : <span>Select an active day to review its summary.</span>}</div></section>;
}

const emptyForm = { title: "Practice interview", role: "Frontend Developer", interviewType: "Technical", difficulty: "Medium", scheduledAt: "", notes: "", reminderEnabled: false };

export function UpcomingInterviews({ items, onCreate, onUpdate, onCancel }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const openForm = (item = null) => {
    setEditing(item);
    setForm(item ? { ...item, scheduledAt: new Date(item.scheduledAt).toISOString().slice(0, 16) } : emptyForm);
    setShowForm(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    const payload = { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() };
    if (editing) await onUpdate(editing.id, payload); else await onCreate(payload);
    setEditing(null);
    setForm(emptyForm);
    setShowForm(false);
  };
  return <section className="dash-card upcoming-card"><div className="section-heading"><div><span>Plan ahead</span><h2>Upcoming practice</h2></div><button className="icon-button" type="button" onClick={() => openForm()} aria-label="Schedule interview">+</button></div>{items.length ? <div className="upcoming-list">{items.map((item) => <article key={item.id}><time dateTime={item.scheduledAt}><strong>{new Intl.DateTimeFormat("en", { day: "2-digit" }).format(new Date(item.scheduledAt))}</strong><span>{new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(item.scheduledAt))}</span></time><div><strong>{item.role}</strong><small>{item.interviewType} · {item.difficulty} · {new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(item.scheduledAt))}</small></div><div><Link to="/interview/setup">Start now</Link><button type="button" onClick={() => openForm(item)}>Edit</button><button type="button" onClick={() => onCancel(item)}>Cancel</button></div></article>)}</div> : <EmptyState title="Nothing scheduled" description="Plan a focused practice session and make it easier to stay consistent." />}<button className="dash-secondary full" type="button" onClick={() => openForm()}>Schedule practice</button>{showForm && <div className="dash-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><form onSubmit={submit}><h3 id="schedule-title">{editing ? "Edit practice session" : "Schedule practice session"}</h3><label>Title<input required maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Target role<input required maxLength="120" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><div className="form-row"><label>Type<select value={form.interviewType} onChange={(event) => setForm({ ...form, interviewType: event.target.value })}><option>Technical</option><option>Behavioral</option><option>Mixed</option></select></label><label>Difficulty<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}><option>Easy</option><option>Medium</option><option>Hard</option></select></label></div><label>Date and time<input required type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></label><label>Notes<textarea maxLength="500" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div><button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(false); }}>Cancel</button><button className="dash-primary" type="submit">Save session</button></div></form></div>}</section>;
}
