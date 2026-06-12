# Face API Models

This directory should contain the pre-trained Face API model files required by **face-api.js**:

- `ssd_mobilenetv1_model-weights_manifest.json` and associated binary files
- `face_landmark_68_model-weights_manifest.json` and binaries
- `face_recognition_model-weights_manifest.json` and binaries

You can download the models from the official repository:
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Place the downloaded files directly inside this `models` folder. The frontend loads models from `/models`, which maps to this directory when using Vite.
