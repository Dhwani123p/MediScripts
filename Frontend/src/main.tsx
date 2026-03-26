import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600, margin: "4rem auto" }}>
          <h2 style={{ color: "#c00" }}>Something went wrong</h2>
          <pre style={{ background: "#fee", padding: "1rem", borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {err.message}
            {"\n\n"}
            {err.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "1rem", padding: "0.5rem 1.5rem", background: "#008080", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
