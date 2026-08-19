"use client";

import React, { useState } from "react";
import {
  Camera,
  Settings2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Keyboard,
  Sparkles,
  Server,
  Film,
  SwitchCamera,
  MoreVertical,
} from "lucide-react";
import { soundSynth } from "@/lib/audio/soundSynth";
import { ThemeColors } from "@/lib/themes/themeConfig";

interface TopNavbarProps {
  theme: ThemeColors;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  facingMode?: "user" | "environment";
  onToggleFacingMode?: () => void;
  resolution: string;
  onChangeResolution: (res: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenShortcuts: () => void;
  onOpenMediaStudio: () => void;
  backendMode: "client" | "server";
  onToggleBackendMode: () => void;
}

const TopNavbarComponent: React.FC<TopNavbarProps> = ({
  theme,
  devices,
  selectedDeviceId,
  onSelectDevice,
  facingMode = "user",
  onToggleFacingMode,
  resolution,
  onChangeResolution,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onOpenShortcuts,
  onOpenMediaStudio,
  backendMode,
  onToggleBackendMode,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="w-full z-30 flex items-center justify-between px-3 md:px-5 py-2.5 bg-slate-950/85 border-b border-cyan-500/20 backdrop-blur-xl shadow-lg safe-top">
      {/* Brand Title */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative p-1.5 md:p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.3)]">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-cyan-300 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 md:gap-2">
            <h1 className="text-sm md:text-base font-mono font-black tracking-wider text-white">
              LUMINA <span className="text-cyan-400">CV</span>
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-mono font-bold uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
              v2.0
            </span>
          </div>
          <span className="hidden sm:inline text-[10px] font-mono text-slate-400">
            Neural Multi-Modal Vision & Bio-Telemetry
          </span>
        </div>
      </div>

      {/* Desktop / Tablet Center Controls */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Device selector */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              soundSynth.playClick();
              onSelectDevice(e.target.value);
            }}
            className="bg-transparent text-slate-200 outline-none cursor-pointer max-w-[150px] truncate"
          >
            {devices.length === 0 && <option value="">Default Webcam</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId} className="bg-slate-900 text-white">
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Resolution selector */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
          <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
          <select
            value={resolution}
            onChange={(e) => {
              soundSynth.playClick();
              onChangeResolution(e.target.value);
            }}
            className="bg-transparent text-slate-200 outline-none cursor-pointer"
          >
            <option value="1280x720" className="bg-slate-900 text-white">
              720p HD (1280x720)
            </option>
            <option value="1920x1080" className="bg-slate-900 text-white">
              1080p FHD (1920x1080)
            </option>
            <option value="640x480" className="bg-slate-900 text-white">
              480p SD (640x480)
            </option>
          </select>
        </div>

        {/* Engine mode switcher */}
        <button
          onClick={() => {
            soundSynth.playModeSwitch();
            onToggleBackendMode();
          }}
          title="Switch between in-browser WASM and Python backend server"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
            backendMode === "client"
              ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              : "bg-purple-950/60 border-purple-500/40 text-purple-300 shadow-[0_0_10px_rgba(157,0,255,0.2)]"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Engine: {backendMode === "client" ? "WASM Client" : "Python API"}</span>
        </button>
      </div>

      {/* Right Tools & Mobile Quick Actions */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Mobile Camera Flip Button */}
        {onToggleFacingMode && (
          <button
            onClick={() => {
              soundSynth.playModeSwitch();
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(15);
              }
              onToggleFacingMode();
            }}
            title="Switch Front/Back Camera"
            className="flex items-center gap-1 p-2 md:px-3 md:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold transition-colors min-h-[40px] min-w-[40px] justify-center"
          >
            <SwitchCamera className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">{facingMode === "user" ? "Front" : "Back"}</span>
          </button>
        )}

        {/* Media Studio Button */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onOpenMediaStudio();
          }}
          className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-xl bg-cyan-500 text-black font-mono text-xs font-bold hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] min-h-[40px]"
        >
          <Film className="w-4 h-4" />
          <span className="hidden sm:inline">Media Studio</span>
        </button>

        {/* Audio Mute/Unmute */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleMute();
          }}
          title={isMuted ? "Unmute UI Audio" : "Mute UI Audio"}
          className={`p-2 rounded-xl border transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center ${
            isMuted
              ? "bg-red-950/40 border-red-500/30 text-red-400"
              : "bg-white/5 border-white/10 text-cyan-300 hover:text-white"
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Keyboard Shortcuts (Desktop/Tablet) */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onOpenShortcuts();
          }}
          title="Keyboard Shortcuts"
          className="hidden md:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors min-h-[40px] min-w-[40px] items-center justify-center"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Fullscreen (Desktop/Tablet) */}
        <button
          onClick={() => {
            soundSynth.playClick();
            onToggleFullscreen();
          }}
          title="Toggle Fullscreen"
          className="hidden md:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors min-h-[40px] min-w-[40px] items-center justify-center"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

export const TopNavbar = React.memo(TopNavbarComponent);
