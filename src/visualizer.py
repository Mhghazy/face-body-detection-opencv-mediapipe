"""
Visualizer Module
Provides OpenCV drawing routines for rendering face mesh edges & vertices,
body pose skeleton edges & vertices, hand keypoints, thermal false-color heatmaps,
floating temperature tags, scale legend, and telemetry HUD.
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
from src.thermal_engine import ThermalFrameResult, TemperatureSpot, ThermalEngine

# Cache Face Connections as list of (int, int) pairs
FACE_TESSELATION_PAIRS: List[Tuple[int, int]] = [
    (c.start, c.end) for c in mp.tasks.vision.FaceLandmarksConnections.FACE_LANDMARKS_TESSELATION
]

FACE_CONTOUR_PAIRS: List[Tuple[int, int]] = [
    (c.start, c.end) for c in mp.tasks.vision.FaceLandmarksConnections.FACE_LANDMARKS_CONTOURS
]


class FrameVisualizer:
    """
    Renders vertices, wireframe edges, thermal heatmaps, spot temperature tags,
    glow effects, and HUD overlays onto frames.
    """

    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._fps_smoothed = 0.0
        self._alpha_fps = 0.1  # Smoothing factor for FPS
        self._snapshot_alert_frames = 0
        self._snapshot_alert_text = ""
        self._fever_pulse_phase = 0.0

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
        thermal_result: Optional[ThermalFrameResult] = None,
        thermal_engine: Optional[ThermalEngine] = None,
        is_recording: bool = False,
    ) -> np.ndarray:
        """
        Composites all visual elements onto the frame.
        
        Args:
            frame: Input BGR frame.
            detections: FrameDetections containing face, pose, and hand landmarks.
            edge_overlay: Optional classical CV edge map.
            thermal_result: Optional ThermalFrameResult containing heatmap and temperatures.
            thermal_engine: Optional ThermalEngine instance for drawing scale legend.
            is_recording: True if recording is in progress.
            
        Returns:
            Annotated BGR frame.
        """
        output = frame.copy()
        theme = self.settings.current_theme
        self._fever_pulse_phase += 0.15

        # 1. Apply Thermal Heatmap Overlay if active
        if self.settings.show_thermal and thermal_result is not None:
            output = self._apply_thermal_overlay(output, thermal_result)

        # 2. Blend CV Edge Filter if active
        if self.settings.show_edge_filter and edge_overlay is not None:
            mask = edge_overlay.sum(axis=-1) > 0
            if np.any(mask):
                blended = cv2.addWeighted(
                    output, 1.0 - self.settings.edge_filter_alpha,
                    edge_overlay, self.settings.edge_filter_alpha, 0
                )
                output[mask] = blended[mask]

        # 3. Draw Body Pose (Edges and Vertices)
        if self.settings.show_pose_skeleton or self.settings.show_pose_vertices:
            for pose in detections.poses:
                self._draw_pose(output, pose, theme)

        # 4. Draw Hands (Edges and Vertices)
        if self.settings.show_hands:
            for hand in detections.hands:
                self._draw_hand(output, hand, theme)

        # 5. Draw Face Mesh (Edges and Vertices)
        if self.settings.show_face_mesh or self.settings.show_face_vertices or self.settings.show_face_contours:
            for face in detections.faces:
                self._draw_face(output, face, theme)

        # 6. Draw Thermal Spot Temperature Badges & Scale Legend
        if self.settings.show_thermal and thermal_result is not None:
            self._draw_temperature_spots(output, thermal_result.spots)
            if thermal_engine is not None:
                thermal_engine.draw_thermal_scale_legend(
                    output, thermal_result.min_temp_c, thermal_result.max_temp_c
                )
            if thermal_result.fever_detected:
                self._draw_fever_alert(output)

        # 7. Draw HUD Telemetry
        if self.settings.show_hud:
            self._draw_hud(output, detections, thermal_result, is_recording)

        # 8. Draw Snapshot Alert Banner
        if self._snapshot_alert_frames > 0:
            self._draw_snapshot_alert(output)
            self._snapshot_alert_frames -= 1

        return output

    def _apply_thermal_overlay(self, frame: np.ndarray, thermal_result: ThermalFrameResult) -> np.ndarray:
        """Applies thermal color map based on configured blend mode and segmentation mask."""
        blend_mode = self.settings.current_thermal_blend_mode
        alpha = self.settings.thermal_blend_alpha
        thermal_bgr = thermal_result.thermal_bgr

        if blend_mode == "full":
            return thermal_bgr.copy()
        elif blend_mode == "hybrid":
            return cv2.addWeighted(frame, 1.0 - alpha, thermal_bgr, alpha, 0)
        elif blend_mode == "masked":
            # Masked mode: apply thermal false-color strictly to segmented body & face
            seg_mask = thermal_result.segmentation_mask
            mask_3c = np.repeat(seg_mask[:, :, np.newaxis], 3, axis=2)
            blended_body = cv2.addWeighted(frame, 1.0 - alpha, thermal_bgr, alpha, 0)
            return (blended_body * mask_3c + frame * (1.0 - mask_3c)).astype(np.uint8)
        return frame

    def _draw_temperature_spots(self, frame: np.ndarray, spots: List[TemperatureSpot]) -> None:
        """Draws floating, rounded pill badges at temperature sampling sites."""
        h, w = frame.shape[:2]
        is_fahrenheit = self.settings.temp_unit == "F"

        for spot in spots:
            # Check bounds
            if not (10 <= spot.px < w - 10 and 10 <= spot.py < h - 10):
                continue

            # Format text
            if is_fahrenheit:
                temp_text = f"{spot.temp_f:.1f}°F"
            else:
                temp_text = f"{spot.temp_c:.1f}°C"

            full_text = f"{spot.label}: {temp_text}"

            # Box styling based on fever status
            if spot.is_fever:
                bg_color = (0, 0, 180)        # Bright Red
                border_color = (0, 120, 255)  # Orange
                text_color = (255, 255, 255)
            else:
                bg_color = (20, 30, 20)       # Dark Greenish slate
                border_color = (0, 255, 128)  # Emerald/Cyan
                text_color = (220, 255, 220)

            # Calculate badge box size
            font = cv2.FONT_HERSHEY_SIMPLEX
            scale = 0.42
            thickness = 1
            (tw, th), baseline = cv2.getTextSize(full_text, font, scale, thickness)
            
            bx = max(5, min(w - tw - 20, spot.px - tw // 2))
            by = max(25, min(h - 15, spot.py - 18))

            # Translucent background badge
            overlay = frame.copy()
            cv2.rectangle(overlay, (bx - 5, by - th - 5), (bx + tw + 5, by + 5), bg_color, -1)
            cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)
            cv2.rectangle(frame, (bx - 5, by - th - 5), (bx + tw + 5, by + 5), border_color, 1, cv2.LINE_AA)

            # Anchor crosshair dot
            cv2.circle(frame, (spot.px, spot.py), 3, border_color, -1, cv2.LINE_AA)
            cv2.line(frame, (spot.px, spot.py), (bx + tw // 2, by + 5), border_color, 1, cv2.LINE_AA)

            # Badge Text
            cv2.putText(frame, full_text, (bx, by), font, scale, text_color, thickness, cv2.LINE_AA)

    def _draw_fever_alert(self, frame: np.ndarray) -> None:
        """Draws prominent flashing fever warning alert and border."""
        h, w = frame.shape[:2]
        
        # Pulsing intensity
        pulse = abs(math.sin(self._fever_pulse_phase))
        border_thick = int(3 + 3 * pulse)
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 0, 255), border_thick)

        # Warning Toast Banner
        banner_w, banner_h = 360, 36
        bx1 = (w - banner_w) // 2
        by1 = 15
        overlay = frame.copy()
        cv2.rectangle(overlay, (bx1, by1), (bx1 + banner_w, by1 + banner_h), (0, 0, 160), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.rectangle(frame, (bx1, by1), (bx1 + banner_w, by1 + banner_h), (0, 140, 255), 2, cv2.LINE_AA)
        
        alert_msg = f"! ELEVATED TEMPERATURE DETECTED (> {self.settings.fever_threshold_c:.1f}C) !"
        cv2.putText(frame, alert_msg, (bx1 + 14, by1 + 23), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 2, cv2.LINE_AA)

    def _draw_face(self, frame: np.ndarray, face: DetectedFace, theme: Dict[str, Tuple[int, int, int]]) -> None:
        """Renders face tessellation wireframe edges, contour edges, and landmark vertices."""
        lms = face.landmarks
        num_pts = len(lms)

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

            # If glow effect is active, add subtle glow to key prominent landmarks
            if self.settings.glow_effect:
                key_face_indices = [1, 10, 33, 263, 61, 291, 199]
                for idx in key_face_indices:
                    if idx < num_pts:
                        p = lms[idx]
                        cv2.circle(frame, (p.px, p.py), 4, vertex_color, 1, cv2.LINE_AA)
                        cv2.circle(frame, (p.px, p.py), 2, (255, 255, 255), -1, cv2.LINE_AA)

    def _draw_pose(self, frame: np.ndarray, pose: DetectedPose, theme: Dict[str, Tuple[int, int, int]]) -> None:
        """Renders body pose skeletal edges and joint vertices."""
        lms = pose.landmarks
        num_pts = len(lms)

        def draw_conn_group(connections: List[Tuple[int, int]], color: Tuple[int, int, int], thickness: int = 3):
            for start_idx, end_idx in connections:
                if start_idx < num_pts and end_idx < num_pts:
                    p1, p2 = lms[start_idx], lms[end_idx]
                    if p1.visibility > 0.4 and p2.visibility > 0.4:
                        cv2.line(frame, (p1.px, p1.py), (p2.px, p2.py), color, thickness, cv2.LINE_AA)

        # A. Pose Skeleton Edges
        if self.settings.show_pose_skeleton:
            draw_conn_group(POSE_CONNECTIONS_CORE, theme["pose_core_edge"], thickness=4)
            draw_conn_group(POSE_CONNECTIONS_LEFT, theme["pose_left_edge"], thickness=3)
            draw_conn_group(POSE_CONNECTIONS_RIGHT, theme["pose_right_edge"], thickness=3)
            draw_conn_group(POSE_CONNECTIONS_HEAD, theme["pose_core_edge"], thickness=2)

        # B. Pose Joint Vertices
        if self.settings.show_pose_vertices:
            for idx, pt in enumerate(lms):
                if pt.visibility > 0.35:
                    if idx in [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]:
                        color = theme["pose_left_vertex"]
                    elif idx in [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]:
                        color = theme["pose_right_vertex"]
                    else:
                        color = theme["pose_core_vertex"]

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

        for start_idx, end_idx in HAND_CONNECTIONS:
            if start_idx < num_pts and end_idx < num_pts:
                p1, p2 = lms[start_idx], lms[end_idx]
                cv2.line(frame, (p1.px, p1.py), (p2.px, p2.py), edge_color, 2, cv2.LINE_AA)

        for idx, pt in enumerate(lms):
            if idx in [4, 8, 12, 16, 20] and self.settings.glow_effect:
                cv2.circle(frame, (pt.px, pt.py), 6, vertex_color, 1, cv2.LINE_AA)
                cv2.circle(frame, (pt.px, pt.py), 3, (255, 255, 255), -1, cv2.LINE_AA)
            else:
                cv2.circle(frame, (pt.px, pt.py), 3, vertex_color, -1, cv2.LINE_AA)

    def _draw_hud(
        self,
        frame: np.ndarray,
        detections: FrameDetections,
        thermal_result: Optional[ThermalFrameResult],
        is_recording: bool,
    ) -> None:
        """Draws modern glassmorphic HUD telemetry card and status indicators."""
        theme = self.settings.current_theme
        h, w = frame.shape[:2]

        # Top-Left Telemetry Card
        card_w, card_h = 370, 225
        card_overlay = frame.copy()
        cv2.rectangle(card_overlay, (10, 10), (10 + card_w, 10 + card_h), theme["hud_bg"], -1)
        cv2.addWeighted(card_overlay, 0.75, frame, 0.25, 0, frame)
        cv2.rectangle(frame, (10, 10), (10 + card_w, 10 + card_h), theme["hud_accent"], 1, cv2.LINE_AA)

        # Title / Brand
        cv2.putText(frame, "LUMINA CV VISION & THERMAL", (22, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.50, theme["hud_accent"], 2, cv2.LINE_AA)
        cv2.line(frame, (20, 40), (10 + card_w - 10, 40), theme["hud_accent"], 1)

        # Thermal Telemetry status string
        if self.settings.show_thermal:
            t_cmap = self.settings.current_thermal_colormap.upper()
            t_blend = self.settings.current_thermal_blend_mode.upper()
            if thermal_result and thermal_result.primary_temp_c is not None:
                if self.settings.temp_unit == "F":
                    t_str = f"ON ({t_cmap}/{t_blend}) | {thermal_result.primary_temp_f:.1f}°F"
                else:
                    t_str = f"ON ({t_cmap}/{t_blend}) | {thermal_result.primary_temp_c:.1f}°C"
            else:
                t_str = f"ON ({t_cmap}/{t_blend})"
        else:
            t_str = "OFF"

        stats = [
            f"FPS: {self._fps_smoothed:.1f} | Latency: {detections.inference_time_ms:.1f}ms | {w}x{h}",
            f"Thermal Vision: {t_str}",
            f"Faces: {len(detections.faces)} (478 pts) | Mesh: {'ON' if self.settings.show_face_mesh else 'OFF'}",
            f"Pose: {len(detections.poses)} (33 pts) | Skn: {'ON' if self.settings.show_pose_skeleton else 'OFF'}",
            f"Hands: {len(detections.hands)} (21 pts) | Show: {'ON' if self.settings.show_hands else 'OFF'}",
            f"CV Edge Filter: {'ON (' + self.settings.edge_filter_type.upper() + ')' if self.settings.show_edge_filter else 'OFF'}",
            f"Camera Mirror: {'FLIPPED' if self.settings.flip_horizontal else 'NORMAL (UNFLIPPED)'}",
            f"Theme: {self.settings.current_theme_name.upper()} | Glow: {'ON' if self.settings.glow_effect else 'OFF'}",
        ]

        for i, text in enumerate(stats):
            y_pos = 58 + i * 19
            cv2.putText(frame, text, (22, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.38, theme["hud_text"], 1, cv2.LINE_AA)

        # Bottom Shortcut Hints Bar
        hint_card_w, hint_card_h = 740, 28
        hx1, hy1 = 10, h - 38
        hint_overlay = frame.copy()
        cv2.rectangle(hint_overlay, (hx1, hy1), (hx1 + hint_card_w, hy1 + hint_card_h), theme["hud_bg"], -1)
        cv2.addWeighted(hint_overlay, 0.75, frame, 0.25, 0, frame)
        cv2.rectangle(frame, (hx1, hy1), (hx1 + hint_card_w, hy1 + hint_card_h), theme["hud_accent"], 1, cv2.LINE_AA)
        
        hints = "[U] Thermal  [O] CMap  [K] Blend  [I] °C/°F  [F] Face  [B] Pose  [H] Hand  [E] Edge  [M] Mirror  [Q] Exit"
        cv2.putText(frame, hints, (hx1 + 8, hy1 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (230, 230, 230), 1, cv2.LINE_AA)

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
