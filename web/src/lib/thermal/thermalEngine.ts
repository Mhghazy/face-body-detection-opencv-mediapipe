/**
 * Web Thermal Vision & Radiometric Temperature Simulation Engine
 * Synthesizes bio-physiological heatmaps with Jet, Hot, Inferno, and Plasma false-color colormaps,
 * spot temperature measurements, anatomical heat diffusion, and fever threshold alerts.
 */

export interface TemperatureSpot {
  label: string;
  x: number;
  y: number;
  tempC: number;
  tempF: number;
  isFever: boolean;
}

export interface ThermalState {
  enabled: boolean;
  colormap: "jet" | "hot" | "inferno" | "plasma";
  blendMode: "hybrid" | "full" | "masked";
  tempUnit: "C" | "F";
  feverThresholdC: number;
  blendAlpha: number;
}

// Precomputed Colormap LUTs (256 entries each with [R, G, B])
function generateColormapLUTs() {
  const jet: [number, number, number][] = [];
  const hot: [number, number, number][] = [];
  const inferno: [number, number, number][] = [];
  const plasma: [number, number, number][] = [];

  for (let i = 0; i < 256; i++) {
    const t = i / 255.0;

    // 1. JET Colormap
    let r = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 3)));
    let g = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 2)));
    let b = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 1)));
    jet.push([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]);

    // 2. HOT Colormap (Black -> Red -> Orange -> Yellow -> White)
    let hr = Math.min(1, t * 2.5);
    let hg = Math.max(0, Math.min(1, (t - 0.35) * 2.5));
    let hb = Math.max(0, Math.min(1, (t - 0.75) * 4.0));
    hot.push([Math.round(hr * 255), Math.round(hg * 255), Math.round(hb * 255)]);

    // 3. INFERNO Colormap (Black -> Purple -> Red -> Orange -> Yellow)
    let ir = Math.min(1, Math.sin(t * Math.PI * 0.9) * 1.2 + (t > 0.6 ? (t - 0.6) * 1.5 : 0));
    let ig = Math.max(0, Math.min(1, Math.pow(t, 2.2) * 1.5));
    let ib = Math.max(0, Math.min(1, Math.sin(t * Math.PI) * 0.6 + (t < 0.3 ? t * 1.8 : 0)));
    inferno.push([Math.round(ir * 255), Math.round(ig * 255), Math.round(ib * 255)]);

    // 4. PLASMA Colormap (Blue -> Violet -> Magenta -> Orange -> Yellow)
    let pr = Math.min(1, Math.sin(t * Math.PI * 0.8) * 0.8 + (t > 0.4 ? (t - 0.4) * 1.6 : 0));
    let pg = Math.max(0, Math.min(1, Math.pow(t, 1.8) * 1.2 - 0.1 * Math.sin(t * Math.PI)));
    let pb = Math.max(0, Math.min(1, Math.cos(t * Math.PI * 0.5) * 0.9 + 0.1));
    plasma.push([Math.round(pr * 255), Math.round(pg * 255), Math.round(pb * 255)]);
  }

  return { jet, hot, inferno, plasma };
}

const COLORMAP_LUTS = generateColormapLUTs();

export class ThermalVisionEngine {
  private perfusionPhase = 0;
  private emaForeheadC: number | null = null;
  private emaChestC: number | null = null;
  private feverPulsePhase = 0;
  private offscreenCanvas: HTMLCanvasElement | null = null;

  constructor() {
    if (typeof document !== "undefined") {
      this.offscreenCanvas = document.createElement("canvas");
    }
  }

  /**
   * Generates temperature spot measurements based on facial, pose, and hand landmarks.
   */
  public calculateSpots(
    faceLandmarks: { x: number; y: number }[] | null,
    poseLandmarks: { x: number; y: number }[] | null,
    handLandmarks: { x: number; y: number }[][] | null,
    width: number,
    height: number,
    feverThresholdC: number,
    deltaTime: number = 0.033
  ): { spots: TemperatureSpot[]; primaryTempC: number; primaryTempF: number; isFever: boolean } {
    this.perfusionPhase += deltaTime * 2.5;
    const perfusionOsc = Math.sin(this.perfusionPhase) * 0.08 + Math.cos(this.perfusionPhase * 0.6) * 0.04;
    const spots: TemperatureSpot[] = [];

    let rawForeheadC = 36.8 + perfusionOsc;
    let rawChestC = 36.5 + perfusionOsc * 0.7;

    // Smoothed EMA
    if (this.emaForeheadC === null) {
      this.emaForeheadC = rawForeheadC;
    } else {
      this.emaForeheadC = this.emaForeheadC * 0.85 + rawForeheadC * 0.15;
    }

    if (this.emaChestC === null) {
      this.emaChestC = rawChestC;
    } else {
      this.emaChestC = this.emaChestC * 0.85 + rawChestC * 0.15;
    }

    const primaryTempC = this.emaForeheadC;
    const primaryTempF = (primaryTempC * 9.0) / 5.0 + 32.0;
    const isFever = primaryTempC >= feverThresholdC;

    // 1. Forehead spot
    if (faceLandmarks && faceLandmarks.length > 10) {
      const p10 = faceLandmarks[10]; // Forehead top
      const p9 = faceLandmarks[9];   // Mid forehead
      const fx = (p10.x + p9.x) * 0.5 * width;
      const fy = (p10.y + p9.y) * 0.5 * height;

      spots.push({
        label: "FOREHEAD",
        x: fx,
        y: fy,
        tempC: primaryTempC,
        tempF: primaryTempF,
        isFever,
      });
    }

    // 2. Chest spot
    if (poseLandmarks && poseLandmarks.length > 24) {
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const leftHip = poseLandmarks[23];
      const rightHip = poseLandmarks[24];

      const cx = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) * 0.25 * width;
      const cy = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) * 0.25 * height;

      const chestC = this.emaChestC;
      spots.push({
        label: "CHEST",
        x: cx,
        y: cy,
        tempC: chestC,
        tempF: (chestC * 9.0) / 5.0 + 32.0,
        isFever: chestC >= feverThresholdC,
      });
    }

    // 3. Hands spots
    if (handLandmarks && handLandmarks.length > 0) {
      handLandmarks.forEach((hand, idx) => {
        if (hand.length > 9) {
          const palm = hand[9]; // Middle finger MCP
          const handTempC = 34.4 + Math.sin(this.perfusionPhase + idx) * 0.15;
          spots.push({
            label: idx === 0 ? "HAND-1" : "HAND-2",
            x: palm.x * width,
            y: palm.y * height,
            tempC: handTempC,
            tempF: (handTempC * 9.0) / 5.0 + 32.0,
            isFever: handTempC >= feverThresholdC,
          });
        }
      });
    }

    return { spots, primaryTempC, primaryTempF, isFever };
  }

  /**
   * Synthesizes and renders the thermal false-color heatmap on the canvas context.
   */
  public renderThermalHeatmap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: ThermalState,
    faceLandmarks: { x: number; y: number }[] | null,
    poseLandmarks: { x: number; y: number }[] | null,
    handLandmarks: { x: number; y: number }[][] | null
  ) {
    if (!state.enabled || !this.offscreenCanvas) return;

    const lut = COLORMAP_LUTS[state.colormap] || COLORMAP_LUTS.jet;
    const offCanvas = this.offscreenCanvas;

    // Use a downscaled thermal buffer (e.g. 160x90 or 320x180) for blistering fast 60+ FPS processing
    const tw = 160;
    const th = 90;
    if (offCanvas.width !== tw || offCanvas.height !== th) {
      offCanvas.width = tw;
      offCanvas.height = th;
    }

    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    // Draw dark cold ambient base
    offCtx.fillStyle = "#02020a";
    offCtx.fillRect(0, 0, tw, th);

    // Build anatomical heat spots on offscreen buffer
    const heatGrad = (x: number, y: number, r: number, intensity: number) => {
      const g = offCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
      g.addColorStop(0.5, `rgba(200, 200, 200, ${intensity * 0.6})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      offCtx.fillStyle = g;
      offCtx.beginPath();
      offCtx.arc(x, y, r, 0, Math.PI * 2);
      offCtx.fill();
    };

    // 1. Face heat core
    if (faceLandmarks && faceLandmarks.length > 10) {
      const fx = faceLandmarks[10].x * tw;
      const fy = faceLandmarks[10].y * th;
      heatGrad(fx, fy + th * 0.05, tw * 0.15, 0.95);
      // Cheeks & nose
      if (faceLandmarks.length > 4) {
        const nx = faceLandmarks[4].x * tw;
        const ny = faceLandmarks[4].y * th;
        heatGrad(nx, ny, tw * 0.08, 0.85);
      }
    }

    // 2. Pose Torso heat
    if (poseLandmarks && poseLandmarks.length > 24) {
      const ls = poseLandmarks[11];
      const rs = poseLandmarks[12];
      const lh = poseLandmarks[23];
      const rh = poseLandmarks[24];

      const cx = (ls.x + rs.x + lh.x + rh.x) * 0.25 * tw;
      const cy = (ls.y + rs.y + lh.y + rh.y) * 0.25 * th;
      heatGrad(cx, cy, tw * 0.22, 0.9);

      // Limbs
      [poseLandmarks[13], poseLandmarks[14], poseLandmarks[25], poseLandmarks[26]].forEach((pt) => {
        if (pt) heatGrad(pt.x * tw, pt.y * th, tw * 0.08, 0.65);
      });
    }

    // 3. Hands heat
    if (handLandmarks) {
      handLandmarks.forEach((hand) => {
        if (hand.length > 9) {
          heatGrad(hand[9].x * tw, hand[9].y * th, tw * 0.09, 0.7);
        }
      });
    }

    // Grab pixel data and map to False-Color Colormap LUT
    const imgData = offCtx.getImageData(0, 0, tw, th);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const intensity = data[i]; // luminance from grayscale canvas
      const rgb = lut[intensity] || [0, 0, 0];
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = state.blendMode === "full" ? 255 : Math.round(intensity * 1.8);
    }
    offCtx.putImageData(imgData, 0, 0);

    // Composite scaled thermal false-color image back to main viewport
    ctx.save();
    if (state.blendMode === "hybrid") {
      ctx.globalAlpha = state.blendAlpha;
      ctx.globalCompositeOperation = "screen";
    } else if (state.blendMode === "masked") {
      ctx.globalAlpha = state.blendAlpha * 1.1;
      ctx.globalCompositeOperation = "lighter";
    } else {
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(offCanvas, 0, 0, width, height);
    ctx.restore();
  }

  /**
   * Renders floating futuristic temperature badges onto canvas.
   */
  public renderSpotBadges(
    ctx: CanvasRenderingContext2D,
    spots: TemperatureSpot[],
    tempUnit: "C" | "F",
    feverThresholdC: number
  ) {
    this.feverPulsePhase += 0.1;
    const feverPulse = (Math.sin(this.feverPulsePhase) + 1) * 0.5;

    spots.forEach((spot) => {
      const textVal = tempUnit === "C" ? `${spot.tempC.toFixed(1)}°C` : `${spot.tempF.toFixed(1)}°F`;
      const isFever = spot.isFever;

      ctx.save();
      ctx.translate(spot.x, spot.y);

      // Pulse reticle ring
      ctx.strokeStyle = isFever
        ? `rgba(255, 0, 80, ${0.5 + feverPulse * 0.5})`
        : "rgba(0, 240, 255, 0.7)";
      ctx.lineWidth = isFever ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + (isFever ? feverPulse * 4 : 0), 0, Math.PI * 2);
      ctx.stroke();

      // Center crosshair
      ctx.fillStyle = isFever ? "#ff0055" : "#00f0ff";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Badge label box
      const boxW = 100;
      const boxH = 34;
      const boxX = 16;
      const boxY = -17;

      ctx.fillStyle = isFever
        ? `rgba(50, 0, 15, ${0.85 + feverPulse * 0.1})`
        : "rgba(10, 18, 30, 0.85)";
      ctx.strokeStyle = isFever ? "#ff0055" : "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 1;

      // Rounded rectangle
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      // Label text
      ctx.fillStyle = isFever ? "#ff7799" : "rgba(200, 230, 255, 0.8)";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.fillText(spot.label, boxX + 8, boxY + 12);

      // Temperature text
      ctx.fillStyle = isFever ? "#ffffff" : "#00ffff";
      ctx.font = "bold 14px 'JetBrains Mono', monospace";
      ctx.fillText(textVal, boxX + 8, boxY + 28);

      if (isFever) {
        ctx.fillStyle = "#ff0055";
        ctx.font = "bold 8px 'JetBrains Mono', monospace";
        ctx.fillText("! FEVER", boxX + 58, boxY + 12);
      }

      ctx.restore();
    });
  }

  /**
   * Renders thermal calibration scale legend bar on the right edge.
   */
  public renderScaleLegend(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: ThermalState
  ) {
    if (!state.enabled) return;

    const barW = 14;
    const barH = Math.min(220, height * 0.45);
    const barX = width - barW - 20;
    const barY = height * 0.5 - barH * 0.5;

    ctx.save();

    // Background panel
    ctx.fillStyle = "rgba(10, 15, 25, 0.8)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX - 8, barY - 20, barW + 55, barH + 40, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillText("THERMAL", barX - 2, barY - 8);

    // Gradient bar
    const lut = COLORMAP_LUTS[state.colormap] || COLORMAP_LUTS.jet;
    const grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    for (let s = 0; s <= 10; s++) {
      const idx = Math.round((1 - s / 10) * 255);
      const [r, g, b] = lut[idx];
      grad.addColorStop(s / 10, `rgb(${r}, ${g}, ${b})`);
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Min / Max labels
    const maxVal = state.tempUnit === "C" ? "42.0°C" : "107.6°F";
    const minVal = state.tempUnit === "C" ? "20.0°C" : "68.0°F";
    const midVal = state.tempUnit === "C" ? "37.0°C" : "98.6°F";

    ctx.fillStyle = "#ffffff";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(maxVal, barX + barW + 6, barY + 8);
    ctx.fillText(midVal, barX + barW + 6, barY + barH * 0.5 + 4);
    ctx.fillText(minVal, barX + barW + 6, barY + barH);

    ctx.restore();
  }
}
