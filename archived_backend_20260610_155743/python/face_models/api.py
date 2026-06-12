from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
import cv2
import base64
import os
from face_mesh_detector import FaceMeshDetector
from model_downloader import ensure_model
import io
import torch
import timm
import torchvision.transforms as T
import torch.nn.functional as F

app = FastAPI(title='Face Mesh Analysis')
detector = None
detector_init_error = None

# Initialize embedding model (timm)
embed_model = None
embed_init_error = None


def _init_embed_model():
    global embed_model, embed_init_error
    try:
        # load model from Hugging Face hub via timm
        embed_model = timm.create_model('hf_hub:gaunernst/vit_small_patch8_gap_112.cosface_ms1mv3', pretrained=True)
        embed_model.eval()
        if torch.cuda.is_available():
            embed_model.to('cuda')
        embed_init_error = None
    except Exception as e:
        embed_model = None
        embed_init_error = str(e)
        print('Warning: embedding model failed to initialize:', embed_init_error)


def _init_detector():
    global detector, detector_init_error
    try:
        model_url = os.environ.get('MODEL_URL')
        model_path = ensure_model(model_url=model_url)
        detector = FaceMeshDetector(model_asset_path=model_path)
        detector_init_error = None
    except Exception as e:
        detector = None
        detector_init_error = str(e)
        print('Warning: FaceMeshDetector failed to initialize:', detector_init_error)


# Initialize detector at import/startup
_init_detector()
_init_embed_model()


def read_imagefile(file) -> np.ndarray:
    data = file.read()
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


@app.post('/analyze')
async def analyze_image(request: Request, file: UploadFile = File(None)):
    if detector is None:
        # Service available but detector missing due to mediapipe incompatibility
        return JSONResponse(status_code=503, content={
            'error': 'Face analysis service not available',
            'details': detector_init_error or 'Detector not initialized',
            'suggestion': 'Ensure the Tasks model is available or set MODEL_URL to a valid model URL. See python/face_models/README.md for details.'
        })
    # Support either multipart upload (`file`) or JSON `{ "image": "<base64>" }`.
    content_type = request.headers.get('content-type', '')
    img = None
    if content_type.startswith('application/json'):
        body = await request.json()
        b64 = body.get('image')
        if not b64:
            raise HTTPException(status_code=400, detail='Missing image in JSON payload')
        try:
            data = base64.b64decode(b64)
            arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception:
            raise HTTPException(status_code=400, detail='Could not decode base64 image')
    else:
        if file is None or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail='Invalid image file')
        contents = await file.read()
        arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail='Could not decode image')
    analysis = detector.analyze(img)
    if analysis is None:
        return JSONResponse(content={'face': None})
    return JSONResponse(content=analysis)


@app.post('/embed')
async def embed_image(request: Request, file: UploadFile = File(None)):
    if embed_model is None:
        return JSONResponse(status_code=503, content={
            'error': 'Embedding model not available',
            'details': embed_init_error or 'Model not initialized'
        })

    content_type = request.headers.get('content-type', '')
    img = None
    if content_type.startswith('application/json'):
        body = await request.json()
        b64 = body.get('image')
        if not b64:
            raise HTTPException(status_code=400, detail='Missing image in JSON payload')
        try:
            data = base64.b64decode(b64)
            arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception:
            raise HTTPException(status_code=400, detail='Could not decode base64 image')
    else:
        if file is None or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail='Invalid image file')
        contents = await file.read()
        arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail='Could not decode image')

    # Preprocess: convert BGR -> RGB, resize to 112x112, normalize
    try:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (112, 112), interpolation=cv2.INTER_LINEAR)
        # to tensor and normalize using ImageNet stats
        transform = T.Compose([
            T.ToPILImage(),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        inp = transform(img_resized).unsqueeze(0)
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        inp = inp.to(device)
        embed_model.to(device)
        with torch.no_grad():
            out = embed_model(inp)
            # Some timm models may output a tuple; handle that
            if isinstance(out, (list, tuple)):
                out = out[0]
            # normalize
            embs = F.normalize(out, dim=1)
            embs = embs.squeeze(0).cpu().numpy().astype(float).tolist()
        return JSONResponse(content={'success': True, 'descriptor': embs})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Embedding failed: {e}')


if __name__ == '__main__':
    uvicorn.run('api:app', host='0.0.0.0', port=8000, reload=False)
