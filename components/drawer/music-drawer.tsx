"use client";

import type { MusicPlayerApi } from "../../lib/music/use-music-player";
import {
  CloseIcon,
  MusicNoteIcon,
  NextIcon,
  PlayPauseIcon,
  PlusIcon,
  PrevIcon,
  RepeatAllIcon,
  RepeatOneIcon,
  ShuffleIcon,
  VolumeIcon,
} from "../icons";

type Props = {
  open: boolean;
  music: MusicPlayerApi;
  onClose: () => void;
};

export function MusicDrawer({ open, music, onClose }: Props) {
  return (
    <div className={`drawer ${open ? "show" : ""}`}>
      <div className="drawer-head">
        <div>
          <h3>quiet music</h3>
          <div className="sub">for when we&apos;re together</div>
        </div>
        <button className="close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="drawer-body">
        <button
          type="button"
          className="music-upload-btn"
          onClick={music.openFilePicker}
          disabled={music.uploading}
        >
          <PlusIcon />
          <span>{music.uploading ? "adding…" : "add music from my computer"}</span>
        </button>
        <input
          ref={music.fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg"
          multiple
          hidden
          onChange={music.onFilesPicked}
        />
        {music.tracks.length === 0 ? (
          <div className="music-empty">
            no music yet. tap the button above to add your own.
          </div>
        ) : (
          music.tracks.map((t, i) => (
            <div
              key={t.id}
              className={`track ${i === music.currentTrack ? "playing" : ""}`}
              onClick={() => music.selectTrack(i)}
            >
              <div className="icon">
                <MusicNoteIcon size={12} />
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
                    void music.deleteLocal(t.id);
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
        <VolumeIcon size={13} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={music.volume}
          onChange={(e) => music.setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="volume-slider"
        />
      </div>
      <div className="player-bar">
        <button onClick={music.prev} aria-label="Previous">
          <PrevIcon />
        </button>
        <button className="play" onClick={music.playPause} aria-label="Play/Pause">
          <PlayPauseIcon playing={music.playing && music.currentTrack >= 0} />
        </button>
        <button onClick={music.next} aria-label="Next">
          <NextIcon />
        </button>
        <button
          className="play-mode"
          onClick={music.cyclePlayMode}
          aria-label={`play mode: ${music.playModeLabel}`}
          title={music.playModeLabel}
        >
          {music.playMode === "repeat-one" ? (
            <RepeatOneIcon />
          ) : music.playMode === "shuffle" ? (
            <ShuffleIcon />
          ) : (
            <RepeatAllIcon />
          )}
        </button>
        <span className="t">
          {music.audioError && music.currentTrack >= 0
            ? "this track did not load — pick another or add a new one"
            : music.nowPlayingText}
        </span>
      </div>
    </div>
  );
}
