import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ── Mobile optimisations ───────────────────────────────────────────────────
// Injected as a global style tag so they apply universally without
// touching any component. Safe to add/remove without side effects.
const mobileStyles = document.createElement('style');
mobileStyles.textContent = `
  /* Prevent iOS auto-zoom on input focus (requires font-size >= 16px) */
  input, textarea, select {
    font-size: 16px !important;
  }

  /* Remove grey tap highlight flash on iOS */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  /* Remove 300ms tap delay on buttons and interactive elements */
  button, a, [role="button"] {
    touch-action: manipulation;
  }

  /* Prevent accidental text selection during swipe/scroll */
  button, nav, [role="button"], .metric-card-hover, .hide-metric-btn {
    user-select: none;
    -webkit-user-select: none;
  }
`;
document.head.appendChild(mobileStyles);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("CareTrack crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#f5f3f1", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#2a2624", marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: "#7C7270", marginBottom: 24 }}>
              CareTrack encountered an error. Please refresh the page to try again.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#4F6E77", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 13, cursor: "pointer" }}>
              Refresh Page
            </button>
            {process.env.NODE_ENV === "development" && (
              <pre style={{ marginTop: 20, fontSize: 10, color: "#9e3a3a", textAlign: "left", background: "#fdf0f0", padding: 12, borderRadius: 8, overflowX: "auto" }}>
                {String(this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
