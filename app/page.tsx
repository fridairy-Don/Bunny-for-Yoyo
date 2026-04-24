"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBunnyCompanion } from "../lib/state/use-bunny-companion";
import { useBunnyConversation } from "../lib/conversation/use-bunny-conversation";
import {
  findSessionContainingMemory,
  getDistilledMemories,
  getLastSessionCloser,
  getRecentSummaries,
  removeDistilledMemory,
  seedPresetsIfMissing,
  wipeAllMemory,
  type DailySession,
  type DistilledMemory,
  type SessionCloser,
} from "../lib/memory/session-store";
import { defaultPresetMemoryRows } from "../lib/memory/preset-memory";
import { useSessionSave } from "../lib/memory/use-session-save";
import { useMusicPlayer } from "../lib/music/use-music-player";
import { useCaptionStream } from "../lib/conversation/use-caption-stream";
import { getChildFriendlyErrorCaption } from "../lib/conversation/error-caption";
import { useAmbient } from "../lib/ambient/use-ambient";
import { MusicDrawer } from "../components/drawer/music-drawer";
import {
  MemoryDrawer,
  type MemoryGroup,
} from "../components/drawer/memory-drawer";
import { dateKeyFromMemory } from "../components/memory/memory-detail";
import { Ambient } from "../components/chrome/ambient";
import { HeaderChrome } from "../components/chrome/header-chrome";
import { CornerControls } from "../components/corner/corner-controls";
import { BunnyStage } from "../components/stage/bunny-stage";
import { CaptionZone } from "../components/stage/caption-zone";
import { ChatlogPanel } from "../components/chatlog/chatlog-panel";

function groupMemoriesByDate(memories: DistilledMemory[]): MemoryGroup[] {
  const buckets = new Map<string, DistilledMemory[]>();
  for (const mem of memories) {
    const key = dateKeyFromMemory(mem);
    const bucket = buckets.get(key) ?? [];
    bucket.push(mem);
    buckets.set(key, bucket);
  }
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => b.localeCompare(a));
  return sortedKeys.map((key) => ({
    dateKey: key,
    dateLabel: formatDateLabelFromKey(key),
    entries: buckets.get(key) ?? [],
  }));
}

function formatDateLabelFromKey(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return "today";
  if (key === yesterday) return "yesterday";
  const [y, m, d] = key.split("-");
  return `${y}.${m}.${d}`;
}

export default function Home() {
  const companion = useBunnyCompanion();

  // keep memories in a ref so the conversation hook always sees the latest without recomputing
  const memoriesRef = useRef<DistilledMemory[]>([]);
  const lastCloserRef = useRef<SessionCloser | null>(null);

  const recentSummariesRef = useRef<string[]>([]);

  const conversation = useBunnyConversation(
    {
      beginListening: companion.beginListening,
      startSpeaking: companion.startSpeaking,
      returnToIdle: companion.returnToIdle,
      showMomentaryReaction: companion.showMomentaryReaction,
    },
    {
      getMemories: () => memoriesRef.current.map((m) => m.content),
      getLastCloser: () => lastCloserRef.current,
      getRecentSummaries: () => recentSummariesRef.current,
    },
  );

  const { bunnyImage, isListening, handleBunnyPress } = companion;
  const {
    status,
    subtitle,
    turns,
    error,
    handleMicClick,
    clearTurns,
    activeWordIndex,
    triggerAutoOpener,
  } = conversation;

  const [asleep, setAsleep] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<"music" | "memory" | null>(null);
  const [memories, setMemories] = useState<DistilledMemory[]>([]);
  const [memoryDetail, setMemoryDetail] = useState<DistilledMemory | null>(null);
  const [memoryDetailSession, setMemoryDetailSession] = useState<DailySession | null>(null);
  const music = useMusicPlayer(0.2);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [memConfirmId, setMemConfirmId] = useState<string | null>(null);

  const { motes, timeLabel, timeWarm, dayNumber, clientReady } = useAmbient();
  const [showWipeBanner, setShowWipeBanner] = useState(false);

  // caption orchestration — 3-phase transition + listener-triggered retirement
  const { displayedTurn, captionPhase, clear: clearCaption } = useCaptionStream(
    subtitle,
    status,
  );

  // session save flow — distill + archive + refresh last-closer + summary
  const sessionSave = useSessionSave({
    getTurns: () => turns,
    getExistingMemories: () => memoriesRef.current.map((m) => m.content),
    onAccepted: (accepted) => setMemories((current) => [...accepted, ...current]),
    onCloserUpdated: (closer) => {
      lastCloserRef.current = closer;
    },
    onSummariesUpdated: (summaries) => {
      recentSummariesRef.current = summaries;
    },
  });

  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    void getLastSessionCloser()
      .then((closer) => {
        if (cancelled) return;
        lastCloserRef.current = closer;
      })
      .catch(() => undefined);
    void getRecentSummaries(3)
      .then((summaries) => {
        if (cancelled) return;
        recentSummariesRef.current = summaries;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // mount-only: optional ?wipe=1 reset + load persisted memories + first-launch drama
  useEffect(() => {
    let cancelled = false;

    // Parent / test reset: navigating with ?wipe=1 clears all bunny storage.
    const doWipe =
      typeof window !== "undefined" && window.location.search.includes("wipe=1");
    const wipePromise = doWipe
      ? wipeAllMemory().then(() => {
          if (cancelled) return;
          const url = new URL(window.location.href);
          url.searchParams.delete("wipe");
          window.history.replaceState(
            {},
            "",
            url.pathname + (url.search ? "?" + url.searchParams.toString() : ""),
          );
          // Wiping also clears the first-launch done flag so the wake-up
          // drama plays again — useful for testing and for handing a fresh
          // Bunny to Yoyo.
          try {
            window.localStorage.removeItem("bunny:first_launch_done");
          } catch {
            // quota / privacy mode
          }
          setShowWipeBanner(true);
          window.setTimeout(() => setShowWipeBanner(false), 2800);
        })
      : Promise.resolve();

    void wipePromise
      .then(() => seedPresetsIfMissing(defaultPresetMemoryRows()))
      .then(() => getDistilledMemories())
      .then((list) => {
        if (cancelled) return;
        setMemories(list);
        // First-launch detection: nothing persisted AND flag not set.
        // Runs after wipe so `?wipe=1` correctly retriggers the drama.
        const alreadyWoken =
          typeof window !== "undefined"
            ? window.localStorage.getItem("bunny:first_launch_done")
            : "1";
        if (!alreadyWoken && list.length === 0 && lastCloserRef.current === null) {
          // Pause ~1.5s so Yoyo has a beat to look at Bunny before it stirs.
          window.setTimeout(() => {
            if (cancelled) return;
            void triggerAutoOpener({ firstLaunch: true })
              .catch(() => undefined)
              .finally(() => {
                try {
                  window.localStorage.setItem(
                    "bunny:first_launch_done",
                    String(Date.now()),
                  );
                } catch {
                  // quota / privacy mode
                }
              });
          }, 1500);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // triggerAutoOpener identity is stable per hook instance; omitting it
    // from deps avoids re-running this mount-only effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // body class for sleep
  useEffect(() => {
    if (asleep) {
      document.body.classList.add("sleeping");
    } else {
      document.body.classList.remove("sleeping");
    }
    return () => document.body.classList.remove("sleeping");
  }, [asleep]);

  // status label
  const statusLabel = useMemo(() => {
    if (asleep) return "Bunny is resting";
    if (status === "listening") return "Bunny is listening";
    if (status === "transcribing" || status === "thinking") return "Bunny is thinking";
    if (status === "speaking") return "Bunny is speaking";
    if (status === "error") return "Bunny got a little tangled";
    return "Bunny is here";
  }, [status, asleep]);

  // child-friendly error caption (see error-caption.ts for mapping rules)
  const errorCaption = useMemo(() => getChildFriendlyErrorCaption(error), [error]);

  // caption text + role (error overrides displayed turn)
  const captionText = errorCaption ?? displayedTurn?.text ?? "";
  const captionRole: "assistant" | "user" = errorCaption ? "assistant" : (displayedTurn?.role ?? "assistant");
  const captionKey = errorCaption ? `err-${errorCaption}` : displayedTurn?.id ?? "empty";
  // Karaoke mode lights up one word at a time as Bunny actually speaks it.
  // We only engage it while the assistant reply is live (status === speaking)
  // AND the currently displayed turn is that assistant turn — so user
  // transcripts and old captions keep the calm static look.
  const karaokeActive =
    !errorCaption &&
    captionRole === "assistant" &&
    status === "speaking" &&
    displayedTurn?.id === subtitle?.id;

  // chatlog turns: exclude both the turn currently hosted in caption AND the
  // turn that just arrived as `subtitle` (which is about to become displayed).
  // Without the subtitle filter, a new reply briefly appears in the log
  // during the 560ms exit animation, then vanishes when displayedTurn swaps.
  const chatTurns = useMemo(() => {
    return turns.filter((turn) => {
      if (turn.role === "system") return false;
      if (turn.id === displayedTurn?.id) return false;
      if (turn.id === subtitle?.id) return false;
      return true;
    });
  }, [turns, displayedTurn?.id, subtitle?.id]);

  const hasChat = chatTurns.length > 0 || (displayedTurn !== null && turns.length > 1);

  // handlers
  const onClickMic = () => {
    if (asleep) return;
    handleMicClick();
  };

  const onToggleSleep = () => {
    if (asleep) {
      setAsleep(false);
    } else {
      setAsleep(true);
      setOpenDrawer(null);
    }
  };

  const toggleDrawer = (which: "music" | "memory") => {
    setOpenDrawer((current) => (current === which ? null : which));
  };

  const onClearChat = () => {
    clearTurns();
    clearCaption();
    sessionSave.reset();
  };

  const saveButtonEnabled = turns.filter((t) => t.role !== "system").length >= 2;

  const openMemoryDetail = useCallback(async (mem: DistilledMemory) => {
    const dateKey = dateKeyFromMemory(mem);
    setMemoryDetail(mem);
    setMemoryDetailSession(null);
    try {
      const session = await findSessionContainingMemory(dateKey, mem.id);
      setMemoryDetailSession(session);
    } catch {
      // session archive not available — detail view shows memory text only
    }
  }, []);

  const closeMemoryDetail = useCallback(() => {
    setMemoryDetail(null);
    setMemoryDetailSession(null);
  }, []);

  const handleDeleteMemory = useCallback(async (id: string) => {
    setMemories((current) => current.filter((m) => m.id !== id));
    setMemConfirmId(null);
    try {
      await removeDistilledMemory(id);
    } catch (err) {
      console.warn("[bunny] remove failed:", err);
    }
  }, []);

  const handleFactoryReset = useCallback(async () => {
    setResetConfirming(false);
    try {
      await wipeAllMemory();
    } catch (err) {
      console.warn("[bunny] wipe failed:", err);
    }
    try {
      // Replaying the first-launch drama is part of "fresh start" — without
      // this clear, a parent resetting Bunny for a new child would still
      // miss the wake-up moment next load.
      window.localStorage.removeItem("bunny:first_launch_done");
      window.localStorage.removeItem("bunny:first_seen");
    } catch {
      // quota / privacy mode
    }
    setMemories([]);
    lastCloserRef.current = null;
    clearTurns();
    clearCaption();
    setShowWipeBanner(true);
    window.setTimeout(() => setShowWipeBanner(false), 2800);
  }, [clearTurns, clearCaption]);

  const memoryGroups = useMemo(() => groupMemoriesByDate(memories), [memories]);

  const captionBlock = (
    <CaptionZone
      text={captionText}
      role={captionRole}
      keyId={captionKey}
      phase={captionPhase}
      karaokeActive={karaokeActive}
      activeWordIndex={activeWordIndex}
      hasError={!!errorCaption}
    />
  );

  return (
    <>
      <Ambient motes={motes} />

      <HeaderChrome
        statusLabel={statusLabel}
        timeLabel={timeLabel}
        timeWarm={timeWarm}
        dayNumber={dayNumber}
        clientReady={clientReady}
      />

      <ChatlogPanel
        hasChat={hasChat}
        turns={chatTurns}
        saveState={sessionSave.saveState}
        saveEnabled={saveButtonEnabled}
        saveLabel={sessionSave.label}
        onSave={sessionSave.save}
        onClear={onClearChat}
      />

      <BunnyStage
        bunnyImage={bunnyImage}
        isListening={isListening}
        onBunnyPress={handleBunnyPress}
        onMicClick={onClickMic}
        caption={captionBlock}
      />

      <CornerControls
        openDrawer={openDrawer}
        asleep={asleep}
        onToggleDrawer={toggleDrawer}
        onToggleSleep={onToggleSleep}
      />

      <MusicDrawer
        open={openDrawer === "music"}
        music={music}
        onClose={() => setOpenDrawer(null)}
      />

      <MemoryDrawer
        open={openDrawer === "memory"}
        memories={memories}
        memoryGroups={memoryGroups}
        memoryDetail={memoryDetail}
        memoryDetailSession={memoryDetailSession}
        memConfirmId={memConfirmId}
        resetConfirming={resetConfirming}
        onClose={() => setOpenDrawer(null)}
        onOpenDetail={openMemoryDetail}
        onCloseDetail={closeMemoryDetail}
        onRequestDelete={setMemConfirmId}
        onConfirmDelete={handleDeleteMemory}
        onRequestReset={() => setResetConfirming(true)}
        onCancelReset={() => setResetConfirming(false)}
        onConfirmReset={handleFactoryReset}
      />

      {showWipeBanner ? <div className="reset-banner">memory cleared · fresh start</div> : null}
    </>
  );
}

