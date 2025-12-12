import React, { useState, useEffect, useCallback } from 'react';
import { LogEntry, MonitoringTier, RiskLevel, SystemStatus } from './types';
import Monitor from './components/Monitor';
import StatusBadge from './components/StatusBadge';
import ActivityChart from './components/ActivityChart';
import { Camera, ShieldCheck, Activity, AlertTriangle, Play, Square, Baby, Lock, KeyRound, ChevronRight, AlertCircle, Info, Key, Check } from 'lucide-react';

const App: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentRisk, setCurrentRisk] = useState<RiskLevel>(RiskLevel.SAFE);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    tier: MonitoringTier.OFF,
    fps: 0,
    activityScore: 0,
    lastAnalysis: null
  });
  
  // Security & Auth State
  const [apiKey, setApiKey] = useState<string>('');
  const [tempKey, setTempKey] = useState('');

  // Chart data state
  const [chartData, setChartData] = useState<{ time: string; value: number }[]>([]);

  useEffect(() => {
    // Load API Key with validation
    const storedKey = localStorage.getItem('gemini_api_key');
    // Validate stored key: must be reasonable length and contain only safe characters
    if (storedKey && storedKey.length >= 10 && storedKey.length <= 100 && /^[A-Za-z0-9_-]+$/.test(storedKey)) {
      setApiKey(storedKey);
    } else if (storedKey) {
      // Clear invalid stored key
      localStorage.removeItem('gemini_api_key');
    }
  }, []);

  // MEMOIZED HANDLERS
  const handleLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [entry, ...prev].slice(0, 50)); 
  }, []);

  const handleStatusChange = useCallback((status: SystemStatus) => {
    setSystemStatus(status);
    setChartData(prev => {
      const newData = [...prev, { time: new Date().toLocaleTimeString(), value: status.activityScore }];
      return newData.slice(-30); 
    });
  }, []);

  const handleSaveKey = () => {
    const sanitizedKey = tempKey.trim();
    
    // Basic validation: Gemini API keys start with "AIza" and are typically 39 chars
    // This is a security measure to prevent storing invalid/malicious data
    if (sanitizedKey.length >= 10 && sanitizedKey.length <= 100) {
       localStorage.setItem('gemini_api_key', sanitizedKey);
       setApiKey(sanitizedKey);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsMonitoring(false);
    setTempKey('');
  };

  // 1. API Key Gate
  if (!apiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
         <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                  <KeyRound className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 brand-font">Configuration</h1>
              <p className="text-slate-500 text-sm text-center mt-2">
                Sentinella requires a Google Gemini API Key to perform vision analysis.
              </p>
           </div>
           
           <div className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Gemini API Key</label>
                  <input 
                    type="password" 
                    placeholder="AIza..." 
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    maxLength={100}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:bg-blue-50 outline-none transition-all font-mono text-sm"
                  />
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer noopener" className="text-xs text-blue-500 hover:text-blue-600 font-medium mt-2 flex items-center gap-1 ml-1">
                     Get a key from AI Studio <ChevronRight className="w-3 h-3" />
                  </a>
              </div>
              
              <button 
                onClick={handleSaveKey}
                disabled={tempKey.length < 10}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                 <Check className="w-4 h-4" /> Save Configuration
              </button>
              
              <div className="bg-slate-50 p-3 rounded-lg text-[10px] text-slate-400 leading-relaxed border border-slate-100">
                 <p className="flex gap-2">
                    <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    Your API key is stored locally in your browser and never sent to our servers.
                 </p>
              </div>
           </div>
         </div>
      </div>
    );
  }

  // --- MAIN APP ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 md:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl text-violet-600">
            <Baby className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 brand-font">Sentinella</h1>
            <p className="hidden md:block text-xs text-slate-500 font-medium tracking-wide">AI SAFETY MONITOR</p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {/* Key Management Button */}
          <button 
             onClick={handleClearKey}
             title="Reset API Key"
             className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
             <Key className="w-4 h-4" />
          </button>

          <div className={`flex flex-col items-end transition-colors duration-500 ${
             currentRisk === RiskLevel.SAFE ? 'text-emerald-600' :
             currentRisk === RiskLevel.CAUTION ? 'text-amber-500' : 'text-rose-600'
          }`}>
             <span className="hidden md:block text-[10px] font-bold uppercase opacity-60 tracking-wider">Status</span>
             <span className="text-sm md:text-lg font-bold flex items-center gap-1.5 bg-white md:bg-transparent px-2 md:px-0 py-1 md:py-0 rounded-full shadow-sm md:shadow-none border border-slate-100 md:border-none">
               {currentRisk === RiskLevel.DANGER && <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 animate-bounce" />}
               {currentRisk}
             </span>
          </div>
          
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-full font-semibold text-sm transition-all shadow-md active:scale-95 ${
              isMonitoring 
                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                : 'bg-violet-600 text-white hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-200'
            }`}
          >
            {isMonitoring ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="hidden md:inline">{isMonitoring ? 'Stop' : 'Start Monitoring'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        
        {/* Left Column: Video & Stats (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Monitor 
            isActive={isMonitoring}
            onStatusChange={handleStatusChange}
            onLog={handleLog}
            onRiskChange={setCurrentRisk}
            apiKey={apiKey}
          />
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Mode</span>
              </div>
              <StatusBadge type="tier" value={systemStatus.tier} />
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Activity</span>
              </div>
              <div className="text-xl font-bold text-slate-700">
                {systemStatus.activityScore.toFixed(0)}<span className="text-slate-400 text-sm font-normal">%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${systemStatus.activityScore > 15 ? 'bg-violet-500' : 'bg-slate-300'}`} 
                  style={{ width: `${Math.min(systemStatus.activityScore, 100)}%` }}
                />
              </div>
            </div>

            <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-row md:flex-col justify-between items-center md:items-start">
               <div className="flex items-center gap-2 mb-0 md:mb-2 text-slate-400">
                <Camera className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Scan</span>
              </div>
              <div className="text-right md:text-left">
                <div className="text-sm font-medium text-slate-700">
                  {systemStatus.lastAnalysis ? systemStatus.lastAnalysis.toLocaleTimeString() : 'Waiting...'}
                </div>
                <p className="text-[10px] text-slate-400">
                   Freq: {systemStatus.tier === MonitoringTier.WATCHDOG ? '1s' : '4s'}
                </p>
              </div>
            </div>
          </div>

          <ActivityChart data={chartData} />
        </div>

        {/* Right Column: Logs & Events (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px] lg:h-[600px] overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Event Log</h2>
            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{logs.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm italic">
                <ShieldCheck className="w-8 h-8 mb-2 opacity-20" />
                System ready. No events yet.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="text-sm border-l-2 border-slate-200 pl-3 py-1 relative animate-in fade-in slide-in-from-right-4">
                   <div className={`absolute -left-[5px] top-2 w-2 h-2 rounded-full ring-2 ring-white ${
                     log.riskLevel === RiskLevel.DANGER ? 'bg-rose-500' :
                     log.riskLevel === RiskLevel.CAUTION ? 'bg-amber-500' : 'bg-emerald-400'
                   }`} />
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-[10px] text-slate-400">{log.timestamp.toLocaleTimeString()}</span>
                    <span className={`text-[10px] px-1.5 rounded uppercase font-bold ${
                      log.tier === MonitoringTier.EXPERT ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>{log.tier}</span>
                  </div>
                  <p className="text-slate-600 leading-snug">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* Legal Disclaimer Footer */}
      <footer className="p-6 text-center text-slate-400 text-[10px] border-t border-slate-200 bg-white/50">
        <div className="max-w-3xl mx-auto flex items-start justify-center gap-2">
           <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
           <p>
             <strong>Disclaimer:</strong> This application is a technical demonstration of AI capabilities and is 
             <strong> NOT</strong> a certified medical device. It should never replace direct parental supervision. 
             The AI analysis (Gemini 2.5/3.0) may produce inaccurate results. Always rely on your own judgment.
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;