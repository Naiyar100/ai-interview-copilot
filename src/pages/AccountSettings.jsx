import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile, updateUserProfile } from "../services/api";
import "./AccountPages.css";

function AccountSettings() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getUserProfile()
      .then((response) => {
        if (active) {
          setName(response.data.user.name);
          setEmail(response.data.user.email);
          updateUser(response.data.user);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Unable to load account settings");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");
    setLoading(true);

    try {
      const response = await updateUserProfile({ name, email });
      updateUser(response.data.user);
      setName(response.data.user.name);
      setEmail(response.data.user.email);
      setStatus("Account settings saved.");
    } catch (requestError) {
      setError(requestError.errors?.[0] || requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-topbar">
          <Link to="/profile">← Back to Profile</Link>
        </div>

        <span className="account-eyebrow">Account Settings</span>
        <h1>Update your account</h1>
        <p className="account-description">
          Manage the name and email connected to your account.
        </p>

        <form className="account-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          {error && <p className="account-error" role="alert">{error}</p>}
          {status && <p className="account-success">{status}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Save Settings"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AccountSettings;
