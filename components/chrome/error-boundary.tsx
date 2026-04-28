"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Top-level crash guard. If anything below page.tsx throws during render,
// React unmounts the whole tree and would normally leave Yoyo staring at
// a white screen. Instead we show a soft "Bunny is resting" fallback —
// still in-world, non-technical, and a button to reload.
//
// We do NOT try to recover in-place via resetKeys / retry: the conversation
// and audio state are easier to reason about as a fresh page load.
export class BunnyErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[bunny] error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <div className="error-fallback-card">
            <div className="error-fallback-title">Bunny is resting.</div>
            <div className="error-fallback-body">
              Something got tangled up. Let&apos;s wake Bunny up again.
            </div>
            <button
              type="button"
              className="error-fallback-button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
            >
              wake Bunny
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
