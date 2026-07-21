import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./LoginForm.css";

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");

        if (loading) {
            return;
        }

        if (!email.trim() || !password.trim()) {
            setError("Please enter both email and password.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            await login({ email: email.trim(), password });
            navigate("/dashboard");
        } catch (requestError) {
            setError(requestError.errors?.[0] || requestError.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-glow login-glow-one" />
            <div className="login-glow login-glow-two" />

            <section className="login-card" aria-labelledby="login-heading">
                <Link className="login-brand" to="/">
                    <span className="login-logo" aria-hidden="true">AI</span>
                    AI Interview Copilot
                </Link>

                <div className="login-heading">
                    <h1 id="login-heading">Welcome back</h1>
                    <p>Login to continue your interview practice</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="form-error">{error}</p>}

                    <button className="login-button" type="submit" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>

                <p className="signup-prompt">
                    Don&apos;t have an account? <Link to="/signup">Sign up</Link>
                </p>
            </section>
        </main>
    );
}

export default LoginForm;
