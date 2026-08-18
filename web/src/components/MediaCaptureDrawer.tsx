"use client";

import React, { useState } from "react";
import { Camera, Video, Upload, Download, Trash2, Film, Image as ImageIcon, X } from "lucide-react";
import { soundSynth } from "@/lib/audio/soundSynth";

export interface SnapshotItem {
  id: string;
  dataUrl: string;
  timestamp: string;
  entities: string;
  temp: string;
}

interface MediaCaptureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: SnapshotItem[];
  onDeleteSnapshot: (id: string) => void;
  onTakeSnapshot: () => void;
  isRecording: boolean;
  recordingSeconds: number;
  onToggleRecording: () => void;
  onUploadMedia: (file: File) => void;
}

export const MediaCaptureDrawer: React.FC<MediaCaptureDrawerProps> = ({
  isOpen,
  onClose,
  snapshots,
  onDeleteSnapshot,
  onTakeSnapshot,
  isRecording,
  recordingSeconds,
  onToggleRecording,
  onUploadMedia,
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotItem | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      soundSynth.playClick();
      onUploadMedia(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md h-full bg-slate-950/95 border-l border-cyan-500/30 p-5 flex flex-col gap-4 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-mono font-bold text-white tracking-wider">
              CAPTURE & MEDIA STUDIO
            </h2>
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

        {/* Quick Actions Bar */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Snapshot Button */}
          <button
            onClick={() => {
              soundSynth.playSnapshot();
              onTakeSnapshot();
            }}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-cyan-950/80 border border-cyan-500/50 hover:bg-cyan-900/80 text-cyan-300 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
          >
            <Camera className="w-4 h-4" />
            <span>TAKE SNAPSHOT (SPACE)</span>
          </button>

          {/* Record Button */}
          <button
            onClick={() => {
              soundSynth.playModeSwitch();
              onToggleRecording();
            }}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-mono text-xs font-bold transition-all ${
              isRecording
                ? "bg-red-950/90 border-red-500 text-red-200 animate-pulse shadow-[0_0_20px_rgba(255,0,0,0.4)]"
                : "bg-red-950/40 border-red-500/40 hover:bg-red-900/60 text-red-300"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>{isRecording ? `STOP REC (${recordingSeconds}s)` : "RECORD VIDEO (R)"}</span>
          </button>
        </div>

        {/* Upload File Input */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-cyan-400/50 transition-colors">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Analyze Image or Video File</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            Upload any local photo or video to run face mesh, thermal simulation, and rPPG.
          </p>
          <label className="mt-1 cursor-pointer flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-cyan-950/50 border border-cyan-500/30 hover:bg-cyan-900/50 text-cyan-300 text-xs font-mono font-semibold transition-colors">
            <Film className="w-3.5 h-3.5" />
            <span>Select Media File...</span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Snapshot Gallery */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-white/5 pb-2">
            <span>SAVED SNAPSHOTS ({snapshots.length})</span>
            <span className="text-[10px] text-slate-500">Auto-saved to session</span>
          </div>

          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 font-mono text-xs gap-2">
              <ImageIcon className="w-8 h-8 text-slate-600" />
              <span>No snapshots captured yet.</span>
              <span className="text-[10px]">Press SPACE or click Take Snapshot</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[360px] pr-1">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="group relative flex flex-col rounded-xl overflow-hidden bg-black/50 border border-white/10 hover:border-cyan-400 transition-all shadow-md"
                >
                  <img
                    src={snap.dataUrl}
                    alt={`Snapshot ${snap.id}`}
                    className="w-full h-24 object-cover cursor-pointer"
                    onClick={() => setSelectedSnapshot(snap)}
                  />
                  <div className="p-2 flex flex-col gap-0.5 text-[10px] font-mono text-slate-400">
                    <span className="text-white font-semibold">{snap.timestamp}</span>
                    <span className="text-cyan-400">{snap.entities}</span>
                    <span className="text-orange-400">{snap.temp}</span>
                  </div>

                  {/* Actions overlay on hover */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={snap.dataUrl}
                      download={`lumina_snapshot_${snap.id}.png`}
                      title="Download PNG"
                      className="p-1 rounded bg-black/80 hover:bg-cyan-600 text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => onDeleteSnapshot(snap.id)}
                      title="Delete"
                      className="p-1 rounded bg-black/80 hover:bg-red-600 text-white transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal preview for single snapshot */}
        {selectedSnapshot && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="max-w-2xl w-full flex flex-col gap-3 bg-slate-950 p-4 rounded-2xl border border-cyan-500">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-cyan-300">
                  SNAPSHOT PREVIEW - {selectedSnapshot.timestamp}
                </span>
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={selectedSnapshot.dataUrl}
                alt="Enlarged snapshot"
                className="w-full rounded-xl border border-white/10"
              />
              <div className="flex justify-end gap-2">
                <a
                  href={selectedSnapshot.dataUrl}
                  download={`lumina_snapshot_${selectedSnapshot.id}.png`}
                  className="flex items-center gap-2 py-2 px-4 rounded-xl bg-cyan-500 text-black font-mono text-xs font-bold hover:bg-cyan-400 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Full-Res PNG
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
