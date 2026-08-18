"""
Remote Photoplethysmography (rPPG) Engine
Performs real-time contactless heart-rate estimation (BPM) and pulse waveform extraction
from subtle capillary micro-color fluctuations in facial video.
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
from collections import deque
import time
import math
import numpy as np
import cv2
from scipy import signal as scipy_signal

from src.config import AppSettings
from src.detector import FrameDetections, LandmarkPoint


@dataclass
class RPPGResult:
    """Contains estimated heart rate (BPM), signal confidence, and pulse waveform."""
    bpm: Optional[float] = None
    instant_bpm: Optional[float] = None
    snr_db: float = 0.0
    confidence: float = 0.0  # Normalized [0.0, 1.0]
    is_valid: bool = False
    buffer_progress: float = 0.0  # [0.0, 1.0] loading progress
    waveform: List[float] = field(default_factory=list)  # Normalized BVP waveform for oscilloscope
    pulse_phase: float = 0.0  # 0.0 to 1.0 for heartbeat icon scaling
    roi_boxes: List[Tuple[int, int, int, int]] = field(default_factory=list)  # (x, y, w, h)


class RPPGDetector:
    """
    Contactless Photoplethysmography (rPPG) Heart-Rate & Pulse Estimator.
    Implements the Plane-Orthogonal-to-Skin (POS) chrominance method and
    frequency-domain spectral analysis over facial skin micro-pulsations.
    """

    def __init__(self, settings: AppSettings):
        self.settings = settings
        self.buffer_size = settings.rppg_buffer_size
        
        # Temporal rolling buffers
        self._timestamps: deque = deque(maxlen=self.buffer_size)
        self._r_vals: deque = deque(maxlen=self.buffer_size)
        self._g_vals: deque = deque(maxlen=self.buffer_size)
        self._b_vals: deque = deque(maxlen=self.buffer_size)
        
        # Filtered BVP waveform buffer for oscilloscope display
        self._waveform_buffer: deque = deque(maxlen=90)
        
        # Smoothed estimation state
        self._smoothed_bpm: Optional[float] = None
        self._last_valid_bpm: Optional[float] = None
        self._last_peak_time: float = 0.0
        self._ema_alpha = 0.12  # Smoothing factor for BPM

    def reset(self) -> None:
        """Clears buffers and resets estimation state."""
        self._timestamps.clear()
        self._r_vals.clear()
        self._g_vals.clear()
        self._b_vals.clear()
        self._waveform_buffer.clear()
        self._smoothed_bpm = None
        self._last_valid_bpm = None

    def process(
        self,
        frame_bgr: np.ndarray,
        detections: FrameDetections,
        timestamp_sec: Optional[float] = None,
    ) -> RPPGResult:
        """
        Extracts facial skin color signals and computes Heart Rate (BPM).
        
        Args:
            frame_bgr: Current video frame (BGR).
            detections: FrameDetections containing face landmarks.
            timestamp_sec: Optional custom timestamp in seconds (useful for tests/replay).
            
        Returns:
            RPPGResult with BPM, confidence, and pulse waveform.
        """
        now = time.time() if timestamp_sec is None else timestamp_sec
        h, w = frame_bgr.shape[:2]

        if not detections.faces:
            # Decay waveform smoothly if face lost
            if self._waveform_buffer:
                self._waveform_buffer.append(0.0)
            return RPPGResult(
                bpm=self._smoothed_bpm,
                is_valid=False,
                buffer_progress=len(self._timestamps) / float(self.buffer_size),
                waveform=list(self._waveform_buffer),
            )

        # 1. Extract Forehead and Cheek Skin ROIs from the primary detected face
        face = detections.faces[0]
        lms = face.landmarks
        if len(lms) < 468:
            return RPPGResult(is_valid=False, waveform=list(self._waveform_buffer))

        roi_boxes: List[Tuple[int, int, int, int]] = []
        mean_colors: List[np.ndarray] = []

        # A. Forehead ROI (Center forehead between temples)
        # Landmarks: 10 (top), 151 (mid), 67 (left), 297 (right)
        fx1 = max(0, min(w - 1, min(lms[67].px, lms[109].px)))
        fx2 = max(0, min(w - 1, max(lms[297].px, lms[338].px)))
        fy1 = max(0, min(h - 1, lms[10].py))
        fy2 = max(0, min(h - 1, lms[151].py + int(abs(lms[151].py - lms[10].py) * 0.4)))

        if (fx2 - fx1) > 15 and (fy2 - fy1) > 10:
            roi_forehead = frame_bgr[fy1:fy2, fx1:fx2]
            if roi_forehead.size > 0:
                roi_boxes.append((fx1, fy1, fx2 - fx1, fy2 - fy1))
                mean_colors.append(cv2.mean(roi_forehead)[:3])

        # B. Left & Right Cheek Malar ROIs
        # Left cheek: 117, 118, 101, 205
        lx1 = max(0, min(w - 1, lms[117].px - 10))
        lx2 = max(0, min(w - 1, lms[205].px + 10))
        ly1 = max(0, min(h - 1, lms[118].py - 5))
        ly2 = max(0, min(h - 1, lms[101].py + 15))
        if (lx2 - lx1) > 10 and (ly2 - ly1) > 10:
            roi_l = frame_bgr[ly1:ly2, lx1:lx2]
            if roi_l.size > 0:
                roi_boxes.append((lx1, ly1, lx2 - lx1, ly2 - ly1))
                mean_colors.append(cv2.mean(roi_l)[:3])

        # Right cheek: 346, 347, 330, 425
        rx1 = max(0, min(w - 1, lms[425].px - 10))
        rx2 = max(0, min(w - 1, lms[346].px + 10))
        ry1 = max(0, min(h - 1, lms[347].py - 5))
        ry2 = max(0, min(h - 1, lms[330].py + 15))
        if (rx2 - rx1) > 10 and (ry2 - ry1) > 10:
            roi_r = frame_bgr[ry1:ry2, rx1:rx2]
            if roi_r.size > 0:
                roi_boxes.append((rx1, ry1, rx2 - rx1, ry2 - ry1))
                mean_colors.append(cv2.mean(roi_r)[:3])

        if not mean_colors:
            return RPPGResult(is_valid=False, waveform=list(self._waveform_buffer))

        # Spatial average of skin RGB channels
        avg_bgr = np.mean(mean_colors, axis=0)
        b_val, g_val, r_val = avg_bgr[0], avg_bgr[1], avg_bgr[2]

        self._timestamps.append(now)
        self._r_vals.append(r_val)
        self._g_vals.append(g_val)
        self._b_vals.append(b_val)

        buf_len = len(self._timestamps)
        progress = min(1.0, buf_len / float(self.buffer_size))

        # Need at least 45 frames (~1.5s) to start estimating BVP
        if buf_len < 45:
            self._waveform_buffer.append(0.0)
            return RPPGResult(
                bpm=self._smoothed_bpm,
                is_valid=False,
                buffer_progress=progress,
                waveform=list(self._waveform_buffer),
                roi_boxes=roi_boxes,
            )

        # 2. POS (Plane-Orthogonal-to-Skin) Chrominance BVP Extraction
        r_arr = np.array(self._r_vals, dtype=np.float64)
        g_arr = np.array(self._g_vals, dtype=np.float64)
        b_arr = np.array(self._b_vals, dtype=np.float64)
        t_arr = np.array(self._timestamps, dtype=np.float64)

        # Normalize channels by their temporal mean
        r_norm = r_arr / (np.mean(r_arr) + 1e-6)
        g_norm = g_arr / (np.mean(g_arr) + 1e-6)
        b_norm = b_arr / (np.mean(b_arr) + 1e-6)

        # Orthogonal projections S1 and S2
        s1 = g_norm - b_norm
        s2 = g_norm + b_norm - 2.0 * r_norm

        std_s1 = np.std(s1)
        std_s2 = np.std(s2)
        alpha = (std_s1 / (std_s2 + 1e-6)) if std_s2 > 1e-6 else 1.0

        bvp_raw = s1 + alpha * s2

        # 3. Physiological Bandpass Filtering [0.75 Hz - 3.0 Hz] (45 - 180 BPM)
        duration = t_arr[-1] - t_arr[0]
        fs = (buf_len - 1) / duration if duration > 0.1 else 30.0
        fs = float(np.clip(fs, 10.0, 120.0))

        bvp_filtered = self._bandpass_filter(bvp_raw, fs, lowcut=0.75, highcut=3.0)

        # Store latest filtered sample in the waveform oscilloscope buffer
        latest_val = float(bvp_filtered[-1])
        # Scale for normalized display [-1.0, 1.0]
        std_val = float(np.std(bvp_filtered)) + 1e-5
        norm_sample = np.clip(latest_val / (std_val * 2.5), -1.0, 1.0)
        self._waveform_buffer.append(norm_sample)

        # 4. Spectral Frequency Analysis & BPM Extraction
        instant_bpm, snr_db = self._extract_bpm_fft(bvp_filtered, fs)

        is_valid = (instant_bpm is not None) and (snr_db > 1.5)

        if is_valid and instant_bpm is not None:
            if self._smoothed_bpm is None:
                self._smoothed_bpm = instant_bpm
            else:
                # Outlier rejection filter: ignore sudden erratic jumps > 30 BPM
                if abs(instant_bpm - self._smoothed_bpm) < 30.0:
                    self._smoothed_bpm = (1.0 - self._ema_alpha) * self._smoothed_bpm + self._ema_alpha * instant_bpm
                else:
                    self._smoothed_bpm = (1.0 - 0.03) * self._smoothed_bpm + 0.03 * instant_bpm

        final_bpm = round(self._smoothed_bpm, 1) if self._smoothed_bpm is not None else None
        confidence = float(np.clip(snr_db / 10.0, 0.0, 1.0))

        # 5. Heartbeat Pulse Phase Indicator (for rhythmic heart icon animation)
        pulse_phase = 0.0
        if final_bpm is not None and final_bpm > 0:
            beat_period = 60.0 / final_bpm
            pulse_phase = (now % beat_period) / beat_period

        return RPPGResult(
            bpm=final_bpm,
            instant_bpm=round(instant_bpm, 1) if instant_bpm is not None else None,
            snr_db=round(snr_db, 1),
            confidence=confidence,
            is_valid=is_valid,
            buffer_progress=progress,
            waveform=list(self._waveform_buffer),
            pulse_phase=pulse_phase,
            roi_boxes=roi_boxes,
        )

    def _bandpass_filter(self, data: np.ndarray, fs: float, lowcut: float = 0.75, highcut: float = 3.0) -> np.ndarray:
        """Applies 3rd-order Butterworth zero-phase bandpass filter with linear detrending."""
        # Linear detrending to eliminate slow lighting drifts
        detrended = scipy_signal.detrend(data)
        
        nyq = 0.5 * fs
        low = max(0.01, lowcut / nyq)
        high = min(0.99, highcut / nyq)
        
        if low >= high:
            return detrended

        try:
            b, a = scipy_signal.butter(3, [low, high], btype="bandpass")
            # If buffer is short, use lfilter instead of filtfilt to prevent padlen error
            if len(detrended) > 18:
                filtered = scipy_signal.filtfilt(b, a, detrended)
            else:
                filtered = scipy_signal.lfilter(b, a, detrended)
            return filtered
        except Exception:
            return detrended

    def _extract_bpm_fft(self, bvp_signal: np.ndarray, fs: float) -> Tuple[Optional[float], float]:
        """Computes Power Spectral Density via FFT and calculates peak BPM and SNR."""
        n = len(bvp_signal)
        if n < 30:
            return None, 0.0

        # Apply Hanning window to suppress spectral leakage
        windowed = bvp_signal * np.hanning(n)

        # Zero-pad FFT to 1024 points for high sub-BPM resolution
        n_fft = max(1024, 2 ** int(math.ceil(math.log2(n))))
        fft_vals = np.fft.rfft(windowed, n=n_fft)
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / fs)
        psd = np.abs(fft_vals) ** 2

        # Physiological search range: 0.75 Hz (45 BPM) to 3.0 Hz (180 BPM)
        band_mask = (freqs >= 0.75) & (freqs <= 3.0)
        if not np.any(band_mask):
            return None, 0.0

        band_freqs = freqs[band_mask]
        band_psd = psd[band_mask]

        peak_idx = np.argmax(band_psd)
        peak_freq = band_freqs[peak_idx]
        peak_bpm = peak_freq * 60.0

        # Calculate SNR (Ratio of peak signal power vs noise power in band)
        # Peak power within +/- 0.15 Hz
        peak_region = (band_freqs >= (peak_freq - 0.15)) & (band_freqs <= (peak_freq + 0.15))
        signal_power = np.sum(band_psd[peak_region])
        total_band_power = np.sum(band_psd)
        noise_power = max(1e-8, total_band_power - signal_power)

        snr = float(signal_power / noise_power)
        snr_db = 10.0 * math.log10(max(1.0, snr))

        return peak_bpm, snr_db
