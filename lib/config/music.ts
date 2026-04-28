export type MusicTrack = {
  id: string;
  title: string;
  desc: string;
  dur: string;
  src: string;
  builtIn: true;
};

// Bundled tracks that ship with the project (files in public/assets/music/).
// The app treats these as read-only defaults — the user can't delete them
// from the UI, only add more via upload.
export const BUILTIN_TRACKS: MusicTrack[] = [
  {
    id: "builtin-soft",
    title: "soft",
    desc: "gentle lullaby",
    dur: "—",
    src: "/assets/music/soft-Altlasaudio.mp3",
    builtIn: true,
  },
  {
    id: "builtin-quiet-keys",
    title: "quiet keys",
    desc: "soft piano",
    dur: "—",
    src: "/assets/music/leberch-soft-510702.mp3",
    builtIn: true,
  },
  {
    id: "builtin-ukulele",
    title: "ukulele",
    desc: "sunny ukulele",
    dur: "—",
    src: "/assets/music/Ukulele - OYAMANGA.mp3",
    builtIn: true,
  },
];
