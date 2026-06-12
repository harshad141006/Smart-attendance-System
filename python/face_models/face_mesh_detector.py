import cv2
import numpy as np
from pathlib import Path

try:
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.vision import (
        FaceLandmarker,
        FaceLandmarkerOptions,
        RunningMode,
    )
    # BaseOptions lives under mediapipe.tasks.python.core.base_options
    from mediapipe.tasks.python.core import base_options
    BaseOptions = base_options.BaseOptions
except Exception as e:
    raise ImportError('Could not import MediaPipe Tasks API: ' + str(e))


class FaceMeshDetector:
    """Face mesh detector using MediaPipe Tasks API (FaceLandmarker).

    This implementation expects a Task model file (e.g. `face_landmarker.task`) and
    operates in IMAGE mode for single-frame analysis.
    """

    def __init__(self, model_asset_path: str, max_num_faces: int = 1):
        model_asset_path = str(Path(model_asset_path))
        base_options = BaseOptions(model_asset_path=model_asset_path)
        options = FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=RunningMode.IMAGE,
            num_faces=max_num_faces,
        )
        self._landmarker = FaceLandmarker.create_from_options(options)

    def _to_pixel_coords(self, landmark, image_shape):
        h, w = image_shape[:2]
        return np.array((int(landmark.x * w), int(landmark.y * h)))

    def get_landmarks(self, image):
        """Return Nx2 numpy array of pixel landmarks for the first detected face, or None."""
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = vision.Image.create_from_array(rgb)
        try:
            result = self._landmarker.detect(mp_image)
        except Exception:
            return None
        if not result.face_landmarks:
            return None
        fl = result.face_landmarks[0]
        pts = [self._to_pixel_coords(lm, image.shape) for lm in fl.landmarks]
        return np.array(pts)

    def eye_aspect_ratio(self, eye_points):
        A = np.linalg.norm(eye_points[1] - eye_points[5])
        B = np.linalg.norm(eye_points[2] - eye_points[4])
        C = np.linalg.norm(eye_points[0] - eye_points[3])
        ear = (A + B) / (2.0 * C + 1e-6)
        return ear

    def detect_blink(self, landmarks, ear_threshold=0.20):
        left_idx = [33, 160, 158, 133, 153, 144]
        right_idx = [362, 385, 387, 263, 373, 380]
        try:
            left_eye = landmarks[left_idx]
            right_eye = landmarks[right_idx]
        except Exception:
            return {'left_ear': 0.0, 'right_ear': 0.0, 'blink': False}
        left_ear = self.eye_aspect_ratio(left_eye)
        right_ear = self.eye_aspect_ratio(right_eye)
        blink = (left_ear + right_ear) / 2.0 < ear_threshold
        return {
            'left_ear': float(left_ear),
            'right_ear': float(right_ear),
            'blink': bool(blink)
        }

    def estimate_gaze(self, landmarks):
        try:
            left_iris_idx = [468, 469, 470, 471, 472]
            right_iris_idx = [473, 474, 475, 476, 477]
            left_iris = np.mean(landmarks[left_iris_idx], axis=0)
            right_iris = np.mean(landmarks[right_iris_idx], axis=0)
        except Exception:
            return {'gaze': 'unknown'}

        left_eye_outer = landmarks[33]
        left_eye_inner = landmarks[133]
        right_eye_outer = landmarks[362]
        right_eye_inner = landmarks[263]

        def gaze_ratio(iris, outer, inner):
            total = np.linalg.norm(outer - inner)
            if total < 1e-6:
                return 0.5
            return np.linalg.norm(iris - inner) / (total + 1e-6)

        left_ratio = gaze_ratio(left_iris, left_eye_outer, left_eye_inner)
        right_ratio = gaze_ratio(right_iris, right_eye_outer, right_eye_inner)
        avg = (left_ratio + right_ratio) / 2.0
        if avg < 0.4:
            dir = 'left'
        elif avg > 0.6:
            dir = 'right'
        else:
            dir = 'center'
        return {'left_ratio': float(left_ratio), 'right_ratio': float(right_ratio), 'gaze': dir}

    def estimate_head_pose(self, landmarks, image_shape):
        image_points = np.array([
            landmarks[1],    # Nose tip
            landmarks[152],  # Chin
            landmarks[263],  # Left eye outer
            landmarks[33],   # Right eye outer
            landmarks[291],  # Left mouth
            landmarks[61],   # Right mouth
        ], dtype='double')

        model_points = np.array([
            (0.0, 0.0, 0.0),
            (0.0, -330.0, -65.0),
            (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0),
            (-150.0, -150.0, -125.0),
            (150.0, -150.0, -125.0)
        ])

        h, w = image_shape[:2]
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]],
             [0, focal_length, center[1]],
             [0, 0, 1]], dtype='double'
        )

        dist_coeffs = np.zeros((4, 1))

        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return {'valid': False}

        rmat, _ = cv2.Rodrigues(rotation_vector)
        proj_matrix = np.hstack((rmat, translation_vector))
        _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

        pitch, yaw, roll = [float(a) for a in euler_angles]
        return {'valid': True, 'pitch': pitch, 'yaw': yaw, 'roll': roll}

    def analyze(self, image):
        landmarks = self.get_landmarks(image)
        if landmarks is None:
            return None
        blink = self.detect_blink(landmarks)
        gaze = self.estimate_gaze(landmarks)
        head = self.estimate_head_pose(landmarks, image.shape)
        return {'blink': blink, 'gaze': gaze, 'head': head}


if __name__ == '__main__':
    print('Use run_demo.py to start the webcam demo with the Tasks API model.')
