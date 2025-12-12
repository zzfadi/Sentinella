import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MonitoringTier, RiskLevel, LogEntry, SystemStatus } from '../types';
import { analyzeFrameTier2, analyzeFrameTier3 } from '../services/geminiService';
import { Upload, X, Video as VideoIcon, Camera, Film, PlayCircle, FolderOpen, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';

interface MonitorProps {
  onStatusChange: (status: SystemStatus) => void;
  onLog: (entry: LogEntry) => void;
  onRiskChange: (risk: RiskLevel) => void;
  isActive: boolean;
  apiKey: string;
}

const MOTION_THRESHOLD = 15;
const WATCHDOG_INTERVAL = 1000;
const ANALYZER_INTERVAL = 4000;
const ACTIVITY_TRIGGER = 5;

const SAMPLE_SCENARIOS = [
  {
    id: 'sleeping',
    name: "Sleeping Baby",
    url: "https://videos.pexels.com/video-files/3205803/3205803-sd_640_360_25fps.mp4",
    desc: "Low risk"
  },
  {
    id: 'active',
    name: "Active Playing",
    url: "https://videos.pexels.com/video-files/3256542/3256542-sd_640_360_25fps.mp4",
    desc: "High motion"
  }
];

const Monitor: React.FC<MonitorProps> = ({ onStatusChange, onLog, onRiskChange, isActive, apiKey }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [currentTier, setCurrentTier] = useState<MonitoringTier>(MonitoringTier.OFF);
  const [testVideoSrc, setTestVideoSrc] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Camera selection state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const prevFrameData = useRef<Uint8ClampedArray | null>(null);
  const lastAnalysisTime = useRef<number>(0);
  const tierRef = useRef<MonitoringTier>(MonitoringTier.OFF);
  const riskRef = useRef<RiskLevel>(RiskLevel.SAFE);
  const requestRef = useRef<number>();
  
  // Safety ref to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Detect Cameras
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(cameras);
      } catch (err) {
        console.warn("Error enumerating devices:", err);
      }
    };
    
    // Initial check
    getDevices();
    
    // Listen for changes (plugging in webcam, etc.)
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  const handleSwitchCamera = useCallback(() => {
    if (videoDevices.length < 2) return;
    
    const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
    
    // Logic: If current device isn't explicitly selected (index -1), we assume 
    // the system default (index 0) is active, so we switch to index 1.
    // Otherwise, we just cycle to the next one.
    let nextIndex = 0;
    if (currentIndex === -1) {
        nextIndex = 1;
    } else {
        nextIndex = (currentIndex + 1) % videoDevices.length;
    }
    
    const nextDevice = videoDevices[nextIndex];
    if (nextDevice) {
        setSelectedDeviceId(nextDevice.deviceId);
    }
  }, [videoDevices, selectedDeviceId]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return null;
    
    // Resize frame to max 640px width to ensure payload is within API limits (< 4MB)
    const MAX_WIDTH = 640;
    const videoW = videoRef.current.videoWidth;
    const videoH = videoRef.current.videoHeight;
    
    let targetW = videoW;
    let targetH = videoH;
    
    if (videoW > MAX_WIDTH) {
        const ratio = MAX_WIDTH / videoW;
        targetW = MAX_WIDTH;
        targetH = videoH * ratio;
    }
    
    // Ensure integer dimensions to prevent rendering artifacts
    canvasRef.current.width = Math.floor(targetW);
    canvasRef.current.height = Math.floor(targetH);
    
    try {
        ctx.drawImage(videoRef.current, 0, 0, Math.floor(targetW), Math.floor(targetH));
        // Lowered quality to 0.5 to prevent 500 RPC payload errors on congested networks
        return canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
    } catch (e) {
        return null;
    }
  }, []);

  const calculateMotion = useCallback((): number => {
    if (!videoRef.current || !canvasRef.current) return 0;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const w = 64;
    const h = 48;
    
    try {
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        let score = 0;
        
        if (prevFrameData.current) {
          let changedPixels = 0;
          for (let i = 0; i < data.length; i += 4) {
            const rDiff = Math.abs(data[i] - prevFrameData.current[i]);
            const gDiff = Math.abs(data[i + 1] - prevFrameData.current[i + 1]);
            const bDiff = Math.abs(data[i + 2] - prevFrameData.current[i + 2]);
            if (rDiff + gDiff + bDiff > MOTION_THRESHOLD) changedPixels++;
          }
          score = (changedPixels / (w * h)) * 100;
        }
        prevFrameData.current = data;
        return score;
    } catch (e) {
        return 0;
    }
  }, []);

  const processFrame = useCallback(async () => {
    if (!isActive) return;

    const now = Date.now();
    const motionScore = calculateMotion();
    
    onStatusChange({
      tier: tierRef.current,
      fps: tierRef.current === MonitoringTier.WATCHDOG ? 1 : 10,
      activityScore: motionScore,
      lastAnalysis: new Date(lastAnalysisTime.current)
    });

    if (tierRef.current === MonitoringTier.WATCHDOG && motionScore > ACTIVITY_TRIGGER) {
      tierRef.current = MonitoringTier.ANALYZER;
      setCurrentTier(MonitoringTier.ANALYZER);
      onLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        tier: MonitoringTier.WATCHDOG,
        message: `Motion detected (${motionScore.toFixed(1)}%). Elevating to Tier 2.`,
        riskLevel: riskRef.current
      });
    }

    if (tierRef.current === MonitoringTier.ANALYZER && motionScore < 1 && (now - lastAnalysisTime.current > 10000)) {
       tierRef.current = MonitoringTier.WATCHDOG;
       setCurrentTier(MonitoringTier.WATCHDOG);
       onLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        tier: MonitoringTier.ANALYZER,
        message: `No activity. Returning to Watchdog mode.`,
        riskLevel: RiskLevel.SAFE
      });
    }

    const interval = tierRef.current === MonitoringTier.WATCHDOG ? WATCHDOG_INTERVAL : ANALYZER_INTERVAL;
    
    if (now - lastAnalysisTime.current > interval) {
      lastAnalysisTime.current = now;

      if (tierRef.current === MonitoringTier.ANALYZER || tierRef.current === MonitoringTier.EXPERT) {
        const frame = captureFrame();
        if (frame) {
          try {
              const result = await analyzeFrameTier2(apiKey, frame);
              
              // Check mount status after async call
              if (!isMountedRef.current || !isActive) return;

              if (result.riskLevel === RiskLevel.DANGER || result.riskLevel === RiskLevel.CAUTION) {
                 riskRef.current = result.riskLevel;
                 onRiskChange(result.riskLevel);
                 
                 if (result.riskLevel === RiskLevel.DANGER && tierRef.current !== MonitoringTier.EXPERT) {
                   tierRef.current = MonitoringTier.EXPERT;
                   setCurrentTier(MonitoringTier.EXPERT);
                   
                   onLog({
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    tier: MonitoringTier.ANALYZER,
                    message: `DANGER: ${result.notes}. Elevating to Expert.`,
                    riskLevel: RiskLevel.DANGER
                  });

                   analyzeFrameTier3(apiKey, frame).then(expert => {
                     // Check mount status again after second async call
                     if (!isMountedRef.current || !isActive) return;

                     onLog({
                       id: crypto.randomUUID(),
                       timestamp: new Date(),
                       tier: MonitoringTier.EXPERT,
                       message: `EXPERT: ${expert.detailedAnalysis} ADVICE: ${expert.recommendation}`,
                       riskLevel: RiskLevel.DANGER
                     });
                     
                     setTimeout(() => {
                        // Ensure we don't switch state if component unmounted or user stopped monitoring
                        if (isMountedRef.current && isActive && tierRef.current === MonitoringTier.EXPERT) {
                            tierRef.current = MonitoringTier.ANALYZER;
                            setCurrentTier(MonitoringTier.ANALYZER);
                        }
                     }, 5000); 
                   });
                 } else {
                   onLog({
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    tier: MonitoringTier.ANALYZER,
                    message: `Analysis: ${result.posture}, Face: ${result.faceVisible ? 'Visible' : 'Hidden'}. ${result.notes}`,
                    riskLevel: result.riskLevel
                   });
                 }

              } else {
                 if (riskRef.current !== RiskLevel.SAFE) {
                    riskRef.current = RiskLevel.SAFE;
                    onRiskChange(RiskLevel.SAFE);
                    onLog({
                      id: crypto.randomUUID(),
                      timestamp: new Date(),
                      tier: MonitoringTier.ANALYZER,
                      message: `Situation stabilized. Safe.`,
                      riskLevel: RiskLevel.SAFE
                    });
                 }
              }
          } catch (err) {
              // Graceful failure for analysis
              console.error("Analysis loop error:", err);
          }
        }
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [isActive, captureFrame, onStatusChange, onLog, onRiskChange, calculateMotion, apiKey]);

  // EFFECT 1: VIDEO SOURCE MANAGEMENT
  useEffect(() => {
    let mounted = true;

    const stopStream = () => {
       if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
       }
       if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.src = "";
          videoRef.current.srcObject = null;
       }
    };

    const startStream = async () => {
      stopStream();
      setError(null);

      if (!videoRef.current || !mounted) return;

      try {
        if (testVideoSrc) {
             // VIDEO FILE MODE
             videoRef.current.src = testVideoSrc;
             videoRef.current.loop = true;
             
             if (testVideoSrc.startsWith('http')) {
                videoRef.current.crossOrigin = "anonymous";
             } else {
                videoRef.current.removeAttribute('crossOrigin');
             }

             videoRef.current.onloadedmetadata = () => {
                if (mounted && videoRef.current) {
                    videoRef.current.play().catch(e => console.warn("Auto-play blocked", e));
                }
             };
        } else if (isActive) {
            // CAMERA MODE
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera API is unavailable. Secure Context (HTTPS) required.");
            }

            const constraints: MediaStreamConstraints = { 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 } 
                }, 
                audio: false 
            };

            if (selectedDeviceId && (constraints.video as MediaTrackConstraints)) {
                 (constraints.video as MediaTrackConstraints).deviceId = { exact: selectedDeviceId };
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            navigator.mediaDevices.enumerateDevices().then(devices => {
               if (mounted) {
                   setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
               }
            });

            if (mounted && videoRef.current) {
                streamRef.current = stream;
                videoRef.current.removeAttribute('crossOrigin');
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(e => {
                    console.warn("Camera play blocked", e);
                    setError("Autoplay blocked. Please interact with the page.");
                });
            } else {
                stream.getTracks().forEach(t => t.stop());
            }
        }
      } catch (err: any) {
        console.error("Source initialization error:", err);
        setError(err.message || "Failed to initialize camera. Check permissions.");
      }
    };

    if (isActive || testVideoSrc) {
       startStream();
    } else {
       stopStream();
    }

    return () => {
      mounted = false;
      stopStream();
    };
  }, [isActive, testVideoSrc, selectedDeviceId]); 

  // EFFECT 2: PROCESSING LOOP MANAGEMENT
  useEffect(() => {
    if (isActive) {
        tierRef.current = MonitoringTier.WATCHDOG;
        setCurrentTier(MonitoringTier.WATCHDOG);
        requestRef.current = requestAnimationFrame(processFrame);
    } else {
        tierRef.current = MonitoringTier.OFF;
        setCurrentTier(MonitoringTier.OFF);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, processFrame]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setTestVideoSrc(url);
          setIsSample(false);
          setError(null);
      }
  };

  const handleSelectSample = (url: string) => {
    setTestVideoSrc(url);
    setIsSample(true);
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    window.location.reload(); 
  };

  return (
    <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-200 group">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        webkit-playsinline="true"
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Error State */}
      {error && isActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm text-white p-8 text-center animate-in fade-in">
              <div className="max-w-md">
                  <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="w-8 h-8 text-rose-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Camera Unavailable</h3>
                  <p className="text-slate-300 mb-8 leading-relaxed text-sm">
                      {error}
                      <br/>
                      <span className="text-slate-500 text-xs mt-2 block">
                        If using HTTP, switch to HTTPS or use simulation mode.
                      </span>
                  </p>
                  <button 
                    onClick={handleRetry}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors mx-auto"
                  >
                      <RefreshCw className="w-4 h-4" />
                      Reload App
                  </button>
              </div>
          </div>
      )}

      {/* Offline / Setup Overlay */}
      {!isActive && (
        <div className={`absolute inset-0 flex flex-col z-10 transition-all duration-500 ${
            testVideoSrc ? 'bg-black/0 pointer-events-none' : 'bg-white/95 backdrop-blur-md p-6 overflow-y-auto'
        }`}>
          
          {/* Main Setup UI */}
          <div className={`flex flex-col items-center justify-center w-full max-w-2xl mx-auto transition-opacity duration-300 ${testVideoSrc ? 'opacity-0' : 'opacity-100'}`}>
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
                 <Camera className="w-8 h-8 text-violet-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Initialize Monitor</h3>
            <p className="text-slate-500 text-center mb-8 max-w-md text-sm">
                Connect a camera or load a simulation video to test the AI distress detection logic.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {/* Upload */}
                <label className="cursor-pointer flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50 transition-all active:scale-95">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <FolderOpen className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="text-center">
                        <span className="block font-semibold text-slate-700">Upload Video</span>
                        <span className="text-xs text-slate-400">MP4, WebM (Local)</span>
                    </div>
                    <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                </label>

                {/* Scenarios */}
                <div className="flex flex-col gap-2">
                    {SAMPLE_SCENARIOS.map(scenario => (
                        <button 
                            key={scenario.id}
                            onClick={() => handleSelectSample(scenario.url)}
                            className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-violet-400 hover:shadow-md transition-all text-left active:scale-95"
                        >
                            <div className="p-2 bg-emerald-100 rounded-full text-emerald-600">
                                <PlayCircle size={20} />
                            </div>
                            <div>
                                <span className="block font-semibold text-sm text-slate-800">{scenario.name}</span>
                                <span className="text-xs text-slate-500">{scenario.desc}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* Floating Controls for Preview Mode */}
          {testVideoSrc && (
             <div className="absolute bottom-4 left-4 right-4 pointer-events-auto flex items-center justify-between animate-in fade-in slide-in-from-bottom-4">
                 <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-3 shadow-lg">
                    <Film className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-medium">
                        {isSample ? "PREVIEW: SCENARIO" : "PREVIEW: UPLOAD"}
                    </span>
                 </div>

                 <button 
                    onClick={() => { setTestVideoSrc(null); setIsSample(false); }}
                    className="p-3 rounded-full bg-white text-slate-800 shadow-xl hover:bg-slate-100 active:scale-90 transition-all"
                 >
                    <X size={20} />
                 </button>
             </div>
          )}
          
          {/* Prompt to Start if loaded */}
          {testVideoSrc && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                  <div className="bg-black/40 backdrop-blur-sm px-6 py-4 rounded-2xl text-white mb-2">
                      <p className="text-lg font-bold">Video Loaded</p>
                      <p className="text-sm opacity-90">Press "Start Monitoring" above</p>
                  </div>
              </div>
          )}

        </div>
      )}

      {/* Switch Camera Button (Only Live Mode) */}
      {isActive && !testVideoSrc && !error && videoDevices.length > 1 && (
        <div className="absolute top-4 right-4 z-20">
            <button
                onClick={handleSwitchCamera}
                className="bg-black/40 backdrop-blur-md hover:bg-black/60 text-white p-2.5 rounded-full transition-all active:scale-90 active:rotate-180 duration-300 shadow-lg border border-white/10"
                title="Switch Camera"
            >
                <SwitchCamera size={20} />
            </button>
        </div>
      )}

      {isActive && !error && (
        <div className="absolute top-4 left-4 flex gap-2">
          <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${currentTier === MonitoringTier.WATCHDOG ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`}></div>
            <span className="text-xs font-bold text-slate-700">
                {testVideoSrc ? (isSample ? 'SIM: SCENARIO' : 'SIM: FILE') : 'LIVE CAMERA'}
            </span>
          </div>
        </div>
      )}
      
      {/* Tier Overlay */}
      {isActive && !error && (
         <div className="absolute bottom-4 right-4 text-right">
             <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-100">
                 <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">AI Engine</p>
                 <p className={`text-sm font-bold tracking-wide ${
                     currentTier === MonitoringTier.EXPERT ? 'text-rose-500 animate-pulse' :
                     currentTier === MonitoringTier.ANALYZER ? 'text-violet-600' : 'text-blue-500'
                 }`}>
                     {currentTier}
                 </p>
             </div>
         </div>
      )}
    </div>
  );
};

export default Monitor;