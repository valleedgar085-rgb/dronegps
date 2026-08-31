import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Upload, Navigation, 
  Battery, Signal, Compass, Layers, Gauge, ArrowUpRight 
} from 'lucide-react';
import { DroneTelemetryPoint, FlightSummary } from '../types/droneTelemetry';
import { parseRukoLog } from '../parsers/rukoLogParser';
import { Cesium3DViewer } from './Cesium3DViewer';

export const DroneFlightDashboard: React.FC = () => {
  const [telemetry, setTelemetry] = useState<DroneTelemetryPoint[]>([]);
  const [summary, setSummary] = useState<FlightSummary | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [cameraMode, setCameraMode] = useState<'chase' | 'orbit' | 'fpv' | 'topDown'>('chase');
  const [showAltitudeCurtain, setShowAltitudeCurtain] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Log File Loading
  const handleFileLoad = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseRukoLog(text, file.name);
        setTelemetry(result.points);
        setSummary(result.summary);
        setCurrentIndex(0);
        setIsPlaying(false);
      } catch (err: any) {
        alert(err.message || 'Failed to parse Ruko flight log.');
      }
    };
    reader.readAsText(file);
  };

  // Playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && telemetry.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= telemetry.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, telemetry.length]);

  const currentPt = telemetry[currentIndex] || {
    timestamp: 0, timeString: '00:00', latitude: 0, longitude: 0, altitudeAGL: 0,
    pitch: 0, roll: 0, yaw: 0, speedHorizontal: 0, speedVertical: 0,
    batteryPercent: 100, batteryVoltage: 7.4, satellites: 0, distanceFromHome: 0
  };

  return (
    <div 
      className="relative w-full h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (e.dataTransfer.files[0]) handleFileLoad(e.dataTransfer.files[0]);
      }}
    >
      {/* ── DRAG AND DROP OVERLAY ──────────────────────────────────── */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-cyan-950/80 backdrop-blur-md border-4 border-dashed border-cyan-400 z-50 flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-16 h-16 text-cyan-400 mb-3 animate-bounce" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Drop Ruko Flight Log Here</h2>
          <p className="text-sm text-cyan-200">Accepts .CSV or .TXT telemetry files</p>
        </div>
      )}

      {/* ── TOP HEADER ─────────────────────────────────────────────── */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20">
        <div className="flex items-center space-x-3">
          <Navigation className="w-5 h-5 text-cyan-400" />
          <span className="font-bold tracking-wider text-sm uppercase text-slate-200">
            Ruko 3D Flight Reviewer
          </span>
          {summary && (
            <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-950 text-cyan-400 rounded-full border border-cyan-800/50">
              {summary.fileName}
            </span>
          )}
        </div>

        {summary && (
          <div className="hidden md:flex items-center space-x-6 text-xs font-mono text-slate-400">
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Max Altitude</span>
              <span className="text-emerald-400 font-bold">{summary.maxAltitude} m AGL</span>
            </div>
            <div className="h-5 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Max Distance</span>
              <span className="text-amber-400 font-bold">{summary.maxDistance} m</span>
            </div>
            <div className="h-5 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Duration</span>
              <span className="text-slate-200 font-bold">
                {Math.floor(summary.totalDurationSeconds / 60)}m {summary.totalDurationSeconds % 60}s
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileLoad(e.target.files[0])}
            accept=".csv,.txt,.gpx"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Log File</span>
          </button>
        </div>
      </header>

      {/* ── 3D MAP & HUD VIEWPORT ─────────────────────────────────── */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden">
        {telemetry.length > 0 ? (
          <Cesium3DViewer
            telemetry={telemetry}
            currentIndex={currentIndex}
            cameraMode={cameraMode}
            showAltitudeCurtain={showAltitudeCurtain}
            googleApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Upload className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No Flight Log Loaded</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Drag and drop your Ruko drone flight log file (.csv/.txt) here or click Open Log File above.
            </p>
          </div>
        )}

        {/* ── LEFT AVIATION HUD OVERLAY ───────────────────────────── */}
        {telemetry.length > 0 && (
          <div className="absolute top-4 left-4 z-10 flex flex-col space-y-3 pointer-events-none">
            {/* Artificial Horizon */}
            <div className="w-44 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 shadow-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                  <Gauge className="w-3 h-3 text-cyan-400 mr-1" /> Attitude
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {currentPt.pitch > 0 ? `+${currentPt.pitch}` : currentPt.pitch}° / {currentPt.roll}°
                </span>
              </div>
              <div className="relative w-full h-24 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                <div 
                  className="absolute inset-0 transition-transform duration-75"
                  style={{
                    transform: `translateY(${currentPt.pitch * 1.2}px) rotate(${-currentPt.roll}deg)`
                  }}
                >
                  <div className="h-1/2 bg-sky-900/70 border-b border-cyan-400/80" />
                  <div className="h-1/2 bg-amber-950/70" />
                </div>
                <div className="absolute w-7 h-0.5 bg-yellow-400 shadow-md shadow-yellow-400/60" />
                <div className="absolute w-0.5 h-2 bg-yellow-400" />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-mono bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                <span className="text-slate-400 flex items-center">
                  <Compass className="w-3 h-3 text-cyan-400 mr-1" /> HDG
                </span>
                <span className="text-cyan-400 font-bold">{Math.round(currentPt.yaw)}°</span>
              </div>
            </div>

            {/* Flight Tapes */}
            <div className="w-44 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-2.5 shadow-2xl flex space-x-2">
              <div className="flex-1 bg-slate-900/80 rounded-lg p-2 text-center border border-slate-800/60">
                <span className="text-[9px] text-slate-400 uppercase block font-semibold">Speed</span>
                <span className="text-base font-mono font-bold text-cyan-400">{currentPt.speedHorizontal}</span>
                <span className="text-[9px] text-slate-500 block">m/s</span>
              </div>
              <div className="flex-1 bg-slate-900/80 rounded-lg p-2 text-center border border-slate-800/60">
                <span className="text-[9px] text-slate-400 uppercase block font-semibold">Altitude</span>
                <span className="text-base font-mono font-bold text-emerald-400">{currentPt.altitudeAGL}</span>
                <span className="text-[9px] text-slate-500 block">m AGL</span>
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT TELEMETRY OVERLAY ─────────────────────────────── */}
        {telemetry.length > 0 && (
          <div className="absolute top-4 right-4 z-10 w-60 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3.5 shadow-2xl space-y-3 pointer-events-none">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>Telemetry</span>
              <span className="flex items-center text-emerald-400 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                {currentPt.satellites} Sats
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center">
                  <Battery className="w-3.5 h-3.5 text-emerald-400 mr-1" /> Battery
                </span>
                <span className="text-slate-200 font-bold">{currentPt.batteryPercent}% ({currentPt.batteryVoltage}V)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${currentPt.batteryPercent > 25 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${currentPt.batteryPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">DISTANCE</span>
                <span className="text-slate-200 font-bold flex items-center">
                  <ArrowUpRight className="w-3 h-3 text-amber-400 mr-1" />
                  {currentPt.distanceFromHome} m
                </span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">CLIMB RATE</span>
                <span className="text-slate-200 font-bold">
                  {currentPt.speedVertical > 0 ? `+${currentPt.speedVertical}` : currentPt.speedVertical} m/s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── TOP-CENTER CAMERA / CURTAIN TOGGLES ──────────────────── */}
        {telemetry.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-1 shadow-2xl space-x-1 text-xs">
            {(['chase', 'orbit', 'fpv', 'topDown'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCameraMode(mode)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                  cameraMode === mode ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'topDown' ? 'Top-Down' : mode}
              </button>
            ))}
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={() => setShowAltitudeCurtain(!showAltitudeCurtain)}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                showAltitudeCurtain ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Altitude Curtain</span>
            </button>
          </div>
        )}
      </div>

      {/* ── BOTTOM TIMELINE & ALTITUDE PROFILE SCRUBBER ───────────── */}
      {telemetry.length > 0 && (
        <footer className="h-28 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-6 py-3 flex flex-col justify-between z-20">
          
          {/* Synchronized Altitude Profile SVG Line & Scrubber */}
          <div className="relative w-full h-8 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-end">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${telemetry.length} ${(summary?.maxAltitude || 50) + 5}`}>
              <path
                d={`M 0 ${(summary?.maxAltitude || 50) + 5} ${telemetry.map((pt, i) => `L ${i} ${(summary?.maxAltitude || 50) + 5 - pt.altitudeAGL}`).join(' ')} L ${telemetry.length} ${(summary?.maxAltitude || 50) + 5} Z`}
                fill="rgba(6, 182, 212, 0.2)"
              />
              <path
                d={`M 0 ${(summary?.maxAltitude || 50) + 5 - telemetry[0].altitudeAGL} ${telemetry.map((pt, i) => `L ${i} ${(summary?.maxAltitude || 50) + 5 - pt.altitudeAGL}`).join(' ')}`}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.5"
              />
            </svg>
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
              style={{ left: `${(currentIndex / (telemetry.length - 1)) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={telemetry.length - 1}
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
            />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCurrentIndex(0)}
                className="p-1.5 text-slate-400 hover:text-slate-200 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-full font-bold transition shadow-lg shadow-cyan-500/20"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <div className="flex items-center space-x-1 text-xs font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                {[1, 2, 5, 10].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-1.5 py-0.5 rounded ${playbackSpeed === spd ? 'bg-cyan-900 text-cyan-300 font-bold' : 'text-slate-400'}`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono text-slate-400">
                {currentPt.timeString} / {telemetry[telemetry.length - 1]?.timeString}
              </span>
            </div>

            <div className="text-xs font-mono text-slate-500">
              Point {currentIndex + 1} of {telemetry.length}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default DroneFlightDashboard;
