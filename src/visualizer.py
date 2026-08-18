"""
Visualizer Module
Provides OpenCV drawing routines for rendering face mesh edges & vertices,
body pose skeleton edges & vertices, hand keypoints, neon glow effects, and HUD.
"""

import cv2
import numpy as np
from typing import List, Tuple, Dict, Optional
import mediapipe as mp

from src.config import (
    AppSettings,
    POSE_CONNECTIONS_CORE,
    POSE_CONNECTIONS_LEFT,
    POSE_CONNECTIONS_RIGHT,
    POSE_CONNECTIONS_HEAD,
    HAND_CONNECTIONS,
)
from src.detector import FrameDetections, LandmarkPoint, DetectedFace, DetectedPose, DetectedHand

# Cache Face Connections as list of (int, int) pairs
FACE_TESSELATION_PAIRS: List[Tuple[int, int]] = [
    (c.start, c.end) for c in mp.tasks.vision.FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION
]

FACE_CONTOUR_PAIRS: List[Tuple[int, int]] = [
    (c.start, c.end) for c in mp.tasks.vision.FaceLandmarksConnections.FACE_LANDMARKS_CONTOURS
]


class FrameVisualizer:
    """
    Renders vertices, edges, glow effects, and HUD overlays onto frames.
    """

    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._fps_smoothed = 0.0
        self._alpha_fps = 0.1  # Smoothing factor for FPS
        self._snapshot_alert_frames = 0
        self._snapshot_alert_text = ""

    def trigger_snapshot_alert(self, text: str = "Snapshot Saved!") -> None:
        """Triggers a temporary visual alert banner on screen."""
        self._snapshot_alert_frames = 45
        self._snapshot_alert_text = text

    def update_fps(self, fps: float) -> None:
        """Updates exponential moving average of FPS."""
        if self._fps_smoothed == 0.0:
            self._fps_smoothed = fps
        else:
            self._fps_smoothed = (1.0 - self._alpha_fps) * self._fps_smoothed + self._alpha_fps * fps

    def render(
        self,
        frame: np.ndarray,
        detections: FrameDetections,
        edge_overlay: Optional[np.ndarray] = None,
        is_recording: bool = False,
    ) -> np.ndarray:
        """
        Composites all visual elements onto the frame.
        
        Args:
            frame: Input BGR frame.
            detections: FrameDetections containing face, pose, and hand landmarks.
            edge_overlay: Optional classical CV edge map.
            is_recording: True if recording is in progress.
            
        Returns:
            Annotated BGR frame.
        """
        output = frame.copy()
        theme = self.settings.current_theme

        # 1. Blend CV Edge Filter if active
        if self.settings.show_edge_filter and edge_overlay is not None:
            mask = edge_overlay.sum(axis=-1) > 0
            if np.any(mask):
                blended = cv2.addWeighted(
                    output, 1.0 - self.settings.edge_filter_alpha,
                    edge_overlay, self.settings.edge_filter_alpha, 0
                )
                output[mask] = blended[mask]

        # 2. Draw Body Pose (Edges and Vertices)
        if self.settings.show_pose_skeleton or self.settings.show_pose_vertices:
            for pose in detections.poses:
                self._draw_pose(output, pose, theme)

        # 3. Draw Hands (Edges and Vertices)
        if self.settings.show_hands:
            for hand in detections.hands:
                self._draw_hand(output, hand, theme)

        # 4. Draw Face Mesh (Edges and Vertices)
        if self.settings.show_face_mesh or self.settings.show_face_vertices or self.settings.show_face_contours:
            for face in detections.faces:
                self._draw_face(output, face, theme)

        # 5. Draw HUD Telemetry
        if self.settings.show_hud:
            self._draw_hud(output, detections, is_recording)

        # 6. Draw Snapshot Alert Banner
        if self._snapshot_alert_frames > 0:
            self._draw_snapshot_alert(output)
            self._snapshot_alert_frames -= 1

        return output

    def _draw_face(self, frame: np.ndarray, face: DetectedFace, theme: Dict[str, Tuple[int, int, int]]) -> None:
        """Renders face tessellation wireframe edges, contour edges, and landmark vertices."""
        lms = face.landmarks
        num_pts = len(lms)
        h, w = frame.shape[:2]

        # A. Face Tessellation (Wireframe Edges)
        if self.settings.show_face_mesh and self.settings.face_mesh_alpha > 0.0:
            wireframe_overlay = frame.copy()
            edge_color = theme["face_edge"]

            for start_idx, end_idx in FACE_TESSELATION_PAIRS:
                if start_idx < num_pts and end_idx < num_pts:
                    pt1 = (lms[start_idx].px, lms[start_idx].py)
                    pt2 = (lms[end_idx].px, lms[end_idx].py)
                    cv2.line(wireframe_overlay, pt1, pt2, edge_color, 1, cv2.LINE_AA)

            # Alpha blend wireframe for clean non-cluttered aesthetics
            cv2.addWeighted(
                wireframe_overlay, self.settings.face_mesh_alpha,
                frame, 1.0 - self.settings.face_mesh_alpha, 0, frame
            )

        # B. Prominent Facial Contours (Lips, Eyes, Eyebrows, Face Oval)
        if self.settings.show_face_contours:
            contour_color = theme["face_contour"]
            for start_idx, end_idx in FACE_CONTOUR_PAIRS:
                if start_idx < num_pts and end_idx < num_pts:
                    pt1 = (lms[start_idx].px, lms[start_idx].py)
                    pt2 = (lms[end_idx].px, lms[end_idx].py)
                    cv2.line(frame, pt1, pt2, contour_color, 2, cv2.LINE_AA)

        # C. Face Vertices
        if self.settings.show_face_vertices:
            vertex_color = theme["face_vertex"]
            for pt in lms:
                cv2.circle(frame, (pt.px, pt.py), 1, vertex_color, -1, cv2.LINE_AA)

            # If glow effect is active, add subtle glow to key prominent landmarks (eyes, nose tip, chin)
            if self.settings.glow_effect:
                key_face_indices = [1, 33, 263, 61, 291, 199]  # Nose tip, eye corners, lip corners, chin
                for idx in key_face_indices:
                    if idx < num_pts:
                        p = lms[idx]
                        cv2.circle(frame, (p.px, p.py), 4, vertex_color, 1, cv2.LINE_AA)
                        cv2.circle(frame, (p.px, p.py), 2, (255, 255, 255), -1, cv2.LINE_AA)

    def _draw_pose(self, frame: np.ndarray, pose: DetectedPose, theme: Dict[str, Tuple[int, int, int]]) -> None:
        """Renders body pose skeletal edges and joint vertices."""
        lms = pose.landmarks
        num_pts = len(lms)

        # Helper to draw connection groups
        def draw_conn_group(connections: List[Tuple[int, int]], color: Tuple[int, int, int], thickness: int = 3):
            for start_idx, end_idx in connections:
                if start_idx < num_pts and end_idx < num_pts:
                    p1, p2 = lms[start_idx], lms[end_idx]
                    if p1.visibility > 0.4 and p2.visibility > 0.4:
                        cv2.line(frame, (p1.px, p1.py), (p2.px, p2.py), color, thickness, cv2.LINE_AA)

        # A. Pose Skeleton Edges (Color-coded by lateral symmetry)
        if self.settings.show_pose_skeleton:
            draw_conn_group(POSE_CONNECTIONS_CORE, theme["pose_core_edge"], thickness=4)
            draw_conn_group(POSE_CONNECTIONS_LEFT, theme["pose_left_edge"], thickness=3)
            draw_conn_group(POSE_CONNECTIONS_RIGHT, theme["pose_right_edge"], thickness=3)
            draw_conn_group(POSE_CONNECTIONS_HEAD, theme["pose_core_edge"], thickness=2)

        # B. Pose Joint Vertices
        if self.settings.show_pose_vertices:
            for idx, pt in enumerate(lms):
                if pt.visibility > 0.35:
                    # Choose color based on joint side
                    if idx in [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]:
                        color = theme["pose_left_vertex"]
                    elif idx in [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]:
                        color = theme["pose_right_vertex"]
                    else:
                        color = theme["pose_core_vertex"]

                    # Glow effect around joints
                    if self.settings.glow_effect:
                        cv2.circle(frame, (pt.px, pt.py), 8, color, 1, cv2.LINE_AA)
                        cv2.circle(frame, (pt.px, pt.py), 5, color, -1, cv2.LINE_AA)
                        cv2.circle(frame, (pt.px, pt.py), 2, (255, 255, 255), -1, cv2.LINE_AA)
                    else:
                        cv2.circle(frame, (pt.px, pt.py), 4, color, -1, cv2.LINE_AA)

    def _draw_hand(self, frame: np.ndarray, hand: DetectedHand, theme: Dict[str, Tuple[int, int, int]]) -> None:
        """Renders hand skeletal chains and fingertip vertices."""
        lms = hand.landmarks
        num_pts = len(lms)
        edge_color = theme["hand_edge"]
        vertex_color = theme["hand_vertex"]

        # Edges
        for start_idx, end_idx in HAND_CONNECTIONS:
            if start_idx < num_pts and end_idx < num_pts:
                p1, p2 = lms[start_idx], lms[end_idx]
                cv2.line(frame, (p1.px, p1.py), (p2.px, p2.py), edge_color, 2, cv2.LINE_AA)

        # Vertices
        for idx, pt in enumerate(lms):
            # Fingertips (4, 8, 12, 16, 20) get accented glow
            if idx in [4, 8, 12, 16, 20] and self.settings.glow_effect:
                cv2.circle(frame, (pt.px, pt.py), 6, vertex_color, 1, cv2.LINE_AA)
                cv2.circle(frame, (pt.px, pt.py), 3, (255, 255, 255), -1, cv2.LINE_AA)
            else:
                cv2.circle(frame, (pt.px, pt.py), 3, vertex_color, -1, cv2.LINE_AA)

    def _draw_hud(self, frame: np.ndarray, detections: FrameDetections, is_recording: bool) -> None:
        """Draws modern glassmorphic HUD telemetry card and status indicators."""
        theme = self.settings.current_theme
        h, w = frame.shape[:2]

        # Top-Left Telemetry Card
        card_w, card_h = 360, 205
        card_overlay = frame.copy()
        cv2.rectangle(card_overlay, (10, 10), (10 + card_w, 10 + card_h), theme["hud_bg"], -1)
        cv2.addWeighted(card_overlay, 0.75, frame, 0.25, 0, frame)
        cv2.rectangle(frame, (10, 10), (10 + card_w, 10 + card_h), theme["hud_accent"], 1, cv2.LINE_AA)

        # Title / Brand
        cv2.putText(frame, "LUMINA CV VISION ENGINE", (22, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.52, theme["hud_accent"], 2, cv2.LINE_AA)
        cv2.line(frame, (20, 40), (10 + card_w - 10, 40), theme["hud_accent"], 1)

        # Stats Lines
        stats = [
            f"FPS: {self._fps_smoothed:.1f} | Latency: {detections.inference_time_ms:.1f}ms | {w}x{h}",
            f"Faces: {len(detections.faces)} (478 pts) | Mesh: {'ON' if self.settings.show_face_mesh else 'OFF'}",
            f"Pose: {len(detections.poses)} (33 pts) | Skn: {'ON' if self.settings.show_pose_skeleton else 'OFF'}",
            f"Hands: {len(detections.hands)} (21 pts) | Show: {'ON' if self.settings.show_hands else 'OFF'}",
            f"CV Edge Filter: {'ON (' + self.settings.edge_filter_type.upper() + ')' if self.settings.show_edge_filter else 'OFF'}",
            f"Camera Mirror: {'FLIPPED' if self.settings.flip_horizontal else 'NORMAL (UNFLIPPED)'}",
            f"Theme: {self.settings.current_theme_name.upper()} | Glow: {'ON' if self.settings.glow_effect else 'OFF'}",
        ]

        for i, text in enumerate(stats):
            y_pos = 60 + i * 20
            cv2.putText(frame, text, (22, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.40, theme["hud_text"], 1, cv2.LINE_AA)

        # Bottom Shortcut Hints Bar
        hint_card_w, hint_card_h = 630, 28
        hx1, hy1 = 10, h - 38
        hint_overlay = frame.copy()
        cv2.rectangle(hint_overlay, (hx1, hy1), (hx1 + hint_card_w, hy1 + hint_card_h), theme["hud_bg"], -1)
        cv2.addWeighted(hint_overlay, 0.75, frame, 0.25, 0, frame)
        cv2.rectangle(frame, (hx1, hy1), (hx1 + hint_card_w, hy1 + hint_card_h), theme["hud_accent"], 1, cv2.LINE_AA)
        
        hints = "[F] Face  [B] Pose  [H] Hands  [E] Edge  [M] Mirror  [T] Theme  [G] Glow  [SPC] Snap  [Q] Exit"
        cv2.putText(frame, hints, (hx1 + 10, hy1 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (230, 230, 230), 1, cv2.LINE_AA)

        # Recording Status Indicator (Top Right)
        if is_recording:
            rx = w - 160
            cv2.rectangle(frame, (rx, 15), (w - 15, 45), (0, 0, 180), -1)
            cv2.circle(frame, (rx + 20, 30), 6, (0, 0, 255), -1, cv2.LINE_AA)
            cv2.putText(frame, "RECORDING", (rx + 35, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 2, cv2.LINE_AA)

    def _draw_snapshot_alert(self, frame: np.ndarray) -> None:
        """Displays temporary green confirmation toast."""
        h, w = frame.shape[:2]
        banner_w, banner_h = 300, 40
        x1 = (w - banner_w) // 2
        y1 = 20
        cv2.rectangle(frame, (x1, y1), (x1 + banner_w, y1 + banner_h), (0, 180, 50), -1)
        cv2.rectangle(frame, (x1, y1), (x1 + banner_w, y1 + banner_h), (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(
            frame, self._snapshot_alert_text, (x1 + 35, y1 + 26),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA
        )
