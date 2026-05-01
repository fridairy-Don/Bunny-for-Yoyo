# Bunny Project — Visual Development Journal

A chronological, screenshot-based record of failed approaches and
iterations across the bunny renderer's evolution. Kept as a visual
journal — not currently referenced by any code.

## Folders

### 01-rig-static-experiments
Early "static rig" approach: using AI-generated PNG layers (idle, blink,
ear-react, happy, speak) overlaid on the canvas. Files cover the M1
through A4 generations of overlay tuning, plus the parts-based rig
(separate ear/eye/mouth PNG parts composited per state). Preview routes
this maps to: `/preview/rig`, `/preview/rig-parts`.

### 02-mesh-pixijs-experiments
Tried using PixiJS to load the static idle PNG as a deformable mesh,
then animate face features (mouth, eyes) by warping mesh vertices.
Preview route: `/preview/rig-mesh`. Approach abandoned — mesh
deformation didn't read as natural movement on a furry character.

### 03-tile-system
Earliest tile-based expression system. Pure thumbnails, no rig logic.
Pre-dates rig + mesh approaches.

### 04-alpha-matting-experiments
The transition from cream-backdrop mp4 video to alpha-channel webm
cutouts. Includes:
- MatAnyone vs other matting tools side-by-side
- ffmpeg despill / chroma key experiments
- Page-background color matching attempts (the failed "match the cream
  to the page" path before alpha matting was viable)
- Final clean side-by-side comparisons

### 05-main-page-evolution
Main `/` page screenshots through the redesign — different scales,
different background-matching strategies, different mask shapes,
listening / speaking / idle state captures.

### 99-misc
Other one-off captures (Photoshop export tests, etc).
