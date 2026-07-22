import "./DashboardHome.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import useDashboard from "../../hooks/useDashboard";
import {
  cancelScheduledInterview,
  createScheduledInterview,
  deleteInterview,
  updateDashboardGoal,
  updateScheduledInterview,
} from "../../services/api";
import {
  ActivityTimeline,
  AICoachCard,
  ContinueInterviewCard,
  DailyGoalCard,
  DashboardSkeleton,
  GamificationCards,
  QuickActions,
  RecentInterviews,
  StatsGrid,
  TopicInsights,
  WelcomeHero,
} from "./DashboardWidgets";
import {
  ActivityHeatmap,
  CalendarWidget,
  UpcomingInterviews,
  WeeklyProgressChart,
} from "./DashboardVisuals";

const getInitials = (name = "User") => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

function DashboardHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const { data, loading, error, retry, refresh, timezone } = useDashboard();
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");

  const runMutation = async (operation, successMessage) => {
    setMutationError("");
    try {
      await operation();
      setNotice(successMessage);
      await refresh();
    } catch (requestError) {
      setMutationError(requestError.message || "Unable to update dashboard");
      throw requestError;
    }
  };

  const handleDelete = async (interview) => {
    if (!window.confirm(`Delete the ${interview.role} interview? This cannot be undone.`)) return;
    await runMutation(() => deleteInterview(interview.id), "Interview deleted.");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading && !data) return <main className="dashboard-page"><div className="dashboard-shell"><DashboardSkeleton /></div></main>;
  if (error && !data) return <main className="dashboard-page"><div className="dashboard-shell"><section className="dashboard-error" role="alert"><span>Connection issue</span><h1>Your dashboard could not load</h1><p>{error}</p><button className="dash-primary" type="button" onClick={retry}>Try again</button></section></div></main>;

  return (
    <main className="dashboard-page">
      <div className="dashboard-backdrop" aria-hidden="true" />
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <Link className="dashboard-brand" to="/"><span>AI</span><strong>Interview<br />Copilot</strong></Link>
          <nav>
            <a className="active" href="#overview"><span>⌂</span>Overview</a>
            <Link to="/interview/setup"><span>＋</span>New interview</Link>
            <Link to="/interview/history"><span>▤</span>Interviews</Link>
            <Link to="/resumes"><span>CV</span>Resumes</Link>
            <Link to="/analytics"><span>↗</span>Analytics</Link>
            <Link to="/coach"><span>AI</span>Coach</Link>
          </nav>
          <div className="sidebar-level"><span>Level {data.gamification.level}</span><strong>{data.gamification.xp} XP</strong><div className="progress-track"><i style={{ width: `${data.gamification.percentage}%` }} /></div></div>
        </aside>

        <div className="dashboard-main">
          <header className="dashboard-header">
            <div className="mobile-brand"><span>AI</span><strong>Interview Copilot</strong></div>
            <div className="header-tools">
              <label className="theme-control"><span className="sr-only">Color theme</span><select value={preference} onChange={(event) => setPreference(event.target.value)} aria-label="Color theme"><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label>
              <div className="dashboard-profile">
                <button className="profile-trigger" type="button" aria-label="Open profile menu"><span className="profile-avatar">{getInitials(user.name)}</span><span>{user.name.split(" ")[0]}</span></button>
                <div className="profile-menu"><Link to="/profile">My Profile</Link><Link to="/analytics">Analytics Center</Link><Link to="/account/settings">Account Settings</Link><Link to="/resumes">My Resumes</Link><button type="button" onClick={handleLogout}>Logout</button></div>
              </div>
            </div>
          </header>

          <div className="dashboard-content" id="overview">
            {(notice || mutationError) && <div className={mutationError ? "dashboard-notice error" : "dashboard-notice"} role={mutationError ? "alert" : "status"}><span>{mutationError || notice}</span><button type="button" onClick={() => { setNotice(""); setMutationError(""); }} aria-label="Dismiss message">×</button></div>}
            <WelcomeHero user={data.user} summary={data.summary} continueInterview={data.continueInterview} />
            <QuickActions data={data} />
            <StatsGrid summary={data.summary} />

            <div className="dashboard-two-column priority-row">
              <ContinueInterviewCard interview={data.continueInterview} />
              <DailyGoalCard goal={data.dailyGoal} onSave={(target) => runMutation(() => updateDashboardGoal({ target, timezone }), "Daily goal updated.")} />
            </div>

            <div className="dashboard-two-column chart-row">
              <WeeklyProgressChart data={data.weeklyProgress} />
              <AICoachCard coach={data.aiCoach} />
            </div>
            <ActivityHeatmap data={data.heatmap} />
            <TopicInsights weakTopics={data.weakTopics} strongTopics={data.strongTopics} />
            <GamificationCards gamification={data.gamification} summary={data.summary} badges={data.badges} />

            <div className="dashboard-two-column lower-row">
              <ActivityTimeline activity={data.activity} />
              <CalendarWidget activity={data.calendarActivity} />
            </div>

            <RecentInterviews interviews={data.recentInterviews} onDelete={handleDelete} />
            <UpcomingInterviews
              items={data.upcomingInterviews}
              onCreate={(schedule) => runMutation(() => createScheduledInterview(schedule), "Practice session scheduled.")}
              onUpdate={(id, schedule) => runMutation(() => updateScheduledInterview(id, schedule), "Scheduled session updated.")}
              onCancel={(schedule) => window.confirm(`Cancel ${schedule.title}?`) && runMutation(() => cancelScheduledInterview(schedule.id), "Scheduled session cancelled.")}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default DashboardHome;
