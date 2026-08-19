"use client";

import React from "react";
import { Scan, Sliders, Palette, Zap } from "lucide-react";
import { EdgeFilterState } from "@/lib/edge/edgeEngine";
import { soundSynth } from "@/lib/audio/soundSynth";

interface EdgeFilterControlsProps {
  state: EdgeFilterState;
  onUpdate: (state: EdgeFilterState) => void;
  themeEdgeColor: string;
}

const EdgeFilterControlsComponent: React.FC<EdgeFilterControlsProps> = ({
  state,
  onUpdate,
  themeEdgeColor,
}) => {
  const toggleFilter = () => {
    soundSynth.playModeSwitch();
    onUpdate({ ...state, enabled: !state.enabled });
  };

  const setType = (type: "canny" | "sobel") => {
    soundSynth.playClick();
    onUpdate({ ...state, type });
  };

  return (
    <div className="flex flex-col gap-3.5 p-4 rounded-2xl bg-slate-950/85 border border-yellow-500/30 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold tracking-wide text-yellow-200">
              EDGE DETECTION FILTER
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Classical OpenCV Convolution & Gradients
            </p>
          </div>
        </div>

        <button
          onClick={toggleFilter}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${
            state.enabled ? "bg-yellow-500 shadow-[0_0_15px_#ffe600]" : "bg-slate-800"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
              state.enabled ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {state.enabled && (
        <div className="flex flex-col gap-3 pt-2 border-t border-white/10 animate-fadeIn">
          {/* Canny vs Sobel Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/5">
            <button
              onClick={() => setType("canny")}
              className={`py-1.5 px-3 rounded-lg text-center text-xs font-mono transition-all ${
                state.type === "canny"
                  ? "bg-yellow-500/80 text-black font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Canny (Sharp Edges)
            </button>
            <button
              onClick={() => setType("sobel")}
              className={`py-1.5 px-3 rounded-lg text-center text-xs font-mono transition-all ${
                state.type === "sobel"
                  ? "bg-yellow-500/80 text-black font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sobel (Gradient Glow)
            </button>
          </div>

          {/* Threshold Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span>Detection Sensitivity Threshold</span>
              <span className="text-yellow-400 font-bold">{state.threshold}</span>
            </div>
            <input
              type="range"
              min="20"
              max="180"
              step="5"
              value={state.threshold}
              onChange={(e) => onUpdate({ ...state, threshold: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
          </div>

          {/* Alpha Blend Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span>Edge Glow Intensity</span>
              <span className="text-yellow-400 font-bold">{Math.round(state.alpha * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={state.alpha}
              onChange={(e) => onUpdate({ ...state, alpha: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const EdgeFilterControls = React.memo(EdgeFilterControlsComponent);
