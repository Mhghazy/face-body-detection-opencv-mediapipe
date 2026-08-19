"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/TopNavbar";
import { CameraViewfinder } from "@/components/CameraViewfinder";
import { TelemetryHud } from "@/components/TelemetryHud";
import { ControlDock } from "@/components/ControlDock";
import { ThermalControlPanel } from "@/components/ThermalControlPanel";
import { PulseVitalsMonitor } from "@/components/PulseVitalsMonitor";
import { EdgeFilterControls } from "@/components/EdgeFilterControls";
import { ThemeSelector } from "@/components/ThemeSelector";
import { MediaCaptureDrawer, SnapshotItem } from "@/components/MediaCaptureDrawer";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { THEMES, ThemeColors } from "@/lib/themes/themeConfig";
import { ThermalState } from "@/lib/thermal/thermalEngine";
import { VitalsState } from "@/lib/rppg/rppgEngine";
import { EdgeFilterState } from "@/lib/edge/edgeEngine";
import { soundSynth } from "@/lib/audio/soundSynth";
import { ChevronRight, Sliders, X, Sparkles } from "lucide-react";

export default function Home() {
  // Themes
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(THEMES.cyberpunk);

  // Vision Toggles
  const [showFace, setShowFace] = useState(true);
  const [showPose, setShowPose] = useState(true);
  const [showHands, setShowHands] = useState(true);
  const [showGlow, setShowGlow] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [showHud, setShowHud] = useState(true);

  // Facing mode (user = front, environment = back camera)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Thermal Vision State
  const [thermalState, setThermalState] = useState<ThermalState>({
    enabled: false,
    colormap: "jet",
    blendMode: "hybrid",
    tempUnit: "C",
    feverThresholdC: 37.5,
    blendAlpha: 0.65,
  });

  // rPPG Vitals State
  const [rppgEnabled, setRppgEnabled] = useState(true);
  const [vitals, setVitals] = useState<VitalsState>({
    bpm: 72,
    hrvMs: 45,
    respirationBpm: 16,
    confidence: 0,
    isPeak: false,
    pulseWave: [],
  });

  // Edge Filter State
  const [edgeState, setEdgeState] = useState<EdgeFilterState>({
    enabled: false,
    type: "canny",
    threshold: 65,
    alpha: 0.65,
    color: "#ffff00",
  });

  // Telemetry state
  const [fps, setFps] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [poseCount, setPoseCount] = useState(0);
  const [handCount, setHandCount] = useState(0);
  const [primaryTempC, setPrimaryTempC] = useState<number | null>(null);
  const [isFever, setIsFever] = useState(false);

  // Camera devices & resolution
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [resolution, setResolution] = useState("1280x720");

  // Media Capture state
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isMediaStudioOpen, setIsMediaStudioOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Closed by default on mobile, openable via dock/button

  // Sound & Fullscreen & Backend mode
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backendMode, setBackendMode] = useState<"client" | "server">("client");

  // Enumerate Connected Cameras
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devs) => {
          const videoDevs = devs.filter((d) => d.kind === "videoinput");
          setDevices(videoDevs);
          if (videoDevs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoDevs[0].deviceId);
          }
        })
        .catch(console.error);
    }
  }, [selectedDeviceId]);

  // Set desktop sidebar open by default on larger screens
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Recording Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      setRecordingSeconds(0);
      timer = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Telemetry callback
  const handleUpdateTelemetry = useCallback(
    (data: {
      fps: number;
      inferenceMs: number;
      faceCount: number;
      poseCount: number;
      handCount: number;
      primaryTempC: number | null;
      isFever: boolean;
      vitals: VitalsState;
    }) => {
      setFps(data.fps);
      setInferenceMs(data.inferenceMs);
      setFaceCount(data.faceCount);
      setPoseCount(data.poseCount);
      setHandCount(data.handCount);
      setPrimaryTempC(data.primaryTempC);
      setIsFever(data.isFever);
      setVitals(data.vitals);
    },
    []
  );

  // Snapshot Handlers
  const handleAddSnapshot = (snap: SnapshotItem) => {
    setSnapshots((prev) => [snap, ...prev]);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  };

  // Camera Facing Mode Toggle (Front <-> Back)
  const handleToggleFacingMode = useCallback(() => {
    setFacingMode((prev) => {
      const next = prev === "user" ? "environment" : "user";
      setIsMirrored(next === "user"); // Mirror for selfie camera, raw for environment
      return next;
    });
    setSelectedDeviceId(""); // clear exact device id to trigger facingMode constraint
  }, []);

  // Memoized Action Callbacks
  const handleToggleFace = useCallback(() => setShowFace((v) => !v), []);
  const handleTogglePose = useCallback(() => setShowPose((v) => !v), []);
  const handleToggleHands = useCallback(() => setShowHands((v) => !v), []);
  const handleToggleGlow = useCallback(() => setShowGlow((v) => !v), []);
  const handleToggleMirror = useCallback(() => setIsMirrored((v) => !v), []);
  const handleToggleHud = useCallback(() => setShowHud((v) => !v), []);
  const handleToggleRppg = useCallback(() => setRppgEnabled((v) => !v), []);
  const handleToggleRecording = useCallback(() => setIsRecording((v) => !v), []);
  const handleStopRecording = useCallback(() => setIsRecording(false), []);
  const handleToggleThermal = useCallback(
    () => setThermalState((s) => ({ ...s, enabled: !s.enabled })),
    []
  );
  const handleToggleEdges = useCallback(
    () => setEdgeState((s) => ({ ...s, enabled: !s.enabled })),
    []
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Mute audio toggle
  const toggleMute = useCallback(() => {
    const muted = soundSynth.toggleMute();
    setIsMuted(muted);
  }, []);

  return (
    <div className="flex flex-col h-full h-[100dvh] w-screen bg-[#05070a] text-slate-100 overflow-hidden select-none">
      {/* Top Navbar */}
      <TopNavbar
        theme={currentTheme}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={setSelectedDeviceId}
        facingMode={facingMode}
        onToggleFacingMode={handleToggleFacingMode}
        resolution={resolution}
        onChangeResolution={setResolution}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenMediaStudio={() => setIsMediaStudioOpen(true)}
        backendMode={backendMode}
        onToggleBackendMode={() =>
          setBackendMode((m) => (m === "client" ? "server" : "client"))
        }
      />

      {/* Main Viewport Studio */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Center Camera Viewfinder */}
        <div className="flex-1 relative h-full w-full bg-black">
          <CameraViewfinder
            theme={currentTheme}
            deviceId={selectedDeviceId}
            facingMode={facingMode}
            onToggleFacingMode={handleToggleFacingMode}
            resolution={resolution}
            isMirrored={isMirrored}
            showFace={showFace}
            showPose={showPose}
            showHands={showHands}
            showGlow={showGlow}
            thermalState={thermalState}
            onUpdateThermal={setThermalState}
            rppgEnabled={rppgEnabled}
            edgeState={edgeState}
            onUpdateTelemetry={handleUpdateTelemetry}
            onAddSnapshot={handleAddSnapshot}
            isRecording={isRecording}
            onStopRecording={handleStopRecording}
          />

          {/* Glassmorphic Telemetry HUD Overlay */}
          <TelemetryHud
            fps={fps}
            inferenceMs={inferenceMs}
            faceCount={faceCount}
            poseCount={poseCount}
            handCount={handCount}
            theme={currentTheme}
            thermalState={thermalState}
            primaryTempC={primaryTempC}
            isFever={isFever}
            vitals={vitals}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            isMirrored={isMirrored}
            visible={showHud}
            glowEnabled={showGlow}
          />

          {/* Floating Bottom Action Dock (Responsive Mobile Thumb Bar & Desktop Power Dock) */}
          <ControlDock
            theme={currentTheme}
            showFace={showFace}
            onToggleFace={handleToggleFace}
            showPose={showPose}
            onTogglePose={handleTogglePose}
            showHands={showHands}
            onToggleHands={handleToggleHands}
            showThermal={thermalState.enabled}
            onToggleThermal={handleToggleThermal}
            showRppg={rppgEnabled}
            onToggleRppg={handleToggleRppg}
            showEdges={edgeState.enabled}
            onToggleEdges={handleToggleEdges}
            glowEnabled={showGlow}
            onToggleGlow={handleToggleGlow}
            isMirrored={isMirrored}
            onToggleMirror={handleToggleMirror}
            showHud={showHud}
            onToggleHud={handleToggleHud}
            onTakeSnapshot={() => {
              const evt = new KeyboardEvent("keydown", { key: " " });
              window.dispatchEvent(evt);
            }}
            isRecording={isRecording}
            onToggleRecording={handleToggleRecording}
            onOpenStudio={() => setIsSidebarOpen((v) => !v)}
            onToggleFacingMode={handleToggleFacingMode}
            isStudioOpen={isSidebarOpen}
          />

          {/* Desktop Sidebar Toggle Button */}
          <button
            onClick={() => {
              soundSynth.playClick();
              setIsSidebarOpen(!isSidebarOpen);
            }}
            title={isSidebarOpen ? "Collapse Control Studio" : "Expand Control Studio"}
            className="hidden lg:flex absolute top-4 right-4 z-30 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/30 text-cyan-300 backdrop-blur-xl shadow-lg transition-transform"
          >
            {isSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
          </button>
        </div>

        {/* Desktop Sidebar Studio (>= 1024px) */}
        {isSidebarOpen && (
          <aside className="hidden lg:flex w-80 xl:w-96 h-full bg-slate-950/90 border-l border-cyan-500/20 backdrop-blur-2xl p-4 flex-col gap-4 overflow-y-auto z-20 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" /> VISION CONTROL STUDIO
              </span>
              <span className="text-[10px] font-mono text-slate-500">LIVE PARAMS</span>
            </div>

            {/* Theme Selector */}
            <ThemeSelector currentTheme={currentTheme} onSelectTheme={setCurrentTheme} />

            {/* rPPG Vitals Monitor */}
            <PulseVitalsMonitor
              vitals={vitals}
              enabled={rppgEnabled}
              onToggle={handleToggleRppg}
            />

            {/* Thermal Vision Controls */}
            <ThermalControlPanel
              thermalState={thermalState}
              onUpdate={setThermalState}
              primaryTempC={primaryTempC}
            />

            {/* Classical Edge Filter Controls */}
            <EdgeFilterControls
              state={edgeState}
              onUpdate={setEdgeState}
              themeEdgeColor={currentTheme.edgeFilter}
            />
          </aside>
        )}
      </div>

      {/* Mobile & Tablet Swipeable Glass Bottom Sheet (< 1024px) */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
          {/* Backdrop dismiss touch target */}
          <div
            className="flex-1 w-full"
            onClick={() => {
              soundSynth.playClick();
              setIsSidebarOpen(false);
            }}
          />

          {/* Bottom Sheet Modal Container */}
          <div className="w-full max-h-[82vh] bg-slate-950/95 border-t border-cyan-500/40 rounded-t-3xl p-5 flex flex-col gap-4 shadow-[0_-15px_40px_rgba(0,0,0,0.9)] overflow-y-auto animate-slideUp safe-bottom">
            {/* Drag Pill Handle */}
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={() => setIsSidebarOpen(false)}
                className="w-12 h-1.5 rounded-full bg-cyan-400/40 hover:bg-cyan-400 cursor-pointer transition-colors"
              />
              <div className="w-full flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" /> VISION CONTROL STUDIO
                </span>
                <button
                  onClick={() => {
                    soundSynth.playClick();
                    setIsSidebarOpen(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Theme Selector */}
            <ThemeSelector currentTheme={currentTheme} onSelectTheme={setCurrentTheme} />

            {/* rPPG Vitals Monitor */}
            <PulseVitalsMonitor
              vitals={vitals}
              enabled={rppgEnabled}
              onToggle={handleToggleRppg}
            />

            {/* Thermal Vision Controls */}
            <ThermalControlPanel
              thermalState={thermalState}
              onUpdate={setThermalState}
              primaryTempC={primaryTempC}
            />

            {/* Classical Edge Filter Controls */}
            <EdgeFilterControls
              state={edgeState}
              onUpdate={setEdgeState}
              themeEdgeColor={currentTheme.edgeFilter}
            />
          </div>
        </div>
      )}

      {/* Media Studio Drawer Modal */}
      <MediaCaptureDrawer
        isOpen={isMediaStudioOpen}
        onClose={() => setIsMediaStudioOpen(false)}
        snapshots={snapshots}
        onDeleteSnapshot={handleDeleteSnapshot}
        onTakeSnapshot={() => {
          const evt = new KeyboardEvent("keydown", { key: " " });
          window.dispatchEvent(evt);
        }}
        isRecording={isRecording}
        recordingSeconds={recordingSeconds}
        onToggleRecording={() => setIsRecording(!isRecording)}
        onUploadMedia={(file) => {
          console.log("Uploaded file:", file.name);
          alert(`File ${file.name} loaded into media buffer.`);
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
