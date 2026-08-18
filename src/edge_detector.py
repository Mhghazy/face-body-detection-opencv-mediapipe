"""
Classical Computer Vision Edge Detection Module
Provides Canny, Sobel, and Morphological edge extraction routines
that integrate with MediaPipe facial/body landmark wireframes.
"""

import cv2
import numpy as np
from typing import Tuple, Optional


class EdgeDetector:
    """
    Applies classical Computer Vision edge detection filters
    with adaptive thresholding and aesthetic color mapping.
    """

    def __init__(self, blur_ksize: int = 5, sigma_color: float = 75.0, sigma_space: float = 75.0):
        self.blur_ksize = blur_ksize
        self.sigma_color = sigma_color
        self.sigma_space = sigma_space

    def auto_canny(self, image: np.ndarray, sigma: float = 0.33) -> np.ndarray:
        """
        Computes Canny edge map with automatically calculated thresholds
        based on the median pixel intensity of the grayscale image.
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image

        # Bilateral filter reduces noise while keeping edges crisp
        filtered = cv2.bilateralFilter(gray, d=self.blur_ksize, sigmaColor=self.sigma_color, sigmaSpace=self.sigma_space)

        # Compute the median of the single channel pixel intensities
        v = np.median(filtered)

        # Apply automatic Canny edge detection using computed median with safe bounds
        lower = int(max(10, (1.0 - sigma) * v))
        upper = int(max(30, min(255, (1.0 + sigma) * v)))
        edged = cv2.Canny(filtered, lower, upper)

        return edged

    def sobel_edges(self, image: np.ndarray) -> np.ndarray:
        """
        Computes Sobel gradient magnitude edges.
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image

        blurred = cv2.GaussianBlur(gray, (self.blur_ksize, self.blur_ksize), 0)

        grad_x = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=3)

        magnitude = cv2.magnitude(grad_x, grad_y)
        magnitude = np.uint8(np.clip(magnitude, 0, 255))

        _, thresh = cv2.threshold(magnitude, 40, 255, cv2.THRESH_BINARY)
        return thresh

    def create_colored_edge_overlay(
        self,
        edge_mask: np.ndarray,
        color: Tuple[int, int, int] = (0, 255, 255),
        dilate_iter: int = 1
    ) -> np.ndarray:
        """
        Transforms a binary 1-channel edge mask into a 3-channel BGR colored overlay
        with optional slight dilation for neon-like visibility.
        """
        if dilate_iter > 0:
            kernel = np.ones((2, 2), np.uint8)
            edge_mask = cv2.dilate(edge_mask, kernel, iterations=dilate_iter)

        colored = np.zeros((*edge_mask.shape[:2], 3), dtype=np.uint8)
        colored[edge_mask > 0] = color
        return colored

    def blend_edges_with_frame(
        self,
        frame: np.ndarray,
        edge_overlay: np.ndarray,
        alpha: float = 0.7
    ) -> np.ndarray:
        """
        Alpha-blends a colored edge overlay on top of the original video frame.
        """
        mask = (edge_overlay.sum(axis=-1) > 0)
        output = frame.copy()
        
        if np.any(mask):
            blended = cv2.addWeighted(frame, 1.0 - alpha, edge_overlay, alpha, 0)
            output[mask] = blended[mask]

        return output
