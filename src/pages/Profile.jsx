import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile } from "../services/api";
import "./AccountPages.css";

function getInitials(name = "Naiyar Alam") {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getUserProfile()
      .then((response) => {
        if (active) {
          setProfile(response.data.user);
          updateUser(response.data.user);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Unable to load profile");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [updateUser]);

  const name = profile?.name || user.name;
  const joinedDate = profile?.createdAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
        new Date(profile.createdAt),
      )
    : "Unavailable";

  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-topbar">
          <Link to="/dashboard">← Back to Dashboard</Link>
        </div>

        {error && <p className="account-error" role="alert">{error}</p>}

        <div className="profile-hero" aria-busy={loading}>
          <div className="profile-large-avatar" aria-hidden="true">
            {getInitials(name)}
          </div>
          <div>
            <span className="account-eyebrow">My Profile</span>
            <h1>{name}</h1>
            <p>Your personal information for AI Interview Copilot.</p>
          </div>
        </div>

        <div className="account-info-grid">
          <div>
            <span>Name</span>
            <strong>{name}</strong>
          </div>
          <div>
            <span>Account Status</span>
            <strong>Active</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{profile?.email || user.email}</strong>
          </div>
          <div>
            <span>Joined</span>
            <strong>{joinedDate}</strong>
          </div>
        </div>

        <div className="account-actions-row">
          <Link className="account-primary-link" to="/account/settings">
            Edit Account Settings
          </Link>
          <Link className="account-secondary-link" to="/resumes">
            Manage Resumes
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Profile;
