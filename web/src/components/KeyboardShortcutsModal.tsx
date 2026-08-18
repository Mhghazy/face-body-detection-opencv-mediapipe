"use client";

import React from "react";
import { Keyboard, X } from "lucide-react";
import { soundSynth } from "@/lib/audio/soundSynth";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "U", desc: "Toggle Thermal Vision & Temperature Detection" },
    { key: "O", desc: "Cycle Thermal Colormap (Jet -> Hot -> Inferno -> Plasma)" },
    { key: "K", desc: "Cycle Thermal Blend Mode (Hybrid -> Full -> Masked)" },
    { key: "I", desc: "Toggle Temperature Units (°C <-> °F)" },
    { key: "F", desc: "Toggle Face Mesh Wireframe & Vertices (478v)" },
    { key: "B / P", desc: "Toggle Body Pose Skeleton & Joint Vertices (33j)" },
    { key: "H", desc: "Toggle Hand Keypoints & Finger Kinematics (21k)" },
    { key: "V", desc: "Toggle rPPG Vital Signs & Heart Rate Monitor" },
    { key: "E", desc: "Toggle Classical OpenCV Edge Detection Filter" },
    { key: "C", desc: "Cycle Edge Filter Type (Canny <-> Sobel)" },
    { key: "M", desc: "Toggle Camera Mirror / Flip Mode" },
    { key: "T", desc: "Cycle Theme (Cyberpunk -> Emerald -> Sunset -> Mono)" },
    { key: "G", desc: "Toggle Neon Glow Shader Effects" },
    { key: "TAB / D", desc: "Toggle Telemetry HUD Card" },
    { key: "SPACE", desc: "Save High-Resolution Annotated Snapshot" },
    { key: "R", desc: "Start / Stop Live Video Recording" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="max-w-xl w-full bg-slate-950/95 border border-cyan-500/40 rounded-3xl p-6 shadow-[0_15px_50px_rgba(0,0,0,0.8)] flex flex-col gap-4 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-mono font-bold tracking-wider text-cyan-200">
                INTERACTIVE KEYBOARD SHORTCUTS
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Quick commands matching Lumina CV CLI
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundSynth.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-colors"
            >
              <span className="text-xs font-mono text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-1 rounded bg-black/60 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shrink-0 ml-2 shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            onClick={() => {
              soundSynth.playClick();
              onClose();
            }}
            className="py-2 px-5 rounded-xl bg-cyan-500 text-black font-mono text-xs font-bold hover:bg-cyan-400 transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
