"use client";

import React from "react";
import { Activity, Flame, ShieldAlert, Video, Eye, User, Sparkles, Cpu, Layers } from "lucide-react";
import { ThemeColors } from "@/lib/themes/themeConfig";
import { ThermalState } from "@/lib/thermal/thermalEngine";
import { VitalsState } from "@/lib/rppg/rppgEngine";

interface TelemetryHudProps {
  fps: number;
  inferenceMs: number;
  faceCount: number;
  poseCount: number;
  handCount: number;
  theme: ThemeColors;
  thermalState: ThermalState;
  primaryTempC: number | null;
  isFever: boolean;
  vitals: VitalsState;
  isRecording: boolean;
  recordingSeconds: number;
  isMirrored: boolean;
  visible: boolean;
  glowEnabled: boolean;
}

const TelemetryHudComponent: React.FC<TelemetryHudProps> = ({
  fps,
  inferenceMs,
  faceCount,
  poseCount,
  handCount,
  theme,
  thermalState,
  primaryTempC,
  isFever,
  vitals,
  isRecording,
  recordingSeconds,
  isMirrored,
  visible,
  glowEnabled,
}) => {
  if (!visible) return null;

  const tempDisplay =
    primaryTempC !== null
      ? thermalState.tempUnit === "C"
        ? `${primaryTempC.toFixed(1)}°C`
        : `${((primaryTempC * 9) / 5 + 32).toFixed(1)}°F`
      : "--";

  const formatRecTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5 max-w-sm pointer-events-none select-none">
      {/* Recording Alert */}
      {isRecording && (
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-500/60 shadow-[0_0_15px_rgba(255,0,0,0.4)] backdrop-blur-md animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff0000]" />
          <span className="text-xs font-mono font-bold tracking-wider text-red-100">
            REC {formatRecTime(recordingSeconds)}
          </span>
          <span className="text-[10px] font-mono text-red-300 ml-auto">WEBM 60FPS</span>
        </div>
      )}

      {/* Fever Warning Alert Banner */}
      {thermalState.enabled && isFever && (
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-red-950/90 border-2 border-red-500 shadow-[0_0_25px_rgba(255,0,80,0.6)] backdrop-blur-xl animate-bounce">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <div className="text-[11px] font-mono font-black tracking-widest text-red-200 uppercase">
              CRITICAL: FEVER DETECTED
            </div>
            <div className="text-xs font-mono text-red-300">
              Core Temp: <span className="font-bold text-white text-sm">{tempDisplay}</span> (Limit: {thermalState.feverThresholdC}°C)
            </div>
          </div>
        </div>
      )}

      {/* Main Glassmorphic Telemetry Card */}
      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col gap-3 pointer-events-auto">
        {/* Header: System & FPS */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: theme.primaryGlow }}
            />
            <span className="text-xs font-mono font-bold tracking-wider text-white">
              LUMINA CV <span className="text-[10px] text-cyan-400">TELEMETRY</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-slate-300">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <strong className="text-white text-xs">{fps.toFixed(0)}</strong> FPS
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <strong className="text-emerald-300 text-xs">{inferenceMs}</strong>ms
            </span>
          </div>
        </div>

        {/* Entities Detected Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Eye className="w-3 h-3 text-cyan-400" /> FACE
            </div>
            <div className="text-base font-mono font-bold text-white mt-0.5">
              {faceCount > 0 ? (
                <span className="text-cyan-400">{faceCount} <span className="text-[10px] text-slate-400">/ 478v</span></span>
              ) : (
                <span className="text-slate-500">0</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <User className="w-3 h-3 text-emerald-400" /> BODY
            </div>
            <div className="text-base font-mono font-bold text-white mt-0.5">
              {poseCount > 0 ? (
                <span className="text-emerald-400">{poseCount} <span className="text-[10px] text-slate-400">/ 33j</span></span>
              ) : (
                <span className="text-slate-500">0</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Sparkles className="w-3 h-3 text-purple-400" /> HANDS
            </div>
            <div className="text-base font-mono font-bold text-white mt-0.5">
              {handCount > 0 ? (
                <span className="text-purple-400">{handCount} <span className="text-[10px] text-slate-400">/ 21k</span></span>
              ) : (
                <span className="text-slate-500">0</span>
              )}
            </div>
          </div>
        </div>

        {/* Thermal & rPPG Quick Status Bar */}
        <div className="flex items-center justify-between text-[11px] font-mono bg-black/40 p-2 rounded-xl border border-white/5">
          <div className="flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${thermalState.enabled ? "text-orange-400 animate-pulse" : "text-slate-500"}`} />
            <span className="text-slate-400">Thermal:</span>
            <span className={`font-bold ${thermalState.enabled ? "text-orange-300" : "text-slate-500"}`}>
              {thermalState.enabled ? `${thermalState.colormap.toUpperCase()} (${tempDisplay})` : "OFF"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-slate-400">rPPG:</span>
            <span className="font-bold text-pink-300">{vitals.bpm > 0 ? `${vitals.bpm} BPM` : "CALIB..."}</span>
          </div>
        </div>

        {/* Footer info pills */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1 pt-1 border-t border-white/5">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" /> Theme: <strong className="text-slate-200 capitalize">{theme.name.replace("_", " ")}</strong>
          </span>
          <span className="text-slate-500">
            {isMirrored ? "MIRROR: ON" : "MIRROR: RAW"} | GLOW: {glowEnabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>
    </div>
  );
};

export const TelemetryHud = React.memo(TelemetryHudComponent);
