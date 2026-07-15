import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const POLL_INTERVAL_MS = 200; // ~5fps
// How long stale face data is trusted before being treated as "no face"
const STALE_TIMEOUT_MS = 600;

export function useFaceDetectionPoller(videoRef, captureCanvasRef, stream) {
  const timerRef     = useRef(null);
  const busyRef      = useRef(false);
  const lastPollTime = useRef(0);

  const poll = useCallback(async () => {
    if (busyRef.current) return;
    const video  = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    busyRef.current = true;
    try {
      const vw = video.videoWidth  || 640;
      const vh = video.videoHeight || 480;
      canvas.width  = vw;
      canvas.height = vh;
      canvas.getContext('2d').drawImage(video, 0, 0, vw, vh);
      const b64 = canvas.toDataURL('image/jpeg', 0.6);

      const res = await api.post('/attendance/face-detect', { image: b64 });
      // Only update _faceData on success — never null it during in-flight requests
      // so the validator sees stable data between polls
      if (videoRef.current) {
        videoRef.current._faceData     = res.data;
        videoRef.current._faceDataTime = Date.now();
      }
      lastPollTime.current = Date.now();
    } catch {
      // On hard error keep stale data; validator will expire it via STALE_TIMEOUT_MS
    } finally {
      busyRef.current = false;
    }
  }, [videoRef, captureCanvasRef]);

  // Expose stale-timeout so validator can read it
  videoRef._staleTimeoutMs = STALE_TIMEOUT_MS;

  useEffect(() => {
    if (!stream) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (videoRef.current) {
        videoRef.current._faceData     = null;
        videoRef.current._faceDataTime = 0;
      }
      return;
    }
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stream, poll]);
}
