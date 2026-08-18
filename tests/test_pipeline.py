"""
Automated Test Suite for Face & Body Vertices and Edges Detection System
"""

import unittest
from pathlib import Path
import numpy as np
import cv2

from src.config import AppSettings, THEMES, THEME_NAMES, SNAPSHOTS_DIR
from src.detector import (
    VisionDetector,
    VisionRunningMode,
    LandmarkPoint,
    DetectedFace,
    DetectedPose,
    DetectedHand,
    FrameDetections,
)
from src.edge_detector import EdgeDetector
from src.visualizer import FrameVisualizer


class TestDetectionPipeline(unittest.TestCase):
    """Test suite verifying detector, edge filtering, and visualizer modules."""

    def setUp(self):
        self.settings = AppSettings()
        self.width = 640
        self.height = 480
        # Create a sample frame with shapes to test edge detection and visualization
        self.test_frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        cv2.circle(self.test_frame, (320, 180), 80, (200, 180, 160), -1)  # Head shape
        cv2.rectangle(self.test_frame, (260, 260), (380, 440), (120, 90, 80), -1)  # Torso shape

    def test_edge_detector_canny_and_sobel(self):
        """Verify Canny and Sobel edge detection."""
        edge_engine = EdgeDetector()
        canny_mask = edge_engine.auto_canny(self.test_frame)
        self.assertEqual(canny_mask.shape, (self.height, self.width))
        self.assertEqual(canny_mask.dtype, np.uint8)

        sobel_mask = edge_engine.sobel_edges(self.test_frame)
        self.assertEqual(sobel_mask.shape, (self.height, self.width))

        overlay = edge_engine.create_colored_edge_overlay(canny_mask, (0, 255, 255))
        self.assertEqual(overlay.shape, (self.height, self.width, 3))

        blended = edge_engine.blend_edges_with_frame(self.test_frame, overlay, alpha=0.5)
        self.assertEqual(blended.shape, self.test_frame.shape)

    def test_auto_canny_dark_image_fallback(self):
        """Verify Canny edge detection handles zero-intensity (all black) frames safely."""
        edge_engine = EdgeDetector()
        black_frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        canny_mask = edge_engine.auto_canny(black_frame)
        self.assertEqual(canny_mask.shape, (self.height, self.width))
        self.assertEqual(canny_mask.dtype, np.uint8)

    def test_visualizer_rendering(self):
        """Verify rendering of face vertices, mesh edges, pose limbs, and HUD."""
        visualizer = FrameVisualizer(self.settings)

        # Create dummy detections to test rendering routines
        face_lms = [
            LandmarkPoint(x=0.5 + 0.05 * np.cos(t), y=0.3 + 0.05 * np.sin(t), z=0.0,
                          px=int(320 + 30 * np.cos(t)), py=int(150 + 30 * np.sin(t)))
            for t in np.linspace(0, 2 * np.pi, 478)
        ]
        pose_lms = [
            LandmarkPoint(x=0.5, y=0.5, z=0.0, px=320, py=240, visibility=0.9)
            for _ in range(33)
        ]
        # Distribute a few pose joints
        pose_lms[11].px, pose_lms[11].py = 280, 260  # Left shoulder
        pose_lms[12].px, pose_lms[12].py = 360, 260  # Right shoulder
        pose_lms[23].px, pose_lms[23].py = 290, 380  # Left hip
        pose_lms[24].px, pose_lms[24].py = 350, 380  # Right hip

        hand_lms = [
            LandmarkPoint(x=0.2, y=0.5, z=0.0, px=150, py=250)
            for _ in range(21)
        ]

        detections = FrameDetections(
            faces=[DetectedFace(landmarks=face_lms)],
            poses=[DetectedPose(landmarks=pose_lms)],
            hands=[DetectedHand(landmarks=hand_lms)],
            inference_time_ms=12.5,
        )

        visualizer.update_fps(30.0)
        rendered = visualizer.render(self.test_frame, detections)
        self.assertEqual(rendered.shape, (self.height, self.width, 3))

        # Save test output
        out_path = SNAPSHOTS_DIR / "test_verification_output.png"
        cv2.imwrite(str(out_path), rendered)
        self.assertTrue(out_path.exists())
        self.assertGreater(out_path.stat().st_size, 1000)

    def test_all_visual_themes(self):
        """Verify that all defined visual themes can be rendered without errors."""
        visualizer = FrameVisualizer(self.settings)
        detections = FrameDetections(inference_time_ms=8.0)

        for idx, theme_name in enumerate(THEME_NAMES):
            self.settings.theme_idx = idx
            self.assertEqual(self.settings.current_theme_name, theme_name)
            rendered = visualizer.render(self.test_frame, detections)
            self.assertEqual(rendered.shape, (self.height, self.width, 3))

    def test_theme_cycling(self):
        """Verify theme cycling helper rotates cleanly."""
        initial_name = self.settings.current_theme_name
        for _ in range(len(THEME_NAMES)):
            self.settings.cycle_theme()
        self.assertEqual(self.settings.current_theme_name, initial_name)

    def test_detector_initialization_and_inference(self):
        """Verify VisionDetector initialization and execution on static image."""
        frame_rgb = cv2.cvtColor(self.test_frame, cv2.COLOR_BGR2RGB)
        with VisionDetector(settings=self.settings, running_mode=VisionRunningMode.IMAGE) as detector:
            detections = detector.process_frame(
                frame_rgb=frame_rgb,
                timestamp_ms=0,
                detect_face=True,
                detect_pose=True,
                detect_hands=True,
            )
            self.assertIsInstance(detections, FrameDetections)
            self.assertGreaterEqual(detections.inference_time_ms, 0.0)

    def test_detector_video_mode_sequential_frames(self):
        """Verify VisionDetector in VIDEO mode correctly handles sequential and duplicate timestamps."""
        frame_rgb = cv2.cvtColor(self.test_frame, cv2.COLOR_BGR2RGB)
        with VisionDetector(settings=self.settings, running_mode=VisionRunningMode.VIDEO) as detector:
            # Send sequential frames
            d1 = detector.process_frame(frame_rgb, timestamp_ms=33)
            self.assertIsInstance(d1, FrameDetections)
            self.assertGreater(d1.inference_time_ms, 0.0)

            # Test duplicate timestamp - should be handled by monotonic guard without raising error
            d2 = detector.process_frame(frame_rgb, timestamp_ms=33)
            self.assertIsInstance(d2, FrameDetections)

            # Next normal frame
            d3 = detector.process_frame(frame_rgb, timestamp_ms=66)
            self.assertIsInstance(d3, FrameDetections)


if __name__ == "__main__":
    unittest.main()
