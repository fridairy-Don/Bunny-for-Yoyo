export type MusicTrack = {
  id: string;
  title: string;
  desc: string;
  dur: string;
  // Either `engine` (built-in Web Audio synth) or `src` (path to an mp3 under public/)
  engine?: "rainy-window" | "music-box" | "starry-night" | "warm-hum";
  src?: string;
};

// Real mp3s dropped into public/assets/music/. Add more by putting files there
// and adding entries below. The last four entries are fallback Web Audio
// synth tracks that always work offline.
export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "mp3-soft",
    title: "soft",
    desc: "gentle lullaby",
    dur: "—",
    src: "/assets/music/soft-Altlasaudio.mp3",
  },
  {
    id: "mp3-leberch-soft",
    title: "quiet keys",
    desc: "soft piano",
    dur: "—",
    src: "/assets/music/leberch-soft-510702.mp3",
  },
  {
    id: "mp3-ukulele",
    title: "ukulele",
    desc: "sunny ukulele",
    dur: "—",
    src: "/assets/music/Ukulele - OYAMANGA.mp3",
  },
  {
    id: "rainy-window",
    title: "rainy window",
    desc: "built-in · soft rain",
    dur: "∞",
    engine: "rainy-window",
  },
  {
    id: "music-box",
    title: "music box",
    desc: "built-in · twinkle lullaby",
    dur: "∞",
    engine: "music-box",
  },
  {
    id: "starry-night",
    title: "starry night",
    desc: "built-in · quiet drone",
    dur: "∞",
    engine: "starry-night",
  },
  {
    id: "warm-hum",
    title: "warm hum",
    desc: "built-in · cozy ambient",
    dur: "∞",
    engine: "warm-hum",
  },
];
