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

      // 2. Initialize Face Landmarker (478 vertices + iris)
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: true,
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
   * Processes a video frame with Face, Pose, and Hand landmarkers.
   */
  public detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number,
    options: { detectFace: boolean; detectPose: boolean; detectHands: boolean }
  ): DetectionResults {
    const startTime = performance.now();
    const results: DetectionResults = {
      faces: [],
      poses: [],
      hands: [],
      inferenceTimeMs: 0,
    };

    if (!this.isReady || video.readyState < 2) {
      return results;
    }

    try {
      // 1. Face detection
      if (options.detectFace && this.faceLandmarker) {
        const faceRes = this.faceLandmarker.detectForVideo(video, timestampMs);
        if (faceRes && faceRes.faceLandmarks) {
          results.faces = faceRes.faceLandmarks as NormalizedLandmark[][];
        }
      }

      // 2. Pose detection
      if (options.detectPose && this.poseLandmarker) {
        const poseRes = this.poseLandmarker.detectForVideo(video, timestampMs);
        if (poseRes && poseRes.landmarks) {
          results.poses = poseRes.landmarks as NormalizedLandmark[][];
        }
      }

      // 3. Hands detection
      if (options.detectHands && this.handLandmarker) {
        const handRes = this.handLandmarker.detectForVideo(video, timestampMs);
        if (handRes && handRes.landmarks) {
          results.hands = handRes.landmarks as NormalizedLandmark[][];
        }
      }
    } catch (err) {
      // Ignore transient frame skips
    }

    results.inferenceTimeMs = Math.round(performance.now() - startTime);
    return results;
  }
}
