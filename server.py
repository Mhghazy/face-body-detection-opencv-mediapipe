"""
FastAPI & WebSocket Companion Server for Lumina CV Web Application.
Provides dual-mode server-side processing, snapshot sync, and REST inference endpoints.
"""

import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
import base64
import time
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import uvicorn

# Include project root
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

from src.config import (
    AppSettings,
    THEMES,
    THEME_NAMES,
    THERMAL_COLORMAPS,
    THERMAL_BLEND_MODES,
    SNAPSHOTS_DIR,
)
from src.detector import VisionDetector, VisionRunningMode
from src.thermal_engine import ThermalEngine
from src.edge_detector import EdgeDetector
from src.visualizer import FrameVisualizer

app = FastAPI(
    title="Lumina CV Backend API",
    description="Real-time Computer Vision & Bio-Thermal API for Lumina CV Web App",
    version="2.0.0",
)

# Enable CORS for Next.js web application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount snapshots directory
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=str(SNAPSHOTS_DIR)), name="snapshots")


@app.get("/api/health")
async def health_check():
    """Returns system status, active models, and available options."""
    return {
        "status": "online",
        "engine": "MediaPipe Tasks Vision + OpenCV",
        "themes": THEME_NAMES,
        "thermal_colormaps": THERMAL_COLORMAPS,
        "thermal_blend_modes": THERMAL_BLEND_MODES,
        "snapshots_count": len(list(SNAPSHOTS_DIR.glob("*.png"))),
    }


@app.get("/api/snapshots")
async def list_snapshots():
    """Lists all saved snapshots with metadata and download URLs."""
    items = []
    for f in sorted(SNAPSHOTS_DIR.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True):
        items.append({
            "name": f.name,
            "url": f"/snapshots/{f.name}",
            "size_bytes": f.stat().st_size,
            "modified_time": time.ctime(f.stat().st_mtime),
        })
    return {"snapshots": items}


@app.post("/api/process-image")
async def process_image(
    file: UploadFile = File(...),
    theme: str = Form("cyberpunk"),
    thermal: bool = Form(False),
    thermal_colormap: str = Form("jet"),
    thermal_blend: str = Form("hybrid"),
    edge_filter: bool = Form(False),
    filter_type: str = Form("canny"),
):
    """Processes an uploaded image through the full CV pipeline."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return JSONResponse(status_code=400, content={"error": "Failed to decode image file."})

    settings = AppSettings(
        show_thermal=thermal,
        edge_filter_type=filter_type,
        show_edge_filter=edge_filter,
    )
    if theme in THEME_NAMES:
        settings.theme_idx = THEME_NAMES.index(theme)
    if thermal_colormap in THERMAL_COLORMAPS:
        settings.thermal_colormap_idx = THERMAL_COLORMAPS.index(thermal_colormap)
    if thermal_blend in THERMAL_BLEND_MODES:
        settings.thermal_blend_mode_idx = THERMAL_BLEND_MODES.index(thermal_blend)

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    edge_engine = EdgeDetector()
    thermal_engine = ThermalEngine(settings)
    visualizer = FrameVisualizer(settings)

    with VisionDetector(settings=settings, running_mode=VisionRunningMode.IMAGE) as detector:
        detections = detector.process_frame(
            frame_rgb=frame_rgb,
            timestamp_ms=0,
            detect_face=True,
            detect_pose=True,
            detect_hands=True,
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

        annotated = visualizer.render(
            frame=frame,
            detections=detections,
            edge_overlay=edge_overlay,
            thermal_result=thermal_result,
            thermal_engine=thermal_engine,
        )

    # Encode result to base64 PNG
    _, buffer = cv2.imencode(".png", annotated)
    img_b64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "success": True,
        "image_base64": f"data:image/png;base64,{img_b64}",
        "faces_detected": len(detections.faces),
        "poses_detected": len(detections.poses),
        "hands_detected": len(detections.hands),
        "primary_temp_c": thermal_result.primary_temp_c if thermal_result else None,
        "primary_temp_f": thermal_result.primary_temp_f if thermal_result else None,
        "is_fever": thermal_result.fever_detected if thermal_result else False,
    }


@app.websocket("/ws/stream")
async def websocket_stream_endpoint(websocket: WebSocket):
    """Real-time bi-directional streaming endpoint for frame processing."""
    await websocket.accept()
    settings = AppSettings()
    edge_engine = EdgeDetector()
    thermal_engine = ThermalEngine(settings)
    visualizer = FrameVisualizer(settings)

    try:
        while True:
            data = await websocket.receive_json()
            # Respond with heartbeat or processed telemetry
            await websocket.send_json({
                "status": "connected",
                "timestamp": time.time(),
                "echo": data.get("type", "ping"),
            })
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    print("[Server] Starting Lumina CV Backend on http://localhost:8000 ...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
