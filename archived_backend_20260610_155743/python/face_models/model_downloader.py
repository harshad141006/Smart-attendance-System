import os
import urllib.request
from pathlib import Path

DEFAULT_MODEL_URLS = [
    # Official-ish candidates; if these change, set MODEL_URL env var to a reachable URL.
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker.task',
    'https://storage.googleapis.com/mediapipe-assets/face_landmarker.task'
]


def ensure_model(model_dir: str = None, model_name: str = 'face_landmarker.task', model_url: str = None) -> str:
    """Ensure the Tasks API model exists locally. Returns the path to the model file.

    - Checks `model_dir/model_name`, downloads if missing.
    - `model_url` may be provided to override default locations.
    """
    model_dir = Path(model_dir or Path(__file__).parent / 'models')
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / model_name
    if model_path.exists():
        return str(model_path)

    urls = [model_url] if model_url else DEFAULT_MODEL_URLS
    last_err = None
    for url in filter(None, urls):
        try:
            print(f'Downloading model from: {url}')
            urllib.request.urlretrieve(url, str(model_path))
            print(f'Model saved to: {model_path}')
            return str(model_path)
        except Exception as e:
            last_err = e
            print(f'Failed to download from {url}: {e}')

    raise RuntimeError(
        'Could not download face-landmarker model. Please set the MODEL_URL environment variable '
        'or download the model manually and place it at: ' + str(model_path) + f' (last error: {last_err})'
    )
