/**
 * MediaPipe Tasks Vision Engine for Next.js Browser Client
 * Initializes WebAssembly vision runtime for Face, Pose, and Hand landmarkers.
 */

import {
  FilesetResolver,
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface DetectionResults {
  faces: NormalizedLandmark[][];
  poses: NormalizedLandmark[][];
  hands: NormalizedLandmark[][];
  inferenceTimeMs: number;
}

export class WebVisionDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  public isReady: boolean = false;
  public initError: string | null = null;

  // Cached results for decoupled 60 FPS rendering
  private lastFaces: NormalizedLandmark[][] = [];
  private lastPoses: NormalizedLandmark[][] = [];
  private lastHands: NormalizedLandmark[][] = [];
  private frameCount: number = 0;
  private lastFaceTimestamp: number = -1;
  private lastPoseTimestamp: number = -1;
  private lastHandTimestamp: number = -1;

  public async initialize(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.initError = null;

    try {
      // 1. Load Wasm Fileset
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      // 2. Initialize Face Landmarker (478 vertices + iris, blendshapes disabled for max FPS)
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      // 3. Initialize Pose Landmarker (33 body joints)
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 2,
      });

      // 4. Initialize Hand Landmarker (21 keypoints per hand)
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err: unknown) {
      console.error("Failed to initialize MediaPipe WebVision:", err);
      this.initError = err instanceof Error ? err.message : String(err);
      this.isInitializing = false;
      return false;
    }
  }

  /**
   * Processes a video frame with high-performance interleaved execution.
   * Alternates neural network inference across frames while preserving cached landmarks.
   */
  public detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number,
    options: { detectFace: boolean; detectPose: boolean; detectHands: boolean; interleaved?: boolean }
  ): DetectionResults {
    const startTime = performance.now();

    if (!this.isReady || video.readyState < 2) {
      return {
        faces: this.lastFaces,
        poses: this.lastPoses,
        hands: this.lastHands,
        inferenceTimeMs: 0,
      };
    }

    const isInterleaved = options.interleaved !== false;
    this.frameCount++;

    try {
      const activeOptionsCount =
        (options.detectFace ? 1 : 0) + (options.detectPose ? 1 : 0) + (options.detectHands ? 1 : 0);

      // If only 1 model is requested or interleaving is off, run normally
      if (activeOptionsCount <= 1 || !isInterleaved) {
        if (options.detectFace && this.faceLandmarker) {
          const ts = Math.max(timestampMs, this.lastFaceTimestamp + 1);
          this.lastFaceTimestamp = ts;
          const res = this.faceLandmarker.detectForVideo(video, ts);
          this.lastFaces = (res?.faceLandmarks as NormalizedLandmark[][]) || [];
        }
        if (options.detectPose && this.poseLandmarker) {
          const ts = Math.max(timestampMs, this.lastPoseTimestamp + 1);
          this.lastPoseTimestamp = ts;
          const res = this.poseLandmarker.detectForVideo(video, ts);
          this.lastPoses = (res?.landmarks as NormalizedLandmark[][]) || [];
        }
        if (options.detectHands && this.handLandmarker) {
          const ts = Math.max(timestampMs, this.lastHandTimestamp + 1);
          this.lastHandTimestamp = ts;
          const res = this.handLandmarker.detectForVideo(video, ts);
          this.lastHands = (res?.landmarks as NormalizedLandmark[][]) || [];
        }
      } else {
        // Interleaved execution:
        // Frame % 2 === 0: Face Landmarker
        // Frame % 4 === 1: Pose Landmarker
        // Frame % 4 === 3: Hand Landmarker
        const cycle = this.frameCount % 4;

        if (cycle % 2 === 0 && options.detectFace && this.faceLandmarker) {
          const ts = Math.max(timestampMs, this.lastFaceTimestamp + 1);
          this.lastFaceTimestamp = ts;
          const res = this.faceLandmarker.detectForVideo(video, ts);
          this.lastFaces = (res?.faceLandmarks as NormalizedLandmark[][]) || [];
        } else if (cycle === 1 && options.detectPose && this.poseLandmarker) {
          const ts = Math.max(timestampMs, this.lastPoseTimestamp + 1);
          this.lastPoseTimestamp = ts;
          const res = this.poseLandmarker.detectForVideo(video, ts);
          this.lastPoses = (res?.landmarks as NormalizedLandmark[][]) || [];
        } else if (cycle === 3 && options.detectHands && this.handLandmarker) {
          const ts = Math.max(timestampMs, this.lastHandTimestamp + 1);
          this.lastHandTimestamp = ts;
          const res = this.handLandmarker.detectForVideo(video, ts);
          this.lastHands = (res?.landmarks as NormalizedLandmark[][]) || [];
        }
      }
    } catch (err) {
      // Ignore transient frame skips
    }

    return {
      faces: options.detectFace ? this.lastFaces : [],
      poses: options.detectPose ? this.lastPoses : [],
      hands: options.detectHands ? this.lastHands : [],
      inferenceTimeMs: Math.round(performance.now() - startTime),
    };
  }
}
