"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  ONBOARDING_FIELDS,
  ONBOARDING_SECTIONS,
  fieldsToMemoryRows,
} from "../../../lib/parent/onboarding-schema";
import { getPresetMemories, upsertPresetMemory } from "../../../lib/memory/session-store";

type SubmitState = "idle" | "saving" | "saved" | "error";

// Parent onboarding questionnaire. Every answered field becomes a preset
// memory row in Supabase, keyed by the stable field id so that returning
// parents edit in place instead of duplicating. Empty answers are skipped.
//
// On submit → writes all filled answers → sets localStorage flag so the
// child page no longer surfaces the "please set up" nudge.
export default function ParentSetupPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Track what each field looked like when we loaded it so that on submit
  // we can distinguish "parent left this alone" (write back as-is, no
  // template re-wrap) from "parent typed a new answer" (wrap through the
  // field template). Without this, the already-wrapped sentence would get
  // wrapped a second time and produce garbage like "The child you love is
  // named The child you love is named Yoyo…".
  const existingWrappedRef = useRef<Record<string, string>>({});
  const [currentSaved, setCurrentSaved] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void getPresetMemories()
      .then((rows) => {
        if (cancelled) return;
        const saved: Record<string, string> = {};
        for (const row of rows) {
          if (row.id.startsWith("onb-")) saved[row.id] = row.content;
        }
        setCurrentSaved(saved);
        existingWrappedRef.current = saved;
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitState === "saving") return;
    setSubmitState("saving");
    setErrorMsg(null);
    try {
      // For every field where the parent typed a new answer → wrap via
      // field.template. For fields they left blank, we consult existing
      // saved content: if something was already saved, leave it. If not,
      // skip.
      const onlyNew: Record<string, string> = {};
      for (const [id, val] of Object.entries(answers)) {
        const trimmed = (val ?? "").trim();
        if (trimmed.length === 0) continue;
        onlyNew[id] = trimmed;
      }
      const rows = fieldsToMemoryRows(onlyNew);
      for (const row of rows) {
        await upsertPresetMemory(row);
      }
      try {
        window.localStorage.setItem(
          "bunny:parent_onboarding_done",
          String(Date.now()),
        );
      } catch {
        /* quota */
      }
      setSubmitState("saved");
      // Refresh the "currently saved" hints so next submit sees the new
      // wrapped content and doesn't double-wrap.
      void getPresetMemories().then((fresh) => {
        const next: Record<string, string> = {};
        for (const row of fresh) {
          if (row.id.startsWith("onb-")) next[row.id] = row.content;
        }
        setCurrentSaved(next);
        existingWrappedRef.current = next;
        setAnswers({});
      });
    } catch (err) {
      console.error("[bunny] onboarding save failed:", err);
      setSubmitState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div className="parent-page">
      <header className="parent-header">
        <div>
          <h1>Set Bunny up for your child</h1>
          <p>
            Answer as much as you&apos;d like. Skip anything that doesn&apos;t fit.
            You can come back and edit anytime.
          </p>
        </div>
        <Link href="/" className="parent-back">
          ← back to Bunny
        </Link>
      </header>

      <form className="parent-form" onSubmit={onSubmit}>
        {ONBOARDING_SECTIONS.map((section) => {
          const sectionFields = ONBOARDING_FIELDS.filter(
            (f) => f.section === section.key,
          );
          return (
            <section key={section.key} className="parent-section">
              <div className="parent-section-head">
                <h2>{section.title}</h2>
                <p>{section.subtitle}</p>
              </div>
              <div className="parent-section-body">
                {sectionFields.map((field) => {
                  const value = answers[field.id] ?? "";
                  const saved = currentSaved[field.id];
                  return (
                    <label key={field.id} className="parent-field">
                      <span className="parent-field-label">{field.label}</span>
                      {field.multiline ? (
                        <textarea
                          className="parent-field-textarea"
                          placeholder={field.placeholder}
                          value={value}
                          onChange={(e) => onChange(field.id, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <input
                          type="text"
                          className="parent-field-input"
                          placeholder={field.placeholder}
                          value={value}
                          onChange={(e) => onChange(field.id, e.target.value)}
                        />
                      )}
                      {saved ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontStyle: "italic",
                            color: "oklch(0.55 0.02 40)",
                          }}
                        >
                          currently: {saved}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="parent-submit-row">
          <button
            type="submit"
            className="parent-submit"
            disabled={!loaded || submitState === "saving"}
          >
            {submitState === "saving"
              ? "saving…"
              : submitState === "saved"
                ? "saved · Bunny will remember"
                : "save Bunny's memory"}
          </button>
          {errorMsg ? <div className="parent-error">{errorMsg}</div> : null}
          {submitState === "saved" ? (
            <div className="parent-hint">
              You can close this page. Bunny will carry these in the background.
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
