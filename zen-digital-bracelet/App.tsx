import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { initializeHandLandmarker } from './services/vision';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import { DigitalBracelet } from './components/DigitalBracelet';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [handDistance, setHandDistance] = useState<number>(0.1); // Default semi-open
  const [isHandPresent, setIsHandPresent] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let landmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => {
                videoRef.current!.play();
                resolve();
              };
            }
          });
        }
      } catch (e) {
        console.error("Camera error:", e);
        setError("Camera access required for interaction.");
        setLoading(false);
      }
    };

    const startPrediction = async () => {
      landmarker = await initializeHandLandmarker();
      setLoading(false);

      const predict = () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && landmarker) {
          const results = landmarker.detectForVideo(videoRef.current, performance.now());
          
          if (results.landmarks.length > 0) {
            setIsHandPresent(true);
            const landmarks = results.landmarks[0];
            
            // Calculate distance between Thumb Tip (4) and Index Tip (8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            
            // Simple Euclidean distance (ignoring Z for simplified normalized interaction)
            const distance = Math.sqrt(
              Math.pow(thumbTip.x - indexTip.x, 2) + 
              Math.pow(thumbTip.y - indexTip.y, 2)
            );
            
            // Log distance for debugging thresholds
            // console.log("Dist:", distance);
            
            setHandDistance(distance);
          } else {
            setIsHandPresent(false);
          }
        }
        animationFrameId = requestAnimationFrame(predict);
      };
      predict();
    };

    setupCamera().then(() => {
        startPrediction();
    });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden font-mono">
      {/* Hidden Video Feed for CV */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 opacity-0 pointer-events-none w-[640px] h-[480px]"
        playsInline
      />

      {/* 3D Scene */}
      <Canvas camera={{ position: [0, 0, 12], fov: 45 }}>
        <DigitalBracelet 
          handDistance={handDistance} 
          isHandPresent={isHandPresent} 
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 max-w-sm pointer-events-none select-none">
        <h1 className="text-2xl font-bold mb-2 tracking-widest uppercase">Zen Bracelet</h1>
        {loading && <p className="text-yellow-400 animate-pulse">Initializing Vision Engine...</p>}
        {error && <p className="text-red-500">{error}</p>}
        
        {!loading && !error && (
          <div className="space-y-2 text-sm text-gray-400 bg-black/50 p-4 rounded-lg backdrop-blur-sm border border-gray-800">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isHandPresent ? 'bg-green-500' : 'bg-red-900'}`}></div>
              <span>{isHandPresent ? 'Hand Detected' : 'Show hand to interact'}</span>
            </div>
            
            <div className="pt-2 border-t border-gray-800">
              <p><strong>Gestures:</strong></p>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li className={handDistance < 0.06 && isHandPresent ? 'text-white' : ''}>
                  Pinch & Hold: Rotate beads (Pan)
                </li>
                <li className={handDistance > 0.18 && isHandPresent ? 'text-white' : ''}>
                  Open Hand: Scatter thoughts
                </li>
              </ul>
            </div>
            
            <div className="pt-2 text-xs opacity-50">
              Distance: {handDistance.toFixed(3)}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 w-full text-center text-gray-600 text-xs pointer-events-none">
        Powered by React Three Fiber & MediaPipe
      </div>
    </div>
  );
};

export default App;