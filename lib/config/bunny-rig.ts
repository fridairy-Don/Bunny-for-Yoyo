// Bunny rig — describes how the dissected vector parts assemble into a
// faithful reproduction of `bunny_idle.png`.
//
// Coordinate system: a virtual 934×1040 canvas (matches the original idle
// image's pixel dimensions). Each part declares its CENTER point (cx, cy)
// AND its rendered width/height in canvas pixels (NOT the asset's native
// pixel size — the source sheet was drawn at ~1.4× the idle bunny scale,
// so we explicitly size each part to match the idle composition).
//
// All parts are transparent PNGs in /public/assets/bunny/bunny_parts/.

export const RIG_CANVAS = { width: 934, height: 1040 } as const;

const PARTS_BASE = "/assets/bunny/bunny_parts";

export type PartId =
  | "ear_left_idle"
  | "ear_right_idle"
  | "ear_pose_top_left"
  | "ear_pose_top_right"
  | "ear_pose_middle_left"
  | "ear_pose_middle_right"
  | "ear_pose_bottom_left"
  | "ear_pose_bottom_right"
  | "body_legs"
  | "head"
  | "arm_left"
  | "arm_right"
  | "cheek_swirl_left"
  | "cheek_swirl_right"
  | "eye_left"
  | "eye_right"
  | "blink_left"
  | "blink_right"
  | "mouth_closed"
  | "mouth_small_open"
  | "mouth_smile_tongue"
  | "mouth_big_open"
  | "flower";

export type PartSpec = {
  id: PartId;
  src: string;
  /** Rendered width in canvas pixels (already scaled to idle proportions). */
  width: number;
  /** Rendered height in canvas pixels. */
  height: number;
  /** Center X of the part in canvas pixels. */
  cx: number;
  /** Center Y of the part in canvas pixels. */
  cy: number;
  /** Stacking order — higher renders on top. */
  z: number;
  /** Transform origin inside the part (CSS string). Defaults to "50% 50%". */
  origin?: string;
};

// Source-sheet aspect ratios — preserved when sizing parts so their shape
// stays faithful even though we resample their absolute dimensions.
// (We measured these earlier from the cut PNGs.)
const NAT = {
  ear_idle:           { w: 209, h: 552 },
  ear_pose_top:       { w: 449, h: 370 },
  ear_pose_middle:    { w: 318, h: 382 },
  ear_pose_bottom:    { w: 316, h: 367 },
  body_legs:          { w: 374, h: 503 },
  head:               { w: 404, h: 400 },
  arm_left:           { w: 208, h: 172 },
  arm_right:          { w: 187, h: 179 },
  cheek_left:         { w: 89,  h: 79  },
  cheek_right:        { w: 97,  h: 87  },
  eye:                { w: 72,  h: 83  },
  blink:              { w: 87,  h: 37  },
  mouth_closed:       { w: 171, h: 161 },
  mouth_small_open:   { w: 148, h: 122 },
  mouth_smile_tongue: { w: 177, h: 150 },
  mouth_big_open:     { w: 178, h: 163 },
  flower:             { w: 198, h: 190 },
};

/**
 * Helper: take a target rendered width and the asset's natural aspect, return
 * a {width, height} pair preserving aspect ratio.
 */
function sized(targetW: number, nat: { w: number; h: number }) {
  return { width: targetW, height: Math.round((targetW * nat.h) / nat.w) };
}

// ---------------------------------------------------------------------------
// Idle layout — center coordinates and rendered sizes tuned by overlaying the
// rig on bunny_idle.png. Values are in 934×1040 canvas pixels.
// ---------------------------------------------------------------------------

export const PARTS: Record<PartId, PartSpec> = {
  // Ears — droopy idle pose. Pink on viewer's left, rainbow on viewer's right.
  // The idle ears hang from the very top of the head down past the cheeks
  // to roughly mid-belly level. They overlap the head sides slightly so the
  // silhouette reads as one continuous plush shape.
  ear_left_idle: {
    id: "ear_left_idle",
    src: `${PARTS_BASE}/ear_left_idle.png`,
    ...sized(210, NAT.ear_idle),
    cx: 165,
    cy: 430,
    z: 1,
    origin: "50% 8%",
  },
  ear_right_idle: {
    id: "ear_right_idle",
    src: `${PARTS_BASE}/ear_right_idle.png`,
    ...sized(210, NAT.ear_idle),
    cx: 770,
    cy: 430,
    z: 1,
    origin: "50% 8%",
  },

  // Active ear poses — replace idle ear when expressions demand them.
  ear_pose_top_left: {
    id: "ear_pose_top_left",
    src: `${PARTS_BASE}/ear_pose_top_left.png`,
    ...sized(330, NAT.ear_pose_top),
    cx: 230,
    cy: 220,
    z: 1,
    origin: "85% 75%",
  },
  ear_pose_top_right: {
    id: "ear_pose_top_right",
    src: `${PARTS_BASE}/ear_pose_top_right.png`,
    ...sized(330, NAT.ear_pose_top),
    cx: 705,
    cy: 220,
    z: 1,
    origin: "15% 75%",
  },
  ear_pose_middle_left: {
    id: "ear_pose_middle_left",
    src: `${PARTS_BASE}/ear_pose_middle_left.png`,
    ...sized(230, NAT.ear_pose_middle),
    cx: 220,
    cy: 305,
    z: 1,
    origin: "80% 70%",
  },
  ear_pose_middle_right: {
    id: "ear_pose_middle_right",
    src: `${PARTS_BASE}/ear_pose_middle_right.png`,
    ...sized(230, NAT.ear_pose_middle),
    cx: 715,
    cy: 305,
    z: 1,
    origin: "20% 70%",
  },
  ear_pose_bottom_left: {
    id: "ear_pose_bottom_left",
    src: `${PARTS_BASE}/ear_pose_bottom_left.png`,
    ...sized(230, NAT.ear_pose_bottom),
    cx: 230,
    cy: 410,
    z: 1,
    origin: "80% 30%",
  },
  ear_pose_bottom_right: {
    id: "ear_pose_bottom_right",
    src: `${PARTS_BASE}/ear_pose_bottom_right.png`,
    ...sized(230, NAT.ear_pose_bottom),
    cx: 705,
    cy: 410,
    z: 1,
    origin: "20% 30%",
  },

  // Body — sits behind the head; legs extend down to the bottom of the canvas.
  body_legs: {
    id: "body_legs",
    src: `${PARTS_BASE}/body_legs.png`,
    ...sized(390, NAT.body_legs),
    cx: 467,
    cy: 720,
    z: 2,
    origin: "50% 100%",
  },

  // Head — sits on top of body. Head pulled down a touch so neck region
  // overlaps body for a continuous silhouette (no "neck gap").
  head: {
    id: "head",
    src: `${PARTS_BASE}/head.png`,
    ...sized(420, NAT.head),
    cx: 467,
    cy: 350,
    z: 3,
    origin: "50% 90%",
  },

  // Arms — small paws hugging the chest, just below the cheeks.
  arm_left: {
    id: "arm_left",
    src: `${PARTS_BASE}/arm_left.png`,
    ...sized(165, NAT.arm_left),
    cx: 320,
    cy: 510,
    z: 4,
    origin: "85% 25%",
  },
  arm_right: {
    id: "arm_right",
    src: `${PARTS_BASE}/arm_right.png`,
    ...sized(150, NAT.arm_right),
    cx: 620,
    cy: 510,
    z: 4,
    origin: "15% 25%",
  },

  // Cheek swirls — pink blush flanking the nose.
  cheek_swirl_left: {
    id: "cheek_swirl_left",
    src: `${PARTS_BASE}/cheek_swirl_left.png`,
    ...sized(78, NAT.cheek_left),
    cx: 340,
    cy: 380,
    z: 5,
  },
  cheek_swirl_right: {
    id: "cheek_swirl_right",
    src: `${PARTS_BASE}/cheek_swirl_right.png`,
    ...sized(82, NAT.cheek_right),
    cx: 595,
    cy: 380,
    z: 5,
  },

  // Eyes — open + closed (blink) variants share centers.
  eye_left: {
    id: "eye_left",
    src: `${PARTS_BASE}/eye_left.png`,
    ...sized(76, NAT.eye),
    cx: 395,
    cy: 320,
    z: 6,
  },
  eye_right: {
    id: "eye_right",
    src: `${PARTS_BASE}/eye_right.png`,
    ...sized(76, NAT.eye),
    cx: 540,
    cy: 320,
    z: 6,
  },
  blink_left: {
    id: "blink_left",
    src: `${PARTS_BASE}/blink_left.png`,
    ...sized(92, NAT.blink),
    cx: 395,
    cy: 332,
    z: 6,
  },
  blink_right: {
    id: "blink_right",
    src: `${PARTS_BASE}/blink_right.png`,
    ...sized(92, NAT.blink),
    cx: 540,
    cy: 332,
    z: 6,
  },

  // Mouth — 4 visemes. The pink nose triangle stays fixed across visemes;
  // the lips/tongue grow downward. Sized so the nose+lips reach the prominence
  // of the reference idle image (where the nose is a clear focal point).
  mouth_closed: {
    id: "mouth_closed",
    src: `${PARTS_BASE}/mouth_closed.png`,
    ...sized(180, NAT.mouth_closed),
    cx: 467,
    cy: 395,
    z: 6,
  },
  mouth_small_open: {
    id: "mouth_small_open",
    src: `${PARTS_BASE}/mouth_small_open.png`,
    ...sized(160, NAT.mouth_small_open),
    cx: 467,
    cy: 405,
    z: 6,
  },
  mouth_smile_tongue: {
    id: "mouth_smile_tongue",
    src: `${PARTS_BASE}/mouth_smile_tongue.png`,
    ...sized(175, NAT.mouth_smile_tongue),
    cx: 467,
    cy: 410,
    z: 6,
  },
  mouth_big_open: {
    id: "mouth_big_open",
    src: `${PARTS_BASE}/mouth_big_open.png`,
    ...sized(180, NAT.mouth_big_open),
    cx: 467,
    cy: 415,
    z: 6,
  },

  // Flower — top of head, slightly toward viewer's right.
  flower: {
    id: "flower",
    src: `${PARTS_BASE}/flower.png`,
    ...sized(140, NAT.flower),
    cx: 555,
    cy: 175,
    z: 7,
    origin: "50% 80%",
  },
};

/**
 * Convert a part spec into CSS positioning percentages relative to the
 * 934×1040 canvas. Used by the rig component to render parts inside a
 * fluid `aspect-ratio: 934/1040` container.
 */
export function partLayoutPercent(spec: PartSpec) {
  const left = ((spec.cx - spec.width / 2) / RIG_CANVAS.width) * 100;
  const top = ((spec.cy - spec.height / 2) / RIG_CANVAS.height) * 100;
  const width = (spec.width / RIG_CANVAS.width) * 100;
  const height = (spec.height / RIG_CANVAS.height) * 100;
  return { left, top, width, height };
}

// ---------------------------------------------------------------------------
// Idle composition — the exact set of parts that should render when the
// bunny is in its default static state.
// ---------------------------------------------------------------------------

export const IDLE_PART_IDS: ReadonlyArray<PartId> = [
  "ear_left_idle",
  "ear_right_idle",
  "body_legs",
  "head",
  "arm_left",
  "arm_right",
  "cheek_swirl_left",
  "cheek_swirl_right",
  "eye_left",
  "eye_right",
  // Idle bunny in the reference image is mid-laugh — tongue out, mouth open.
  // Use smile_tongue as the resting pose, not mouth_closed.
  "mouth_smile_tongue",
  "flower",
];
