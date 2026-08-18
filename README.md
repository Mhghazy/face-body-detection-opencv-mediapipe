# Lumina CV - Face & Body Vertices, Edges, Thermal & Heart-Rate (rPPG) System

An advanced, real-time Computer Vision & Biometrics system built with **MediaPipe (Tasks Vision API)** and **OpenCV** to detect, analyze, and visualize:
- Facial vertices (landmarks) & wireframe edges
- Body pose skeleton vertices & limb edges
- Hand keypoints & finger kinematics
- **Contactless Heart-Rate Estimation (Remote Photoplethysmography / rPPG) & Pulse Wave Oscilloscope**
- **Thermal Heatmap Visualization & Body Temperature Monitoring** (Simulated Bio-Physiological & Hardware Radiometric)
- Classical CV Edge Filters (Canny & Sobel)

---

## Features

- **478 Facial Vertices & Mesh Edges**: High-density 3D face mesh tessellation, iris tracking, and outline contours (lips, eyes, eyebrows, jawline).
- **33 Body Pose Vertices & Skeleton Edges**: Full-body kinematic tracking with color-coded lateral symmetry (left side, right side, core torso).
- **21 Hand Keypoint Vertices & Kinematic Chains**: Fingertip joint accents and palm base connectivity.
- **Contactless Heart-Rate (rPPG) & Pulse Wave Monitoring**:
  - **Facial Capillary Pulse Tracking**: Extracts blood volume pulse (BVP) from micro-chrominance fluctuations in forehead and cheek skin regions using the **Plane-Orthogonal-to-Skin (POS)** algorithm.
  - **Physiological Filtering**: 3rd-order Butterworth bandpass filter $[0.75\text{ Hz} - 3.0\text{ Hz}]$ ($45 - 180\text{ BPM}$) with linear detrending.
  - **Spectral Frequency Peak Detection**: Computes Fast Fourier Transform (FFT) Power Spectral Density with high sub-BPM resolution.
  - **Live Oscilloscope ECG-Style Waveform**: Renders real-time animated pulse waveform graph in the HUD.
  - **Floating Forehead Vitals Badge**: Displays live BPM, SNR confidence (dB), and an animated beating heart icon synchronously scaling to the pulse rhythm.
- **Thermal Heatmap & Body Temperature Monitoring**:
  - **Bio-Physiological Simulation**: Synthesizes continuous Gaussian heat diffusion fields with realistic core body temperatures (~36.4°C–37.2°C) and micro-perfusion fluctuations.
  - **Pixel-Accurate Face & Body Segmentation**: Isolates the human silhouette from background ambient cooling.
  - **Hardware Radiometric Support**: Ingests raw 16-bit radiometric thermal sensor frames from standard UVC thermal cameras.
  - **Spot Temperature Badges**: Anchors floating temperature tags to the forehead (clinical surrogate), core chest, and hands.
  - **Multi-Palette Colormaps**: `JET`, `HOT`, `INFERNO`, and `PLASMA`.
  - **Blend Styles**: `Hybrid` overlay, `Full Thermal`, and `Masked`.
  - **Fever Alert System**: Detects elevated temperatures exceeding configurable threshold (>37.5°C) with flashing alerts.
  - **Thermal Scale Legend Bar**: Vertical gradient calibration bar with min/max scale markers.
- **Classical Computer Vision Edge Filters**: Integrated OpenCV Canny and Sobel edge detection overlay with adaptive thresholding.
- **Visual Themes & Neon Glow**: 4 themes (`cyberpunk`, `scifi_emerald`, `sunset_fire`, `minimal_mono`) with translucent vertex glow nodes.
- **Interactive Real-Time HUD**: Real-time FPS counter, inference latency telemetry, heart rate, thermal status, mirror state, and keyboard shortcuts guide.
- **Zero Setup / Auto-Downloader**: Automatically downloads and verifies required MediaPipe `.task` models on first run.
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

### 1. Launch with Default Webcam (Flipped / Mirrored)
```bash
python main.py
```

### 2. Launch with Contactless Heart-Rate (rPPG) Pulse Monitoring
```bash
python main.py --rppg
```

### 3. Launch with Thermal Heatmap & Body Temperature Monitoring
```bash
python main.py --thermal --thermal-colormap jet --thermal-blend hybrid
```

### 4. Launch with Both Heart-Rate and Thermal Vision
```bash
python main.py --rppg --thermal
```

### 5. Launch with Webcam Unflipped (Raw camera orientation)
```bash
python main.py --no-flip
```

### 6. Launch with a Specific Video File
```bash
python main.py --source path/to/video.mp4
```

### 7. Process a Static Image
```bash
python main.py --source path/to/photo.jpg --theme cyberpunk
```

---

## Interactive Keyboard Controls

| Key | Action |
|---|---|
| `V` | **Toggle Contactless Heart-Rate Estimation (rPPG) & Pulse Wave** |
| `U` | **Toggle Thermal Vision & Temperature Detection** |
| `O` | **Cycle Thermal Colormap** (`Jet` $\to$ `Hot` $\to$ `Inferno` $\to$ `Plasma`) |
| `K` | **Cycle Thermal Blend Mode** (`Hybrid` $\to$ `Full` $\to$ `Masked`) |
| `I` | **Toggle Temperature Units** (`°C` $\leftrightarrow$ `°F`) |
| `[` / `]` | **Adjust Fever Alert Threshold** ($-0.2^\circ\text{C}$ / $+0.2^\circ\text{C}$) |
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
               [--rppg] [--thermal] [--thermal-colormap {jet,hot,inferno,plasma}]
               [--thermal-blend {hybrid,full,masked}] [--temp-unit {C,F}]
               [--fever-threshold FEVER_THRESHOLD] [--thermal-type {sim,hw}]
               [--edge-filter] [--filter-type {canny,sobel}]
               [--no-glow] [--no-hud] [--width WIDTH] [--height HEIGHT]
               [--save SAVE] [--no-flip] [--headless] [--confidence CONFIDENCE]

Options:
  --source SOURCE       Camera index (e.g. '0'), video file path, or image path.
  --mode {all,face,pose,hands}
                        Target detection mode (default: 'all').
  --theme {cyberpunk,scifi_emerald,sunset_fire,minimal_mono}
                        Initial visual theme.
  --rppg                Enable contactless heart-rate (rPPG) estimation and pulse waveform.
  --thermal             Enable thermal heatmap and body temperature detection.
  --thermal-colormap {jet,hot,inferno,plasma}
                        Thermal false-color palette.
  --thermal-blend {hybrid,full,masked}
                        Thermal overlay blending style.
  --temp-unit {C,F}     Temperature unit ('C' or 'F').
  --fever-threshold FEVER_THRESHOLD
                        Fever warning temperature threshold in Celsius (default: 37.5).
  --thermal-type {sim,hw}
                        Thermal mode: 'sim' (physiological simulation) or 'hw' (radiometric USB).
  --edge-filter         Enable classical edge overlay.
  --filter-type {canny,sobel}
                        Type of edge filter.
  --no-glow             Disable glowing joint nodes.
  --no-hud              Hide HUD card.
  --width WIDTH         Webcam width resolution (default: 1280).
  --height HEIGHT       Webcam height resolution (default: 720).
  --save SAVE           Path to save output video/image.
  --no-flip             Disable camera horizontal mirror/flip.
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
│   ├── config.py               # Theme palettes, thermal & rPPG constants, AppSettings
│   ├── downloader.py           # Auto-download manager with progress tracking
│   ├── detector.py             # MediaPipe Tasks Vision wrapper (Face, Pose, Hand)
│   ├── rppg.py                 # Remote PPG heart-rate estimation & BVP pulse wave extraction
│   ├── thermal_engine.py       # Thermal simulation, segmentation & radiometric decoding
│   ├── visualizer.py           # Wireframes, oscilloscope wave, vitals badge, heatmaps & HUD
│   └── edge_detector.py        # Classical CV Canny/Sobel algorithms
├── tests/
│   └── test_pipeline.py        # Automated test suite (13 unit tests)
├── main.py                     # CLI entry point and real-time processing loop
├── requirements.txt            # Python dependencies
└── README.md                   # Documentation
```

---

## License
MIT
