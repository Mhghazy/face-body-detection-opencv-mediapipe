# Lumina CV - Face and Body Vertices & Edges Detection System

An advanced, real-time Computer Vision system built with **MediaPipe (Tasks Vision API)** and **OpenCV** to detect, analyze, and visualize facial vertices (landmarks) & wireframe edges, body pose skeleton vertices & limb edges, and hand keypoints.

---

## Features

- **478 Facial Vertices & Mesh Edges**: High-density 3D face mesh tessellation, iris tracking, and outline contours (lips, eyes, eyebrows, jawline).
- **33 Body Pose Vertices & Skeleton Edges**: Full-body kinematic tracking with color-coded lateral symmetry (left side, right side, core torso).
- **21 Hand Keypoint Vertices & Kinematic Chains**: Fingertip joint accents and palm base connectivity.
- **Classical Computer Vision Edge Filters**: Integrated OpenCV Canny and Sobel edge detection overlay with adaptive thresholding.
- **Visual Themes & Neon Glow**: 4 themes (`cyberpunk`, `scifi_emerald`, `sunset_fire`, `minimal_mono`) with translucent vertex glow nodes.
- **Interactive Real-Time HUD**: Real-time FPS counter, inference latency telemetry, active detector statuses, mirror state, and keyboard shortcuts guide.
- **Zero Setup / Auto-Downloader**: Automatically downloads and verifies required MediaPipe `.task` models on first run.
- **Camera Orientation**: Default is **unflipped** (raw camera feed preserved as requested), with an interactive toggle `M` to flip/mirror if ever needed.
- **Snapshot & Recording**: Save high-res screenshots (`SPACE`) or record live video feeds (`R`).

---

## Installation

Ensure you have Python 3.9+ installed.

```bash
# Clone or navigate to the project directory
cd "d:\AI models\face detection project"

# Install dependencies
pip install -r requirements.txt
```

---

## Quickstart

### 1. Launch with Default Webcam (Flipped / Mirrored by default)
```bash
python main.py
```

### 2. Launch with Webcam Unflipped (Raw camera orientation)
```bash
python main.py --no-flip
```

### 3. Launch with a Specific Video File
```bash
python main.py --source path/to/video.mp4
```

### 4. Process a Static Image
```bash
python main.py --source path/to/photo.jpg --theme cyberpunk
```

### 5. Enable Classical Edge Filter on Startup
```bash
python main.py --edge-filter --filter-type canny --theme scifi_emerald
```

---

## Interactive Keyboard Controls

| Key | Action |
|---|---|
| `F` | Toggle Face Mesh Wireframe & Vertices |
| `B` or `P` | Toggle Body Pose Skeleton Limbs & Joint Vertices |
| `H` | Toggle Hand Keypoints & Finger Kinematics |
| `E` | Toggle Classical OpenCV Edge Detection Filter Overlay |
| `C` | Cycle Edge Filter Type (`Canny` $\leftrightarrow$ `Sobel`) |
| `M` | Toggle Camera Mirror / Flip (`Default: ON - Mirrored`) |
| `T` | Cycle Visual Color Theme (`Cyberpunk` $\to$ `Emerald` $\to$ `Sunset` $\to$ `Mono`) |
| `G` | Toggle Neon Node Glow Effects |
| `TAB` / `D` | Toggle Telemetry HUD Glassmorphic Card |
| `SPACE` | Save High-Resolution Snapshot to `snapshots/` |
| `R` | Start / Stop Video Recording to `snapshots/` |
| `Q` / `ESC` | Quit Application |

---

## CLI Options

```text
usage: main.py [-h] [--source SOURCE] [--mode {all,face,pose,hands}]
               [--theme {cyberpunk,scifi_emerald,sunset_fire,minimal_mono}]
               [--edge-filter] [--filter-type {canny,sobel}]
               [--no-glow] [--no-hud] [--width WIDTH] [--height HEIGHT]
               [--save SAVE] [--headless] [--confidence CONFIDENCE]

Options:
  --source SOURCE       Camera index (e.g. '0'), video file path, or image path.
  --mode {all,face,pose,hands}
                        Target detection mode (default: 'all').
  --theme {cyberpunk,scifi_emerald,sunset_fire,minimal_mono}
                        Initial visual theme.
  --edge-filter         Enable classical edge overlay.
  --filter-type {canny,sobel}
                        Type of edge filter.
  --no-glow             Disable glowing joint nodes.
  --no-hud              Hide HUD card.
  --width WIDTH         Webcam width resolution (default: 1280).
  --height HEIGHT       Webcam height resolution (default: 720).
  --save SAVE           Path to save output video/image.
  --headless            Run without GUI window (for testing/batch).
  --confidence CONFIDENCE
                        Confidence threshold [0.0 - 1.0].
```

---

## Architecture

```
face detection project/
├── models/                     # Auto-downloaded MediaPipe task models
│   ├── face_landmarker.task
│   ├── pose_landmarker_full.task
│   └── hand_landmarker.task
├── snapshots/                  # Saved screenshots & recordings
├── src/
│   ├── __init__.py
│   ├── config.py               # Theme palettes, topology graphs, and settings
│   ├── downloader.py           # Auto-download manager with progress tracking
│   ├── detector.py             # MediaPipe Tasks Vision wrapper (Face, Pose, Hand)
│   ├── visualizer.py           # OpenCV wireframe, vertex rendering, glow & HUD
│   └── edge_detector.py        # Classical CV Canny/Sobel algorithms
├── tests/
│   └── test_pipeline.py        # Automated test suite
├── main.py                     # CLI entry point and real-time processing loop
├── requirements.txt            # Python dependencies
└── README.md                   # Documentation
```

---

## License
MIT
