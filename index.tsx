import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Activity, 
  Shield, 
  Zap, 
  Radio, 
  Server, 
  Lock, 
  TrendingUp, 
  AlertTriangle,
  Play,
  Pause,
  // Added PauseCircle to imports
  PauseCircle,
  Settings,
  Database,
  Terminal,
  Clock,
  Wifi,
  Cpu,
  XCircle,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  Check,
  X,
  FileText,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  History,
  Layers,
  Network,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  Globe,
  PieChart,
  Target,
  DollarSign,
  Briefcase,
  ShieldAlert,
  Sliders,
  ChevronDown
} from 'lucide-react';

// --- Types ---

type SystemStatus = 'LIVE' | 'PAUSED' | 'PROTECTED' | 'DEGRADED';
type AeonState = 'SCANNING' | 'SIMULATING' | 'EXECUTING' | 'COOLING';
type RiskLevel = 'NORMAL' | 'ELEVATED' | 'LOCKED';
type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'COOLING';
type StrategyRisk = 'LOW' | 'MEDIUM' | 'HIGH';
type ExecutionPhase = 'BORROW' | 'SWAP' | 'REPAY' | 'FINALIZE';

interface AtomEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: 'INFO' | 'OPPORTUNITY' | 'EXECUTION' | 'PROFIT' | 'WARNING' | 'ERROR' | 'PROTECTION';
  data: any;
}

interface Strategy {
  id: string;
  name: string;
  status: StrategyStatus;
  winRate: number;
  avgProfit: number;
  avgGas: string;
  riskRating: StrategyRisk;
  description: string;
  guardrails: Record<string, string>;
}

interface ActiveExecution {
  id: string;
  strategy: string;
  assets: string[];
  amounts: string[];
  startTime: number;
  phase: ExecutionPhase;
  gasUsed: string;
  expectedProfit: string;
  triggerReason: string;
}

interface BotState {
  id: string;
  name: string;
  role: string;
  status: 'RUNNING' | 'IDLE' | 'ERROR';
  lastHeartbeat: number;
  uptime: string;
  load: number;
  region: string;
}

// --- Mock Data ---

const STRATEGIES: Strategy[] = [
  { id: 's1', name: 'Tri-Arb (UniV3)', status: 'ACTIVE', winRate: 94.2, avgProfit: 42.50, avgGas: '0.012', riskRating: 'LOW', description: 'Exploits triangular price gaps in concentrated liquidity pools.', guardrails: { slippage: '0.3%', gasCap: '200gwei', minLiquidity: '$500k' } },
  { id: 's2', name: 'Flash Liquidator', status: 'ACTIVE', winRate: 98.1, avgProfit: 124.8, avgGas: '0.045', riskRating: 'MEDIUM', description: 'Triggers liquidations using Aave/Maker flash loans.', guardrails: { minHealth: '1.0', maxLoan: '1.2M', collateral: 'WETH/DAI' } },
  { id: 's3', name: 'Stable Rotation', status: 'COOLING', winRate: 100.0, avgProfit: 12.2, avgGas: '0.008', riskRating: 'LOW', description: 'Rotates pegged assets across Curve/Balancer pools.', guardrails: { pegVar: '0.1%', minLiq: '$1M', cooldown: '300s' } }
];

const BOTS: BotState[] = [
  { id: 'b1', name: 'VALKYRIE-1', role: 'SOLVER', status: 'RUNNING', lastHeartbeat: Date.now(), uptime: '12d 4h', load: 24, region: 'US-EAST-1' },
  { id: 'b2', name: 'VALKYRIE-2', role: 'EXECUTOR', status: 'RUNNING', lastHeartbeat: Date.now(), uptime: '12d 4h', load: 12, region: 'EU-WEST-1' },
  { id: 'b3', name: 'SENTINEL', role: 'WATCHDOG', status: 'RUNNING', lastHeartbeat: Date.now(), uptime: '45d 1h', load: 5, region: 'AP-SOUTHEAST-1' },
  { id: 'b4', name: 'SIM-ENGINE', role: 'FORK_RUNNER', status: 'IDLE', lastHeartbeat: Date.now() - 5000, uptime: '2d 12h', load: 0, region: 'US-WEST-2' }
];

const generateId = () => Math.random().toString(36).substring(2, 9);

// --- Shared Components ---

const StatCard: React.FC<{ label: string; value: string; trend?: string; icon: any; color?: string }> = ({ label, value, trend, icon: Icon, color = 'text-atom-accent' }) => (
  <div className="tech-border bg-atom-card p-4 flex flex-col gap-2 group hover:border-atom-accent/30 transition-all">
    <div className="flex justify-between items-start">
      <div className={`p-1.5 rounded bg-atom-bg border border-atom-border ${color}`}><Icon size={16} /></div>
      {trend && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${trend.startsWith('+') ? 'text-atom-success bg-atom-success/10' : 'text-atom-error bg-atom-error/10'}`}>{trend}</span>}
    </div>
    <div>
      <h4 className="text-[10px] text-atom-muted font-mono uppercase tracking-widest">{label}</h4>
      <div className="text-2xl font-bold text-white font-mono tracking-tighter group-hover:text-atom-accent transition-colors">{value}</div>
    </div>
  </div>
);

const ExecutionReplayOverlay: React.FC<{ execution: any; onClose: () => void }> = ({ execution, onClose }) => {
    const [step, setStep] = useState(0);
    const steps = [
        { title: 'Opportunity Detected', desc: `Market imbalance found in ${execution.assets.join('/')}. Spread: 18.2bps.`, icon: Radio, color: 'text-blue-400' },
        { title: 'Simulation Completed', desc: 'Mainnet fork verification passed. Estimated net result: ' + execution.expectedProfit, icon: Database, color: 'text-atom-warning' },
        { title: 'Safety Constraints', desc: 'Risk rating checked. Slippage tolerance confirmed. Liquidity verified.', icon: Shield, color: 'text-atom-success' },
        { title: 'Bundle Broadcast', desc: 'Atomic transaction submitted via private Flashbots relay.', icon: Zap, color: 'text-atom-accent' },
        { title: 'Atomic Result', desc: 'Success. Transaction mined in block 18,234,914. Logic committed.', icon: CheckCircle, color: 'text-atom-success' }
    ];

    useEffect(() => {
        const timer = setInterval(() => setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev)), 1200);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 bg-atom-bg/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="tech-border bg-atom-card w-full max-w-lg overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-4 border-b border-atom-border bg-atom-bg/50 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2"><History size={16} className="text-atom-accent" /> Execution Audit Trace</h2>
                    <button onClick={onClose} className="text-atom-muted hover:text-white transition-colors p-1"><X size={18} /></button>
                </div>
                <div className="p-8 space-y-8">
                    {steps.map((s, idx) => (
                        <div key={idx} className={`flex gap-6 relative transition-all duration-500 ${idx > step ? 'opacity-20 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                            {idx < steps.length - 1 && <div className={`absolute left-4 top-10 bottom-[-24px] w-px ${idx < step ? 'bg-atom-success' : 'bg-atom-border'}`} />}
                            <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 z-10 ${idx === step ? 'border-atom-accent bg-atom-accent/10 shadow-[0_0_15px_rgba(0,240,255,0.2)]' : idx < step ? 'border-atom-success bg-atom-success/5' : 'border-atom-border bg-atom-bg'}`}>
                                {idx < step ? <Check size={16} className="text-atom-success" /> : <s.icon size={16} className={idx === step ? s.color : 'text-atom-muted'} />}
                            </div>
                            <div>
                                <h3 className={`text-[12px] font-bold font-mono uppercase tracking-wide ${idx === step ? s.color : 'text-atom-text'}`}>{s.title}</h3>
                                <p className="text-[11px] text-atom-muted mt-1 font-mono leading-relaxed">{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-atom-bg/50 border-t border-atom-border text-center">
                   <span className="text-[10px] text-atom-muted font-mono uppercase tracking-widest flex items-center justify-center gap-2">
                     <ShieldCheck size={12} /> Truth Layer Verified via Mainnet State
                   </span>
                </div>
            </div>
        </div>
    );
};

const EventDetailPanel: React.FC<{ event: AtomEvent; onClose: () => void }> = ({ event, onClose }) => {
  return (
    <div className="absolute top-0 right-0 bottom-0 w-96 bg-atom-card border-l border-atom-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-atom-border bg-atom-bg/95 backdrop-blur flex justify-between items-center shrink-0">
        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest flex items-center gap-2">
           <Terminal size={14} className="text-atom-accent"/> Event Inspector
        </h3>
        <button onClick={onClose} className="text-atom-muted hover:text-white transition-colors p-1"><X size={16}/></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Meta Header */}
         <div className="flex justify-between items-start">
             <div>
                 <span className="text-[9px] text-atom-muted uppercase font-mono block mb-1">Event Type</span>
                 <span className="text-sm font-bold text-white font-mono break-all">{event.type}</span>
             </div>
             <div className={`px-2 py-1 rounded border text-[9px] font-bold uppercase font-mono ${
                 event.severity === 'ERROR' ? 'border-atom-error text-atom-error bg-atom-error/10' :
                 event.severity === 'WARNING' ? 'border-atom-warning text-atom-warning bg-atom-warning/10' :
                 event.severity === 'PROFIT' ? 'border-atom-success text-atom-success bg-atom-success/10' :
                 'border-atom-accent text-atom-accent bg-atom-accent/10'
             }`}>
                 {event.severity}
             </div>
         </div>

         {/* Key Details Grid */}
         <div className="grid grid-cols-2 gap-4 p-4 bg-atom-bg border border-atom-border rounded">
             <div>
                 <label className="text-[8px] text-atom-muted uppercase font-mono block mb-1">Timestamp</label>
                 <div className="text-[10px] text-white font-mono">{new Date(event.timestamp).toLocaleTimeString()}</div>
             </div>
             <div>
                 <label className="text-[8px] text-atom-muted uppercase font-mono block mb-1">Event ID</label>
                 <div className="text-[10px] text-white font-mono truncate" title={event.id}>{event.id}</div>
             </div>
         </div>

         {/* Context Extraction */}
         <div className="space-y-3">
             <div className="text-[9px] text-atom-muted uppercase font-mono tracking-widest flex items-center gap-2">
                <Database size={12}/> Context Vectors
             </div>
             
             {event.data.strategy && (
                 <div className="flex justify-between items-center p-3 bg-atom-bg border border-atom-border hover:border-atom-muted transition-colors rounded">
                     <span className="text-[10px] text-atom-muted font-mono uppercase">Strategy</span>
                     <span className="text-[10px] text-atom-accent font-bold font-mono">{event.data.strategy}</span>
                 </div>
             )}
             
             {event.data.botId && (
                 <div className="flex justify-between items-center p-3 bg-atom-bg border border-atom-border hover:border-atom-muted transition-colors rounded">
                     <span className="text-[10px] text-atom-muted font-mono uppercase">Bot Instance</span>
                     <span className="text-[10px] text-white font-mono">{event.data.botId}</span>
                 </div>
             )}

             {event.data.txHash ? (
                 <div className="p-3 bg-atom-bg border border-atom-border hover:border-atom-muted transition-colors rounded group">
                     <span className="text-[9px] text-atom-muted font-mono uppercase block mb-1">Transaction Hash</span>
                     <a href={`https://etherscan.io/tx/${event.data.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-atom-success font-mono flex items-center gap-1 hover:underline break-all">
                         {event.data.txHash} <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                     </a>
                 </div>
             ) : (
                <div className="p-3 bg-atom-bg border border-atom-border/50 border-dashed rounded opacity-50">
                    <span className="text-[9px] text-atom-muted font-mono uppercase block">No On-Chain Hash</span>
                </div>
             )}
         </div>

         {/* Payload Viewer */}
         <div>
             <div className="flex justify-between items-end mb-2">
                <label className="text-[9px] text-atom-muted uppercase font-mono tracking-widest">JSON Payload</label>
                <button className="text-[9px] text-atom-accent font-mono hover:text-white uppercase" onClick={() => navigator.clipboard.writeText(JSON.stringify(event.data, null, 2))}>Copy</button>
             </div>
             <pre className="text-[9px] font-mono text-atom-muted bg-black border border-atom-border p-4 rounded overflow-x-auto whitespace-pre-wrap leading-relaxed">
                 {JSON.stringify(event.data, null, 2)}
             </pre>
         </div>
      </div>
    </div>
  )
}

// --- Page Components ---

const DashboardPage = () => (
  <div className="p-6 space-y-6 overflow-y-auto h-full animate-in fade-in duration-500 pb-20">
    <div className="flex justify-between items-end">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><Activity className="text-atom-accent" size={24} /> DASHBOARD</h2>
        <p className="text-atom-muted text-[10px] font-mono uppercase tracking-widest mt-1">Global System Health & Performance</p>
      </div>
      <div className="flex gap-4 text-[10px] font-mono text-atom-muted uppercase">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-atom-success" /> SYSTEM HEALTH: OPTIMAL</div>
        <div className="border-l border-atom-border pl-4">LATENCY: 12.4ms</div>
        <div className="border-l border-atom-border pl-4">UPTIME: 99.982%</div>
      </div>
    </div>

    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Total 24h Yield" value="+$4,291.50" trend="+12.4%" icon={TrendingUp} color="text-atom-success" />
      <StatCard label="Success Ratio" value="96.8%" trend="+0.5%" icon={Target} color="text-atom-accent" />
      <StatCard label="MEV Resistance" value="Low" icon={ShieldCheck} color="text-atom-warning" />
      <StatCard label="Gas Efficiency" value="1.4x" trend="+0.2x" icon={Zap} color="text-atom-muted" />
    </div>

    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8 tech-border bg-atom-card p-6 h-[400px] flex flex-col">
        <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest flex items-center gap-2"><BarChart3 size={14} className="text-atom-accent" /> Yield Trajectory (7D)</h3>
            <div className="flex gap-2">
                {['1H', '6H', '24H', '7D'].map(t => (
                    <button key={t} className={`px-2 py-1 text-[9px] font-bold font-mono rounded border ${t === '7D' ? 'border-atom-accent text-atom-accent bg-atom-accent/5' : 'border-atom-border text-atom-muted'}`}>{t}</button>
                ))}
            </div>
        </div>
        <div className="flex-1 flex items-end gap-1 px-4 border-b border-atom-border/50 pb-2">
          {[30, 45, 40, 60, 55, 75, 70, 90, 85, 110, 100, 130, 120, 150, 140, 180, 170, 210, 200, 240, 230, 260, 250, 290, 280, 310].map((h, i) => (
            <div key={i} className="flex-1 bg-atom-accent/20 border-t border-atom-accent/40 hover:bg-atom-accent/60 transition-all cursor-crosshair group relative" style={{ height: `${(h / 310) * 100}%` }}>
                 <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-atom-bg border border-atom-accent p-1 text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 z-10 pointer-events-none whitespace-nowrap">
                    BLOCK 18,234,{900+i} | +${h*5}
                 </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[9px] font-mono text-atom-muted">
            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
        </div>
      </div>
      
      <div className="col-span-4 flex flex-col gap-6">
        <div className="tech-border bg-atom-card p-6 flex-1">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-6 flex items-center gap-2"><Globe size={14} className="text-atom-accent" /> Network Nodes</h3>
            <div className="space-y-4">
            {['US-EAST-WORKER', 'EU-WEST-SOLVER', 'AP-SOUTH-SENTINEL', 'BR-SAO-EXECUTOR'].map((n, i) => (
                <div key={n} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${i === 3 ? 'bg-atom-error animate-pulse' : 'bg-atom-success'}`} />
                        <span className="text-[10px] font-mono text-atom-text">{n}</span>
                    </div>
                    <span className="text-[10px] font-mono text-atom-muted">{i === 3 ? '1.2s LATENCY' : '14ms'}</span>
                </div>
            ))}
            </div>
        </div>
        <div className="tech-border bg-atom-card p-6 h-40">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-4 flex items-center gap-2"><ShieldAlert size={14} className="text-atom-error" /> Threat Log</h3>
            <div className="text-[9px] font-mono space-y-2">
                <div className="text-atom-warning opacity-80">[14:22] DETECTED: MEV-SANDWICH ATTEMPT ON BLOCK 18,234,912</div>
                <div className="text-atom-error">[14:25] BLOCKED: MALICIOUS RPC INJECTION FROM 192.168.0.2</div>
            </div>
        </div>
      </div>
    </div>
  </div>
);

const LiveActivityPage = () => {
  const [activeExecs, setActiveExecs] = useState<ActiveExecution[]>([]);
  const [events, setEvents] = useState<AtomEvent[]>([]);
  const [replayExec, setReplayExec] = useState<ActiveExecution | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AtomEvent | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const id = generateId();
        const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
        const newExec: ActiveExecution = { id, strategy: strategy.name, assets: ['WETH', 'USDC', 'DAI'], amounts: ['1', '2500', '2501'], startTime: Date.now(), phase: 'BORROW', gasUsed: '24k', expectedProfit: '+$' + (Math.random()*50+10).toFixed(2), triggerReason: 'Imbalance detected' };
        setActiveExecs(p => [newExec, ...p].slice(0, 6));
        setEvents(p => [{ id, timestamp: Date.now(), type: 'OPPORTUNITY_DETECTED', severity: 'OPPORTUNITY', data: { strategy: strategy.name, botId: 'VALKYRIE-1' } }, ...p].slice(0, 50));
        setTimeout(() => {
             setActiveExecs(p => p.map(e => e.id === id ? {...e, phase: 'SWAP'} : e));
             setEvents(p => [{ id: generateId(), timestamp: Date.now(), type: 'SIMULATION_PASSED', severity: 'EXECUTION', data: { id, txHash: Math.random() > 0.5 ? '0x' + Math.random().toString(16).substring(2, 42) : undefined } }, ...p].slice(0, 50));
        }, 1500);
        setTimeout(() => setActiveExecs(p => p.filter(e => e.id !== id)), 4000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full animate-in fade-in duration-500 overflow-hidden relative">
      <div className="flex-1 p-6 border-r border-atom-border overflow-y-auto pb-20">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><Radio className="text-atom-accent" size={24} /> LIVE MEMPOOL STREAM</h2>
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-atom-muted uppercase">Scanning Blocks...</span>
                <div className="w-2 h-2 rounded-full bg-atom-accent animate-ping" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {activeExecs.map(exec => (
            <div key={exec.id} className="tech-border bg-atom-card p-5 group flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-atom-accent/10">
                  <div className="h-full bg-atom-accent animate-pulse" style={{ width: exec.phase === 'BORROW' ? '25%' : '75%' }} />
              </div>
              <div className="flex justify-between items-start mb-4">
                <div>
                    <span className="text-[10px] font-bold font-mono text-atom-accent uppercase tracking-widest">{exec.phase}ING...</span>
                    <h3 className="text-sm font-mono text-white mt-1">{exec.strategy}</h3>
                </div>
                <span className="text-[10px] text-atom-muted font-mono">ID: {exec.id}</span>
              </div>
              <div className="flex-1 py-4">
                  <div className="text-3xl font-bold text-white font-mono tracking-tighter">{exec.expectedProfit}</div>
                  <div className="text-[10px] text-atom-muted font-mono uppercase mt-1 tracking-widest">Net Realized Expectation</div>
              </div>
              <div className="mt-4 flex gap-3 pt-4 border-t border-atom-border">
                <button onClick={() => setReplayExec(exec)} className="flex-1 py-2 bg-atom-accent/5 border border-atom-accent/20 text-[10px] font-bold text-atom-accent hover:bg-atom-accent hover:text-black uppercase transition-all flex items-center justify-center gap-2"><History size={12}/> Replay</button>
                <button className="flex-1 py-2 bg-atom-error/5 border border-atom-error/20 text-[10px] font-bold text-atom-error hover:bg-atom-error hover:text-white uppercase transition-all flex items-center justify-center gap-2"><AlertOctagon size={12}/> Terminate</button>
              </div>
            </div>
          ))}
          {activeExecs.length === 0 && <div className="col-span-2 h-64 border border-dashed border-atom-border flex flex-col items-center justify-center gap-4 text-atom-muted font-mono uppercase">
               <div className="w-8 h-8 border border-atom-muted rounded-full animate-spin border-t-atom-accent" />
               <span className="text-[10px]">Awaiting Market Anomaly</span>
          </div>}
        </div>
      </div>
      <div className="w-96 bg-atom-card/30 flex flex-col border-l border-atom-border overflow-hidden">
        <div className="p-4 border-b border-atom-border bg-atom-bg/50 flex justify-between items-center">
            <span className="font-mono text-[11px] text-atom-muted uppercase tracking-widest">Global Telemetry Log</span>
            <Terminal size={14} className="text-atom-muted" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[10px]">
          {events.map((e, i) => (
            <div 
                key={e.id} 
                onClick={() => setSelectedEvent(e)}
                className={`p-2 border border-atom-border bg-atom-bg hover:border-atom-accent transition-colors cursor-pointer group ${i === 0 ? 'animate-in slide-in-from-top duration-300' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                  <span className="text-atom-muted">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className={`px-1 rounded text-[8px] font-bold ${e.severity === 'OPPORTUNITY' ? 'text-blue-400 bg-blue-400/10' : 'text-atom-success bg-atom-success/10'}`}>{e.severity}</span>
              </div>
              <div className="text-atom-text font-bold truncate">{e.type.replace('_', ' ')}</div>
              <div className="text-[9px] text-atom-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Payload: {JSON.stringify(e.data)}</div>
            </div>
          ))}
        </div>
      </div>
      {replayExec && <ExecutionReplayOverlay execution={replayExec} onClose={() => setReplayExec(null)} />}
      {selectedEvent && <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
};

const StrategiesPage = () => {
    const [selected, setSelected] = useState<Strategy | null>(null);

    if (selected) {
        return (
            <div className="p-6 h-full flex flex-col animate-in slide-in-from-right duration-300 pb-20">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setSelected(null)} className="p-2 hover:bg-atom-card rounded text-atom-muted hover:text-white transition-colors"><ArrowLeft size={24} /></button>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight uppercase">{selected.name}</h2>
                        <span className="text-[10px] text-atom-muted font-mono uppercase tracking-widest">Logic ID: {selected.id}</span>
                    </div>
                </div>
                <div className="grid grid-cols-12 gap-8 flex-1 overflow-y-auto">
                    <div className="col-span-8 space-y-8">
                        <div className="tech-border bg-atom-card p-6">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 border-b border-atom-border pb-4">Logic Controller</h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] text-atom-muted uppercase font-mono mb-2 block">Maximum Slippage</label>
                                        <input type="text" defaultValue={selected.guardrails.slippage} className="w-full bg-atom-bg border border-atom-border p-3 text-xs font-mono text-atom-accent outline-none focus:border-atom-accent" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-atom-muted uppercase font-mono mb-2 block">Gas Ceiling (Gwei)</label>
                                        <input type="text" defaultValue={selected.guardrails.gasCap} className="w-full bg-atom-bg border border-atom-border p-3 text-xs font-mono text-atom-accent outline-none focus:border-atom-accent" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-atom-muted uppercase font-mono mb-2 block">Minimum Asset Depth</label>
                                    <input type="text" defaultValue={selected.guardrails.minLiquidity || selected.guardrails.minLiq} className="w-full bg-atom-bg border border-atom-border p-3 text-xs font-mono text-atom-accent outline-none" />
                                </div>
                            </div>
                        </div>
                        <div className="tech-border bg-atom-card p-6">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Simulation Sandbox</h3>
                            <div className="bg-atom-bg rounded border border-atom-border p-8 text-center text-atom-muted font-mono text-xs">
                                <Cpu size={32} className="mx-auto mb-4 opacity-20" />
                                INITIALIZING FORK ENGINE... <br/>
                                <span className="opacity-50">Requires local Node connectivity</span>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-4 space-y-6">
                        <div className="tech-border bg-atom-card p-6">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Risk Profile</h3>
                            <div className={`p-4 rounded border text-center font-mono font-bold ${selected.riskRating === 'LOW' ? 'border-atom-success/30 text-atom-success bg-atom-success/5' : 'border-atom-warning/30 text-atom-warning bg-atom-warning/5'}`}>
                                {selected.riskRating} RISK
                            </div>
                            <div className="mt-4 text-[10px] text-atom-muted font-mono leading-relaxed">
                                Strategy verified via build hash 0x72...1a. Any modification triggers a 24h safety delay.
                            </div>
                        </div>
                        <button className="w-full py-4 bg-atom-accent text-black font-bold font-mono uppercase text-sm hover:bg-atom-accent/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.2)]">Deploy Changes <Zap size={18} /></button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-8 overflow-y-auto h-full animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><Server className="text-atom-accent" size={24} /> STRATEGY ENGINE</h2>
                    <p className="text-atom-muted text-[10px] font-mono uppercase tracking-widest mt-1">Manage Logic & Algorithmic Guardrails</p>
                </div>
                <button className="px-4 py-2 bg-atom-accent/10 border border-atom-accent/20 text-[11px] font-bold text-atom-accent hover:bg-atom-accent hover:text-black uppercase transition-all flex items-center gap-2"><Zap size={14} /> NEW STRATEGY</button>
            </div>
            <div className="grid grid-cols-3 gap-6">
                {STRATEGIES.map(s => (
                    <div key={s.id} className="tech-border bg-atom-card p-6 flex flex-col h-[320px] hover:border-atom-accent/40 transition-all group cursor-pointer" onClick={() => setSelected(s)}>
                    <div className="flex justify-between items-start mb-6">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${s.status === 'ACTIVE' ? 'border-atom-success text-atom-success bg-atom-success/10' : 'border-atom-warning text-atom-warning bg-atom-warning/10'}`}>{s.status}</span>
                        <Target size={16} className="text-atom-muted group-hover:text-atom-accent transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-white uppercase mb-2 tracking-tight">{s.name}</h3>
                    <p className="text-[11px] text-atom-muted font-mono leading-relaxed mb-6 flex-1 line-clamp-3">{s.description}</p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-atom-bg border border-atom-border p-2 rounded">
                            <div className="text-[9px] text-atom-muted uppercase font-mono">Win Rate</div>
                            <div className="text-lg font-bold text-white font-mono">{s.winRate}%</div>
                        </div>
                        <div className="bg-atom-bg border border-atom-border p-2 rounded">
                            <div className="text-[9px] text-atom-muted uppercase font-mono">Avg Profit</div>
                            <div className="text-lg font-bold text-atom-success font-mono">+${s.avgProfit}</div>
                        </div>
                    </div>
                    <button className="w-full py-2.5 bg-atom-bg border border-atom-border text-[10px] font-bold text-atom-muted group-hover:text-white group-hover:border-atom-accent transition-all uppercase tracking-widest">Modify Strategy</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BotsPage = () => (
  <div className="p-6 space-y-8 overflow-y-auto h-full animate-in fade-in duration-500 pb-20">
    <div className="flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><Terminal className="text-atom-accent" size={24} /> INFRASTRUCTURE CLUSTER</h2>
            <p className="text-atom-muted text-[10px] font-mono uppercase tracking-widest mt-1">Distributed Instance Management</p>
        </div>
        <div className="text-[10px] font-mono text-atom-muted uppercase">LOAD BALANCER: ROUND_ROBIN</div>
    </div>
    <div className="grid grid-cols-2 gap-6">
      {BOTS.map(bot => (
        <div key={bot.id} className="tech-border bg-atom-card p-6 flex justify-between items-start group relative overflow-hidden">
          <div className="absolute bottom-0 left-0 h-0.5 bg-atom-accent/10 w-full">
              <div className="h-full bg-atom-accent" style={{ width: `${bot.load}%` }} />
          </div>
          <div className="space-y-6 flex-1 pr-6">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${bot.status === 'RUNNING' ? 'bg-atom-success animate-pulse' : 'bg-atom-muted'}`} />
              <h3 className="text-lg font-bold text-white font-mono uppercase">{bot.name}</h3>
              <span className="text-[10px] text-atom-muted font-mono uppercase border border-atom-border px-1.5 py-0.5 rounded">{bot.role}</span>
            </div>
            <div className="grid grid-cols-3 gap-6 text-[10px] font-mono text-atom-muted uppercase">
              <div>Uptime: <span className="text-atom-text block mt-1">{bot.uptime}</span></div>
              <div>Load: <span className="text-atom-accent block mt-1">{bot.load}%</span></div>
              <div>Region: <span className="text-atom-text block mt-1">{bot.region}</span></div>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 py-2 bg-atom-bg border border-atom-border text-[10px] font-bold text-atom-text hover:bg-atom-card hover:border-atom-accent transition-all uppercase">Restart Service</button>
              <button className="flex-1 py-2 bg-atom-bg border border-atom-border text-[10px] font-bold text-atom-text hover:bg-atom-card hover:border-atom-accent transition-all uppercase">Audit History</button>
            </div>
          </div>
          <div className="h-32 w-48 bg-black/50 border border-atom-border overflow-hidden p-2 text-[8px] font-mono text-atom-muted font-normal leading-tight flex flex-col justify-end">
            <div className="opacity-40">SYSTEM: PULL_BLOCKS_ACK</div>
            <div className="opacity-50">WORKER: START_SIM_FORK</div>
            <div className="opacity-70">VALK-1: POLL_ETH_RPC_OK</div>
            <div className="text-atom-accent animate-pulse">STATUS: {bot.status}...</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ProfitPage = () => (
  <div className="p-6 space-y-8 overflow-y-auto h-full animate-in fade-in duration-500 pb-20">
    <div className="flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><TrendingUp className="text-atom-accent" size={24} /> P&L ANALYTICS</h2>
            <p className="text-atom-muted text-[10px] font-mono uppercase tracking-widest mt-1">Capital Performance & Payout Logic</p>
        </div>
        <button className="px-4 py-2 bg-atom-bg border border-atom-border text-[11px] font-bold text-atom-text hover:text-white uppercase transition-all flex items-center gap-2"><DollarSign size={14} /> EXPORT CSV</button>
    </div>
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-4 space-y-6">
        <StatCard label="Total Realized Value" value="$422,912" trend="+8.2%" icon={DollarSign} color="text-atom-success" />
        <StatCard label="Total Network Fees" value="28.4 ETH" trend="+1.2 ETH" icon={Zap} color="text-atom-error" />
        <StatCard label="Operator Treasury" value="$12,400" icon={Briefcase} color="text-atom-muted" />
      </div>
      <div className="col-span-8 tech-border bg-atom-card p-8 flex flex-col">
        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-10 flex items-center gap-2"><PieChart size={14} className="text-atom-accent" /> Revenue Distribution</h3>
        <div className="flex-1 flex gap-12 items-center justify-center">
            {[{l: 'Arbitrage', v: 65, c: 'bg-atom-accent'}, {l: 'Liquidation', v: 25, c: 'bg-atom-success'}, {l: 'MEV Relay', v: 10, c: 'bg-atom-warning'}].map(item => (
                <div key={item.l} className="flex flex-col items-center gap-4">
                    <div className={`tech-border ${item.c} rounded-full flex items-center justify-center`} style={{width: `${item.v * 2}px`, height: `${item.v * 2}px`}}>
                        <span className="text-white font-bold text-xs">{item.v}%</span>
                    </div>
                    <span className="text-[11px] font-mono text-atom-muted uppercase font-bold">{item.l}</span>
                </div>
            ))}
        </div>
        <div className="mt-12 p-4 bg-atom-bg border border-atom-border rounded text-[10px] font-mono text-atom-muted flex justify-between">
            <span>AUDITED VIA BLOCK 18,234,912</span>
            <span className="text-atom-success">MATCH_VERIFIED: TRUE</span>
        </div>
      </div>
    </div>
  </div>
);

const SafetyPage = () => (
  <div className="p-6 space-y-8 overflow-y-auto h-full animate-in fade-in duration-500 pb-20">
    <div className="flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><Shield className="text-atom-accent" size={24} /> SAFETY CONTROL</h2>
            <p className="text-atom-muted text-[10px] font-mono uppercase tracking-widest mt-1">Circuit Breakers & Emergency Overrides</p>
        </div>
    </div>
    <div className="grid grid-cols-2 gap-8">
      <div className="tech-border bg-atom-card p-8 space-y-8">
        <h3 className="text-sm font-bold text-atom-error uppercase font-mono tracking-widest flex items-center gap-3 border-b border-atom-border pb-6"><ShieldAlert size={18} /> Logic Interlocks</h3>
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-atom-bg p-5 border border-atom-border rounded hover:border-atom-accent/30 transition-all cursor-pointer">
            <div>
              <div className="text-sm font-bold text-white uppercase font-mono">Simulate-Only Mode</div>
              <div className="text-[11px] text-atom-muted font-mono mt-1">Dry run every transaction via fork before broadcast.</div>
            </div>
            <ToggleLeft size={32} className="text-atom-muted" />
          </div>
          <div className="flex justify-between items-center bg-atom-bg p-5 border border-atom-success/30 rounded hover:border-atom-success transition-all cursor-pointer">
            <div>
              <div className="text-sm font-bold text-white uppercase font-mono">Gas-Price Ceiling</div>
              <div className="text-[11px] text-atom-muted font-mono mt-1">Halt all transactions if Base Fee &gt; 250 Gwei.</div>
            </div>
            <ToggleRight size={32} className="text-atom-success" />
          </div>
          <div className="flex justify-between items-center bg-atom-bg p-5 border border-atom-success/30 rounded hover:border-atom-success transition-all cursor-pointer">
            <div>
              <div className="text-sm font-bold text-white uppercase font-mono">Self-Destruct Auth</div>
              <div className="text-[11px] text-atom-muted font-mono mt-1">Requires dual-sig for hot wallet liquidation.</div>
            </div>
            <ToggleRight size={32} className="text-atom-success" />
          </div>
        </div>
      </div>
      <div className="tech-border bg-atom-card p-8 flex flex-col">
        <h3 className="text-sm font-bold text-white uppercase font-mono tracking-widest mb-8 flex items-center gap-3 border-b border-atom-border pb-6"><Sliders size={18} /> Global Kill Switches</h3>
        <div className="flex flex-col gap-6 flex-1 justify-center">
          <button className="w-full py-6 bg-atom-error/10 border border-atom-error text-atom-error font-bold font-mono uppercase text-lg hover:bg-atom-error hover:text-white transition-all shadow-[0_0_30px_rgba(255,46,46,0.1)] flex items-center justify-center gap-4">
             <PauseCircle size={28} /> HARD KILL: ALL EXECUTORS
          </button>
          <button className="w-full py-6 bg-atom-warning/10 border border-atom-warning text-atom-warning font-bold font-mono uppercase text-lg hover:bg-atom-warning hover:text-black transition-all flex items-center justify-center gap-4">
             <ShieldAlert size={28} /> FLUSH CAPITAL TO VAULT
          </button>
        </div>
        <div className="mt-auto p-4 bg-atom-bg border border-atom-border rounded text-center text-[10px] font-mono text-atom-muted uppercase">
            WARNING: KILL SWITCH ACTIONS ARE IRREVERSIBLE WITHOUT MANUAL REBOOT
        </div>
      </div>
    </div>
  </div>
);

const SettingsPage = () => (
  <div className="p-6 space-y-8 overflow-y-auto h-full animate-in fade-in duration-500 pb-20">
    <div className="flex justify-between items-end">
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3"><Settings className="text-atom-accent" size={24} /> CONFIGURATION</h2>
            <p className="text-atom-muted text-[10px] font-mono uppercase tracking-widest mt-1">Platform Identity & Access Logic</p>
        </div>
        <button className="px-6 py-2 bg-atom-accent text-black font-bold font-mono uppercase text-xs hover:bg-atom-accent/90 transition-all">Save Profile</button>
    </div>
    <div className="grid grid-cols-12 gap-8">
        <div className="col-span-8 tech-border bg-atom-card p-8 space-y-8">
            <div>
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-6 flex items-center gap-2">Infrastructure Layer</h3>
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] text-atom-muted uppercase font-mono tracking-widest block mb-2">Primary RPC Endpoint (WSS)</label>
                        <input type="text" defaultValue="wss://eth-mainnet.alchemyapi.io/v2/********" className="w-full bg-atom-bg border border-atom-border p-4 text-xs font-mono text-atom-accent outline-none focus:border-atom-accent" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] text-atom-muted uppercase font-mono tracking-widest block mb-2">Relay Policy</label>
                            <select className="w-full bg-atom-bg border border-atom-border p-4 text-xs font-mono text-white outline-none focus:border-atom-accent appearance-none">
                                <option>FLASHBOTS (PRIVATE)</option>
                                <option>EDER-SHARE (MEV)</option>
                                <option>PUBLIC MEMPOOL</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-atom-muted uppercase font-mono tracking-widest block mb-2">Engine Priority</label>
                            <select className="w-full bg-atom-bg border border-atom-border p-4 text-xs font-mono text-white outline-none focus:border-atom-accent appearance-none">
                                <option>MAX_PROFIT</option>
                                <option>MIN_LATENCY</option>
                                <option>STABLE_ONLY</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div className="border-t border-atom-border pt-8">
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-6 flex items-center gap-2">Interface Experience</h3>
                <div className="grid grid-cols-2 gap-6">
                    <div className="flex justify-between items-center p-4 bg-atom-bg border border-atom-border rounded">
                        <span className="text-[10px] text-atom-text font-mono uppercase">CRT Overlay Filter</span>
                        <ToggleRight size={24} className="text-atom-success" />
                    </div>
                    <div className="flex justify-between items-center p-4 bg-atom-bg border border-atom-border rounded">
                        <span className="text-[10px] text-atom-text font-mono uppercase">Sound Synthesis</span>
                        <ToggleLeft size={24} className="text-atom-muted" />
                    </div>
                </div>
            </div>
        </div>
        <div className="col-span-4 space-y-6">
            <div className="tech-border bg-atom-card p-8">
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-6">Build Integrity</h3>
                <div className="space-y-4 font-mono text-[10px] text-atom-muted uppercase">
                    <div className="flex justify-between"><span>CORE VERSION:</span><span className="text-atom-text">v4.2.1-STABLE</span></div>
                    <div className="flex justify-between"><span>AEON ENGINE:</span><span className="text-atom-text">BUILD_8821</span></div>
                    <div className="flex justify-between"><span>UI HASH:</span><span className="text-atom-text">0X92F...A1</span></div>
                    <div className="flex justify-between"><span>SIGNATURE:</span><span className="text-atom-success">VERIFIED</span></div>
                </div>
            </div>
            <div className="tech-border bg-atom-card p-8">
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest mb-6">API Integration</h3>
                <button className="w-full py-3 bg-atom-bg border border-atom-border text-[10px] font-bold text-atom-muted hover:text-white transition-all uppercase flex items-center justify-center gap-2"><Layers size={14} /> View Docs</button>
            </div>
        </div>
    </div>
  </div>
);

// --- Layout Orchestrator ---

const TopStatusBar: React.FC = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="h-10 border-b border-atom-border bg-atom-card flex items-center justify-between px-6 text-[11px] font-mono select-none z-50">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-atom-success animate-pulse" />
              <span className="font-bold text-atom-success uppercase tracking-widest">SESSION LIVE</span>
            </div>
            <div className="flex items-center gap-2 text-atom-muted border-l border-atom-border pl-6">
              <Network size={14} /> <span className="text-atom-text">MAINNET</span>
            </div>
            <div className="flex items-center gap-2 text-atom-muted border-l border-atom-border pl-6">
              <Layers size={14} /> <span className="text-atom-text">BLOCK 18,234,914</span>
            </div>
          </div>
          <div className="flex items-center gap-8 uppercase tracking-widest text-atom-muted">
            <div className="flex items-center gap-2"><Clock size={14} /> {time.toLocaleTimeString()}</div>
            <div className="border-l border-atom-border pl-6 flex items-center gap-2"><Lock size={14} /> ENCRYPTED_TUNNEL</div>
          </div>
        </div>
    );
};

const Sidebar: React.FC<{ activeTab: string, setActiveTab: (t: string) => void }> = ({ activeTab, setActiveTab }) => {
  const items = [
    { id: 'dashboard', label: 'DASHBOARD', icon: Activity },
    { id: 'live', label: 'LIVE ACTIVITY', icon: Radio },
    { id: 'strategies', label: 'STRATEGIES', icon: Server },
    { id: 'bots', label: 'BOTS', icon: Terminal },
    { id: 'profit', label: 'PROFIT & FEES', icon: TrendingUp },
    { id: 'safety', label: 'SAFETY', icon: Shield },
    { id: 'settings', label: 'SETTINGS', icon: Settings },
  ];
  return (
    <div className="w-64 border-r border-atom-border bg-atom-bg flex flex-col h-full shrink-0">
      <div className="p-8 border-b border-atom-border">
        <h1 className="text-2xl font-bold tracking-tighter text-atom-text flex items-center gap-3">
          <div className="w-4 h-4 bg-atom-accent transform rotate-45" /> ATOM
        </h1>
        <p className="text-[10px] text-atom-muted mt-2 font-mono uppercase tracking-[0.3em]">FINANCIAL OS</p>
      </div>
      <div className="flex-1 py-6">
        {items.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full px-8 py-4 flex items-center gap-4 text-[12px] font-mono font-bold transition-all relative uppercase tracking-widest ${activeTab === item.id ? 'text-atom-accent bg-atom-accent/5' : 'text-atom-muted hover:text-atom-text hover:bg-atom-card'}`}>
            {activeTab === item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-atom-accent" />}
            <item.icon size={16} /> {item.label}
          </button>
        ))}
      </div>
      <div className="p-6 mt-auto border-t border-atom-border bg-atom-card/20">
          <div className="text-[9px] font-mono text-atom-muted uppercase mb-3">Operator Verified</div>
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-atom-border flex items-center justify-center text-atom-text font-bold">JD</div>
              <div>
                  <div className="text-[10px] font-bold text-white uppercase font-mono">Jordan_D</div>
                  <div className="text-[9px] text-atom-success font-mono uppercase tracking-widest">ADMIN_LEVEL_3</div>
              </div>
          </div>
      </div>
    </div>
  );
};

const AtomApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <div className="flex flex-col h-screen bg-atom-bg text-atom-text font-sans overflow-hidden">
        <TopStatusBar />
        <div className="flex flex-1 overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 overflow-hidden relative bg-atom-bg">
                {activeTab === 'dashboard' && <DashboardPage />}
                {activeTab === 'live' && <LiveActivityPage />}
                {activeTab === 'strategies' && <StrategiesPage />}
                {activeTab === 'bots' && <BotsPage />}
                {activeTab === 'profit' && <ProfitPage />}
                {activeTab === 'safety' && <SafetyPage />}
                {activeTab === 'settings' && <SettingsPage />}
            </main>
        </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<AtomApp />);
