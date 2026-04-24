"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  // Pre-fill from existing preset rows so re-entry shows the parent what
  // they already saved and lets them edit.
  useEffect(() => {
    let cancelled = false;
    void getPresetMemories()
      .then((rows) => {
        if (cancelled) return;
        const prefill: Record<string, string> = {};
        for (const row of rows) {
          // Answers are wrapped through field.template at submit time, so
          // we can't reverse them 1:1. For edit UX we just show the full
          // stored content as the seed value and let the parent re-type.
          // Field ids starting with 'onb-' came from this form.
          if (row.id.startsWith("onb-")) {
            prefill[row.id] = row.content;
          }
        }
        setAnswers(prefill);
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
      const rows = fieldsToMemoryRows(answers);
      // write sequentially so that a 500 on row 3 doesn't leave rows 1-2
      // in an ambiguous state — each upsert is atomic for its own id.
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
