"use client";

import React, { useEffect, useRef, useState } from "react";
import { Heart, Activity, Wind, Volume2, VolumeX, Radio } from "lucide-react";
import { VitalsState } from "@/lib/rppg/rppgEngine";
import { soundSynth } from "@/lib/audio/soundSynth";

interface PulseVitalsMonitorProps {
  vitals: VitalsState;
  enabled: boolean;
  onToggle: () => void;
}

const PulseVitalsMonitorComponent: React.FC<PulseVitalsMonitorProps> = ({
  vitals,
  enabled,
  onToggle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Play audio heartbeat sync'd to optical peaks
  useEffect(() => {
    if (enabled && soundEnabled && vitals.isPeak) {
      soundSynth.playHeartbeat();
    }
  }, [vitals.isPeak, enabled, soundEnabled]);

  // Render live PPG waveform onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background with dark slate
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const wave = vitals.pulseWave;
    if (wave.length < 2) return;

    // Draw glowing PPG trace
    ctx.save();
    ctx.strokeStyle = "#ff007f";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#ff007f";
    ctx.shadowBlur = 10;
    ctx.beginPath();

    const step = w / (wave.length - 1);
    const midY = h * 0.5;
    const amp = h * 0.38;

    for (let i = 0; i < wave.length; i++) {
      const x = i * step;
      const y = midY - wave[i] * amp;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Lead cursor dot
    const lastX = (wave.length - 1) * step;
    const lastY = midY - wave[wave.length - 1] * amp;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [vitals.pulseWave, enabled]);

  // Compute heart beat pulse CSS animation duration based on current BPM
  const beatDuration = vitals.bpm > 0 ? (60 / vitals.bpm).toFixed(2) : "1";

  return (
    <div className="flex flex-col gap-3.5 p-4 rounded-2xl bg-slate-950/85 border border-pink-500/30 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Heart
              className="w-5 h-5"
              style={{
                animation: enabled ? `pulseGlow ${beatDuration}s ease-in-out infinite` : "none",
              }}
            />
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold tracking-wide text-pink-200">
              rPPG VITALS MONITOR
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Contactless Optical Plethysmography
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {enabled && (
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute Heartbeat Audio" : "Enable Heartbeat Audio"}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundEnabled
                  ? "bg-pink-950/60 border-pink-400 text-pink-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={() => {
              soundSynth.playModeSwitch();
              onToggle();
            }}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${
              enabled ? "bg-pink-500 shadow-[0_0_15px_#ff007f]" : "bg-slate-800"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                enabled ? "translate-x-8" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 pt-1 border-t border-white/10 animate-fadeIn">
          {/* Live Waveform Canvas */}
          <div className="relative rounded-xl overflow-hidden border border-pink-500/20 shadow-inner">
            <canvas ref={canvasRef} width={340} height={80} className="w-full h-20 block" />
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-[9px] font-mono text-pink-300">
              <Radio className="w-2.5 h-2.5 animate-pulse text-pink-400" />
              <span>OPTICAL PPG WAVE</span>
            </div>
            <div className="absolute top-2 right-2 text-[9px] font-mono text-slate-400">
              CONFIDENCE: <span className="font-bold text-pink-300">{vitals.confidence}%</span>
            </div>
          </div>

          {/* Vitals Telemetry Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Heart Rate BPM */}
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/40 border border-pink-500/20">
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <Activity className="w-3 h-3 text-pink-400" /> HEART RATE
              </div>
              <div className="text-xl font-mono font-black text-pink-400 mt-0.5">
                {vitals.bpm > 0 ? vitals.bpm : "--"}
              </div>
              <div className="text-[9px] font-mono text-slate-500">BEATS / MIN</div>
            </div>

            {/* HRV SDNN */}
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/40 border border-cyan-500/20">
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <Heart className="w-3 h-3 text-cyan-400" /> HRV (SDNN)
              </div>
              <div className="text-xl font-mono font-black text-cyan-300 mt-0.5">
                {vitals.hrvMs > 0 ? vitals.hrvMs : "--"}
              </div>
              <div className="text-[9px] font-mono text-emerald-400">OPTIMAL</div>
            </div>

            {/* Respiration */}
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-black/40 border border-emerald-500/20">
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                <Wind className="w-3 h-3 text-emerald-400" /> RESPIRATION
              </div>
              <div className="text-xl font-mono font-black text-emerald-300 mt-0.5">
                {vitals.respirationBpm > 0 ? vitals.respirationBpm : "--"}
              </div>
              <div className="text-[9px] font-mono text-slate-500">BREATHS / MIN</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PulseVitalsMonitor = React.memo(PulseVitalsMonitorComponent);
