"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { WebVisionDetector, DetectionResults } from "@/lib/mediapipe/visionEngine";
import { ThermalVisionEngine, ThermalState, TemperatureSpot } from "@/lib/thermal/thermalEngine";
import { RppgVitalsEngine, VitalsState } from "@/lib/rppg/rppgEngine";
import { EdgeFilterEngine, EdgeFilterState } from "@/lib/edge/edgeEngine";
import {
  ThemeColors,
  POSE_CONNECTIONS_CORE,
  POSE_CONNECTIONS_LEFT,
  POSE_CONNECTIONS_RIGHT,
  POSE_CONNECTIONS_HEAD,
  HAND_CONNECTIONS,
  FACE_OVAL_INDICES,
  LIPS_INDICES,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  LEFT_EYEBROW_INDICES,
  RIGHT_EYEBROW_INDICES,
  LEFT_IRIS_INDICES,
  RIGHT_IRIS_INDICES,
} from "@/lib/themes/themeConfig";
import { soundSynth } from "@/lib/audio/soundSynth";
import { SnapshotItem } from "./MediaCaptureDrawer";

interface CameraViewfinderProps {
  theme: ThemeColors;
  deviceId: string;
  resolution: string;
  isMirrored: boolean;
  showFace: boolean;
  showPose: boolean;
  showHands: boolean;
  showGlow: boolean;
  thermalState: ThermalState;
  onUpdateThermal: (state: ThermalState) => void;
  rppgEnabled: boolean;
  edgeState: EdgeFilterState;
  onUpdateTelemetry: (data: {
    fps: number;
    inferenceMs: number;
    faceCount: number;
    poseCount: number;
    handCount: number;
    primaryTempC: number | null;
    isFever: boolean;
    vitals: VitalsState;
  }) => void;
  onAddSnapshot: (snap: SnapshotItem) => void;
  isRecording: boolean;
  onStopRecording: () => void;
  externalMediaSource?: HTMLVideoElement | HTMLImageElement | null;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  theme,
  deviceId,
  resolution,
  isMirrored,
  showFace,
  showPose,
  showHands,
  showGlow,
  thermalState,
  onUpdateThermal,
  rppgEnabled,
  edgeState,
  onUpdateTelemetry,
  onAddSnapshot,
  isRecording,
  onStopRecording,
  externalMediaSource,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Engines
  const visionDetectorRef = useRef<WebVisionDetector | null>(null);
  const thermalEngineRef = useRef<ThermalVisionEngine | null>(null);
  const rppgEngineRef = useRef<RppgVitalsEngine | null>(null);
  const edgeEngineRef = useRef<EdgeFilterEngine | null>(null);

  // Video stream & recorder refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // State
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [snapshotAlert, setSnapshotAlert] = useState(false);

  // FPS & Telemetry state tracking
  const fpsSmoothedRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const requestAnimRef = useRef<number | null>(null);

  // Initialize Engines
  useEffect(() => {
    thermalEngineRef.current = new ThermalVisionEngine();
    rppgEngineRef.current = new RppgVitalsEngine();
    edgeEngineRef.current = new EdgeFilterEngine();

    const detector = new WebVisionDetector();
    visionDetectorRef.current = detector;

    detector
      .initialize()
      .then((ok) => {
        setModelsLoading(false);
        if (!ok) {
          console.warn("MediaPipe Vision init warning:", detector.initError);
        }
      })
      .catch((err) => {
        console.error("MediaPipe Vision init error:", err);
        setModelsLoading(false);
      });

    return () => {
      if (requestAnimRef.current) cancelAnimationFrame(requestAnimRef.current);
    };
  }, []);

  // Initialize Webcam Stream
  const initWebcam = useCallback(async () => {
    if (externalMediaSource) return;

    setCameraError(null);
    setCameraReady(false);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const [wStr, hStr] = resolution.split("x");
      const reqW = parseInt(wStr, 10) || 1280;
      const reqH = parseInt(hStr, 10) || 720;

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: reqW },
          height: { ideal: reqH },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch (err: unknown) {
      console.error("Camera access failed:", err);
      const errMsg =
        err instanceof Error ? err.message : "Camera permission denied or camera in use.";
      setCameraError(errMsg);
    }
  }, [deviceId, resolution, externalMediaSource]);

  useEffect(() => {
    initWebcam();
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initWebcam]);

  // Video Recording Management
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isRecording) {
      recordedChunksRef.current = [];
      try {
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `lumina_video_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error("MediaRecorder start failed:", err);
        onStopRecording();
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }
  }, [isRecording, onStopRecording]);

  // Take Snapshot function exposed via keyboard / callback
  const takeSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const snap: SnapshotItem = {
      id: Date.now().toString(),
      dataUrl,
      timestamp: new Date().toLocaleTimeString(),
      entities: "Annotated Vision Frame",
      temp: thermalState.enabled ? `${thermalState.colormap.toUpperCase()} HEATMAP` : "STANDARD",
    };

    onAddSnapshot(snap);
    setSnapshotAlert(true);
    setTimeout(() => setSnapshotAlert(false), 2000);
  }, [onAddSnapshot, thermalState.enabled, thermalState.colormap]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const key = e.key.toUpperCase();
      if (key === " ") {
        e.preventDefault();
        soundSynth.playSnapshot();
        takeSnapshot();
      } else if (key === "U") {
        soundSynth.playModeSwitch();
        onUpdateThermal({ ...thermalState, enabled: !thermalState.enabled });
      } else if (key === "O") {
        soundSynth.playClick();
        const cmaps: ThermalState["colormap"][] = ["jet", "hot", "inferno", "plasma"];
        const next = cmaps[(cmaps.indexOf(thermalState.colormap) + 1) % cmaps.length];
        onUpdateThermal({ ...thermalState, colormap: next });
      } else if (key === "K") {
        soundSynth.playClick();
        const bmodes: ThermalState["blendMode"][] = ["hybrid", "full", "masked"];
        const next = bmodes[(bmodes.indexOf(thermalState.blendMode) + 1) % bmodes.length];
        onUpdateThermal({ ...thermalState, blendMode: next });
      } else if (key === "I") {
        soundSynth.playClick();
        onUpdateThermal({
          ...thermalState,
          tempUnit: thermalState.tempUnit === "C" ? "F" : "C",
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [thermalState, onUpdateThermal, takeSnapshot]);

  // Helper Drawing Functions
  const drawFaceMesh = (
    ctx: CanvasRenderingContext2D,
    landmarks: { x: number; y: number }[],
    w: number,
    h: number
  ) => {
    // 1. Draw High-Definition Contours (Jaw, Lips, Eyes, Eyebrows)
    const drawContour = (indices: number[], color: string, lineWidth = 1.5, close = true) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let started = false;
      for (const idx of indices) {
        if (idx < landmarks.length) {
          const pt = landmarks[idx];
          const px = pt.x * w;
          const py = pt.y * h;
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      if (close) ctx.closePath();
      ctx.stroke();
    };

    drawContour(FACE_OVAL_INDICES, theme.faceContour, 1.8, true);
    drawContour(LIPS_INDICES, theme.faceContour, 1.8, true);
    drawContour(LEFT_EYE_INDICES, theme.faceContour, 1.8, true);
    drawContour(RIGHT_EYE_INDICES, theme.faceContour, 1.8, true);
    drawContour(LEFT_EYEBROW_INDICES, theme.faceEdge, 1.5, false);
    drawContour(RIGHT_EYEBROW_INDICES, theme.faceEdge, 1.5, false);

    // 2. Irises
    [LEFT_IRIS_INDICES, RIGHT_IRIS_INDICES].forEach((iris) => {
      ctx.fillStyle = theme.faceVertex;
      for (const idx of iris) {
        if (idx < landmarks.length) {
          const pt = landmarks[idx];
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // 3. Dense Face Vertices
    ctx.fillStyle = theme.faceVertex;
    for (let i = 0; i < landmarks.length; i += 3) {
      const pt = landmarks[i];
      ctx.fillRect(pt.x * w - 1, pt.y * h - 1, 2, 2);
    }
  };

  const drawPoseSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: { x: number; y: number; visibility?: number }[],
    w: number,
    h: number
  ) => {
    const drawConnections = (pairs: [number, number][], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      for (const [s, e] of pairs) {
        if (s < landmarks.length && e < landmarks.length) {
          const p1 = landmarks[s];
          const p2 = landmarks[e];
          if ((p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
          }
        }
      }
    };

    drawConnections(POSE_CONNECTIONS_CORE, theme.poseCoreEdge);
    drawConnections(POSE_CONNECTIONS_LEFT, theme.poseLeftEdge);
    drawConnections(POSE_CONNECTIONS_RIGHT, theme.poseRightEdge);
    drawConnections(POSE_CONNECTIONS_HEAD, theme.poseCoreEdge);

    // Draw Joint Vertices with Glow
    landmarks.forEach((pt, idx) => {
      if ((pt.visibility ?? 1) > 0.4) {
        const px = pt.x * w;
        const py = pt.y * h;

        let nodeColor = theme.poseCoreVertex;
        if (idx % 2 === 1 && idx > 10) nodeColor = theme.poseLeftVertex;
        else if (idx % 2 === 0 && idx > 10) nodeColor = theme.poseRightVertex;

        if (showGlow) {
          ctx.fillStyle = `${nodeColor}44`;
          ctx.beginPath();
          ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  const drawHands = (
    ctx: CanvasRenderingContext2D,
    hands: { x: number; y: number }[][],
    w: number,
    h: number
  ) => {
    hands.forEach((hand) => {
      // Connections
      ctx.strokeStyle = theme.handEdge;
      ctx.lineWidth = 2;
      for (const [s, e] of HAND_CONNECTIONS) {
        if (s < hand.length && e < hand.length) {
          ctx.beginPath();
          ctx.moveTo(hand[s].x * w, hand[s].y * h);
          ctx.lineTo(hand[e].x * w, hand[e].y * h);
          ctx.stroke();
        }
      }

      // Vertices & Fingertips
      hand.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h;
        const isFingertip = [4, 8, 12, 16, 20].includes(idx);

        if (showGlow && isFingertip) {
          ctx.fillStyle = `${theme.handVertex}55`;
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = isFingertip ? "#ffffff" : theme.handVertex;
        ctx.beginPath();
        ctx.arc(px, py, isFingertip ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  };

  // Main Render & Detection Animation Loop
  useEffect(() => {
    let active = true;

    const renderLoop = (timeMs: number) => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = visionDetectorRef.current;
      const thermalEngine = thermalEngineRef.current;
      const rppgEngine = rppgEngineRef.current;
      const edgeEngine = edgeEngineRef.current;

      if (video && canvas && video.readyState >= 2) {
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;

        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          // 1. Calculate FPS
          const now = performance.now();
          const delta = (now - lastFrameTimeRef.current) / 1000.0;
          lastFrameTimeRef.current = now;
          const currentFps = delta > 0 ? 1.0 / delta : 30.0;
          fpsSmoothedRef.current =
            fpsSmoothedRef.current === 0
              ? currentFps
              : fpsSmoothedRef.current * 0.9 + currentFps * 0.1;

          // 2. Clear and Draw Video Frame (with horizontal flip if mirrored)
          ctx.save();
          if (isMirrored) {
            ctx.translate(vw, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, vw, vh);
          ctx.restore();

          // 3. Run MediaPipe Vision Detections
          let detections: DetectionResults = {
            faces: [],
            poses: [],
            hands: [],
            inferenceTimeMs: 0,
          };

          if (detector && detector.isReady) {
            detections = detector.detectForVideo(video, timeMs, {
              detectFace: showFace || thermalState.enabled || rppgEnabled,
              detectPose: showPose || thermalState.enabled,
              detectHands: showHands || thermalState.enabled,
            });
          }

          // Remap landmark X if mirrored
          const adjustLandmarks = (lms: { x: number; y: number }[]) => {
            if (!isMirrored) return lms;
            return lms.map((p) => ({ ...p, x: 1.0 - p.x }));
          };

          const activeFace = detections.faces.length > 0 ? adjustLandmarks(detections.faces[0]) : null;
          const activePose = detections.poses.length > 0 ? adjustLandmarks(detections.poses[0]) : null;
          const activeHands = detections.hands.map((h) => adjustLandmarks(h));

          // 4. Thermal False-Color Heatmap Synthesis Layer
          let primaryTempC: number | null = null;
          let isFever = false;
          let spots: TemperatureSpot[] = [];

          if (thermalState.enabled && thermalEngine) {
            const spotRes = thermalEngine.calculateSpots(
              activeFace,
              activePose,
              activeHands,
              vw,
              vh,
              thermalState.feverThresholdC,
              delta
            );
            spots = spotRes.spots;
            primaryTempC = spotRes.primaryTempC;
            isFever = spotRes.isFever;

            thermalEngine.renderThermalHeatmap(
              ctx,
              vw,
              vh,
              thermalState,
              activeFace,
              activePose,
              activeHands
            );
          }

          // 5. Classical Edge Filter Layer (Canny & Sobel)
          if (edgeState.enabled && edgeEngine) {
            edgeEngine.applyEdgeFilter(ctx, video, vw, vh, {
              ...edgeState,
              color: theme.edgeFilter,
            });
          }

          // 6. Face Mesh & Contours
          if (showFace && activeFace) {
            drawFaceMesh(ctx, activeFace, vw, vh);
          }

          // 7. Body Pose Skeleton
          if (showPose && activePose) {
            drawPoseSkeleton(ctx, activePose, vw, vh);
          }

          // 8. Hand Keypoint Kinematics
          if (showHands && activeHands.length > 0) {
            drawHands(ctx, activeHands, vw, vh);
          }

          // 9. Floating Spot Temperature Badges & Scale Legend
          if (thermalState.enabled && thermalEngine) {
            thermalEngine.renderSpotBadges(ctx, spots, thermalState.tempUnit, thermalState.feverThresholdC);
            thermalEngine.renderScaleLegend(ctx, vw, vh, thermalState);
          }

          // 10. rPPG Heart Rate & Vital Signs Processing
          let vitals: VitalsState = {
            bpm: 72,
            hrvMs: 45,
            respirationBpm: 16,
            confidence: 0,
            isPeak: false,
            pulseWave: [],
          };

          if (rppgEngine) {
            vitals = rppgEngine.processFrame(video, activeFace, timeMs);
          }

          // 11. Push Telemetry Data
          onUpdateTelemetry({
            fps: fpsSmoothedRef.current,
            inferenceMs: detections.inferenceTimeMs,
            faceCount: detections.faces.length,
            poseCount: detections.poses.length,
            handCount: detections.hands.length,
            primaryTempC,
            isFever,
            vitals,
          });
        }
      }

      requestAnimRef.current = requestAnimationFrame(renderLoop);
    };

    requestAnimRef.current = requestAnimationFrame(renderLoop);
    return () => {
      active = false;
      if (requestAnimRef.current) cancelAnimationFrame(requestAnimRef.current);
    };
  }, [
    isMirrored,
    showFace,
    showPose,
    showHands,
    showGlow,
    thermalState,
    rppgEnabled,
    edgeState,
    theme,
    onUpdateTelemetry,
  ]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Hidden Video Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
      />

      {/* Main Interactive Compositing Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain block max-w-full max-h-full"
      />

      {/* Camera Loading & Error Overlay */}
      {(!cameraReady || cameraError || modelsLoading) && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl p-6 text-center text-white gap-4">
          {cameraError ? (
            <div className="flex flex-col items-center gap-3 max-w-md">
              <div className="p-3 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-400">
                <AlertCircle className="w-8 h-8 animate-bounce" />
              </div>
              <h2 className="text-lg font-mono font-bold text-red-200">Camera Initialization Failed</h2>
              <p className="text-xs font-mono text-slate-400">{cameraError}</p>
              <button
                onClick={() => initWebcam()}
                className="mt-2 flex items-center gap-2 py-2 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                <Camera className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-mono font-bold tracking-wider text-cyan-200">
                  {modelsLoading ? "INITIALIZING NEURAL VISION WASM..." : "STARTING CAMERA SENSOR..."}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Loading FaceLandmarker, PoseLandmarker & Thermal Shaders
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Flash Alert for Snapshots */}
      {snapshotAlert && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-white/25 backdrop-blur-[2px] animate-fadeOut">
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-black/90 border border-cyan-400 text-cyan-300 font-mono text-sm font-bold shadow-[0_0_30px_rgba(0,240,255,0.6)]">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>SNAPSHOT CAPTURED & SAVED</span>
          </div>
        </div>
      )}
    </div>
  );
};
