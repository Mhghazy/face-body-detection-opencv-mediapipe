"use client";

import React from "react";
import { Flame, Thermometer, ShieldAlert, Sparkles, Sliders } from "lucide-react";
import { ThermalState } from "@/lib/thermal/thermalEngine";
import { soundSynth } from "@/lib/audio/soundSynth";

interface ThermalControlPanelProps {
  thermalState: ThermalState;
  onUpdate: (state: ThermalState) => void;
  primaryTempC: number | null;
}

const ThermalControlPanelComponent: React.FC<ThermalControlPanelProps> = ({
  thermalState,
  onUpdate,
  primaryTempC,
}) => {
  const colormaps: { id: ThermalState["colormap"]; label: string; gradient: string }[] = [
    {
      id: "jet",
      label: "Jet",
      gradient: "from-blue-600 via-green-500 via-yellow-400 to-red-600",
    },
    {
      id: "hot",
      label: "Hot",
      gradient: "from-black via-red-600 via-amber-400 to-white",
    },
    {
      id: "inferno",
      label: "Inferno",
      gradient: "from-purple-950 via-pink-600 via-orange-500 to-yellow-300",
    },
    {
      id: "plasma",
      label: "Plasma",
      gradient: "from-blue-800 via-purple-600 via-pink-500 to-yellow-400",
    },
  ];

  const blendModes: { id: ThermalState["blendMode"]; label: string; desc: string }[] = [
    { id: "hybrid", label: "Hybrid", desc: "Thermal + Landmarks" },
    { id: "full", label: "Full Heatmap", desc: "Full radiometric screen" },
    { id: "masked", label: "Masked", desc: "Body contours only" },
  ];

  const presets = [37.0, 37.5, 38.0, 38.5];

  const toggleThermal = () => {
    soundSynth.playModeSwitch();
    onUpdate({ ...thermalState, enabled: !thermalState.enabled });
  };

  const setColormap = (cmap: ThermalState["colormap"]) => {
    soundSynth.playClick();
    onUpdate({ ...thermalState, colormap: cmap });
  };

  const setBlendMode = (mode: ThermalState["blendMode"]) => {
    soundSynth.playClick();
    onUpdate({ ...thermalState, blendMode: mode });
  };

  const toggleUnit = () => {
    soundSynth.playClick();
    onUpdate({
      ...thermalState,
      tempUnit: thermalState.tempUnit === "C" ? "F" : "C",
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl bg-slate-950/85 border border-orange-500/30 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white">
      {/* Header & Main Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold tracking-wide text-orange-200">
              THERMAL VISION ENGINE
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Radiometric & Bio-Diffusion Synthesis
            </p>
          </div>
        </div>

        <button
          onClick={toggleThermal}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${
            thermalState.enabled ? "bg-orange-500 shadow-[0_0_15px_#ff5500]" : "bg-slate-800"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
              thermalState.enabled ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {thermalState.enabled && (
        <div className="flex flex-col gap-4 pt-2 border-t border-white/10 animate-fadeIn">
          {/* False-Color Palettes */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Color Palette</span>
              <span className="text-orange-400 font-bold uppercase">{thermalState.colormap}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {colormaps.map((cm) => (
                <button
                  key={cm.id}
                  onClick={() => setColormap(cm.id)}
                  className={`flex flex-col gap-1.5 p-2 rounded-xl border text-left transition-all ${
                    thermalState.colormap === cm.id
                      ? "bg-orange-950/60 border-orange-400 shadow-[0_0_12px_rgba(255,85,0,0.35)]"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className={`h-2.5 w-full rounded-md bg-gradient-to-r ${cm.gradient}`} />
                  <span className="text-xs font-mono font-semibold text-slate-200">{cm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Blend Styles */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
              Overlay Blend Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5">
              {blendModes.map((bm) => (
                <button
                  key={bm.id}
                  onClick={() => setBlendMode(bm.id)}
                  className={`py-1.5 px-2 rounded-lg text-center text-xs font-mono transition-all ${
                    thermalState.blendMode === bm.id
                      ? "bg-orange-500/80 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {bm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Slider */}
          {thermalState.blendMode !== "full" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>Thermal Intensity Alpha</span>
                <span className="text-orange-400 font-bold">{Math.round(thermalState.blendAlpha * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={thermalState.blendAlpha}
                onChange={(e) =>
                  onUpdate({ ...thermalState, blendAlpha: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          )}

          {/* Unit Toggle & Fever Threshold */}
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span>Temperature Unit</span>
              </div>
              <button
                onClick={toggleUnit}
                className="px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold hover:bg-cyan-900/60 transition-colors"
              >
                Switch to °{thermalState.tempUnit === "C" ? "F" : "C"}
              </button>
            </div>

            {/* Fever Threshold Setting */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span className="flex items-center gap-1 text-red-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Fever Warning Threshold
                </span>
                <span className="font-bold text-red-400 text-xs">
                  {thermalState.feverThresholdC.toFixed(1)}°C /{" "}
                  {((thermalState.feverThresholdC * 9) / 5 + 32).toFixed(1)}°F
                </span>
              </div>

              <input
                type="range"
                min="35.5"
                max="39.5"
                step="0.1"
                value={thermalState.feverThresholdC}
                onChange={(e) =>
                  onUpdate({ ...thermalState, feverThresholdC: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />

              {/* Quick Presets */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      soundSynth.playClick();
                      onUpdate({ ...thermalState, feverThresholdC: p });
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono transition-colors ${
                      thermalState.feverThresholdC === p
                        ? "bg-red-500 text-white font-bold"
                        : "bg-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p.toFixed(1)}°C
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ThermalControlPanel = React.memo(ThermalControlPanelComponent);
