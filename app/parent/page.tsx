"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getAllMemories,
  getRecentSessionSummaries,
  removeDistilledMemory,
  upsertPresetMemory,
  type DistilledMemory,
  type SessionSummaryCard,
} from "../../lib/memory/session-store";

// Parent dashboard. Surfaces everything a parent can see/edit:
//   - KPIs (total memory counts)
//   - Recent session summaries (what Bunny carried into the next visit)
//   - Full memory list (preset + session distilled) with inline rename
//     for presets + delete for both
//   - One-click JSON export
//
// Intentionally unlisted in navigation — parents reach it via /parent URL.
export default function ParentDashboardPage() {
  const [memories, setMemories] = useState<DistilledMemory[]>([]);
  const [summaries, setSummaries] = useState<SessionSummaryCard[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAllMemories(), getRecentSessionSummaries(12)])
      .then(([mem, sum]) => {
        if (cancelled) return;
        setMemories(mem);
        setSummaries(sum);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const preset = memories.filter((m) => m.source === "preset").length;
    const session = memories.filter((m) => m.source === "session").length;
    return { preset, session, total: preset + session };
  }, [memories]);

  const startEdit = (mem: DistilledMemory) => {
    if (mem.source !== "preset") return;
    setEditing(mem.id);
    setDraft(mem.content);
  };
  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };
  const saveEdit = async (mem: DistilledMemory) => {
    const trimmed = draft.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    try {
      await upsertPresetMemory({ ...mem, content: trimmed });
      setMemories((current) =>
        current.map((m) => (m.id === mem.id ? { ...m, content: trimmed } : m)),
      );
    } catch (err) {
      console.error("[bunny] preset edit failed:", err);
    } finally {
      cancelEdit();
    }
  };

  const onDelete = useCallback(async (mem: DistilledMemory) => {
    if (!window.confirm(`Remove: "${mem.content.slice(0, 90)}"?`)) return;
    await removeDistilledMemory(mem.id);
    setMemories((current) => current.filter((m) => m.id !== mem.id));
  }, []);

  const onExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      memories,
      summaries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bunny-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const presetMemories = memories.filter((m) => m.source === "preset");
  const sessionMemories = memories.filter((m) => m.source === "session");

  return (
    <div className="parent-page">
      <header className="parent-header">
        <div>
          <h1>Parent tools</h1>
          <p>Review what Bunny remembers and carries into each talk.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/parent/setup" className="parent-back">
            edit onboarding
          </Link>
          <Link href="/" className="parent-back">
            ← back to Bunny
          </Link>
        </div>
      </header>

      <div className="parent-kpis">
        <div className="parent-kpi">
          <div className="parent-kpi-label">preset memories</div>
          <div className="parent-kpi-value">{counts.preset}</div>
        </div>
        <div className="parent-kpi">
          <div className="parent-kpi-label">from talks</div>
          <div className="parent-kpi-value">{counts.session}</div>
        </div>
        <div className="parent-kpi">
          <div className="parent-kpi-label">recent summaries</div>
          <div className="parent-kpi-value">{summaries.length}</div>
        </div>
      </div>

      <div className="parent-pane">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Recent summaries</h2>
          <button type="button" className="parent-export" onClick={onExport}>
            export all as JSON
          </button>
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: "oklch(0.55 0.02 40)" }}>loading…</div>
        ) : summaries.length === 0 ? (
          <div style={{ fontSize: 13, color: "oklch(0.55 0.02 40)" }}>
            no summaries yet — Bunny writes one each time you tap save.
          </div>
        ) : (
          summaries.map((s) => (
            <div key={s.id} className="parent-summary-card">
              <div className="parent-summary-card-date">{s.sessionDate}</div>
              <div>{s.summary}</div>
            </div>
          ))
        )}
      </div>

      <div className="parent-pane">
        <h2>Preset memories (editable)</h2>
        {presetMemories.length === 0 ? (
          <div style={{ fontSize: 13, color: "oklch(0.55 0.02 40)" }}>
            no preset memories yet.{" "}
            <Link href="/parent/setup" style={{ color: "var(--rose)" }}>
              fill the onboarding
            </Link>{" "}
            to seed them.
          </div>
        ) : (
          presetMemories.map((mem) => (
            <div key={mem.id} className="parent-memory-row">
              <div className="parent-memory-meta">
                <div>{mem.type.replace("_", " ")}</div>
                <div>{mem.triggerScope ?? "global"}</div>
                <div>★ {mem.importance.toFixed(2)}</div>
              </div>
              <div className="parent-memory-content">
                {editing === mem.id ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="parent-field-textarea"
                      rows={3}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => void saveEdit(mem)}
                        className="parent-submit"
                        style={{ padding: "6px 14px", fontSize: 13 }}
                      >
                        save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="parent-export"
                      >
                        cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {mem.content}
                    <button
                      type="button"
                      onClick={() => startEdit(mem)}
                      className="parent-export"
                      style={{ marginLeft: 8 }}
                    >
                      edit
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                className="parent-memory-delete"
                aria-label="delete"
                onClick={() => void onDelete(mem)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="parent-pane">
        <h2>From saved talks</h2>
        {sessionMemories.length === 0 ? (
          <div style={{ fontSize: 13, color: "oklch(0.55 0.02 40)" }}>
            nothing distilled yet — these appear when you tap save on a talk.
          </div>
        ) : (
          sessionMemories.map((mem) => (
            <div key={mem.id} className="parent-memory-row">
              <div className="parent-memory-meta">
                <div>{mem.type.replace("_", " ")}</div>
                <div>{mem.sessionDate}</div>
                <div>★ {mem.importance.toFixed(2)}</div>
              </div>
              <div className="parent-memory-content">{mem.content}</div>
              <button
                type="button"
                className="parent-memory-delete"
                aria-label="delete"
                onClick={() => void onDelete(mem)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
