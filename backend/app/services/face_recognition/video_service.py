import cv2
import numpy as np
from typing import List

def extract_frames(video_path: str, fps: int = 1, max_seconds: int = 12) -> List[np.ndarray]:
    """Extract frames from a video file.

    Args:
        video_path: Absolute path to the video file.
        fps: Desired frames per second to sample.
        max_seconds: Maximum duration to process (clips longer than this are trimmed).

    Returns:
        A list of ``numpy.ndarray`` frames in BGR format.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video file: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = int(video_fps / fps) if fps > 0 else 1
    max_frames = max_seconds * fps

    frames: List[np.ndarray] = []
    frame_count = 0
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % frame_interval == 0:
            frames.append(frame)
        frame_count += 1
    cap.release()
    return frames

def select_best_frame(frames: List[np.ndarray]) -> int:
    """Placeholder for selecting the best frame index.

    Currently returns the index of the first frame that is not empty.
    A more sophisticated implementation could run a face‑detection model and pick the frame
    with the highest confidence or largest face bounding box.
    """
    return 0 if frames else -1
