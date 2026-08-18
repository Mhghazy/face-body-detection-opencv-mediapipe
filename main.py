"""
Main Application Entry Point
Face and Body Vertices & Edges Detection System
Using Google MediaPipe and OpenCV with Thermal Heatmap & Body Temperature Monitoring.
"""

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Union
import cv2
import numpy as np

from src.config import (
    AppSettings,
    THEMES,
    THEME_NAMES,
    THERMAL_COLORMAPS,
    THERMAL_BLEND_MODES,
    SNAPSHOTS_DIR,
)
from src.detector import VisionDetector, VisionRunningMode
from src.edge_detector import EdgeDetector
from src.thermal_engine import ThermalEngine
from src.rppg import RPPGDetector, RPPGResult
from src.visualizer import FrameVisualizer


def parse_arguments() -> argparse.Namespace:
    """Parses command line arguments."""
    parser = argparse.ArgumentParser(
        description="Lumina CV - Real-time Face & Body Vertices, Edges & Thermal Temperature Monitoring"
    )
    parser.add_argument(
        "--source",
        type=str,
        default="0",
        help="Video source: camera index (e.g. '0'), video file path, or image path.",
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=["all", "face", "pose", "hands"],
        default="all",
        help="Detection target mode: 'all', 'face', 'pose', or 'hands'.",
    )
    parser.add_argument(
        "--theme",
        type=str,
        choices=THEME_NAMES,
        default="cyberpunk",
        help="Initial visual theme palette.",
    )
    parser.add_argument(
        "--thermal",
        action="store_true",
        help="Enable thermal heatmap and body temperature detection on startup.",
    )
    parser.add_argument(
        "--rppg",
        action="store_true",
        help="Enable contactless heart-rate (rPPG) estimation and pulse waveform on startup.",
    )
    parser.add_argument(
        "--thermal-colormap",
        type=str,
        choices=THERMAL_COLORMAPS,
        default="jet",
        help="Thermal false-color palette ('jet', 'hot', 'inferno', 'plasma').",
    )
    parser.add_argument(
        "--thermal-blend",
        type=str,
        choices=THERMAL_BLEND_MODES,
        default="hybrid",
        help="Thermal overlay blending style ('hybrid', 'full', 'masked').",
    )
    parser.add_argument(
        "--temp-unit",
        type=str,
        choices=["C", "F"],
        default="C",
        help="Temperature unit to display ('C' for Celsius, 'F' for Fahrenheit).",
    )
    parser.add_argument(
        "--fever-threshold",
        type=float,
        default=37.5,
        help="Fever warning temperature threshold in Celsius (default: 37.5).",
    )
    parser.add_argument(
        "--thermal-type",
        type=str,
        choices=["sim", "hw"],
        default="sim",
        help="Thermal camera mode: 'sim' (physiological simulation) or 'hw' (radiometric USB).",
    )
    parser.add_argument(
        "--edge-filter",
        action="store_true",
        help="Enable classical OpenCV edge detection filter overlay on startup.",
    )
    parser.add_argument(
        "--filter-type",
        type=str,
        choices=["canny", "sobel"],
        default="canny",
        help="Type of classical edge filter.",
    )
    parser.add_argument(
        "--no-glow",
        action="store_true",
        help="Disable glowing accents on joint vertices.",
    )
    parser.add_argument(
        "--no-hud",
        action="store_true",
        help="Hide telemetry HUD overlay.",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1280,
        help="Requested capture width for webcam.",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=720,
        help="Requested capture height for webcam.",
    )
    parser.add_argument(
        "--save",
        type=str,
        default=None,
        help="Optional path to save processed output (video or image).",
    )
    parser.add_argument(
        "--no-flip",
        action="store_true",
        help="Disable camera horizontal mirror/flip (default: False - camera IS flipped by default).",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run without displaying GUI window (for batch/testing).",
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.5,
        help="Minimum detection confidence threshold [0.0 - 1.0].",
    )
    return parser.parse_args()


def process_static_image(
    image_path: Path,
    settings: AppSettings,
    save_path: Optional[str] = None,
    headless: bool = False,
) -> None:
    """Processes a single static image."""
    print(f"Loading image from: {image_path}")
    frame = cv2.imread(str(image_path))
    if frame is None:
        print(f"[Error] Failed to load image from {image_path}", file=sys.stderr)
        return

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    edge_engine = EdgeDetector()
    thermal_engine = ThermalEngine(settings)
    rppg_detector = RPPGDetector(settings)
    visualizer = FrameVisualizer(settings)

    print("Running MediaPipe Face & Body landmark inference...")
    with VisionDetector(settings=settings, running_mode=VisionRunningMode.IMAGE) as detector:
        detections = detector.process_frame(
            frame_rgb=frame_rgb,
            timestamp_ms=0,
            detect_face=settings.show_face_mesh or settings.show_face_vertices or settings.show_rppg,
            detect_pose=settings.show_pose_skeleton or settings.show_pose_vertices,
            detect_hands=settings.show_hands,
        )

        edge_overlay = None
        if settings.show_edge_filter:
            if settings.edge_filter_type == "canny":
                edge_mask = edge_engine.auto_canny(frame)
            else:
                edge_mask = edge_engine.sobel_edges(frame)
            edge_overlay = edge_engine.create_colored_edge_overlay(
                edge_mask, color=settings.current_theme["edge_filter"]
            )

        thermal_result = None
        if settings.show_thermal:
            thermal_result = thermal_engine.process(frame, detections)

        rppg_result = None
        if settings.show_rppg:
            rppg_result = rppg_detector.process(frame, detections)

        visualizer.update_fps(30.0)
        annotated = visualizer.render(
            frame=frame,
            detections=detections,
            edge_overlay=edge_overlay,
            thermal_result=thermal_result,
            thermal_engine=thermal_engine,
            rppg_result=rppg_result,
        )

    # Save if requested
    out_file = save_path or str(SNAPSHOTS_DIR / f"processed_{image_path.name}")
    cv2.imwrite(out_file, annotated)
    print(f"[Success] Processed image saved to: {out_file}")
    print(f"Detected: {len(detections.faces)} face(s), {len(detections.poses)} body pose(s), {len(detections.hands)} hand(s)")
    if thermal_result and thermal_result.primary_temp_c:
        print(f"Primary Temperature: {thermal_result.primary_temp_c:.1f}°C ({thermal_result.primary_temp_f:.1f}°F)")

    if not headless:
        cv2.imshow("Face & Body Vertices & Edges (Press any key to close)", annotated)
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def run_video_stream(
    source_val: Union[int, str],
    settings: AppSettings,
    save_path: Optional[str] = None,
    headless: bool = False,
    req_width: int = 1280,
    req_height: int = 720,
) -> None:
    """Runs real-time interactive video loop on webcam or video file."""
    cap = cv2.VideoCapture(source_val)
    if not cap.isOpened():
        print(f"[Error] Could not open video source: {source_val}", file=sys.stderr)
        return

    # Configure camera capture properties if source is a live webcam
    if isinstance(source_val, int):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, req_width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, req_height)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 30.0
    print(f"[Info] Video stream opened: {actual_w}x{actual_h} @ {fps_in:.1f} FPS")

    edge_engine = EdgeDetector()
    thermal_engine = ThermalEngine(settings)
    rppg_detector = RPPGDetector(settings)
    visualizer = FrameVisualizer(settings)

    # Video Writer for recording
    video_writer: Optional[cv2.VideoWriter] = None
    is_recording = False
    if save_path:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        video_writer = cv2.VideoWriter(save_path, fourcc, fps_in, (actual_w, actual_h))
        is_recording = True
        print(f"[Info] Recording output to: {save_path}")

    # Initialize MediaPipe Detector
    print("[Info] Initializing MediaPipe Vision Engine...")
    detector = VisionDetector(settings=settings, running_mode=VisionRunningMode.VIDEO)

    window_name = "Face & Body Vertices, Edges, Thermal & Heart-Rate - Lumina CV"
    if not headless:
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, min(actual_w, 1280), min(actual_h, 720))

    start_time = time.time()
    frame_count = 0
    prev_time = time.time()
    last_timestamp_ms = -1

    print("\n" + "=" * 65)
    print(" INTERACTIVE KEYBOARD CONTROLS:")
    print("  [V] Toggle Contactless Heart-Rate Estimation (rPPG) & Pulse Wave")
    print("  [U] Toggle Thermal Vision & Body Temperature Detection")
    print("  [O] Cycle Thermal Colormap (Jet -> Hot -> Inferno -> Plasma)")
    print("  [K] Cycle Thermal Blend Mode (Hybrid -> Full -> Masked)")
    print("  [I] Toggle Temperature Units (°C <-> °F)")
    print("  [ [ / ] ] Adjust Fever Alert Threshold (-0.2°C / +0.2°C)")
    print("  [F] Toggle Face Mesh (Wireframe & Vertices)")
    print("  [B] Toggle Body Skeleton (Pose Limbs & Joints)")
    print("  [H] Toggle Hands & Fingers")
    print("  [E] Toggle Classical OpenCV Edge Detection Filter")
    print("  [C] Cycle Edge Filter Type (Canny / Sobel)")
    print("  [M] Toggle Camera Mirror / Flip (Default: ON - Flipped)")
    print("  [T] Cycle Visual Theme (Cyberpunk/Emerald/Sunset/Mono)")
    print("  [G] Toggle Glowing Joint Vertices")
    print("  [TAB] / [D] Toggle Telemetry HUD Card")
    print("  [SPACE] Save Snapshot Screenshot")
    print("  [R] Toggle Video Recording to snapshots/")
    print("  [Q] / [ESC] Quit Application")
    print("=" * 65 + "\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # If video file reached end, loop or exit
                if not isinstance(source_val, int):
                    print("[Info] End of video stream.")
                break

            # Horizontally flip frame if enabled (default True)
            if settings.flip_horizontal:
                frame = cv2.flip(frame, 1)

            curr_time = time.time()
            dt = curr_time - prev_time
            prev_time = curr_time
            if dt > 0:
                visualizer.update_fps(1.0 / dt)

            timestamp_ms = int((curr_time - start_time) * 1000)
            if timestamp_ms <= last_timestamp_ms:
                timestamp_ms = last_timestamp_ms + 1
            last_timestamp_ms = timestamp_ms

            # Convert BGR to RGB for MediaPipe inference
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Determine what to detect
            detect_face = (
                settings.show_face_mesh
                or settings.show_face_vertices
                or settings.show_face_contours
                or settings.show_thermal
                or settings.show_rppg
            )
            detect_pose = settings.show_pose_skeleton or settings.show_pose_vertices or settings.show_thermal
            detect_hands = settings.show_hands or settings.show_thermal

            detections = detector.process_frame(
                frame_rgb=frame_rgb,
                timestamp_ms=timestamp_ms,
                detect_face=detect_face,
                detect_pose=detect_pose,
                detect_hands=detect_hands,
            )

            # Edge Filter Overlay (Canny or Sobel)
            edge_overlay = None
            if settings.show_edge_filter:
                if settings.edge_filter_type == "canny":
                    edge_mask = edge_engine.auto_canny(frame)
                else:
                    edge_mask = edge_engine.sobel_edges(frame)
                edge_overlay = edge_engine.create_colored_edge_overlay(
                    edge_mask, color=settings.current_theme["edge_filter"]
                )

            # Thermal Heatmap & Spot Temperatures
            thermal_result = None
            if settings.show_thermal:
                thermal_result = thermal_engine.process(frame, detections)

            # Remote Photoplethysmography (rPPG) Pulse Extraction
            rppg_result = None
            if settings.show_rppg:
                rppg_result = rppg_detector.process(frame, detections)

            # Render Visualizations
            annotated = visualizer.render(
                frame=frame,
                detections=detections,
                edge_overlay=edge_overlay,
                thermal_result=thermal_result,
                thermal_engine=thermal_engine,
                rppg_result=rppg_result,
                is_recording=is_recording,
            )

            # Save recording frame
            if is_recording and video_writer is not None:
                video_writer.write(annotated)

            frame_count += 1

            if not headless:
                cv2.imshow(window_name, annotated)
                key = cv2.waitKey(1) & 0xFF

                # Key Controls
                if key in (ord("q"), ord("Q"), 27):  # Q or ESC
                    print("[Info] Quitting application...")
                    break
                elif key in (ord("v"), ord("V")):
                    settings.show_rppg = not settings.show_rppg
                    if not settings.show_rppg:
                        rppg_detector.reset()
                    print(f"Heart Rate (rPPG): {'ON' if settings.show_rppg else 'OFF'}")
                elif key in (ord("u"), ord("U")):
                    settings.show_thermal = not settings.show_thermal
                    print(f"Thermal Vision: {'ON' if settings.show_thermal else 'OFF'}")
                elif key in (ord("o"), ord("O")):
                    new_cmap = settings.cycle_thermal_colormap()
                    print(f"Thermal Colormap: {new_cmap.upper()}")
                elif key in (ord("k"), ord("K")):
                    new_blend = settings.cycle_thermal_blend_mode()
                    print(f"Thermal Blend Mode: {new_blend.upper()}")
                elif key in (ord("i"), ord("I")):
                    new_unit = settings.toggle_temp_unit()
                    print(f"Temperature Unit: °{new_unit}")
                elif key == ord("["):
                    settings.fever_threshold_c = max(35.0, round(settings.fever_threshold_c - 0.2, 1))
                    print(f"Fever Alert Threshold: {settings.fever_threshold_c:.1f}°C")
                elif key == ord("]"):
                    settings.fever_threshold_c = min(42.0, round(settings.fever_threshold_c + 0.2, 1))
                    print(f"Fever Alert Threshold: {settings.fever_threshold_c:.1f}°C")
                elif key in (ord("f"), ord("F")):
                    settings.show_face_mesh = not settings.show_face_mesh
                    settings.show_face_vertices = settings.show_face_mesh
                    settings.show_face_contours = settings.show_face_mesh
                    print(f"Face Mesh: {'ON' if settings.show_face_mesh else 'OFF'}")
                elif key in (ord("b"), ord("B"), ord("p"), ord("P")):
                    settings.show_pose_skeleton = not settings.show_pose_skeleton
                    settings.show_pose_vertices = settings.show_pose_skeleton
                    print(f"Body Pose: {'ON' if settings.show_pose_skeleton else 'OFF'}")
                elif key in (ord("h"), ord("H")):
                    settings.show_hands = not settings.show_hands
                    print(f"Hands: {'ON' if settings.show_hands else 'OFF'}")
                elif key in (ord("e"), ord("E")):
                    settings.show_edge_filter = not settings.show_edge_filter
                    print(f"Edge Filter: {'ON' if settings.show_edge_filter else 'OFF'}")
                elif key in (ord("c"), ord("C")):
                    settings.edge_filter_type = "sobel" if settings.edge_filter_type == "canny" else "canny"
                    print(f"Edge Filter Type: {settings.edge_filter_type.upper()}")
                elif key in (ord("m"), ord("M")):
                    settings.flip_horizontal = not settings.flip_horizontal
                    print(f"Camera Mirror: {'FLIPPED' if settings.flip_horizontal else 'NORMAL (UNFLIPPED)'}")
                elif key in (ord("t"), ord("T")):
                    new_theme = settings.cycle_theme()
                    print(f"Active Theme: {new_theme.upper()}")
                elif key in (ord("g"), ord("G")):
                    settings.glow_effect = not settings.glow_effect
                    print(f"Glow Effect: {'ON' if settings.glow_effect else 'OFF'}")
                elif key in (ord("\t"), ord("d"), ord("D"), 9):
                    settings.show_hud = not settings.show_hud
                    print(f"HUD Display: {'ON' if settings.show_hud else 'OFF'}")
                elif key == 32:  # SPACE
                    time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                    snap_path = SNAPSHOTS_DIR / f"snapshot_{time_str}.png"
                    cv2.imwrite(str(snap_path), annotated)
                    visualizer.trigger_snapshot_alert(f"Saved: snapshot_{time_str}.png")
                    print(f"[Snapshot] Image saved to: {snap_path}")
                elif key in (ord("r"), ord("R")):
                    if is_recording:
                        if video_writer:
                            video_writer.release()
                            video_writer = None
                        is_recording = False
                        visualizer.trigger_snapshot_alert("Recording Stopped")
                        print("[Recording] Video saved.")
                    else:
                        time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                        rec_path = SNAPSHOTS_DIR / f"recording_{time_str}.mp4"
                        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                        video_writer = cv2.VideoWriter(str(rec_path), fourcc, 30.0, (actual_w, actual_h))
                        if video_writer.isOpened():
                            is_recording = True
                            visualizer.trigger_snapshot_alert("Recording Started...")
                            print(f"[Recording] Started recording to: {rec_path}")
                        else:
                            print(f"[Error] Failed to initialize video writer for: {rec_path}", file=sys.stderr)
                            visualizer.trigger_snapshot_alert("Recording Failed!")
                            video_writer = None

    finally:
        cap.release()
        if video_writer:
            video_writer.release()
        detector.close()
        if not headless:
            cv2.destroyAllWindows()
        print("[Info] Resources successfully released.")


def main() -> None:
    args = parse_arguments()

    # Configure application settings
    settings = AppSettings(
        show_face_mesh=(args.mode in ["all", "face"]),
        show_face_vertices=(args.mode in ["all", "face"]),
        show_face_contours=(args.mode in ["all", "face"]),
        show_pose_skeleton=(args.mode in ["all", "pose"]),
        show_pose_vertices=(args.mode in ["all", "pose"]),
        show_hands=(args.mode in ["all", "hands"]),
        show_thermal=args.thermal,
        show_rppg=args.rppg,
        temp_unit=args.temp_unit,
        fever_threshold_c=args.fever_threshold,
        thermal_mode_type=args.thermal_type,
        show_edge_filter=args.edge_filter,
        edge_filter_type=args.filter_type,
        flip_horizontal=not args.no_flip,
        glow_effect=not args.no_glow,
        show_hud=not args.no_hud,
        min_detection_confidence=args.confidence,
        min_tracking_confidence=args.confidence,
    )

    if args.theme in THEME_NAMES:
        settings.theme_idx = THEME_NAMES.index(args.theme)

    if args.thermal_colormap in THERMAL_COLORMAPS:
        settings.thermal_colormap_idx = THERMAL_COLORMAPS.index(args.thermal_colormap)

    if args.thermal_blend in THERMAL_BLEND_MODES:
        settings.thermal_blend_mode_idx = THERMAL_BLEND_MODES.index(args.thermal_blend)

    # Determine source type
    src_str = args.source.strip()
    if src_str.isdigit():
        source_val: Union[int, str] = int(src_str)
        run_video_stream(
            source_val=source_val,
            settings=settings,
            save_path=args.save,
            headless=args.headless,
            req_width=args.width,
            req_height=args.height,
        )
    else:
        src_path = Path(src_str)
        if not src_path.exists():
            print(f"[Error] Specified source file does not exist: {src_path}", file=sys.stderr)
            sys.exit(1)

        img_exts = [".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"]
        if src_path.suffix.lower() in img_exts:
            process_static_image(
                image_path=src_path,
                settings=settings,
                save_path=args.save,
                headless=args.headless,
            )
        else:
            run_video_stream(
                source_val=str(src_path),
                settings=settings,
                save_path=args.save,
                headless=args.headless,
            )


if __name__ == "__main__":
    main()
