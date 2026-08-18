"""
MediaPipe Tasks Vision Detector Engine
Wraps FaceLandmarker, PoseLandmarker, and HandLandmarker into a unified pipeline.
"""

import time
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
import mediapipe as mp

from src.config import MODEL_PATHS, AppSettings
from src.downloader import ensure_all_models

BaseOptions = mp.tasks.BaseOptions
VisionRunningMode = mp.tasks.vision.RunningMode


@dataclass
class LandmarkPoint:
    """Represents a single vertex/landmark in normalized and pixel space."""
    x: float  # Normalized [0, 1]
    y: float  # Normalized [0, 1]
    z: float  # Relative depth
    px: int   # Pixel X
    py: int   # Pixel Y
    visibility: float = 1.0
    presence: float = 1.0


@dataclass
class DetectedFace:
    """Holds 478 face landmarks (vertices)."""
    landmarks: List[LandmarkPoint]
    blendshapes: Optional[Dict[str, float]] = None


@dataclass
class DetectedPose:
    """Holds 33 body pose landmarks (vertices) and world coordinates."""
    landmarks: List[LandmarkPoint]
    world_landmarks: Optional[List[LandmarkPoint]] = None


@dataclass
class DetectedHand:
    """Holds 21 hand landmarks (vertices)."""
    landmarks: List[LandmarkPoint]
    handedness: str = "Unknown"  # "Left" or "Right"


@dataclass
class FrameDetections:
    """Unified container for all frame detections."""
    faces: List[DetectedFace] = field(default_factory=list)
    poses: List[DetectedPose] = field(default_factory=list)
    hands: List[DetectedHand] = field(default_factory=list)
    inference_time_ms: float = 0.0


class VisionDetector:
    """
    Unified detector for Face, Body Pose, and Hand keypoint detection
    using Google MediaPipe Tasks API.
    """

    def __init__(self, settings: Optional[AppSettings] = None, running_mode: VisionRunningMode = VisionRunningMode.VIDEO):
        self.settings = settings or AppSettings()
        self.running_mode = running_mode
        self._face_landmarker: Optional[mp.tasks.vision.FaceLandmarker] = None
        self._pose_landmarker: Optional[mp.tasks.vision.PoseLandmarker] = None
        self._hand_landmarker: Optional[mp.tasks.vision.HandLandmarker] = None
        self._last_timestamp_ms: int = -1

        # Ensure model files exist
        ensure_all_models(verbose=False)
        self._init_models()

    def _init_models(self) -> None:
        """Initializes Face, Pose, and Hand landmarker instances."""
        # Face Landmarker
        face_opts = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATHS["face_landmarker"])),
            running_mode=self.running_mode,
            num_faces=self.settings.max_num_faces,
            min_face_detection_confidence=self.settings.min_detection_confidence,
            min_face_presence_confidence=self.settings.min_detection_confidence,
            min_tracking_confidence=self.settings.min_tracking_confidence,
            output_face_blendshapes=False,
        )
        self._face_landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(face_opts)

        # Pose Landmarker
        pose_opts = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATHS["pose_landmarker"])),
            running_mode=self.running_mode,
            num_poses=self.settings.max_num_poses,
            min_pose_detection_confidence=self.settings.min_detection_confidence,
            min_pose_presence_confidence=self.settings.min_detection_confidence,
            min_tracking_confidence=self.settings.min_tracking_confidence,
            output_segmentation_masks=False,
        )
        self._pose_landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(pose_opts)

        # Hand Landmarker
        hand_opts = mp.tasks.vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATHS["hand_landmarker"])),
            running_mode=self.running_mode,
            num_hands=self.settings.max_num_hands,
            min_hand_detection_confidence=self.settings.min_detection_confidence,
            min_hand_presence_confidence=self.settings.min_detection_confidence,
            min_tracking_confidence=self.settings.min_tracking_confidence,
        )
        self._hand_landmarker = mp.tasks.vision.HandLandmarker.create_from_options(hand_opts)

    def _convert_landmarks(self, raw_landmarks: Any, width: int, height: int) -> List[LandmarkPoint]:
        """Converts raw NormalizedLandmarks to LandmarkPoint dataclasses with pixel coords."""
        points: List[LandmarkPoint] = []
        for lm in raw_landmarks:
            px = int(np.clip(lm.x * width, 0, width - 1))
            py = int(np.clip(lm.y * height, 0, height - 1))
            points.append(
                LandmarkPoint(
                    x=float(lm.x),
                    y=float(lm.y),
                    z=float(getattr(lm, "z", 0.0)),
                    px=px,
                    py=py,
                    visibility=float(getattr(lm, "visibility", 1.0) or 1.0),
                    presence=float(getattr(lm, "presence", 1.0) or 1.0),
                )
            )
        return points

    def process_frame(
        self,
        frame_rgb: np.ndarray,
        timestamp_ms: int,
        detect_face: bool = True,
        detect_pose: bool = True,
        detect_hands: bool = True,
    ) -> FrameDetections:
        """
        Runs inference on an RGB frame.
        
        Args:
            frame_rgb: RGB NumPy array frame (H, W, 3).
            timestamp_ms: Monotonically increasing timestamp in milliseconds.
            detect_face: Whether to execute face landmarking.
            detect_pose: Whether to execute body pose landmarking.
            detect_hands: Whether to execute hand landmarking.
            
        Returns:
            FrameDetections containing extracted vertices for faces, poses, and hands.
        """
        t_start = time.perf_counter()

        # Enforce strict timestamp monotonicity in video mode
        if self.running_mode == VisionRunningMode.VIDEO:
            if timestamp_ms <= self._last_timestamp_ms:
                timestamp_ms = self._last_timestamp_ms + 1
            self._last_timestamp_ms = timestamp_ms

        h, w = frame_rgb.shape[:2]
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        detections = FrameDetections()

        # 1. Face Landmark Detection
        if detect_face and self._face_landmarker is not None:
            if self.running_mode == VisionRunningMode.VIDEO:
                face_result = self._face_landmarker.detect_for_video(mp_image, timestamp_ms)
            else:
                face_result = self._face_landmarker.detect(mp_image)

            if face_result and face_result.face_landmarks:
                for face_lms in face_result.face_landmarks:
                    pts = self._convert_landmarks(face_lms, w, h)
                    detections.faces.append(DetectedFace(landmarks=pts))

        # 2. Body Pose Detection
        if detect_pose and self._pose_landmarker is not None:
            if self.running_mode == VisionRunningMode.VIDEO:
                pose_result = self._pose_landmarker.detect_for_video(mp_image, timestamp_ms)
            else:
                pose_result = self._pose_landmarker.detect(mp_image)

            if pose_result and pose_result.pose_landmarks:
                for pose_lms in pose_result.pose_landmarks:
                    pts = self._convert_landmarks(pose_lms, w, h)
                    detections.poses.append(DetectedPose(landmarks=pts))

        # 3. Hand Keypoint Detection
        if detect_hands and self._hand_landmarker is not None:
            if self.running_mode == VisionRunningMode.VIDEO:
                hand_result = self._hand_landmarker.detect_for_video(mp_image, timestamp_ms)
            else:
                hand_result = self._hand_landmarker.detect(mp_image)

            if hand_result and hand_result.hand_landmarks:
                for idx, hand_lms in enumerate(hand_result.hand_landmarks):
                    pts = self._convert_landmarks(hand_lms, w, h)
                    handedness = "Hand"
                    if hand_result.handedness and idx < len(hand_result.handedness):
                        if hand_result.handedness[idx] and len(hand_result.handedness[idx]) > 0:
                            handedness = hand_result.handedness[idx][0].category_name or "Hand"
                    detections.hands.append(DetectedHand(landmarks=pts, handedness=handedness))

        detections.inference_time_ms = (time.perf_counter() - t_start) * 1000.0
        return detections

    def close(self) -> None:
        """Closes all landmarker instances and releases underlying C++ resources."""
        if self._face_landmarker:
            try:
                self._face_landmarker.close()
            except Exception:
                pass
            self._face_landmarker = None

        if self._pose_landmarker:
            try:
                self._pose_landmarker.close()
            except Exception:
                pass
            self._pose_landmarker = None

        if self._hand_landmarker:
            try:
                self._hand_landmarker.close()
            except Exception:
                pass
            self._hand_landmarker = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
