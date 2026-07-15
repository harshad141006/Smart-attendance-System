import { useRef, useState, useCallback, useEffect } from 'react';
import config from '../config/faceConfig.json';

export const FACE_CONFIG = config;

// ---------------------------------------------------------------------------
// Pixel helpers
// ---------------------------------------------------------------------------

function estimateBlurAndBrightness(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  let totalBrightness = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = lum;
    totalBrightness += lum;
  }
  const brightness = totalBrightness / (w * h);
  let sum = 0, count = 0;
  for (let y = 1; y < h - 1; y += 4) {
    for (let x = 1; x < w - 1; x += 4) {
      const idx = y * w + x;
      const lap =
        -gray[idx - w - 1] - gray[idx - w] - gray[idx - w + 1]
        - gray[idx - 1] + 8 * gray[idx] - gray[idx + 1]
        - gray[idx + w - 1] - gray[idx + w] - gray[idx + w + 1];
      sum += lap * lap;
      count++;
    }
  }
  return { blur: count > 0 ? sum / count : 0, brightness };
}

function estimatePose(landmarks) {
  if (!landmarks || landmarks.length < 5) return { yaw: 0, pitch: 0, roll: 0 };
  const [le, re, nose, lm, rm] = landmarks;
  const roll = Math.atan2(re[1] - le[1], re[0] - le[0]) * (180 / Math.PI);
  const eyeMidX = (le[0] + re[0]) / 2;
  const eyeSpan = Math.max(re[0] - le[0], 1);
  const yaw = ((nose[0] - eyeMidX) / eyeSpan) * 90;
  const eyeMidY = (le[1] + re[1]) / 2;
  const mouthMidY = (lm[1] + rm[1]) / 2;
  const faceH = Math.max(mouthMidY - eyeMidY, 1);
  const pitch = ((nose[1] - eyeMidY) / faceH - 0.45) * 90;
  return { yaw, pitch, roll };
}


// ---------------------------------------------------------------------------
// Canvas drawing — minimal overlay, just the guide rect and face bbox
// ---------------------------------------------------------------------------
function drawOverlay(ctx, cw, ch, color, faceBox, scaleX, scaleY) {
  ctx.clearRect(0, 0, cw, ch);

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(0, 0, cw, ch);

  const gw = cw * 0.55, gh = ch * 0.75;
  const gx = (cw - gw) / 2, gy = (ch - gh) / 2;
  ctx.clearRect(gx, gy, gw, gh);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(gx + r, gy);
  ctx.lineTo(gx + gw - r, gy);
  ctx.quadraticCurveTo(gx + gw, gy, gx + gw, gy + r);
  ctx.lineTo(gx + gw, gy + gh - r);
  ctx.quadraticCurveTo(gx + gw, gy + gh, gx + gw - r, gy + gh);
  ctx.lineTo(gx + r, gy + gh);
  ctx.quadraticCurveTo(gx, gy + gh, gx, gy + gh - r);
  ctx.lineTo(gx, gy + r);
  ctx.quadraticCurveTo(gx, gy, gx + r, gy);
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Corner accents
  const cs = 18;
  ctx.lineWidth = 4;
  [[gx, gy, 1, 1], [gx + gw, gy, -1, 1], [gx, gy + gh, 1, -1], [gx + gw, gy + gh, -1, -1]]
    .forEach(([ox, oy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(ox + sx * cs, oy);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox, oy + sy * cs);
      ctx.stroke();
    });

  if (faceBox) {
    const [x1, y1, x2, y2] = faceBox;
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
    ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------------------
// Main hook — live loop only checks face count for overlay color/message
// ---------------------------------------------------------------------------
export function useFaceValidator(videoRef, overlayCanvasRef, stream) {
  const [liveStatus, setLiveStatus] = useState({
    // idle | no_face | multiple | ready
    status: 'idle',
    message: '',
    color: '#667eea',
  });

  const rafRef          = useRef(null);
  const workerCanvasRef = useRef(null);

  const analyze = useCallback(() => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !overlayCanvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(analyze);
      return;
    }

    const vw = video.videoWidth  || 640;
    const vh = video.videoHeight || 480;
    const cw = overlayCanvas.width  = overlayCanvas.offsetWidth  || 640;
    const ch = overlayCanvas.height = overlayCanvas.offsetHeight || 480;
    const scaleX = cw / vw;
    const scaleY = ch / vh;

    // Stale-safe face data from poller
    const STALE_MS = 600;
    const age = video._faceDataTime ? Date.now() - video._faceDataTime : Infinity;
    const faceData = age < STALE_MS ? video._faceData : null;
    const count = faceData?.count ?? 0;
    const fd = count === 1 ? faceData.face : null;

    // Determine color and message based only on face count
    let color, message, status;
    if (count === 0) {
      color = '#ef4444'; message = 'Position your face inside the frame.'; status = 'no_face';
    } else if (count > 1) {
      color = '#ef4444'; message = 'Only one person should be visible.'; status = 'multiple';
    } else {
      color = '#22c55e'; message = 'Face detected ✅'; status = 'ready';
      
      // Provide guidance without changing status='ready'
      if (fd && fd.bbox) {
        const [x1, y1, x2, y2] = fd.bbox;
        const faceArea = (x2 - x1) * (y2 - y1);
        const viewportArea = vw * vh;
        const sizeRatio = faceArea / viewportArea;
        
        if (sizeRatio < 0.15) {
          message = 'Move closer';
        } else if (sizeRatio > 0.70) {
          message = 'Move farther';
        } else if (fd.landmarks) {
          const { yaw, pitch } = estimatePose(fd.landmarks);
          if (Math.abs(yaw) > 20 || Math.abs(pitch) > 20) {
            message = 'Look at the camera';
          }
        }
      }
    }

    const ctx = overlayCanvas.getContext('2d');
    drawOverlay(ctx, cw, ch, color, fd?.bbox ?? null, scaleX, scaleY);

    setLiveStatus({ status, message, color });

    rafRef.current = requestAnimationFrame(analyze);
  }, [videoRef, overlayCanvasRef]);

  useEffect(() => {
    if (!stream) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setLiveStatus({ status: 'idle', message: '', color: '#667eea' });
      return;
    }
    rafRef.current = requestAnimationFrame(analyze);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [stream, analyze]);

  // Capture the current video frame + face data for post-capture validation
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const vw = video.videoWidth  || 640;
    const vh = video.videoHeight || 480;

    if (!workerCanvasRef.current) workerCanvasRef.current = document.createElement('canvas');
    const wc = workerCanvasRef.current;
    wc.width = vw; wc.height = vh;
    const wctx = wc.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(video, 0, 0, vw, vh);

    const { blur, brightness } = estimateBlurAndBrightness(wctx, vw, vh);
    const b64 = wc.toDataURL('image/jpeg', 0.92);

    const STALE_MS = 600;
    const age = video._faceDataTime ? Date.now() - video._faceDataTime : Infinity;
    const faceData = age < STALE_MS ? video._faceData : null;
    const fd = faceData?.count === 1 ? faceData.face : null;

    return { b64, blur, brightness, fd, vw, vh };
  }, [videoRef]);

  return { liveStatus, captureFrame };
}
