Face Mesh model (MediaPipe + OpenCV)
===================================

Files:

- `face_mesh_detector.py`: Detector class providing `analyze(image)` that returns blink, gaze, and head pose info.
- `run_demo.py`: Simple webcam demo that shows blink/gaze/head status.
- `requirements.txt`: Python dependencies.

Quick start:

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Run webcam demo:

```bash
cd python/face_models
python run_demo.py
```

Integration notes:

- A FastAPI wrapper is provided in `api.py` which exposes `POST /analyze` and returns JSON analysis for an uploaded image.
- To run the FastAPI service (recommended for integration):

```bash
cd python/face_models
# activate venv
uvicorn api:app --host 127.0.0.1 --port 8000
```

- The backend already includes a route that forwards images to the Python service: `POST /api/vision/analyze`.
	- This endpoint expects a JSON body with an `image` field containing a base64-encoded image (data URL or raw base64).
	- The Node route proxies the image to the Python FastAPI service and returns its JSON response.
	- Compatibility note:

	- This repository's `face_mesh_detector.py` uses the legacy MediaPipe Solutions API (`mp.solutions`).
	- The `requirements.txt` pins `mediapipe==0.8.10` which provides that API. Older/newer mediapipe releases
		may expose a different Tasks API and will not work with the current detector implementation.
	- If you encounter import errors like "module 'mediapipe' has no attribute 'solutions'", either:
		1) Install the pinned legacy mediapipe inside the venv: `pip install mediapipe==0.8.10`, or
		2) Upgrade the detector code to use the MediaPipe Tasks API and supply the appropriate TFLite model files.
Notes and caveats:

- MediaPipe `refine_landmarks=True` is used to access iris landmarks. Some mediapipe versions may vary; adjust indices if required.
- Thresholds (EAR, gaze) are conservative defaults — tune them for your camera and lighting.
