import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import {
  claimGamificationChallenge,
  getGamificationBadges,
  getGamificationChallenges,
  getGamificationHistory,
  getGamificationLeaderboard,
  getGamificationProfile,
} from "../services/api";
import "./Gamification.css";

const loadGamification = async () => {
  const [profile, challenges, badges, history, leaderboard] = await Promise.all([
    getGamificationProfile(),
    getGamificationChallenges(),
    getGamificationBadges(),
    getGamificationHistory(),
    getGamificationLeaderboard(),
  ]);
  return {
    profile: profile.data.profile,
    xpRules: profile.data.xpRules,
    challenges: challenges.data.challenges,
    badges: badges.data.badges,
    history: history.data.history,
    leaderboard: leaderboard.data.leaderboard,
  };
};

function ChallengeCard({ challenge, claiming, onClaim }) {
  const percentage = Math.min(
    Math.round((challenge.progress / challenge.target) * 100),
    100,
  );
  return (
    <article className={`game-challenge ${challenge.completed ? "complete" : ""}`}>
      <div>
        <span>{challenge.type}</span>
        <strong>+{challenge.xp} XP</strong>
      </div>
      <h3>{challenge.title}</h3>
      <p>{challenge.description}</p>
      <div className="game-progress" aria-label={`${percentage}% complete`}>
        <i style={{ width: `${percentage}%` }} />
      </div>
      <footer>
        <small>{challenge.progress} / {challenge.target}</small>
        <button
          type="button"
          disabled={!challenge.completed || challenge.claimed || claiming}
          onClick={() => onClaim(challenge.key)}
        >
          {challenge.claimed ? "Claimed" : claiming ? "Claiming..." : "Claim reward"}
        </button>
      </footer>
    </article>
  );
}

export default function Gamification() {
  const { preference, setPreference } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      setData(await loadGamification());
    } catch (requestError) {
      setError(requestError.message || "Unable to load rewards");
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadGamification()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load rewards");
      });
    return () => {
      active = false;
    };
  }, []);

  const claim = async (challengeKey) => {
    setClaiming(challengeKey);
    setError("");
    try {
      await claimGamificationChallenge(challengeKey);
      setNotice("Reward claimed successfully.");
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "Unable to claim reward");
    } finally {
      setClaiming("");
    }
  };

  if (!data && !error) {
    return <main className="gamification-page"><div className="game-shell game-loading" role="status">Loading your rewards...</div></main>;
  }
  if (!data) {
    return <main className="gamification-page"><div className="game-shell game-error" role="alert"><h1>Rewards unavailable</h1><p>{error}</p><button type="button" onClick={refresh}>Try again</button></div></main>;
  }

  const daily = data.challenges.filter((item) => item.type === "daily");
  const weekly = data.challenges.filter((item) => item.type === "weekly");
  return (
    <main className="gamification-page">
      <div className="game-shell">
        <header className="game-topbar">
          <Link to="/dashboard">← Back to Dashboard</Link>
          <label>Theme
            <select value={preference} onChange={(event) => setPreference(event.target.value)} aria-label="Color theme">
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
        </header>

        <section className="game-hero">
          <div><span>Gamification center</span><h1>Level {data.profile.level}</h1><p>Build consistency, complete missions, and earn permanent achievements.</p></div>
          <div className="level-orbit"><strong>{data.profile.xp}</strong><small>total XP</small></div>
        </section>
        <div className="game-progress hero-progress"><i style={{ width: `${data.profile.levelProgress}%` }} /></div>
        <div className="level-caption"><span>{data.profile.currentLevelXp} / {data.profile.xpPerLevel} XP</span><span>Level {data.profile.level + 1} at {data.profile.nextLevelXp} XP</span></div>

        {(notice || error) && <p className={error ? "game-notice error" : "game-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}

        <section className="game-stats">
          <article><strong>{data.profile.currentStreak}</strong><span>Current streak</span><small>Best: {data.profile.longestStreak} days</small></article>
          <article><strong>{data.profile.earnedBadges}/{data.profile.totalBadges}</strong><span>Badges earned</span><small>Permanent achievements</small></article>
          <article><strong>{data.profile.availableRewards}</strong><span>Rewards ready</span><small>Claim completed missions</small></article>
        </section>

        <section className="game-section"><div className="game-heading"><div><span>Today</span><h2>Daily challenges</h2></div></div><div className="challenge-grid">{daily.map((item) => <ChallengeCard challenge={item} claiming={claiming === item.key} onClaim={claim} key={item.key} />)}</div></section>
        <section className="game-section"><div className="game-heading"><div><span>This week</span><h2>Weekly missions</h2></div></div><div className="challenge-grid">{weekly.map((item) => <ChallengeCard challenge={item} claiming={claiming === item.key} onClaim={claim} key={item.key} />)}</div></section>

        <section className="game-section"><div className="game-heading"><div><span>Collection</span><h2>Achievement gallery</h2></div></div><div className="badge-gallery">{data.badges.map((badge) => <article className={badge.earned ? "earned" : "locked"} key={badge.key}><b>{badge.icon}</b><strong>{badge.name}</strong><p>{badge.description}</p><small>{badge.earned ? `Earned ${new Date(badge.earnedAt).toLocaleDateString()}` : `${badge.progress}/${badge.target}`}</small></article>)}</div></section>

        <div className="game-columns">
          <section className="game-section"><div className="game-heading"><div><span>Community</span><h2>Internal leaderboard</h2></div></div>{data.leaderboard.length ? <ol className="leaderboard">{data.leaderboard.map((entry) => <li className={entry.isCurrentUser ? "current" : ""} key={entry.userId}><b>#{entry.rank}</b><span><strong>{entry.name}</strong><small>Level {entry.level}</small></span><em>{entry.xp} XP</em></li>)}</ol> : <p className="game-empty">Earn XP to join the leaderboard.</p>}</section>
          <section className="game-section"><div className="game-heading"><div><span>Ledger</span><h2>Reward history</h2></div></div>{data.history.length ? <ul className="reward-history">{data.history.map((item) => <li key={item.id}><span><strong>{item.title}</strong><small>{new Date(item.occurredAt).toLocaleString()}</small></span><b>+{item.xpAwarded} XP</b></li>)}</ul> : <p className="game-empty">Your earned rewards will appear here.</p>}</section>
        </div>

        <details className="xp-rules"><summary>How XP works</summary><div>{Object.entries(data.xpRules).map(([key, value]) => <span key={key}><strong>+{value}</strong>{key.replace(/([A-Z])/g, " $1")}</span>)}</div><p>Level formula: level = floor(total XP / 250) + 1. Challenge rewards are protected by a unique user, challenge, and period record.</p></details>
      </div>
    </main>
  );
}
