"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBunnyCompanion } from "../lib/state/use-bunny-companion";
import { useBunnyConversation } from "../lib/conversation/use-bunny-conversation";
import {
  addDistilledMemories,
  archiveSession,
  findSessionContainingMemory,
  getDistilledMemories,
  getLastSessionCloser,
  removeDistilledMemory,
  saveLastSessionCloser,
  wipeAllMemory,
  type DailySession,
  type DistilledMemory,
  type SessionCloser,
} from "../lib/memory/session-store";
import { BUILTIN_TRACKS, type MusicTrack } from "../lib/config/music";
import {
  addLocalTrack,
  deleteLocalTrack,
  formatFileSize,
  listLocalTracks,
  type LocalTrack,
} from "../lib/audio/local-library";

type PlayableTrack = {
  id: string;
  title: string;
  desc: string;
  src: string;
  builtIn: boolean;
};

type MemoryGroup = {
  dateKey: string;
  dateLabel: string;
  entries: DistilledMemory[];
};

type DisplayedTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type CaptionPhase = "idle" | "entering" | "exiting";

type SaveState = "idle" | "saving" | "saved" | "error";

function builtInAsPlayable(t: MusicTrack): PlayableTrack {
  return { id: t.id, title: t.title, desc: t.desc, src: t.src, builtIn: true };
}

function localAsPlayable(t: LocalTrack & { objectUrl: string }): PlayableTrack {
  return {
    id: t.id,
    title: t.title,
    desc: `${formatFileSize(t.size)} · from your computer`,
    src: t.objectUrl,
    builtIn: false,
  };
}

const TIME_COPY: Record<string, { label: string; warm: string }> = {
  "late night": { label: "late night", warm: "she waited up a little" },
  "morning light": { label: "morning light", warm: "the sun is soft today" },
  midday: { label: "midday", warm: "a little quiet here today" },
  afternoon: { label: "afternoon", warm: "the room is warm" },
  evening: { label: "evening", warm: "the day is winding down" },
  night: { label: "night", warm: "everything feels gentle" },
};

function getTimeKey(hours: number) {
  if (hours < 5) return "late night";
  if (hours < 11) return "morning light";
  if (hours < 14) return "midday";
  if (hours < 18) return "afternoon";
  if (hours < 21) return "evening";
  return "night";
}

function getDayNumber() {
  if (typeof window === "undefined") return 1;
  const key = "bunny:first_seen";
  const now = Date.now();
  const stored = window.localStorage.getItem(key);
  const first = stored ? Number(stored) : now;
  if (!stored) {
    window.localStorage.setItem(key, String(now));
  }
  return Math.max(1, Math.floor((now - first) / 86_400_000) + 1);
}

function dateKeyFromMemory(m: DistilledMemory) {
  if (m.sessionDate) return m.sessionDate;
  return new Date(m.createdAt).toISOString().slice(0, 10);
}

function formatDateLabel(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return "today";
  if (key === yesterday) return "yesterday";
  const [y, m, d] = key.split("-");
  return `${y}.${m}.${d}`;
}

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
    dateLabel: formatDateLabel(key),
    entries: buckets.get(key) ?? [],
  }));
}

export default function Home() {
  const companion = useBunnyCompanion();

  // keep memories in a ref so the conversation hook always sees the latest without recomputing
  const memoriesRef = useRef<DistilledMemory[]>([]);
  const lastCloserRef = useRef<SessionCloser | null>(null);

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
    },
  );

  const { bunnyImage, isListening, handleBunnyPress } = companion;
  const { status, subtitle, turns, error, handleMicClick, clearTurns } = conversation;

  const [asleep, setAsleep] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<"music" | "memory" | null>(null);
  const [memories, setMemories] = useState<DistilledMemory[]>([]);
  const [memoryDetail, setMemoryDetail] = useState<DistilledMemory | null>(null);
  const [memoryDetailSession, setMemoryDetailSession] = useState<DailySession | null>(null);
  const [currentTrack, setCurrentTrack] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.45);
  const [audioError, setAudioError] = useState(false);
  const [localTracks, setLocalTracks] = useState<Array<LocalTrack & { objectUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [memConfirmId, setMemConfirmId] = useState<string | null>(null);

  const TRACKS: PlayableTrack[] = useMemo(() => {
    return [...BUILTIN_TRACKS.map(builtInAsPlayable), ...localTracks.map(localAsPlayable)];
  }, [localTracks]);
  const [motes, setMotes] = useState<
    Array<{ left: string; size: number; duration: number; delay: number; opacity: number }>
  >([]);
  const [timeKey, setTimeKey] = useState<string>("midday");
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [clientReady, setClientReady] = useState(false);
  const [showWipeBanner, setShowWipeBanner] = useState(false);

  // caption orchestration
  const [displayedTurn, setDisplayedTurn] = useState<DisplayedTurn | null>(null);
  const [captionPhase, setCaptionPhase] = useState<CaptionPhase>("idle");
  const displayedTurnRef = useRef<DisplayedTurn | null>(null);

  // session save flow
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    displayedTurnRef.current = displayedTurn;
  }, [displayedTurn]);

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
    return () => {
      cancelled = true;
    };
  }, []);

  // mount-only client setup
  useEffect(() => {
    let cancelled = false;

    // Parent / test reset: navigating with ?wipe=1 clears all bunny storage.
    if (typeof window !== "undefined" && window.location.search.includes("wipe=1")) {
      void wipeAllMemory().then(() => {
        if (cancelled) return;
        const url = new URL(window.location.href);
        url.searchParams.delete("wipe");
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.search ? "?" + url.searchParams.toString() : ""),
        );
        setShowWipeBanner(true);
        window.setTimeout(() => setShowWipeBanner(false), 2800);
      });
    }

    const out: typeof motes = [];
    for (let i = 0; i < 14; i++) {
      const size = 2 + Math.random() * 3.5;
      const duration = 22 + Math.random() * 28;
      out.push({
        left: `${Math.random() * 100}%`,
        size,
        duration,
        delay: -Math.random() * duration,
        opacity: Number((0.35 + Math.random() * 0.45).toFixed(2)),
      });
    }
    setMotes(out);
    setTimeKey(getTimeKey(new Date().getHours()));
    setDayNumber(getDayNumber());
    setClientReady(true);

    void getDistilledMemories()
      .then((list) => {
        if (!cancelled) setMemories(list);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // single shared <audio> element for mp3 playback
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = audioVolume;
    audio.addEventListener("play", () => {
      setPlaying(true);
      setAudioError(false);
    });
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("error", () => {
      setPlaying(false);
      setAudioError(true);
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // advance to next track on end — separate effect so TRACKS closure is fresh
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      if (TRACKS.length === 0) return;
      setCurrentTrack((idx) => (idx + 1) % TRACKS.length);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [TRACKS.length]);

  // drive audio output from currentTrack + playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack < 0 || currentTrack >= TRACKS.length || !playing) {
      audio.pause();
      return;
    }
    const track = TRACKS[currentTrack];
    setAudioError(false);
    if (audio.src !== track.src) {
      audio.src = track.src;
    }
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        setPlaying(false);
        setAudioError(true);
      });
    }
  }, [currentTrack, playing, TRACKS]);

  // keep volume in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = audioVolume;
  }, [audioVolume]);

  // load user-uploaded local library on mount
  useEffect(() => {
    let cancelled = false;
    void listLocalTracks()
      .then((list) => {
        if (!cancelled) setLocalTracks(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      // revoke object URLs on unmount
      setLocalTracks((current) => {
        current.forEach((t) => URL.revokeObjectURL(t.objectUrl));
        return current;
      });
    };
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

  // caption transition orchestration: swap when subtitle id changes
  useEffect(() => {
    if (!subtitle) return; // null doesn't retire the currently displayed turn
    const current = displayedTurnRef.current;
    if (current && current.id === subtitle.id) {
      if (current.text !== subtitle.text) {
        setDisplayedTurn({ id: subtitle.id, role: subtitle.role, text: subtitle.text });
        setCaptionPhase("entering");
      }
      return;
    }

    if (!current) {
      setDisplayedTurn({ id: subtitle.id, role: subtitle.role, text: subtitle.text });
      setCaptionPhase("entering");
      return;
    }

    setCaptionPhase("exiting");
    const handle = window.setTimeout(() => {
      setDisplayedTurn({ id: subtitle.id, role: subtitle.role, text: subtitle.text });
      setCaptionPhase("entering");
    }, 560);
    return () => window.clearTimeout(handle);
  }, [subtitle?.id, subtitle?.text, subtitle?.role]);

  // when the user taps mic, retire the currently displayed turn so the bunny's
  // last words fly off toward the chatlog immediately (not after STT completes)
  useEffect(() => {
    if (status !== "listening") return;
    if (!displayedTurnRef.current) return;
    setCaptionPhase("exiting");
    const handle = window.setTimeout(() => {
      setDisplayedTurn(null);
      setCaptionPhase("idle");
    }, 560);
    return () => window.clearTimeout(handle);
  }, [status]);

  // status label
  const statusLabel = useMemo(() => {
    if (asleep) return "Bunny is resting";
    if (status === "listening") return "Bunny is listening";
    if (status === "transcribing" || status === "thinking") return "Bunny is thinking";
    if (status === "speaking") return "Bunny is speaking";
    if (status === "error") return "Bunny got a little tangled";
    return "Bunny is here";
  }, [status, asleep]);

  // child-friendly error caption
  const errorCaption = useMemo(() => {
    if (!error) return null;
    if (error === "permission_denied") {
      return "I can't hear you yet — please let the little mic listen.";
    }
    if (error === "silent_audio" || error === "empty_audio") {
      return "Hmm, I didn't catch that. Try saying it a little louder.";
    }
    if (error === "unsupported") {
      return "This place doesn't have ears. Try a different browser.";
    }
    return "Something got tangled. Let's try one more time.";
  }, [error]);

  // caption text + role (error overrides displayed turn)
  const captionText = errorCaption ?? displayedTurn?.text ?? "";
  const captionRole: "assistant" | "user" = errorCaption ? "assistant" : (displayedTurn?.role ?? "assistant");
  const captionKey = errorCaption ? `err-${errorCaption}` : displayedTurn?.id ?? "empty";
  const captionClassName = ["caption"];
  if (captionPhase === "exiting" && !errorCaption) captionClassName.push("exiting");
  if (captionRole === "user") captionClassName.push("is-user");

  const captionWords = useMemo(() => captionText.split(" ").filter(Boolean), [captionText]);

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

  // time copy
  const timeLabel = TIME_COPY[timeKey]?.label ?? "midday";
  const timeWarm = TIME_COPY[timeKey]?.warm ?? "a little quiet here today";

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
    setDisplayedTurn(null);
    setCaptionPhase("idle");
    setSaveState("idle");
  };

  const saveButtonEnabled = turns.filter((t) => t.role !== "system").length >= 2;

  const onSaveSession = async () => {
    if (saveState === "saving") return;
    if (!saveButtonEnabled) return;
    setSaveState("saving");
    try {
      const payloadTurns = turns.filter((t) => t.role !== "system");
      const existingMemoryContents = memoriesRef.current.map((m) => m.content);
      const response = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: payloadTurns, existingMemories: existingMemoryContents }),
      });
      const data = await response.json();
      const extracted: Array<{ type: string; content: string; importance: number }> = data?.memories ?? [];

      const now = Date.now();
      const todayStr = new Date().toISOString().slice(0, 10);
      const candidateMemories: DistilledMemory[] = extracted.map((entry, i) => ({
        id: `mem-${now}-${i}`,
        createdAt: now,
        type: (entry.type as DistilledMemory["type"]) ?? "special_memory",
        content: entry.content,
        importance: entry.importance ?? 0.7,
        source: "session",
        sessionDate: todayStr,
      }));

      const accepted = await addDistilledMemories(candidateMemories);
      if (accepted.length) {
        setMemories((current) => [...accepted, ...current]);
      }
      await archiveSession(payloadTurns, accepted.map((m) => m.id));

      // capture the tail of this session so the next opening can continue from it
      await saveLastSessionCloser(payloadTurns, 4);
      lastCloserRef.current = await getLastSessionCloser();

      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2400);
    } catch {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2400);
    }
  };

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

  const onPlayPause = () => {
    if (TRACKS.length === 0) return;
    if (currentTrack < 0) {
      setCurrentTrack(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const onPrevTrack = () => {
    if (TRACKS.length === 0) return;
    setCurrentTrack((i) => (i <= 0 ? TRACKS.length - 1 : i - 1));
    setPlaying(true);
  };

  const onNextTrack = () => {
    if (TRACKS.length === 0) return;
    setCurrentTrack((i) => (i + 1) % TRACKS.length);
    setPlaying(true);
  };

  const nowPlayingText =
    currentTrack < 0 || currentTrack >= TRACKS.length
      ? "nothing playing yet"
      : `${playing ? "♪ " : ""}${TRACKS[currentTrack].title} · ${TRACKS[currentTrack].desc}`;

  const onOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg)$/i.test(file.name)) continue;
        await addLocalTrack(file);
      }
      const fresh = await listLocalTracks();
      setLocalTracks((old) => {
        old.forEach((t) => URL.revokeObjectURL(t.objectUrl));
        return fresh;
      });
    } catch (err) {
      console.warn("[bunny] upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDeleteLocalTrack = async (id: string) => {
    const idx = TRACKS.findIndex((t) => t.id === id);
    if (idx === currentTrack) {
      setPlaying(false);
      setCurrentTrack(-1);
    }
    await deleteLocalTrack(id);
    setLocalTracks((old) => {
      const removed = old.find((t) => t.id === id);
      if (removed) URL.revokeObjectURL(removed.objectUrl);
      return old.filter((t) => t.id !== id);
    });
  };

  const memoryGroups = useMemo(() => groupMemoriesByDate(memories), [memories]);

  const saveLabel = (() => {
    if (saveState === "saving") return "saving…";
    if (saveState === "saved") return "saved";
    if (saveState === "error") return "try again";
    return "save to memory";
  })();

  return (
    <>
      <div className="world" />
      <div className="motes">
        {motes.map((m, i) => (
          <div
            key={i}
            className="mote"
            style={{
              left: m.left,
              width: `${m.size}px`,
              height: `${m.size}px`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              opacity: m.opacity,
            }}
          />
        ))}
      </div>
      <div className="vignette" />
      <div className="grain" />

      <header className="chrome">
        <div className="wordmark">
          <span className="dot" />
          <span className="status">{statusLabel}</span>
        </div>
        <div className="meta">
          <div className="meta-line">
            <span>{timeLabel}</span>
            <span className="sep" />
            <span>day {clientReady ? dayNumber : 1}</span>
          </div>
          <div className="meta-sub">{timeWarm}</div>
        </div>
      </header>

      <aside className={`chatlog ${hasChat ? "show" : ""}`} aria-label="Conversation">
        <div className="chatlog-head">
          <span>today · our talk</span>
          <span className="actions">
            <button
              className={`save-session ${saveState === "saved" ? "saved" : ""}`}
              onClick={onSaveSession}
              disabled={!saveButtonEnabled || saveState === "saving"}
              title="save today's talk to memory"
            >
              <svg
                viewBox="0 0 24 24"
                fill={saveState === "saved" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>{saveLabel}</span>
            </button>
            <button className="clear" onClick={onClearChat} title="Clear">
              clear
            </button>
          </span>
        </div>
        <ChatLogScroll turns={chatTurns} />
      </aside>

      <main className="stage">
        <div className="greeting">
          <div className="hi">Hi, Yoyo.</div>
        </div>

        <div className="bunny-wrap">
          <div className="bunny-frame">
            <div className="bunny-halo" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="bunny"
              src={bunnyImage}
              alt="Bunny"
              draggable={false}
              onPointerDown={handleBunnyPress}
            />
            <div className="shadow" />
          </div>
        </div>

        <div className="caption-zone">
          <div
            className={captionClassName.join(" ")}
            style={{ opacity: captionText ? 1 : 0 }}
            key={captionKey}
          >
            {captionWords.map((word, i) => (
              <span
                key={`${captionKey}-${i}`}
                className="word"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {word + " "}
              </span>
            ))}
          </div>
        </div>

        <div className="dock">
          <button
            className={`mic ${isListening ? "listening" : ""}`}
            aria-label="Talk to Bunny"
            onClick={onClickMic}
          >
            <span className="ring" />
            <span className="ring" />
            <span className="ring" />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </button>
          <div className={`wave ${isListening ? "on" : ""}`}>
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </main>

      <div className="corner">
        <button
          className={openDrawer === "music" ? "active" : ""}
          aria-label="Music"
          onClick={() => toggleDrawer("music")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>music</span>
        </button>
        <button
          className={openDrawer === "memory" ? "active" : ""}
          aria-label="Memory"
          onClick={() => toggleDrawer("memory")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>memory</span>
        </button>
        <button
          className={`icon-only ${asleep ? "active" : ""}`}
          aria-label="Say goodnight"
          title="say goodnight"
          onClick={onToggleSleep}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>
      </div>

      <div className={`drawer ${openDrawer === "music" ? "show" : ""}`}>
        <div className="drawer-head">
          <div>
            <h3>quiet music</h3>
            <div className="sub">for when we&apos;re together</div>
          </div>
          <button className="close" onClick={() => setOpenDrawer(null)} aria-label="Close">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="drawer-body">
          <button
            type="button"
            className="music-upload-btn"
            onClick={onOpenFilePicker}
            disabled={uploading}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{uploading ? "adding…" : "add music from my computer"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg"
            multiple
            hidden
            onChange={onFilesPicked}
          />
          {TRACKS.length === 0 ? (
            <div className="music-empty">
              no music yet. tap the button above to add your own.
            </div>
          ) : (
            TRACKS.map((t, i) => (
              <div
                key={t.id}
                className={`track ${i === currentTrack ? "playing" : ""}`}
                onClick={() => {
                  setCurrentTrack(i);
                  setPlaying(true);
                }}
              >
                <div className="icon">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div className="meta-tx">
                  <div className="title">{t.title}</div>
                  <div className="desc">{t.desc}</div>
                </div>
                {!t.builtIn ? (
                  <button
                    type="button"
                    className="track-delete"
                    aria-label="remove from library"
                    title="remove from library"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteLocalTrack(t.id);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="volume-row">
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="M15.5 8.5a4 4 0 0 1 0 7" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audioVolume}
            onChange={(e) => setAudioVolume(Number(e.target.value))}
            aria-label="Volume"
            className="volume-slider"
          />
        </div>
        <div className="player-bar">
          <button onClick={onPrevTrack} aria-label="Previous">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M19 20 9 12l10-8zM5 4v16" />
            </svg>
          </button>
          <button className="play" onClick={onPlayPause} aria-label="Play/Pause">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              {playing && currentTrack >= 0 ? (
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              ) : (
                <path d="M6 4v16l14-8z" />
              )}
            </svg>
          </button>
          <button onClick={onNextTrack} aria-label="Next">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 4l10 8-10 8zM19 4v16" />
            </svg>
          </button>
          <span className="t">
            {audioError && currentTrack >= 0
              ? "track file not found — add mp3s to public/assets/music/"
              : nowPlayingText}
          </span>
        </div>
      </div>

      <div className={`drawer ${openDrawer === "memory" ? "show" : ""}`}>
        <div className="drawer-head">
          <div>
            <h3>our memories</h3>
            <div className="sub">{memories.length} kept</div>
          </div>
          <button
            className="close"
            onClick={() => {
              setOpenDrawer(null);
              closeMemoryDetail();
            }}
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="drawer-body">
          {memoryDetail ? (
            <MemoryDetailView
              memory={memoryDetail}
              session={memoryDetailSession}
              onBack={closeMemoryDetail}
            />
          ) : (
            <>
              {memories.length === 0 ? (
                <div className="mem-empty">
                  nothing saved yet.
                  <br />
                  tap <em>save to memory</em> after a talk.
                </div>
              ) : (
                memoryGroups.map((group) => (
                  <div key={group.dateKey}>
                    <div className="mem-day">{group.dateLabel}</div>
                    {group.entries.map((mem) => {
                      const confirming = memConfirmId === mem.id;
                      return (
                        <div
                          key={mem.id}
                          className={`mem-row ${confirming ? "confirming" : ""}`}
                        >
                          <span className="pin" />
                          <div className="date">{mem.type.replace("_", " ")}</div>
                          <button
                            type="button"
                            className="mem-delete"
                            aria-label="remove this memory"
                            title="remove this memory"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemConfirmId(confirming ? null : mem.id);
                            }}
                          >
                            {confirming ? "×" : "×"}
                          </button>
                          <div
                            className="txt"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (confirming) return;
                              openMemoryDetail(mem);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!confirming) openMemoryDetail(mem);
                              }
                            }}
                          >
                            {mem.content}
                          </div>
                          {confirming ? (
                            <div className="mem-confirm">
                              <span>remove this memory only?</span>
                              <div className="mem-confirm-actions">
                                <button
                                  type="button"
                                  className="mem-confirm-yes"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMemory(mem.id);
                                  }}
                                >
                                  remove
                                </button>
                                <button
                                  type="button"
                                  className="mem-confirm-no"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMemConfirmId(null);
                                  }}
                                >
                                  keep
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="arrow">open →</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div className="parent-tools">
                <div className="parent-tools-label">parent tools</div>
                <div className="parent-tools-hint">
                  to remove one entry, hover the memory card and tap ×.
                </div>
                {resetConfirming ? (
                  <div className="parent-tools-confirm">
                    <span>this wipes EVERY memory and every past session. only use before handing Bunny to Yoyo for a fresh start.</span>
                    <div className="parent-tools-actions">
                      <button
                        className="parent-reset confirm"
                        onClick={async () => {
                          setResetConfirming(false);
                          try {
                            await wipeAllMemory();
                          } catch (err) {
                            console.warn("[bunny] wipe failed:", err);
                          }
                          setMemories([]);
                          lastCloserRef.current = null;
                          clearTurns();
                          setDisplayedTurn(null);
                          setCaptionPhase("idle");
                          setShowWipeBanner(true);
                          window.setTimeout(() => setShowWipeBanner(false), 2800);
                        }}
                      >
                        yes, wipe everything
                      </button>
                      <button
                        className="parent-reset cancel"
                        onClick={() => setResetConfirming(false)}
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="parent-reset"
                    onClick={() => setResetConfirming(true)}
                  >
                    wipe every memory (factory reset)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showWipeBanner ? <div className="reset-banner">memory cleared · fresh start</div> : null}
    </>
  );
}

function MemoryDetailView({
  memory,
  session,
  onBack,
}: {
  memory: DistilledMemory;
  session: DailySession | null;
  onBack: () => void;
}) {
  const turns = (session?.turns ?? []).filter((t) => t.role !== "system");
  return (
    <div className="mem-detail">
      <div className="mem-detail-head">
        <button className="back" onClick={onBack}>
          <span aria-hidden="true">←</span> back
        </button>
        <div className="date">
          {formatDateLabel(dateKeyFromMemory(memory))} · {memory.type.replace("_", " ")}
        </div>
        <div className="phrase">{memory.content}</div>
      </div>
      <div className="mem-detail-body">
        {turns.length === 0 ? (
          <div className="mem-detail-empty">
            the full talk was not kept alongside this memory.
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`mem-detail-line ${turn.role === "user" ? "user" : ""}`}
            >
              <span className="who">{turn.role === "user" ? "Yoyo" : "Bunny"}</span>
              {turn.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatLogScroll({
  turns,
}: {
  turns: { id: string; role: "user" | "assistant" | "system"; text: string }[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  return (
    <div className="chatlog-scroll" ref={scrollRef}>
      {turns.map((turn) => {
        if (turn.role === "system") return null;
        const who = turn.role === "assistant" ? "Bunny" : "You";
        return (
          <div
            key={turn.id}
            className={["bubble", turn.role === "user" ? "user" : ""].filter(Boolean).join(" ")}
          >
            <span className="who">{who}</span>
            {turn.text}
          </div>
        );
      })}
    </div>
  );
}
