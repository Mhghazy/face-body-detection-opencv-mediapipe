/**
 * Visual Theme Configurations and Kinematic Connection Topologies
 * Direct mapping from Python backend src/config.py with Hex / Canvas RGB colors.
 */

export interface ThemeColors {
  name: string;
  label: string;
  faceVertex: string;
  faceEdge: string;
  faceContour: string;
  poseLeftVertex: string;
  poseLeftEdge: string;
  poseRightVertex: string;
  poseRightEdge: string;
  poseCoreVertex: string;
  poseCoreEdge: string;
  handVertex: string;
  handEdge: string;
  hudBg: string;
  hudText: string;
  hudAccent: string;
  edgeFilter: string;
  primaryGlow: string;
}

export const THEMES: Record<string, ThemeColors> = {
  cyberpunk: {
    name: "cyberpunk",
    label: "Cyberpunk Neon",
    faceVertex: "#00ffff",       // Cyan
    faceEdge: "#00b4c8",         // Soft Cyan
    faceContour: "#ff00ff",      // Magenta
    poseLeftVertex: "#0064ff",   // Bright Sky Blue
    poseLeftEdge: "#0032ff",     // Deep Blue
    poseRightVertex: "#80ff00",  // Spring Green
    poseRightEdge: "#64c800",    // Emerald Green
    poseCoreVertex: "#ffff00",   // Yellow
    poseCoreEdge: "#c8c800",     // Amber
    handVertex: "#c800ff",       // Electric Purple
    handEdge: "#ff80ff",         // Pink
    hudBg: "rgba(15, 20, 30, 0.85)",
    hudText: "#ffffff",
    hudAccent: "#00c8ff",
    edgeFilter: "#ffff00",
    primaryGlow: "#00f0ff",
  },
  scifi_emerald: {
    name: "scifi_emerald",
    label: "Sci-Fi Emerald",
    faceVertex: "#80ff00",
    faceEdge: "#50b400",
    faceContour: "#ffff00",
    poseLeftVertex: "#32ff32",
    poseLeftEdge: "#1ec81e",
    poseRightVertex: "#ffe600",
    poseRightEdge: "#c8b400",
    poseCoreVertex: "#ffffff",
    poseCoreEdge: "#b4dcb4",
    handVertex: "#c8ff00",
    handEdge: "#96c800",
    hudBg: "rgba(10, 25, 15, 0.85)",
    hudText: "#dcffdc",
    hudAccent: "#00ff80",
    edgeFilter: "#32ff32",
    primaryGlow: "#00ff88",
  },
  sunset_fire: {
    name: "sunset_fire",
    label: "Sunset Fire",
    faceVertex: "#ffd700",       // Gold
    faceEdge: "#ffa500",         // Orange
    faceContour: "#ff3c3c",      // Coral Red
    poseLeftVertex: "#ff8c00",   // Deep Orange
    poseLeftEdge: "#dc6400",
    poseRightVertex: "#ff7850",  // Red Orange
    poseRightEdge: "#dc5028",
    poseCoreVertex: "#ffffff",
    poseCoreEdge: "#ffb496",
    handVertex: "#ffc800",
    handEdge: "#dc9600",
    hudBg: "rgba(30, 15, 20, 0.85)",
    hudText: "#fff0f0",
    hudAccent: "#ffa500",
    edgeFilter: "#ff8c00",
    primaryGlow: "#ff5500",
  },
  minimal_mono: {
    name: "minimal_mono",
    label: "Minimal Mono",
    faceVertex: "#ffffff",
    faceEdge: "#a0a0a0",
    faceContour: "#ffffff",
    poseLeftVertex: "#f0f0f0",
    poseLeftEdge: "#b4b4b4",
    poseRightVertex: "#dcdcdc",
    poseRightEdge: "#a0a0a0",
    poseCoreVertex: "#ffffff",
    poseCoreEdge: "#c8c8c8",
    handVertex: "#ffffff",
    handEdge: "#b4b4b4",
    hudBg: "rgba(20, 20, 20, 0.85)",
    hudText: "#ffffff",
    hudAccent: "#c8c8c8",
    edgeFilter: "#ffffff",
    primaryGlow: "#ffffff",
  },
};

export const THEME_NAMES = Object.keys(THEMES);

// Pose Landmark Connections (33 MediaPipe Pose Landmarks)
export const POSE_CONNECTIONS_CORE: [number, number][] = [
  [11, 12],  // Shoulders
  [11, 23],  // Left shoulder to left hip
  [12, 24],  // Right shoulder to right hip
  [23, 24],  // Hip bridge
];

export const POSE_CONNECTIONS_LEFT: [number, number][] = [
  [11, 13],  // Left shoulder to left elbow
  [13, 15],  // Left elbow to left wrist
  [15, 17],  // Left wrist to left pinky
  [15, 19],  // Left wrist to left index
  [15, 21],  // Left wrist to left thumb
  [17, 19],  // Left pinky to left index
  [23, 25],  // Left hip to left knee
  [25, 27],  // Left knee to left ankle
  [27, 29],  // Left ankle to left heel
  [29, 31],  // Left heel to left foot index
  [27, 31],  // Left ankle to left foot index
];

export const POSE_CONNECTIONS_RIGHT: [number, number][] = [
  [12, 14],  // Right shoulder to right elbow
  [14, 16],  // Right elbow to right wrist
  [16, 18],  // Right wrist to right pinky
  [16, 20],  // Right wrist to right index
  [16, 22],  // Right wrist to right thumb
  [18, 20],  // Right pinky to right index
  [24, 26],  // Right hip to right knee
  [26, 28],  // Right knee to right ankle
  [28, 30],  // Right ankle to right heel
  [30, 32],  // Right heel to right foot index
  [28, 32],  // Right ankle to right foot index
];

export const POSE_CONNECTIONS_HEAD: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
];

// Hand connections (21 landmarks)
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index
  [5, 9], [9, 10], [10, 11], [11, 12],   // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [0, 17],                               // Palm base
];

// Face Contours Indices (simplified high-definition contours for lips, eyes, eyebrows, jawline, oval)
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10
];

export const LIPS_INDICES = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 61
];

export const LEFT_EYE_INDICES = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362
];

export const RIGHT_EYE_INDICES = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33
];

export const LEFT_EYEBROW_INDICES = [
  276, 283, 282, 295, 285, 300, 293, 334, 296, 336
];

export const RIGHT_EYEBROW_INDICES = [
  46, 53, 52, 65, 55, 70, 63, 105, 66, 107
];

export const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
export const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
