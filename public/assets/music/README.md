# Bunny Companion — Music folder

Drop MP3 files here and the music drawer will play them.

## Default filenames the app is looking for

- `soft-piano.mp3`
- `music-box.mp3`
- `rainy-window.mp3`
- `starry-night.mp3`

Any of these that exist will play. Any that don't will just be skipped silently.

## Where to find kid-friendly music (free, legal, no signup)

- https://pixabay.com/music/search/lullaby/ — lullabies, CC0 (no attribution needed)
- https://pixabay.com/music/search/kids%20piano/ — gentle piano
- https://freepd.com/peaceful.php — public domain peaceful
- https://filmmusic.io — Kevin MacLeod gentle pieces (CC-BY 4.0, credit him if you share publicly)

On any track page, click the **Free Download → MP3** button, then rename the
downloaded file to one of the names above and drop it into this folder.

## Want different track names?

Edit `lib/config/music.ts`. Each entry has `title`, `desc`, `dur`, `src`.
