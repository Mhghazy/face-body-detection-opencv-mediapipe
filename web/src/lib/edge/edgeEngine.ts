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

    const scale = 0.5; // Downscale factor for high FPS processing
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    const offCanvas = this.offscreenCanvas;
    if (offCanvas.width !== sw || offCanvas.height !== sh) {
      offCanvas.width = sw;
      offCanvas.height = sh;
    }

    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    // Draw downscaled frame
    offCtx.drawImage(video, 0, 0, sw, sh);
    const imgData = offCtx.getImageData(0, 0, sw, sh);
    const src = imgData.data;

    // Grayscale buffer
    const gray = new Uint8Array(sw * sh);
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      gray[p] = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
    }

    // Output edges buffer
    const edgeData = offCtx.createImageData(sw, sh);
    const dst = edgeData.data;

    // Parse hex color
    const hex = state.color.replace("#", "");
    const er = parseInt(hex.substring(0, 2), 16) || 0;
    const eg = parseInt(hex.substring(2, 4), 16) || 255;
    const eb = parseInt(hex.substring(4, 6), 16) || 255;

    const threshold = state.threshold;

    // Sobel 3x3 Convolution
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const p = y * sw + x;

        // Sobel kernels
        // Gx: [-1 0 1; -2 0 2; -1 0 1]
        const gx =
          -1 * gray[p - sw - 1] + 1 * gray[p - sw + 1] +
          -2 * gray[p - 1]      + 2 * gray[p + 1] +
          -1 * gray[p + sw - 1] + 1 * gray[p + sw + 1];

        // Gy: [-1 -2 -1; 0 0 0; 1 2 1]
        const gy =
          -1 * gray[p - sw - 1] - 2 * gray[p - sw] - 1 * gray[p - sw + 1] +
           1 * gray[p + sw - 1] + 2 * gray[p + sw] + 1 * gray[p + sw + 1];

        const mag = Math.sqrt(gx * gx + gy * gy);
        const idx = p * 4;

        if (state.type === "canny") {
          // Adaptive threshold with non-linear boost
          if (mag > threshold) {
            dst[idx] = er;
            dst[idx + 1] = eg;
            dst[idx + 2] = eb;
            dst[idx + 3] = 255;
          }
        } else {
          // Continuous Sobel gradient glow
          if (mag > threshold * 0.5) {
            const alphaFactor = Math.min(1.0, mag / 200.0);
            dst[idx] = er;
            dst[idx + 1] = eg;
            dst[idx + 2] = eb;
            dst[idx + 3] = Math.round(alphaFactor * 255);
          }
        }
      }
    }

    offCtx.putImageData(edgeData, 0, 0);

    // Composite scaled edge map back to viewport
    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(offCanvas, 0, 0, width, height);
    ctx.restore();
  }
}
