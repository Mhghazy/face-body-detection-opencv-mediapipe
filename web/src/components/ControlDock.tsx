"use client";

import React from "react";
import {
  Eye,
  User,
  Sparkles,
  Flame,
  Activity,
  Scan,
  Zap,
  FlipHorizontal,
  LayoutDashboard,
  Camera,
  Video,
  Sliders,
  SwitchCamera,
} from "lucide-react";
import { soundSynth } from "@/lib/audio/soundSynth";
import { ThemeColors } from "@/lib/themes/themeConfig";

interface ControlDockProps {
  theme: ThemeColors;
  showFace: boolean;
  onToggleFace: () => void;
  showPose: boolean;
  onTogglePose: () => void;
  showHands: boolean;
  onToggleHands: () => void;
  showThermal: boolean;
  onToggleThermal: () => void;
  showRppg: boolean;
  onToggleRppg: () => void;
  showEdges: boolean;
  onToggleEdges: () => void;
  glowEnabled: boolean;
  onToggleGlow: () => void;
  isMirrored: boolean;
  onToggleMirror: () => void;
  showHud: boolean;
  onToggleHud: () => void;
  onTakeSnapshot: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onOpenStudio?: () => void;
  onToggleFacingMode?: () => void;
  isStudioOpen?: boolean;
}

const ControlDockComponent: React.FC<ControlDockProps> = ({
  theme,
  showFace,
  onToggleFace,
  showPose,
  onTogglePose,
  showHands,
  onToggleHands,
  showThermal,
  onToggleThermal,
  showRppg,
  onToggleRppg,
  showEdges,
  onToggleEdges,
  glowEnabled,
  onToggleGlow,
  isMirrored,
  onToggleMirror,
  showHud,
  onToggleHud,
  onTakeSnapshot,
  isRecording,
  onToggleRecording,
  onOpenStudio,
  onToggleFacingMode,
  isStudioOpen,
}) => {
  return (
    <>
      {/* Mobile Streamlined Thumb Bar (< 768px) */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-between gap-3 px-4 py-2.5 rounded-full bg-slate-950/90 border border-cyan-500/40 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.85)] max-w-[92vw] safe-bottom">
        {/* Studio Drawer Opener */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onOpenStudio?.();
          }}
          title="Open Control Studio"
          className={`flex flex-col items-center justify-center w-11 h-11 rounded-full transition-all active:scale-95 ${
            isStudioOpen
              ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.6)]"
              : "bg-white/10 text-cyan-300 border border-cyan-500/30"
          }`}
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Thermal Toggle */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleThermal();
          }}
          title="Toggle Thermal Heatmap"
          className={`flex flex-col items-center justify-center w-11 h-11 rounded-full transition-all active:scale-95 ${
            showThermal
              ? "bg-orange-500 text-white shadow-[0_0_15px_#ff5500] animate-pulse"
              : "bg-white/10 text-slate-300 border border-white/10"
          }`}
        >
          <Flame className="w-5 h-5" />
        </button>

        {/* Hero Center Circular Shutter Button */}
        <button
          onClick={() => {
            soundSynth.playSnapshot();
            onTakeSnapshot();
          }}
          title="Take Snapshot (Tap) / Record (Long Press)"
          className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all active:scale-90 shadow-[0_0_20px_rgba(0,240,255,0.6)] border-2 ${
            isRecording
              ? "bg-red-600 border-white animate-pulse shadow-[0_0_20px_#ff0000]"
              : "bg-cyan-400 hover:bg-cyan-300 border-white text-black"
          }`}
        >
          <div className="w-11 h-11 rounded-full border-2 border-slate-950 flex items-center justify-center">
            {isRecording ? (
              <div className="w-4 h-4 rounded-sm bg-white" />
            ) : (
              <Camera className="w-6 h-6 text-black" />
            )}
          </div>
        </button>

        {/* rPPG Vitals Toggle */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleRppg();
          }}
          title="Toggle rPPG Vitals"
          className={`flex flex-col items-center justify-center w-11 h-11 rounded-full transition-all active:scale-95 ${
            showRppg
              ? "bg-pink-500 text-white shadow-[0_0_15px_#ff007f]"
              : "bg-white/10 text-slate-300 border border-white/10"
          }`}
        >
          <Activity className="w-5 h-5" />
        </button>

        {/* Flip Camera Toggle */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            if (onToggleFacingMode) onToggleFacingMode();
            else onToggleMirror();
          }}
          title="Flip Camera"
          className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-white/10 text-slate-300 border border-white/10 transition-all active:scale-95 hover:text-white"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop / Tablet Full 11-Button Power Dock (>= 768px) */}
      <div className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-1.5 p-2 rounded-2xl bg-slate-950/85 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_12px_45px_rgba(0,0,0,0.8)] max-w-full overflow-x-auto">
        {/* Face toggle */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleFace();
          }}
          title="Toggle Face Mesh (F)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showFace
              ? "bg-cyan-950/80 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Face</span>
        </button>

        {/* Body Pose toggle */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onTogglePose();
          }}
          title="Toggle Body Pose Skeleton (B / P)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showPose
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-400/60 shadow-[0_0_12px_rgba(0,255,136,0.3)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Pose</span>
        </button>

        {/* Hands toggle */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleHands();
          }}
          title="Toggle Hand Keypoints (H)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showHands
              ? "bg-purple-950/80 text-purple-300 border border-purple-400/60 shadow-[0_0_12px_rgba(157,0,255,0.3)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Hands</span>
        </button>

        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Thermal toggle */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleThermal();
          }}
          title="Toggle Thermal Vision & Body Temperature (U)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showThermal
              ? "bg-orange-950/80 text-orange-300 border border-orange-400/60 shadow-[0_0_15px_rgba(255,85,0,0.4)] animate-pulse"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Thermal</span>
        </button>

        {/* rPPG Vitals toggle */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleRppg();
          }}
          title="Toggle rPPG Heart Rate & Vital Signs (V)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showRppg
              ? "bg-pink-950/80 text-pink-300 border border-pink-400/60 shadow-[0_0_15px_rgba(255,0,127,0.4)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>rPPG</span>
        </button>

        {/* Edge Filter toggle */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleEdges();
          }}
          title="Toggle Classical Edge Filter (E)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showEdges
              ? "bg-yellow-950/80 text-yellow-300 border border-yellow-400/60 shadow-[0_0_12px_rgba(255,230,0,0.3)]"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Scan className="w-4 h-4" />
          <span>Edges</span>
        </button>

        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Glow Nodes toggle */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleGlow();
          }}
          title="Toggle Neon Glow Shader (G)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            glowEnabled
              ? "bg-cyan-950/60 text-cyan-300 border border-cyan-400/40"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Glow</span>
        </button>

        {/* Mirror toggle */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleMirror();
          }}
          title="Toggle Mirror Flip (M)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            isMirrored
              ? "bg-white/10 text-white border border-white/20"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
          }`}
        >
          <FlipHorizontal className="w-4 h-4" />
          <span>Mirror</span>
        </button>

        {/* HUD toggle */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleHud();
          }}
          title="Toggle Telemetry HUD Card (TAB / D)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all font-mono text-[10px] min-h-[40px] ${
            showHud
              ? "bg-white/10 text-white border border-white/20"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>HUD</span>
        </button>

        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Snapshot button */}
        <button
          onClick={() => {
            soundSynth.playSnapshot();
            onTakeSnapshot();
          }}
          title="Take Annotated Snapshot (SPACE)"
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-[10px] font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] min-h-[40px]"
        >
          <Camera className="w-4 h-4" />
          <span>Photo</span>
        </button>

        {/* Record button */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleRecording();
          }}
          title="Record Live Video (R)"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl font-mono text-[10px] font-bold transition-all min-h-[40px] ${
            isRecording
              ? "bg-red-600 text-white animate-pulse shadow-[0_0_15px_#ff0000]"
              : "bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60"
          }`}
        >
          <Video className="w-4 h-4" />
          <span>{isRecording ? "Stop" : "Rec"}</span>
        </button>
      </div>
    </>
  );
};

export const ControlDock = React.memo(ControlDockComponent);
