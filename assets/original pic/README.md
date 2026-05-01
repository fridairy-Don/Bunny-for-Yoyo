# Original Source Assets

Working assets — NOT shipped to production. The browser only loads
files under `/public/`. This folder is the asset library / journal
for the bunny development process.

## Folders

### 01-references
Real-world & ChatGPT prompt references used to develop the bunny look.
- `IMG_*.jpg` — phone photos
- `reference_front/left/right.jpg` — three-view references
- `ChatGPT Image …png` — prompt output kept for context

### 02-static-poses-big
High-resolution AI-generated static poses (the `*-big.png` set). These
were the source of truth during the BunnyRig static-overlay era.
Each maps to one expression: idle, blink, ear_react, ear_touch_react,
happy_react, happy_speaking, listening, listening2, speaking,
touch_playful_pose, touch_ticklish.

### 03-original-expressions
Earlier (smaller) version of the expression set, plus the `hero_master`
master originals. Predates the `*-big` regeneration.

### 04-video-loops
The 9 source MP4 video loops generated from the static poses. These
have a cream backdrop baked in. The cutout pipeline (folder 05)
removes the backdrop and produces transparent webms; production now
uses those webms (`/public/assets/bunny/video/*-cutout.webm`).

### 05-cutout-experiments
The full alpha-matting pipeline working files for each clip:
- `*.mp4` — green-screen / source intermediate
- `*-alpha.mp4` — alpha mask channel
- `*-cutout.webm` — final composited alpha-channel webm
The webms here are the same as the ones in `/public/assets/bunny/video/`.

### 06-blue-layer
Blue-tinted variants of `idle-big.png` for chroma-key-style experiments.
Not used in current production.
