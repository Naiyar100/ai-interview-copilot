import { useState } from "react";
import { Link } from "react-router-dom";
import "./AccountPages.css";

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated successfully for demo mode.");
  };

  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-topbar">
          <Link to="/profile">← Back to Profile</Link>
        </div>

        <span className="account-eyebrow">Security</span>
        <h1>Change Password</h1>
        <p className="account-description">
          Update your password. For now this is demo-only validation.
        </p>

        <form className="account-form" onSubmit={handleSubmit}>
          <label>
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>

          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>

          <label>
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error && <p className="account-error">{error}</p>}
          {message && <p className="account-success">{message}</p>}

          <button type="submit">Update Password</button>
        </form>
      </section>
    </main>
  );
}

export default ChangePassword;