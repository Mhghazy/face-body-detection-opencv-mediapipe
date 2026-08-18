"""
Configuration module for Face & Body Vertices and Edges Detection.
Defines model URLs, paths, theme palettes, and connection topologies.
"""

from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, Tuple, List

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
SNAPSHOTS_DIR = BASE_DIR / "snapshots"

# Ensure directories exist
MODELS_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Official Google MediaPipe Task Model URLs
MODEL_URLS: Dict[str, str] = {
    "face_landmarker": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    "pose_landmarker": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    "hand_landmarker": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
}

# Local Model File Paths
MODEL_PATHS: Dict[str, Path] = {
    "face_landmarker": MODELS_DIR / "face_landmarker.task",
    "pose_landmarker": MODELS_DIR / "pose_landmarker_full.task",
    "hand_landmarker": MODELS_DIR / "hand_landmarker.task",
}

# Visual Themes (Colors are in BGR format for OpenCV)
THEMES: Dict[str, Dict[str, Tuple[int, int, int]]] = {
    "cyberpunk": {
        "face_vertex": (255, 255, 0),        # Cyan
        "face_edge": (200, 180, 0),          # Soft Cyan
        "face_contour": (255, 0, 255),       # Magenta
        "pose_left_vertex": (255, 100, 0),   # Bright Sky Blue
        "pose_left_edge": (255, 50, 0),      # Deep Blue
        "pose_right_vertex": (0, 255, 128),  # Spring Green
        "pose_right_edge": (0, 200, 100),    # Emerald Green
        "pose_core_vertex": (0, 255, 255),   # Yellow
        "pose_core_edge": (0, 200, 200),     # Amber
        "hand_vertex": (255, 0, 200),        # Electric Purple
        "hand_edge": (255, 128, 255),        # Pink
        "hud_bg": (20, 20, 25),              # Dark slate
        "hud_text": (255, 255, 255),         # White
        "hud_accent": (255, 200, 0),         # Neon Blue
        "edge_filter": (0, 255, 255),        # Yellow edge glow
    },
    "scifi_emerald": {
        "face_vertex": (0, 255, 128),
        "face_edge": (0, 180, 80),
        "face_contour": (0, 255, 255),
        "pose_left_vertex": (50, 255, 50),
        "pose_left_edge": (30, 200, 30),
        "pose_right_vertex": (0, 230, 255),
        "pose_right_edge": (0, 180, 200),
        "pose_core_vertex": (255, 255, 255),
        "pose_core_edge": (180, 220, 180),
        "hand_vertex": (0, 255, 200),
        "hand_edge": (0, 200, 150),
        "hud_bg": (15, 25, 15),
        "hud_text": (220, 255, 220),
        "hud_accent": (0, 255, 128),
        "edge_filter": (50, 255, 50),
    },
    "sunset_fire": {
        "face_vertex": (0, 215, 255),        # Gold
        "face_edge": (0, 165, 255),          # Orange
        "face_contour": (60, 60, 255),       # Coral Red
        "pose_left_vertex": (0, 140, 255),   # Deep Orange
        "pose_left_edge": (0, 100, 220),
        "pose_right_vertex": (80, 120, 255), # Red Orange
        "pose_right_edge": (40, 80, 220),
        "pose_core_vertex": (255, 255, 255),
        "pose_core_edge": (150, 180, 255),
        "hand_vertex": (0, 200, 255),
        "hand_edge": (0, 150, 220),
        "hud_bg": (25, 15, 20),
        "hud_text": (255, 240, 240),
        "hud_accent": (0, 165, 255),
        "edge_filter": (0, 140, 255),
    },
    "minimal_mono": {
        "face_vertex": (255, 255, 255),
        "face_edge": (160, 160, 160),
        "face_contour": (255, 255, 255),
        "pose_left_vertex": (240, 240, 240),
        "pose_left_edge": (180, 180, 180),
        "pose_right_vertex": (220, 220, 220),
        "pose_right_edge": (160, 160, 160),
        "pose_core_vertex": (255, 255, 255),
        "pose_core_edge": (200, 200, 200),
        "hand_vertex": (255, 255, 255),
        "hand_edge": (180, 180, 180),
        "hud_bg": (20, 20, 20),
        "hud_text": (255, 255, 255),
        "hud_accent": (200, 200, 200),
        "edge_filter": (255, 255, 255),
    },
}

THEME_NAMES = list(THEMES.keys())

# Pose Landmark Connections categorized by body region
# 33 MediaPipe Pose Landmarks:
# 0-10: Face/Head, 11-12: Shoulders, 13-14: Elbows, 15-16: Wrists,
# 17-22: Hands/Fingers, 23-24: Hips, 25-26: Knees, 27-28: Ankles, 29-32: Feet/Toes
POSE_CONNECTIONS_CORE = [
    (11, 12),  # Shoulders
    (11, 23),  # Left shoulder to left hip
    (12, 24),  # Right shoulder to right hip
    (23, 24),  # Hip bridge
]

POSE_CONNECTIONS_LEFT = [
    (11, 13),  # Left shoulder to left elbow
    (13, 15),  # Left elbow to left wrist
    (15, 17),  # Left wrist to left pinky
    (15, 19),  # Left wrist to left index
    (15, 21),  # Left wrist to left thumb
    (17, 19),  # Left pinky to left index
    (23, 25),  # Left hip to left knee
    (25, 27),  # Left knee to left ankle
    (27, 29),  # Left ankle to left heel
    (29, 31),  # Left heel to left foot index
    (27, 31),  # Left ankle to left foot index
]

POSE_CONNECTIONS_RIGHT = [
    (12, 14),  # Right shoulder to right elbow
    (14, 16),  # Right elbow to right wrist
    (16, 18),  # Right wrist to right pinky
    (16, 20),  # Right wrist to right index
    (16, 22),  # Right wrist to right thumb
    (18, 20),  # Right pinky to right index
    (24, 26),  # Right hip to right knee
    (26, 28),  # Right knee to right ankle
    (28, 30),  # Right ankle to right heel
    (30, 32),  # Right heel to right foot index
    (28, 32),  # Right ankle to right foot index
]

POSE_CONNECTIONS_HEAD = [
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10),
]

ALL_POSE_CONNECTIONS = (
    POSE_CONNECTIONS_CORE
    + POSE_CONNECTIONS_LEFT
    + POSE_CONNECTIONS_RIGHT
    + POSE_CONNECTIONS_HEAD
)

# Hand connections (21 landmarks)
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),        # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),        # Index
    (5, 9), (9, 10), (10, 11), (11, 12),   # Middle
    (9, 13), (13, 14), (14, 15), (15, 16), # Ring
    (13, 17), (17, 18), (18, 19), (19, 20),# Pinky
    (0, 17)                                # Palm base
]

@dataclass
class AppSettings:
    """Runtime toggles and configurations."""
    show_face_mesh: bool = True
    show_face_vertices: bool = True
    show_face_contours: bool = True
    show_pose_skeleton: bool = True
    show_pose_vertices: bool = True
    show_hands: bool = True
    show_edge_filter: bool = False
    edge_filter_type: str = "canny"  # "canny", "sobel", "silhouette"
    glow_effect: bool = True
    show_hud: bool = True
    theme_idx: int = 0
    flip_horizontal: bool = True
    face_mesh_alpha: float = 0.5
    edge_filter_alpha: float = 0.6
    min_detection_confidence: float = 0.5
    min_tracking_confidence: float = 0.5
    max_num_faces: int = 2
    max_num_poses: int = 2
    max_num_hands: int = 2
    
    @property
    def current_theme_name(self) -> str:
        return THEME_NAMES[self.theme_idx % len(THEME_NAMES)]
    
    @property
    def current_theme(self) -> Dict[str, Tuple[int, int, int]]:
        return THEMES[self.current_theme_name]
    
    def cycle_theme(self) -> str:
        self.theme_idx = (self.theme_idx + 1) % len(THEME_NAMES)
        return self.current_theme_name
