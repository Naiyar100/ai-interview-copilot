import { Component } from "react";

class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("Application render failed", error, info);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-failure" role="alert">
        <div>
          <span>AI</span>
          <h1>Something went wrong</h1>
          <p>The page could not be displayed. Your saved account data is not affected.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
