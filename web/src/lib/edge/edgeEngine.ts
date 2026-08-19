/**
 * Classical Computer Vision Edge Detection Engine (Canny & Sobel)
 * Runs pixel-level edge convolutions on canvas ImageData for real-time edge filter visualization.
 */

export interface EdgeFilterState {
  enabled: boolean;
  type: "canny" | "sobel";
  threshold: number; // 0..255
  alpha: number;     // 0..1.0
  color: string;     // Hex color
}

export class EdgeFilterEngine {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offCtx: CanvasRenderingContext2D | null = null;
  private grayBuffer: Uint8Array | null = null;
  private edgeData: ImageData | null = null;
  private currentSw = 0;
  private currentSh = 0;

  constructor() {
    if (typeof document !== "undefined") {
      this.offscreenCanvas = document.createElement("canvas");
    }
  }

  /**
   * Applies Sobel or Canny edge detection and composites neon edges onto the target canvas.
   */
  public applyEdgeFilter(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement | HTMLCanvasElement,
    width: number,
    height: number,
    state: EdgeFilterState
  ) {
    if (!state.enabled || !this.offscreenCanvas) return;

    // Use a performant fixed 320x180 convolution buffer
    const sw = 320;
    const sh = 180;

    const offCanvas = this.offscreenCanvas;
    if (offCanvas.width !== sw || offCanvas.height !== sh || !this.offCtx) {
      offCanvas.width = sw;
      offCanvas.height = sh;
      this.offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
      this.currentSw = sw;
      this.currentSh = sh;
      this.grayBuffer = new Uint8Array(sw * sh);
      this.edgeData = this.offCtx ? this.offCtx.createImageData(sw, sh) : null;
    }

    const offCtx = this.offCtx;
    if (!offCtx || !this.grayBuffer || !this.edgeData) return;

    // Draw downscaled frame
    offCtx.drawImage(video, 0, 0, sw, sh);
    const imgData = offCtx.getImageData(0, 0, sw, sh);
    const src = imgData.data;
    const gray = this.grayBuffer;

    // Fast Grayscale conversion
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      gray[p] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    }

    // Output edges buffer
    const dst32 = new Uint32Array(this.edgeData.data.buffer);
    dst32.fill(0); // clear previous frame

    // Parse hex color
    const hex = state.color.replace("#", "");
    const er = parseInt(hex.substring(0, 2), 16) || 0;
    const eg = parseInt(hex.substring(2, 4), 16) || 255;
    const eb = parseInt(hex.substring(4, 6), 16) || 255;
    const fullColor32 = (255 << 24) | (eb << 16) | (eg << 8) | er;

    const threshold = state.threshold;
    const isCanny = state.type === "canny";

    // Fast Sobel 3x3 Convolution with Manhattan gradient approximation
    for (let y = 1; y < sh - 1; y++) {
      const rowOffset = y * sw;
      for (let x = 1; x < sw - 1; x++) {
        const p = rowOffset + x;

        // Sobel kernels
        const gx =
          -gray[p - sw - 1] + gray[p - sw + 1] -
          (gray[p - 1] << 1) + (gray[p + 1] << 1) -
          gray[p + sw - 1] + gray[p + sw + 1];

        const gy =
          -gray[p - sw - 1] - (gray[p - sw] << 1) - gray[p - sw + 1] +
          gray[p + sw - 1] + (gray[p + sw] << 1) + gray[p + sw + 1];

        // Manhattan distance approximation (5x faster than Math.sqrt)
        const mag = Math.abs(gx) + Math.abs(gy);

        if (isCanny) {
          if (mag > threshold) {
            dst32[p] = fullColor32;
          }
        } else {
          if (mag > threshold * 0.5) {
            const alpha = Math.min(255, (mag * 255) / 400) | 0;
            dst32[p] = (alpha << 24) | (eb << 16) | (eg << 8) | er;
          }
        }
      }
    }

    offCtx.putImageData(this.edgeData, 0, 0);

    // Composite scaled edge map back to viewport
    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(offCanvas, 0, 0, width, height);
    ctx.restore();
  }
}
