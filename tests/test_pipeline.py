"""
Automated Test Suite for Face & Body Vertices, Edges & Thermal Detection System
"""

import unittest
from pathlib import Path
import numpy as np
import cv2

from src.config import (
    AppSettings,
    THEMES,
    THEME_NAMES,
    THERMAL_COLORMAPS,
    THERMAL_BLEND_MODES,
    SNAPSHOTS_DIR,
)
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
from src.thermal_engine import ThermalEngine, TemperatureSpot, ThermalFrameResult
from src.rppg import RPPGDetector, RPPGResult
from src.visualizer import FrameVisualizer


class TestDetectionPipeline(unittest.TestCase):
    """Test suite verifying detector, edge filtering, thermal engine, and visualizer modules."""

    def setUp(self):
        self.settings = AppSettings()
        self.width = 640
        self.height = 480
        # Create a sample frame with shapes to test edge detection and visualization
        self.test_frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        cv2.circle(self.test_frame, (320, 180), 80, (200, 180, 160), -1)  # Head shape
        cv2.rectangle(self.test_frame, (260, 260), (380, 440), (120, 90, 80), -1)  # Torso shape

        # Create dummy detections
        face_lms = [
            LandmarkPoint(x=0.5, y=0.3, z=0.0, px=320, py=150)
            for _ in range(478)
        ]
        face_lms[10].px, face_lms[10].py = 320, 120  # Forehead
        face_lms[151].px, face_lms[151].py = 320, 140
        face_lms[33].px, face_lms[33].py = 300, 160  # Left eye canthus
        face_lms[263].px, face_lms[263].py = 340, 160  # Right eye canthus

        pose_lms = [
            LandmarkPoint(x=0.5, y=0.5, z=0.0, px=320, py=240, visibility=0.9)
            for _ in range(33)
        ]
        pose_lms[11].px, pose_lms[11].py = 280, 260  # Left shoulder
        pose_lms[12].px, pose_lms[12].py = 360, 260  # Right shoulder
        pose_lms[15].px, pose_lms[15].py = 230, 360  # Left wrist
        pose_lms[16].px, pose_lms[16].py = 410, 360  # Right wrist
        pose_lms[23].px, pose_lms[23].py = 290, 380  # Left hip
        pose_lms[24].px, pose_lms[24].py = 350, 380  # Right hip

        hand_lms = [
            LandmarkPoint(x=0.2, y=0.5, z=0.0, px=150, py=250)
            for _ in range(21)
        ]

        self.sample_detections = FrameDetections(
            faces=[DetectedFace(landmarks=face_lms)],
            poses=[DetectedPose(landmarks=pose_lms)],
            hands=[DetectedHand(landmarks=hand_lms)],
            inference_time_ms=12.5,
        )

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
        visualizer.update_fps(30.0)
        rendered = visualizer.render(self.test_frame, self.sample_detections)
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

    def test_thermal_engine_simulation_and_spots(self):
        """Verify ThermalEngine computes thermal heatmap and realistic spot temperatures."""
        thermal_engine = ThermalEngine(self.settings)
        result = thermal_engine.process(self.test_frame, self.sample_detections)

        self.assertIsInstance(result, ThermalFrameResult)
        self.assertEqual(result.thermal_bgr.shape, (self.height, self.width, 3))
        self.assertGreater(len(result.spots), 0)

        # Check forehead and chest spots
        spot_labels = [s.label for s in result.spots]
        self.assertIn("Forehead", spot_labels)
        self.assertIn("Core Chest", spot_labels)

        # Temperatures should be within normal human range
        forehead_spot = next(s for s in result.spots if s.label == "Forehead")
        self.assertGreaterEqual(forehead_spot.temp_c, 35.0)
        self.assertLessEqual(forehead_spot.temp_c, 40.0)

        # Test Fahrenheit conversion
        expected_f = (forehead_spot.temp_c * 9.0 / 5.0) + 32.0
        self.assertAlmostEqual(forehead_spot.temp_f, expected_f, places=1)

    def test_thermal_fever_detection(self):
        """Verify fever threshold triggers fever alert flags."""
        self.settings.fever_threshold_c = 36.0  # Set low threshold to trigger fever flag
        thermal_engine = ThermalEngine(self.settings)
        result = thermal_engine.process(self.test_frame, self.sample_detections)

        self.assertTrue(result.fever_detected)
        fever_spots = [s for s in result.spots if s.is_fever]
        self.assertGreater(len(fever_spots), 0)

    def test_thermal_colormaps_and_blend_modes(self):
        """Verify all thermal colormaps and blend modes execute without error."""
        thermal_engine = ThermalEngine(self.settings)
        visualizer = FrameVisualizer(self.settings)
        self.settings.show_thermal = True

        for cmap in THERMAL_COLORMAPS:
            self.settings.thermal_colormap_idx = THERMAL_COLORMAPS.index(cmap)
            self.assertEqual(self.settings.current_thermal_colormap, cmap)
            result = thermal_engine.process(self.test_frame, self.sample_detections)
            self.assertEqual(result.thermal_bgr.shape, (self.height, self.width, 3))

            for blend_mode in THERMAL_BLEND_MODES:
                self.settings.thermal_blend_mode_idx = THERMAL_BLEND_MODES.index(blend_mode)
                self.assertEqual(self.settings.current_thermal_blend_mode, blend_mode)
                rendered = visualizer.render(
                    self.test_frame,
                    self.sample_detections,
                    thermal_result=result,
                    thermal_engine=thermal_engine,
                )
                self.assertEqual(rendered.shape, (self.height, self.width, 3))

    def test_thermal_scale_legend_drawing(self):
        """Verify vertical thermal scale legend draws onto frame."""
        thermal_engine = ThermalEngine(self.settings)
        frame_copy = self.test_frame.copy()
        thermal_engine.draw_thermal_scale_legend(frame_copy, min_temp_c=20.0, max_temp_c=40.0)
        # Verify frame was modified
        self.assertFalse(np.array_equal(frame_copy, self.test_frame))

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

    def test_rppg_initialization_and_reset(self):
        """Verify RPPGDetector initializes and resets properly."""
        rppg = RPPGDetector(self.settings)
        self.assertEqual(rppg.buffer_size, self.settings.rppg_buffer_size)
        res = rppg.process(self.test_frame, self.sample_detections)
        self.assertIsInstance(res, RPPGResult)
        self.assertFalse(res.is_valid)  # Buffer not filled yet
        self.assertGreaterEqual(res.buffer_progress, 0.0)

        rppg.reset()
        self.assertEqual(len(rppg._timestamps), 0)
        self.assertEqual(len(rppg._waveform_buffer), 0)

    def test_rppg_spectral_bpm_estimation(self):
        """Verify rPPG extracts accurate Heart Rate (BPM) from synthetic sinusoidal pulsed signal."""
        rppg = RPPGDetector(self.settings)
        fs = 30.0  # 30 fps
        target_bpm = 75.0  # 1.25 Hz
        target_freq = target_bpm / 60.0

        # Simulate 120 frames (~4 seconds) of pulsating skin tone
        for i in range(120):
            t = i / fs
            # Sinusoidal micro-color pulse on green channel
            pulse = 3.0 * np.sin(2 * np.pi * target_freq * t)
            sim_frame = self.test_frame.copy()
            sim_frame[:, :, 1] = np.clip(sim_frame[:, :, 1].astype(np.float32) + pulse, 0, 255).astype(np.uint8)

            res = rppg.process(sim_frame, self.sample_detections, timestamp_sec=t)

        self.assertIsNotNone(res.bpm)
        # Expected within +/- 3 BPM of ground truth 75 BPM
        self.assertAlmostEqual(res.bpm, target_bpm, delta=3.5)
        self.assertGreater(len(res.waveform), 0)
        self.assertTrue(res.is_valid)

    def test_rppg_visualizer_rendering(self):
        """Verify FrameVisualizer renders rPPG heart rate badge, pulse wave, and ROI without error."""
        visualizer = FrameVisualizer(self.settings)
        self.settings.show_rppg = True
        dummy_rppg = RPPGResult(
            bpm=72.0,
            snr_db=8.5,
            confidence=0.85,
            is_valid=True,
            buffer_progress=1.0,
            waveform=[0.1, 0.5, 0.9, 0.2, -0.4, -0.8, -0.2, 0.4],
            pulse_phase=0.5,
            roi_boxes=[(100, 100, 50, 40)],
        )
        rendered = visualizer.render(
            self.test_frame,
            self.sample_detections,
            rppg_result=dummy_rppg,
        )
        self.assertEqual(rendered.shape, (self.height, self.width, 3))
        # Ensure visual output is modified by the render pass
        self.assertFalse(np.array_equal(rendered, self.test_frame))


if __name__ == "__main__":
    unittest.main()

