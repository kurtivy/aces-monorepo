'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  onCancel: () => void;
  isUploading?: boolean;
}

export function CameraCapture({ onCapture, onCancel, isUploading = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isInitializing, setIsInitializing] = useState(true);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsInitializing(true);

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.333 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsStreaming(true);
          setIsInitializing(false);
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setIsInitializing(false);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.');
        } else if (err.name === 'NotSupportedError') {
          setError('Camera not supported on this device.');
        } else {
          setError('Failed to access camera. Please try again.');
        }
      } else {
        setError('Failed to access camera. Please try again.');
      }
    }
  }, [facingMode]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          stopCamera();
        }
      },
      'image/jpeg',
      0.8,
    );
  }, [isStreaming, stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
      setCapturedImage(null);
    }
    startCamera();
  }, [capturedImage, startCamera]);

  // Confirm photo
  const confirmPhoto = useCallback(async () => {
    if (!capturedImage || !canvasRef.current) return;

    // Convert canvas to blob
    canvasRef.current.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob);
        }
      },
      'image/jpeg',
      0.8,
    );
  }, [capturedImage, onCapture]);

  // Switch camera (mobile)
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [startCamera, stopCamera]); // Removed capturedImage from dependencies to avoid cleanup loop

  // Check if device has multiple cameras (for switch button)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      })
      .catch(() => setHasMultipleCameras(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Camera View */}
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
        {/* Loading State */}
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <Camera className="w-12 h-12 text-[#D0B284] mx-auto mb-2 animate-pulse" />
              <p className="text-white text-sm">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center px-4">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
              <p className="text-white text-sm mb-4">{error}</p>
              <Button
                onClick={startCamera}
                variant="outline"
                size="sm"
                className="border-[#D0B284] text-[#D0B284] hover:bg-[#D0B284] hover:text-black"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Video Stream */}
        {!error && !capturedImage && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ display: isStreaming ? 'block' : 'none' }}
          />
        )}

        {/* Captured Image Preview */}
        {capturedImage && (
          <img src={capturedImage} alt="Captured selfie" className="w-full h-full object-cover" />
        )}

        {/* Camera Controls Overlay */}
        {isStreaming && !error && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
            {/* Switch Camera (Mobile) */}
            {hasMultipleCameras && (
              <Button
                onClick={switchCamera}
                size="sm"
                variant="outline"
                className="border-white/50 text-white hover:bg-white/20"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}

            {/* Capture Button */}
            <Button
              onClick={capturePhoto}
              size="lg"
              className="bg-[#D0B284] hover:bg-[#D0B284]/80 text-black rounded-full w-16 h-16 p-0"
            >
              <Camera className="w-6 h-6" />
            </Button>

            {/* Cancel Button */}
            <Button
              onClick={onCancel}
              size="sm"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Photo Review Controls */}
        {capturedImage && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
            {/* Retake Button */}
            <Button
              onClick={retakePhoto}
              size="sm"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/20"
              disabled={isUploading}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>

            {/* Confirm Button */}
            <Button
              onClick={confirmPhoto}
              size="lg"
              className="bg-[#D0B284] hover:bg-[#D0B284]/80 text-black"
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {isUploading ? 'Processing...' : 'Use Photo'}
            </Button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center">
        {!capturedImage ? (
          <div>
            <p className="text-sm text-[#DCDDCC] mb-1">
              Position your face in the center and tap the capture button
            </p>
            <p className="text-xs text-gray-400">
              Make sure your face is well-lit and clearly visible
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#DCDDCC] mb-1">
              Review your photo and confirm if it looks good
            </p>
            <p className="text-xs text-gray-400">
              Your face should be clearly visible and match your document
            </p>
          </div>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
