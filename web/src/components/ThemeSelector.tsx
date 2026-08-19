"use client";

import React from "react";
import { Palette, Check } from "lucide-react";
import { THEMES, ThemeColors } from "@/lib/themes/themeConfig";
import { soundSynth } from "@/lib/audio/soundSynth";

interface ThemeSelectorProps {
  currentTheme: ThemeColors;
  onSelectTheme: (theme: ThemeColors) => void;
}

const ThemeSelectorComponent: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
}) => {
  const themeList = Object.values(THEMES);

  const previewGradients: Record<string, string> = {
    cyberpunk: "from-cyan-400 via-magenta-500 to-yellow-400",
    scifi_emerald: "from-emerald-400 via-green-500 to-yellow-300",
    sunset_fire: "from-amber-400 via-orange-500 to-rose-600",
    minimal_mono: "from-slate-200 via-slate-400 to-slate-100",
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-950/85 border border-cyan-500/30 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          <Palette className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-mono font-bold tracking-wide text-cyan-200">
            VISUAL THEME PALETTE
          </h3>
          <p className="text-[11px] font-mono text-slate-400">
            Cybernetic Node & Wireframe Shaders
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
        {themeList.map((t) => {
          const isSelected = currentTheme.name === t.name;
          const grad = previewGradients[t.name] || "from-cyan-500 to-blue-600";

          return (
            <button
              key={t.name}
              onClick={() => {
                soundSynth.playModeSwitch();
                onSelectTheme(t);
              }}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${grad} shadow-sm`} />
                <span className="text-xs font-mono font-semibold text-slate-200">{t.label}</span>
              </div>
              {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ThemeSelector = React.memo(ThemeSelectorComponent);
