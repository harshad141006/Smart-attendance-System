import { useState, useCallback, useRef } from 'react';

export const useCamera = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null); // to keep track of the attached video element

  const startCamera = useCallback(async (videoElement) => {
    setLoading(true);
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      if (videoElement) {
        videoRef.current = videoElement;
        videoElement.srcObject = mediaStream;
        // Attempt to play and catch any AbortError if it gets interrupted
        try {
          await videoElement.play();
        } catch (playErr) {
          if (playErr.name !== 'AbortError') {
             console.error('Video play error:', playErr);
          }
        }
      }

      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, [stream]);

  return { stream, error, loading, startCamera, stopCamera };
};
