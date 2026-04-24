"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addLocalTrack,
  deleteLocalTrack,
  formatFileSize,
  listLocalTracks,
  type LocalTrack,
} from "../audio/local-library";
import { BUILTIN_TRACKS, type MusicTrack } from "../config/music";

export type PlayableTrack = {
  id: string;
  title: string;
  desc: string;
  src: string;
  builtIn: boolean;
};

export type PlayMode = "repeat-one" | "shuffle" | "sequential";

export type MusicPlayerApi = {
  // derived list the UI renders
  tracks: PlayableTrack[];
  // player state
  currentTrack: number;
  playing: boolean;
  volume: number;
  playMode: PlayMode;
  audioError: boolean;
  uploading: boolean;
  // display helpers
  playModeLabel: string;
  nowPlayingText: string;
  // commands
  selectTrack: (index: number) => void;
  playPause: () => void;
  prev: () => void;
  next: () => void;
  cyclePlayMode: () => void;
  setVolume: (v: number) => void;
  // upload flow
  openFilePicker: () => void;
  onFilesPicked: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  deleteLocal: (id: string) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

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

// Encapsulates the background-music player:
// - state (currentTrack, playing, volume, playMode)
// - a shared <audio> element
// - autostart on first user gesture (browser autoplay gate)
// - upload + delete flow against IndexedDB-backed local library
// - onEnded behaviour per play mode
export function useMusicPlayer(initialVolume = 0.2): MusicPlayerApi {
  const [currentTrack, setCurrentTrack] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [playMode, setPlayMode] = useState<PlayMode>("repeat-one");
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [localTracks, setLocalTracks] = useState<Array<LocalTrack & { objectUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Only touch audio.src when the track truly changes, otherwise every render
  // would reload the file and trip spurious error events.
  const loadedTrackIdRef = useRef<string | null>(null);

  const tracks: PlayableTrack[] = useMemo(
    () => [...BUILTIN_TRACKS.map(builtInAsPlayable), ...localTracks.map(localAsPlayable)],
    [localTracks],
  );

  // single shared <audio> element for mp3 playback
  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = volume;
    audio.addEventListener("play", () => {
      setPlaying(true);
      setAudioError(false);
    });
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("error", () => {
      // Only surface an error if there is actually a src loaded. Setting
      // audio.src to "" or hot-reloading during dev can otherwise trip a
      // spurious "error" that shows "track file not found" with no cause.
      if (audio.src && audio.src !== window.location.href) {
        setPlaying(false);
        setAudioError(true);
      }
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      // Do NOT clear audio.src here — removing src fires an error event on
      // some browsers which then flashes "track file not found" on next mount.
      audioRef.current = null;
      loadedTrackIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // advance behaviour on end depends on the current play mode.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = playMode === "repeat-one";
    const onEnded = () => {
      if (tracks.length === 0) return;
      if (playMode === "repeat-one") {
        audio.currentTime = 0;
        audio.play().catch(() => undefined);
        return;
      }
      if (playMode === "shuffle") {
        if (tracks.length === 1) {
          audio.currentTime = 0;
          audio.play().catch(() => undefined);
          return;
        }
        setCurrentTrack((idx) => {
          let next = idx;
          while (next === idx) {
            next = Math.floor(Math.random() * tracks.length);
          }
          return next;
        });
        return;
      }
      // sequential
      setCurrentTrack((idx) => (idx + 1) % tracks.length);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [tracks.length, playMode]);

  // drive audio output from currentTrack + playing state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack < 0 || currentTrack >= tracks.length || !playing) {
      audio.pause();
      return;
    }
    const track = tracks[currentTrack];
    setAudioError(false);
    if (loadedTrackIdRef.current !== track.id) {
      audio.src = track.src;
      loadedTrackIdRef.current = track.id;
    }
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        setPlaying(false);
        setAudioError(true);
      });
    }
  }, [currentTrack, playing, tracks]);

  // keep volume in sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Start the first track on the user's first interaction with the page.
  // Browsers block silent autoplay, but any click / key / tap within the
  // document unblocks the <audio> element — we latch on that gesture.
  useEffect(() => {
    if (hasAutoStarted) return;
    if (tracks.length === 0) return;
    const start = () => {
      if (hasAutoStarted) return;
      setHasAutoStarted(true);
      setCurrentTrack((idx) => (idx >= 0 ? idx : 0));
      setPlaying(true);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("touchstart", start);
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    window.addEventListener("touchstart", start, { once: true });
    return cleanup;
  }, [hasAutoStarted, tracks.length]);

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
      setLocalTracks((current) => {
        current.forEach((t) => URL.revokeObjectURL(t.objectUrl));
        return current;
      });
    };
  }, []);

  const selectTrack = useCallback((index: number) => {
    setCurrentTrack(index);
    setPlaying(true);
  }, []);

  const playPause = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrack((i) => (i < 0 ? 0 : i));
    setPlaying((p) => {
      // If we're starting fresh from "nothing selected", we also set playing
      // true via the currentTrack setter above. Keep simple toggle here.
      return !p;
    });
  }, [tracks.length]);

  const prev = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrack((i) => (i <= 0 ? tracks.length - 1 : i - 1));
    setPlaying(true);
  }, [tracks.length]);

  const next = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrack((i) => (i + 1) % tracks.length);
    setPlaying(true);
  }, [tracks.length]);

  const cyclePlayMode = useCallback(() => {
    setPlayMode((m) =>
      m === "repeat-one" ? "shuffle" : m === "shuffle" ? "sequential" : "repeat-one",
    );
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesPicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  const deleteLocal = useCallback(
    async (id: string) => {
      const idx = tracks.findIndex((t) => t.id === id);
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
    },
    [currentTrack, tracks],
  );

  const playModeLabel =
    playMode === "repeat-one" ? "repeat one" : playMode === "shuffle" ? "shuffle" : "in order";

  const nowPlayingText =
    currentTrack < 0 || currentTrack >= tracks.length
      ? "nothing playing yet"
      : `${playing ? "♪ " : ""}${tracks[currentTrack].title} · ${tracks[currentTrack].desc}`;

  return {
    tracks,
    currentTrack,
    playing,
    volume,
    playMode,
    audioError,
    uploading,
    playModeLabel,
    nowPlayingText,
    selectTrack,
    playPause,
    prev,
    next,
    cyclePlayMode,
    setVolume,
    openFilePicker,
    onFilesPicked,
    deleteLocal,
    fileInputRef,
  };
}
