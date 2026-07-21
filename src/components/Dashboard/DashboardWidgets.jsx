import { memo, useState } from "react";
import { Link } from "react-router-dom";

const relativeTime = (value) => {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, amount] of units) {
    if (Math.abs(seconds) >= amount) return formatter.format(Math.round(seconds / amount), unit);
  }
  return "just now";
};

export function EmptyState({ title, description, action, to = "/interview/setup" }) {
  return (
    <div className="dash-empty">
      <span aria-hidden="true">◇</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && <Link to={to}>{action}</Link>}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" role="status" aria-label="Loading dashboard">
      <div className="skeleton-block skeleton-hero" />
      <div className="skeleton-row">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-block" key={index} />)}</div>
      <div className="skeleton-columns"><div className="skeleton-block tall" /><div className="skeleton-block tall" /></div>
    </div>
  );
}

export function WelcomeHero({ user, summary, continueInterview }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstTime = summary.totalInterviews === 0;
  return (
    <section className="dash-hero">
      <div>
        <span className="dash-kicker">{greeting}</span>
        <h1>{user.firstName}, let&apos;s build interview confidence.</h1>
        <p>{firstTime ? "Your first tailored practice session is one click away." : continueInterview ? `Your ${continueInterview.role} interview is ready to continue.` : `Keep your momentum going${user.targetRole ? ` toward ${user.targetRole}` : ""}.`}</p>
        <div className="hero-actions">
          <Link className="dash-primary" to={continueInterview ? `/interview/session/${continueInterview.id}` : "/interview/setup"}>
            {continueInterview ? "Continue Interview" : "Start New Interview"}
          </Link>
          <Link className="dash-secondary" to={continueInterview ? "/interview/setup" : "/interview/history"}>
            {continueInterview ? "Start New Interview" : "View History"}
          </Link>
        </div>
      </div>
      <div className="hero-orbit" aria-hidden="true"><span>{summary.currentStreak}</span><small>day streak</small></div>
    </section>
  );
}

export function QuickActions({ data }) {
  const feedbackInterview = data.recentInterviews.find((item) => item.score != null);
  const actions = [
    { icon: "+", title: "New interview", description: "Create tailored practice", to: "/interview/setup", show: true },
    { icon: "▶", title: "Continue", description: "Resume saved answers", to: data.continueInterview ? `/interview/session/${data.continueInterview.id}` : "", show: Boolean(data.continueInterview) },
    { icon: "CV", title: data.activeResume ? "Manage resume" : "Upload resume", description: data.activeResume ? "Update interview context" : "Personalize questions", to: "/resumes", show: true },
    { icon: "↗", title: "Interview history", description: "Review all sessions", to: "/interview/history", show: data.summary.totalInterviews > 0 },
    { icon: "AI", title: "Open feedback", description: "Review your latest report", to: feedbackInterview ? `/interview/report/${feedbackInterview.id}` : "", show: Boolean(feedbackInterview) },
    { icon: "ME", title: "Profile", description: "Manage your account", to: "/profile", show: true },
    { icon: "◎", title: "Practice weak topic", description: data.weakTopics[0]?.topic || "Build topic insights", to: "/interview/setup", show: data.weakTopics.length > 0 },
  ].filter((item) => item.show);
  return (
    <section className="dash-section quick-section" aria-labelledby="quick-title">
      <div className="section-heading"><div><span>Workspace</span><h2 id="quick-title">Quick actions</h2></div></div>
      <div className="quick-grid">{actions.map((action) => (
        <Link to={action.to} className="quick-action" key={action.title}>
          <span aria-hidden="true">{action.icon}</span><div><strong>{action.title}</strong><small>{action.description}</small></div>
        </Link>
      ))}</div>
    </section>
  );
}

const StatCard = memo(function StatCard({ item }) {
  return <article className="metric-card"><span aria-hidden="true">{item.icon}</span><div><strong>{item.value}</strong><p>{item.label}</p><small>{item.context}</small></div></article>;
});

export function StatsGrid({ summary }) {
  const enoughScores = summary.evaluatedInterviews >= 2;
  const items = [
    { icon: "01", value: summary.totalInterviews, label: "Total interviews", context: `${summary.thisWeek.completed} completed this week` },
    { icon: "✓", value: summary.completedInterviews, label: "Completed", context: summary.totalInterviews ? `${Math.round(summary.completedInterviews / summary.totalInterviews * 100)}% completion rate` : "Start your first interview" },
    { icon: "%", value: `${summary.averageScore}%`, label: "Average score", context: enoughScores ? `${summary.evaluatedInterviews} evaluated interviews` : "Not enough data yet" },
    { icon: "↑", value: `${summary.highestScore}%`, label: "Highest score", context: summary.highestScore ? "Your personal best" : "No evaluated interview yet" },
    { icon: "Q", value: summary.questionsAnswered, label: "Questions answered", context: `${summary.thisWeek.questions} this week` },
    { icon: "◷", value: `${summary.totalPracticeMinutes}m`, label: "Practice time", context: `${summary.thisWeek.minutes} minutes this week` },
    { icon: "🔥", value: summary.currentStreak, label: "Current streak", context: summary.activeToday ? "Active today" : "Practice today to continue" },
    { icon: "CV", value: summary.resumeScore == null ? "—" : `${summary.resumeScore}%`, label: "Resume score", context: summary.resumeScore == null ? "ATS scoring arrives in a future phase" : "Latest resume analysis" },
  ];
  return <section className="metric-grid" aria-label="Interview statistics">{items.map((item) => <StatCard item={item} key={item.label} />)}</section>;
}

export function ContinueInterviewCard({ interview }) {
  if (!interview) return <section className="dash-card continue-card"><div className="section-heading"><div><span>Pick up where you left off</span><h2>Continue interview</h2></div></div><EmptyState title="No interview in progress" description="Start a focused practice session when you are ready." action="Start interview" /></section>;
  const percentage = interview.totalQuestions ? Math.round(interview.answeredQuestions / interview.totalQuestions * 100) : 0;
  return (
    <section className="dash-card continue-card">
      <div className="section-heading"><div><span>Pick up where you left off</span><h2>{interview.role}</h2></div><b className="status-pill">Draft</b></div>
      <p>{interview.difficulty} · {interview.interviewType}</p>
      <div className="progress-copy"><strong>{interview.answeredQuestions} of {interview.totalQuestions} questions</strong><span>{percentage}%</span></div>
      <div className="progress-track"><span style={{ width: `${percentage}%` }} /></div>
      <div className="card-footer"><small>Updated {relativeTime(interview.updatedAt)}</small><Link className="dash-primary compact" to={`/interview/session/${interview.id}`}>Resume</Link></div>
    </section>
  );
}

export function DailyGoalCard({ goal, onSave }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.target);
  return (
    <section className={`dash-card goal-card ${goal.completed ? "complete" : ""}`}>
      <div className="section-heading"><div><span>Daily practice</span><h2>Today&apos;s goal</h2></div><button className="icon-button" type="button" onClick={() => setEditing(true)} aria-label="Edit daily goal">···</button></div>
      <div className="goal-ring" style={{ "--progress": `${goal.percentage * 3.6}deg` }}><div><strong>{goal.progress}</strong><span>of {goal.target}</span></div></div>
      <p>{goal.completed ? "Daily goal completed — excellent consistency." : `${Math.max(goal.target - goal.progress, 0)} more question${goal.target - goal.progress === 1 ? "" : "s"} to complete today's goal.`}</p>
      <small>Resets at midnight · {goal.timezone}</small>
      {editing && <div className="dash-modal" role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title"><form onSubmit={(event) => { event.preventDefault(); onSave(Number(target)); setEditing(false); }}><h3 id="goal-dialog-title">Set daily question goal</h3><label>Questions per day<input type="number" min="1" max="50" value={target} onChange={(event) => setTarget(event.target.value)} /></label><div><button type="button" onClick={() => setEditing(false)}>Cancel</button><button className="dash-primary" type="submit">Save goal</button></div></form></div>}
    </section>
  );
}

export function AICoachCard({ coach }) {
  return <section className="dash-card coach-card"><div className="coach-badge"><span>AI</span>Coach insight</div><h2>One focused next step</h2><p>{coach.primaryRecommendation}</p>{coach.weakTopic && <div className="coach-detail"><span>Focus topic</span><strong>{coach.weakTopic.topic}</strong><small>{coach.weakTopic.score}% across {coach.weakTopic.questionCount} questions</small></div>}{coach.recentImprovement != null && <p className={coach.recentImprovement >= 0 ? "positive-copy" : "neutral-copy"}>{coach.recentImprovement >= 0 ? "+" : ""}{coach.recentImprovement}% compared with your previous evaluated interview</p>}<Link className="dash-secondary" to={coach.recommendedAction.path}>{coach.recommendedAction.label}</Link></section>;
}

function TopicList({ title, items, weak }) {
  return <section className="dash-card topic-card"><div className="section-heading"><div><span>{weak ? "Priority practice" : "Demonstrated strength"}</span><h2>{title}</h2></div></div>{items.length ? <div className="topic-list">{items.map((item) => <div key={item.topic}><span><strong>{item.topic}</strong><small>{item.questionCount} related question{item.questionCount === 1 ? "" : "s"}</small></span><b>{item.score}%</b></div>)}</div> : <EmptyState title={`No ${weak ? "weak" : "strong"} topics yet`} description="Complete evaluated interviews to build reliable topic insights." />}</section>;
}

export function TopicInsights({ weakTopics, strongTopics }) {
  return <div className="topic-columns"><TopicList title="Weak topics" items={weakTopics} weak /><TopicList title="Strong topics" items={strongTopics} /></div>;
}

export function GamificationCards({ gamification, summary, badges }) {
  return <div className="game-grid"><section className="dash-card xp-card"><div className="section-heading"><div><span>Growth</span><h2>Level {gamification.level}</h2></div><b>{gamification.xp} XP</b></div><div className="progress-track"><span style={{ width: `${gamification.percentage}%` }} /></div><small>{gamification.currentLevelXp} / {gamification.xpForNextLevel} XP to advance</small></section><section className="dash-card streak-card"><span className="big-icon">🔥</span><div><strong>{summary.currentStreak}-day streak</strong><p>Longest streak: {summary.longestStreak} days</p><small>{summary.activeToday ? "Today is counted" : "Practice today to keep it alive"}</small></div></section><section className="dash-card badge-card"><div className="section-heading"><div><span>Milestones</span><h2>Badge preview</h2></div></div><div className="badge-row">{badges.slice(0, 4).map((badge) => <div className={badge.earned ? "earned" : "locked"} title={`${badge.name}: ${badge.description}`} key={badge.key}><span>{badge.icon}</span><small>{badge.name}</small></div>)}</div></section></div>;
}

export function ActivityTimeline({ activity }) {
  return <section className="dash-card activity-card"><div className="section-heading"><div><span>Latest updates</span><h2>Recent activity</h2></div></div>{activity.length ? <ol>{activity.map((item) => <li key={item.id}><span className="activity-dot" aria-hidden="true" /><div><strong>{item.title}</strong><p>{item.description}</p><small>{relativeTime(item.occurredAt)}</small></div>{item.relatedEntityType === "interview" && <Link aria-label={`Open ${item.title}`} to={item.type === "evaluation_generated" ? `/interview/report/${item.relatedEntityId}` : `/interview/results/${item.relatedEntityId}`}>↗</Link>}</li>)}</ol> : <EmptyState title="No recent activity" description="Your interview, resume, evaluation, and goal events will appear here." action="Start interview" />}</section>;
}

export function RecentInterviews({ interviews, onDelete }) {
  return <section className="dash-card recent-card"><div className="section-heading"><div><span>Your latest sessions</span><h2>Recent interviews</h2></div><Link to="/interview/history">View all</Link></div>{interviews.length ? <div className="recent-table" role="table" aria-label="Recent interviews">{interviews.map((item) => <div className="recent-row" role="row" key={item.id}><div><strong>{item.role}</strong><small>{item.interviewType} · {item.difficulty}</small></div><span className={`status-pill ${item.status}`}>{item.status}</span><b>{item.score == null ? "—" : `${item.score}%`}</b><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.completedAt || item.createdAt))}</small><div className="row-actions"><Link to={item.status === "draft" ? `/interview/session/${item.id}` : item.score != null ? `/interview/report/${item.id}` : `/interview/results/${item.id}`}>{item.status === "draft" ? "Resume" : item.score != null ? "Report" : "Details"}</Link><button type="button" aria-label={`Delete ${item.role} interview`} onClick={() => onDelete(item)}>×</button></div></div>)}</div> : <EmptyState title="No interviews yet" description="Start your first AI-powered mock interview and track progress here." action="Start interview" />}</section>;
}
