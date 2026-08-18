"""
Thermal Vision & Radiometric Body Temperature Engine
Provides real-time thermal heatmap synthesis, landmark hotspot temperature sampling,
radiometric 16-bit decoding, and fever alert monitoring.
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
import time
import math
import cv2
import numpy as np

from src.config import AppSettings
from src.detector import FrameDetections, LandmarkPoint


@dataclass
class TemperatureSpot:
    """Represents a discrete temperature measurement anchored to an anatomical vertex."""
    label: str
    px: int
    py: int
    temp_c: float
    temp_f: float
    is_fever: bool = False

    @classmethod
    def create(cls, label: str, px: int, py: int, temp_c: float, fever_threshold_c: float) -> "TemperatureSpot":
        temp_f = (temp_c * 9.0 / 5.0) + 32.0
        is_fever = temp_c >= fever_threshold_c
        return cls(label=label, px=px, py=py, temp_c=temp_c, temp_f=temp_f, is_fever=is_fever)


@dataclass
class ThermalFrameResult:
    """Contains rendered thermal false-color image and extracted temperature hotspots."""
    thermal_bgr: np.ndarray
    spots: List[TemperatureSpot] = field(default_factory=list)
    min_temp_c: float = 20.0
    max_temp_c: float = 40.0
    fever_detected: bool = False
    primary_temp_c: Optional[float] = None
    primary_temp_f: Optional[float] = None


COLORMAP_MAP = {
    "jet": cv2.COLORMAP_JET,
    "hot": cv2.COLORMAP_HOT,
    "inferno": cv2.COLORMAP_INFERNO,
    "plasma": cv2.COLORMAP_PLASMA,
}


class ThermalEngine:
    """
    Bio-Physiological Thermal Simulator and Radiometric Decoder.
    Synthesizes realistic thermal heat diffusion fields around face/body landmarks
    and extracts accurate clinical surrogate temperatures.
    """

    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._last_time = time.time()
        self._perfusion_phase = 0.0
        
        # Exponential moving average smoothed base temperatures for key spots
        self._ema_forehead_c: Optional[float] = None
        self._ema_chest_c: Optional[float] = None
        self._ema_alpha = 0.15

        # Pre-generate scale legend cache
        self._legend_cache: Dict[Tuple[str, int, int, str], np.ndarray] = {}

    def process(
        self,
        frame_bgr: np.ndarray,
        detections: FrameDetections,
        hardware_radiometric_raw: Optional[np.ndarray] = None,
    ) -> ThermalFrameResult:
        """
        Generates false-color thermal image and samples spot temperatures from landmarks.
        
        Args:
            frame_bgr: Input BGR camera image.
            detections: Extracted face, pose, and hand landmarks.
            hardware_radiometric_raw: Optional raw 16-bit thermal frame from physical hardware sensor.
            
        Returns:
            ThermalFrameResult containing thermal image, spot temperatures, and fever flags.
        """
        h, w = frame_bgr.shape[:2]
        now = time.time()
        dt = max(0.001, now - self._last_time)
        self._last_time = now
        self._perfusion_phase += dt * 1.5  # Slow periodic physiological breathing/pulse cycle

        if self.settings.thermal_mode_type == "hw" and hardware_radiometric_raw is not None:
            return self._process_hardware(frame_bgr, detections, hardware_radiometric_raw)
        else:
            return self._process_simulation(frame_bgr, detections, w, h)

    def _process_simulation(
        self,
        frame_bgr: np.ndarray,
        detections: FrameDetections,
        width: int,
        height: int,
    ) -> ThermalFrameResult:
        """Simulates physiological heat diffusion and calculates realistic spot temperatures."""
        # 1. Base grayscale ambient background field
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        
        # Soft bilateral filter to remove high-frequency noise for smooth thermal look
        smooth_gray = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)

        # Map ambient grayscale [0, 255] to baseline ambient temperature range [20.0°C, 28.0°C]
        temp_field = 20.0 + (smooth_gray.astype(np.float32) / 255.0) * 8.0

        # Micro-fluctuation wave
        micro_wave = 0.08 * math.sin(self._perfusion_phase) + 0.03 * math.sin(self._perfusion_phase * 2.3)

        spots: List[TemperatureSpot] = []
        fever_thresh = self.settings.fever_threshold_c
        primary_temp: Optional[float] = None

        # Mask accumulator for body and face regions
        body_mask = np.zeros((height, width), dtype=np.float32)

        # A. Process Faces (Forehead, Canthi, Nose, Face Oval)
        for face in detections.faces:
            lms = face.landmarks
            num_pts = len(lms)
            if num_pts < 468:
                continue

            # Forehead Landmark (Index 10: Top center forehead, 151: Mid forehead)
            forehead_pt = lms[10]
            forehead_mid = lms[151]
            fx, fy = forehead_pt.px, forehead_pt.py

            # Inner eye canthi (Index 33: Left eye inner corner, 263: Right eye inner corner)
            left_eye_canthus = lms[33]
            right_eye_canthus = lms[263]

            # Nose tip (Index 1)
            nose_pt = lms[1]

            # Calculate face size scale
            face_size = max(20, int(math.hypot(lms[10].px - lms[152].px, lms[10].py - lms[152].py)))
            head_radius = int(face_size * 0.45)

            # Local skin intensity modulation
            skin_brightness = float(smooth_gray[max(0, min(height-1, fy)), max(0, min(width-1, fx))]) / 255.0
            skin_offset = (skin_brightness - 0.5) * 0.3

            # Calculate raw forehead temperature (Normal baseline: 36.8°C)
            raw_forehead_c = 36.80 + skin_offset + micro_wave
            if self._ema_forehead_c is None:
                self._ema_forehead_c = raw_forehead_c
            else:
                self._ema_forehead_c = (1.0 - self._ema_alpha) * self._ema_forehead_c + self._ema_alpha * raw_forehead_c

            forehead_spot_c = round(float(self._ema_forehead_c), 1)
            primary_temp = forehead_spot_c

            spots.append(TemperatureSpot.create("Forehead", fx, fy, forehead_spot_c, fever_thresh))

            # Splat forehead heat circle (Warmer core ~36.8°C)
            cv2.circle(temp_field, (fx, fy), head_radius, forehead_spot_c, -1)
            cv2.circle(body_mask, (fx, fy), head_radius, 1.0, -1)

            # Eye canthi warmer spots
            canthus_temp = forehead_spot_c + 0.1
            cv2.circle(temp_field, (left_eye_canthus.px, left_eye_canthus.py), int(face_size * 0.12), canthus_temp, -1)
            cv2.circle(temp_field, (right_eye_canthus.px, right_eye_canthus.py), int(face_size * 0.12), canthus_temp, -1)

            # Nose cooler spot (~32.5°C)
            cv2.circle(temp_field, (nose_pt.px, nose_pt.py), int(face_size * 0.15), 32.5, -1)

        # B. Process Body Poses (Core Chest, Limbs)
        for pose in detections.poses:
            lms = pose.landmarks
            if len(lms) < 33:
                continue

            # Core Chest (Midpoint between left shoulder 11 and right shoulder 12)
            s_left, s_right = lms[11], lms[12]
            if s_left.visibility > 0.4 and s_right.visibility > 0.4:
                cx = (s_left.px + s_right.px) // 2
                cy = (s_left.py + s_right.py) // 2 + 25  # Lower slightly to sternum/chest
                torso_w = max(30, int(abs(s_right.px - s_left.px)))
                chest_radius = int(torso_w * 0.6)

                raw_chest_c = 36.65 + micro_wave
                if self._ema_chest_c is None:
                    self._ema_chest_c = raw_chest_c
                else:
                    self._ema_chest_c = (1.0 - self._ema_alpha) * self._ema_chest_c + self._ema_alpha * raw_chest_c

                chest_spot_c = round(float(self._ema_chest_c), 1)
                if primary_temp is None:
                    primary_temp = chest_spot_c

                spots.append(TemperatureSpot.create("Core Chest", cx, cy, chest_spot_c, fever_thresh))

                # Splat core body heat
                cv2.circle(temp_field, (cx, cy), chest_radius, chest_spot_c, -1)
                cv2.circle(body_mask, (cx, cy), chest_radius, 1.0, -1)

            # Hands/Wrists (Pose Landmarks 15 and 16)
            for w_idx, name in [(15, "L-Hand"), (16, "R-Hand")]:
                wrist = lms[w_idx]
                if wrist.visibility > 0.45:
                    wrist_temp_c = round(33.6 + micro_wave, 1)
                    spots.append(TemperatureSpot.create(name, wrist.px, wrist.py, wrist_temp_c, fever_thresh))
                    cv2.circle(temp_field, (wrist.px, wrist.py), 25, wrist_temp_c, -1)
                    cv2.circle(body_mask, (wrist.px, wrist.py), 25, 1.0, -1)

        # Smooth the discrete splats with large Gaussian blur to simulate continuous thermal conduction
        temp_field_smooth = cv2.GaussianBlur(temp_field, (45, 45), 0)

        # Normalize temperature field [20°C - 40°C] into [0 - 255]
        min_scale = 20.0
        max_scale = 40.0
        norm_field = np.clip((temp_field_smooth - min_scale) / (max_scale - min_scale), 0.0, 1.0)
        norm_uint8 = (norm_field * 255.0).astype(np.uint8)

        # Apply user's active colormap (JET, HOT, INFERNO, PLASMA)
        cmap_code = COLORMAP_MAP.get(self.settings.current_thermal_colormap, cv2.COLORMAP_JET)
        thermal_bgr = cv2.applyColorMap(norm_uint8, cmap_code)

        # Check if any detected spot has a fever
        fever_detected = any(s.is_fever for s in spots)
        primary_temp_f = (primary_temp * 9.0 / 5.0 + 32.0) if primary_temp is not None else None

        return ThermalFrameResult(
            thermal_bgr=thermal_bgr,
            spots=spots,
            min_temp_c=min_scale,
            max_temp_c=max_scale,
            fever_detected=fever_detected,
            primary_temp_c=primary_temp,
            primary_temp_f=primary_temp_f,
        )

    def _process_hardware(
        self,
        frame_bgr: np.ndarray,
        detections: FrameDetections,
        raw_16bit: np.ndarray,
    ) -> ThermalFrameResult:
        """Decodes raw 16-bit radiometric thermal sensor matrix."""
        # Standard UVC thermal sensor: temperature in Kelvin x 100 or Celsius x 100
        # Check median to determine if Kelvin (> 20000) or Celsius
        med_val = np.median(raw_16bit)
        if med_val > 10000:
            temp_c_matrix = (raw_16bit.astype(np.float32) / 100.0) - 273.15
        else:
            temp_c_matrix = raw_16bit.astype(np.float32) / 10.0

        min_scale = float(np.percentile(temp_c_matrix, 2))
        max_scale = float(np.percentile(temp_c_matrix, 98))
        if max_scale <= min_scale:
            max_scale = min_scale + 10.0

        norm_field = np.clip((temp_c_matrix - min_scale) / (max_scale - min_scale), 0.0, 1.0)
        norm_uint8 = (norm_field * 255.0).astype(np.uint8)

        cmap_code = COLORMAP_MAP.get(self.settings.current_thermal_colormap, cv2.COLORMAP_JET)
        thermal_bgr = cv2.applyColorMap(norm_uint8, cmap_code)

        spots: List[TemperatureSpot] = []
        fever_thresh = self.settings.fever_threshold_c
        h, w = temp_c_matrix.shape[:2]

        for face in detections.faces:
            if len(face.landmarks) >= 151:
                pt = face.landmarks[10]
                tx = max(0, min(w - 1, pt.px))
                ty = max(0, min(h - 1, pt.py))
                val_c = round(float(temp_c_matrix[ty, tx]), 1)
                spots.append(TemperatureSpot.create("Forehead", pt.px, pt.py, val_c, fever_thresh))

        for pose in detections.poses:
            if len(pose.landmarks) >= 12:
                s1, s2 = pose.landmarks[11], pose.landmarks[12]
                cx = (s1.px + s2.px) // 2
                cy = (s1.py + s2.py) // 2 + 20
                tx = max(0, min(w - 1, cx))
                ty = max(0, min(h - 1, cy))
                val_c = round(float(temp_c_matrix[ty, tx]), 1)
                spots.append(TemperatureSpot.create("Core Chest", cx, cy, val_c, fever_thresh))

        fever_detected = any(s.is_fever for s in spots)
        primary_temp = spots[0].temp_c if spots else None
        primary_temp_f = (primary_temp * 9.0 / 5.0 + 32.0) if primary_temp is not None else None

        return ThermalFrameResult(
            thermal_bgr=thermal_bgr,
            spots=spots,
            min_temp_c=min_scale,
            max_temp_c=max_scale,
            fever_detected=fever_detected,
            primary_temp_c=primary_temp,
            primary_temp_f=primary_temp_f,
        )

    def draw_thermal_scale_legend(
        self,
        frame: np.ndarray,
        min_temp_c: float = 20.0,
        max_temp_c: float = 40.0,
    ) -> None:
        """
        Renders an elegant vertical thermal gradient calibration bar on the right margin.
        """
        h, w = frame.shape[:2]
        bar_w = 18
        bar_h = min(260, h - 140)
        margin_right = 20
        top_y = 70
        bottom_y = top_y + bar_h
        bar_x = w - margin_right - bar_w

        # Generate gradient array [0 to 255] vertically
        grad_1d = np.linspace(255, 0, bar_h, dtype=np.uint8)[:, np.newaxis]
        grad_2d = np.repeat(grad_1d, bar_w, axis=1)

        cmap_code = COLORMAP_MAP.get(self.settings.current_thermal_colormap, cv2.COLORMAP_JET)
        colored_bar = cv2.applyColorMap(grad_2d, cmap_code)

        # Background plate
        plate_x1 = bar_x - 10
        plate_x2 = w - 8
        plate_y1 = top_y - 25
        plate_y2 = bottom_y + 25

        overlay = frame.copy()
        cv2.rectangle(overlay, (plate_x1, plate_y1), (plate_x2, plate_y2), (20, 20, 25), -1)
        cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
        cv2.rectangle(frame, (plate_x1, plate_y1), (plate_x2, plate_y2), (80, 80, 90), 1, cv2.LINE_AA)

        # Stamp gradient bar
        frame[top_y:bottom_y, bar_x : bar_x + bar_w] = colored_bar
        cv2.rectangle(frame, (bar_x, top_y), (bar_x + bar_w, bottom_y), (255, 255, 255), 1, cv2.LINE_AA)

        # Labels
        is_fahrenheit = self.settings.temp_unit == "F"
        unit_str = "°F" if is_fahrenheit else "°C"

        def format_val(c_val: float) -> str:
            if is_fahrenheit:
                return f"{c_val * 1.8 + 32.0:.0f}"
            return f"{c_val:.0f}"

        # Top label
        cv2.putText(frame, f"{format_val(max_temp_c)}{unit_str}", (plate_x1 + 4, top_y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1, cv2.LINE_AA)

        # Mid label
        mid_temp = (max_temp_c + min_temp_c) / 2.0
        cv2.putText(frame, f"{format_val(mid_temp)}", (plate_x1 + 6, top_y + bar_h // 2 + 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.34, (220, 220, 220), 1, cv2.LINE_AA)

        # Bottom label
        cv2.putText(frame, f"{format_val(min_temp_c)}{unit_str}", (plate_x1 + 4, bottom_y + 16),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1, cv2.LINE_AA)
