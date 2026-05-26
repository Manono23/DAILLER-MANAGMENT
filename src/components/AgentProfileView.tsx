import React, { useMemo, useState, useEffect } from 'react';
import { 
  X, Sparkles, TrendingUp, TrendingDown, Target, Info, Calendar, PhoneCall, Activity, 
  BookOpen, Send, MessageSquare, HelpCircle, Lightbulb, CheckCircle2, ChevronRight, Calculator, RefreshCw, Clock
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { AgentPerformanceRecord } from '../types';

interface AgentProfileViewProps {
  agentName: string;
  records: AgentPerformanceRecord[];
  onClose: () => void;
  currentUser?: { username: string; role: string; team?: string };
}

interface CoachingNote {
  id: string;
  date: string;
  author: string;
  text: string;
}

export default function AgentProfileView({ agentName, records, onClose, currentUser }: AgentProfileViewProps) {
  // Extract all logs for this specific agent
  const agentLogs = useMemo(() => {
    return records
      .filter(r => r.agentName === agentName)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records, agentName]);

  const existLog = agentLogs[0];

  // Notes state
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Simulation Sandbox Sandbox Input States
  const [simProductivity, setSimProductivity] = useState<number>(80);
  const [simSales, setSimSales] = useState<number>(10);
  const [simTarget, setSimTarget] = useState<number>(12);

  // Fetch coaching logs
  const fetchCoachingNotes = () => {
    setNotesLoading(true);
    fetch(`/api/agent-notes/${encodeURIComponent(agentName)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotes(data.notes);
        }
      })
      .catch(err => console.error('Error fetching notes', err))
      .finally(() => setNotesLoading(false));
  };

  useEffect(() => {
    if (agentName) {
      fetchCoachingNotes();
      
      // Seed simulator inputs with actual averages
      if (agentLogs.length > 0) {
        let sumProd = 0;
        let sumSales = 0;
        let sumTarget = 0;
        
        agentLogs.forEach(l => {
          sumProd += l.productivity;
          sumSales += l.sales;
          sumTarget += l.target;
        });

        const num = agentLogs.length;
        setSimProductivity(Math.round(sumProd / num));
        setSimSales(Math.round(sumSales / num));
        setSimTarget(Math.max(1, Math.round(sumTarget / num)));
      }
    }
  }, [agentName, records]);

  // Handle note submission
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setSubmittingNote(true);
    try {
      const authorName = currentUser?.username || 'Administrator';
      const authorRole = currentUser?.role || 'Administrator';
      
      const response = await fetch(`/api/agent-notes/${encodeURIComponent(agentName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: `${authorName} (${authorRole})`,
          text: newNoteText.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        setNotes(data.notes);
        setNewNoteText('');
      } else {
        alert(data.error || 'Failed to submit coaching log.');
      }
    } catch (err) {
      console.error('Coaching log submission failed:', err);
    } finally {
      setNewNoteText('');
      setSubmittingNote(false);
    }
  };

  // Aggregates for individual calculations
  const stats = useMemo(() => {
    if (agentLogs.length === 0) return { 
      avgScore: 0, totalSales: 0, avgProd: 0, totalCalls: 0, meetCount: 0,
      avgDispoSale: 0, avgDispoNoAnswer: 0, avgDispoBusy: 0, avgDispoNotInterested: 0, avgDispoCallback: 0,
      avgTalkTime: 0, avgWrapTime: 0, avgHoldTime: 0, avgIdleTime: 0, avgAuxTime: 0, avgLoginTime: 0
    };
    
    let sumScore = 0;
    let sumSales = 0;
    let sumBSales = 0;
    let sumProd = 0;
    let sumCalls = 0;
    let targetMeet = 0;

    let sumDispoSale = 0;
    let sumDispoNoAnswer = 0;
    let sumDispoBusy = 0;
    let sumDispoNotInterested = 0;
    let sumDispoCallback = 0;

    let sumTalkTime = 0;
    let sumWrapTime = 0;
    let sumHoldTime = 0;
    let sumIdleTime = 0;
    let sumAuxTime = 0;
    let sumLoginTime = 0;

    agentLogs.forEach(r => {
      sumScore += r.performanceScore;
      sumSales += r.sales;
      sumBSales += r.bSales !== undefined ? r.bSales : 0;
      sumProd += r.productivity;
      sumCalls += r.callsCount;

      if (r.sales >= r.target) targetMeet++;

      // Dispositions
      sumDispoSale += r.dispoSale !== undefined ? r.dispoSale : r.sales;
      sumDispoNoAnswer += r.dispoNoAnswer !== undefined ? r.dispoNoAnswer : 0;
      sumDispoBusy += r.dispoBusy !== undefined ? r.dispoBusy : 0;
      sumDispoNotInterested += r.dispoNotInterested !== undefined ? r.dispoNotInterested : 0;
      sumDispoCallback += r.dispoCallback !== undefined ? r.dispoCallback : 0;

      // Times (with defaults if missing)
      sumTalkTime += r.talkTime !== undefined ? r.talkTime : 0;
      sumWrapTime += r.wrapTime !== undefined ? r.wrapTime : 0;
      sumHoldTime += r.holdTime !== undefined ? r.holdTime : 0;
      sumIdleTime += r.idleTime !== undefined ? r.idleTime : 0;
      sumAuxTime += r.auxTime !== undefined ? r.auxTime : 0;
      sumLoginTime += r.loginTime !== undefined ? r.loginTime : 0;
    });

    return {
      avgScore: sumScore / agentLogs.length,
      totalSales: sumSales,
      totalBSales: sumBSales,
      avgProd: sumProd / agentLogs.length,
      totalCalls: sumCalls,
      meetCount: (targetMeet / agentLogs.length) * 100,

      // Average Dispositions
      avgDispoSale: sumDispoSale / agentLogs.length,
      avgDispoNoAnswer: sumDispoNoAnswer / agentLogs.length,
      avgDispoBusy: sumDispoBusy / agentLogs.length,
      avgDispoNotInterested: sumDispoNotInterested / agentLogs.length,
      avgDispoCallback: sumDispoCallback / agentLogs.length,

      // Average Times (per shift, in minutes)
      avgTalkTime: sumTalkTime / agentLogs.length,
      avgWrapTime: sumWrapTime / agentLogs.length,
      avgHoldTime: sumHoldTime / agentLogs.length,
      avgIdleTime: sumIdleTime / agentLogs.length,
      avgAuxTime: sumAuxTime / agentLogs.length,
      avgLoginTime: sumLoginTime / agentLogs.length
    };
  }, [agentLogs]);

  // Classify active slope direction
  const trajectoryDetails = useMemo(() => {
    if (agentLogs.length < 3) return { label: 'Insufficient Data', color: 'bg-zinc-100 text-zinc-650' };
    
    const startValue = agentLogs[0].performanceScore;
    const endValue = agentLogs[agentLogs.length - 1].performanceScore;
    const difference = endValue - startValue;

    if (difference > 8) {
      return { 
        label: 'Accelerating Trend (Improving output over time)', 
        color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-200/50', 
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
      };
    }
    if (difference < -8) {
      return { 
        label: 'Decelerating Trend (Declining output over time)', 
        color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 border-rose-200/50', 
        icon: <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
      };
    }
    return { 
      label: 'Stable Horizon (Maintaining steady balanced output)', 
      color: 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200/60', 
      icon: <Activity className="w-3.5 h-3.5 text-zinc-400" />
    };
  }, [agentLogs]);

  // Interactive Simulator Math Calculation
  const simEstimatedScore = useMemo(() => {
    // Standard Shift Score formulation used across high tier call center modules:
    // Productivity contributes 50%
    // Target attainment ratios contributes 50% (capped at 100%)
    const targetAttainment = Math.min(100, (simSales / Math.max(1, simTarget)) * 100);
    const score = (simProductivity * 0.5) + (targetAttainment * 0.5);
    return Math.round(Math.min(100, Math.max(0, score)));
  }, [simProductivity, simSales, simTarget]);

  // Generated Real Read-Through Bullet Diagnoses
  const computedDiagnostics = useMemo(() => {
    const list: { type: 'success' | 'warning' | 'critical' | 'info'; title: string; desc: string }[] = [];

    // 2. Conversion efficiency (Agent Average = (Sales + B Sales) / Calls)
    const conversionRatio = stats.totalCalls > 0 ? ((stats.totalSales + (stats.totalBSales || 0)) / stats.totalCalls) * 100 : 0;
    if (conversionRatio > 0 && conversionRatio < 8) {
      list.push({
        type: 'warning',
        title: 'Pipeline Conversion Deficit',
        desc: `With ${stats.totalCalls} total outbound calls, they have clocked only a ${conversionRatio.toFixed(1)}% conversion ratio. High dialing activity is present, but closing conversions is falling below target. Suggesting active pairing with peers to address objections.`
      });
    } else if (conversionRatio >= 11) {
      list.push({
        type: 'success',
        title: 'High-Yield Objection Handling',
        desc: `Elite conversion efficiency index at ${conversionRatio.toFixed(1)}%. High closure rates reflect great pitch timing and immediate objection rebuttals on active lines.`
      });
    } else {
      list.push({
        type: 'info',
        title: 'Stable Conversion Baseline',
        desc: `Conversion efficiency sits at a steady ${conversionRatio.toFixed(1)}%. This is consistent with standard campaign expectations but offers potential for growth via specialized training.`
      });
    }

    // 3. Goal Attainment Consistency
    if (stats.meetCount < 40) {
      list.push({
        type: 'critical',
        title: 'Inconsistent Quota Compliance',
        desc: `Meets daily sales targets on only ${stats.meetCount.toFixed(0)}% of tracked shifts. Gaps in conversion volume on active campaign queues suggest difficulty with premium sales closures.`
      });
    } else if (stats.meetCount >= 75) {
      list.push({
        type: 'success',
        title: 'Elite Target Achievement Ratio',
        desc: `Achieved or exceeded the daily sales quota benchmark during ${stats.meetCount.toFixed(0)}% of shifts. Highly reliable asset of the team.`
      });
    }

    // 4. Overburden or Conversion bottleneck
    if (stats.avgProd > 85 && stats.totalSales < (agentLogs.length * 4)) {
      list.push({
        type: 'info',
        title: 'High Call Count / Low Closure Fatigue',
        desc: `Aggressive productivity (${stats.avgProd.toFixed(1)}%) but low units secured. User is handling high call volumes with stellar effort, but experiences heavy queue fatigue or weak leads distribution.`
      });
    }

    // 5. Automated Time Stewardship Assessments
    if (stats.avgWrapTime > 65) {
      list.push({
        type: 'warning',
        title: 'Time Leak: Wrap/ACW Overhead',
        desc: `High average Wrap/ACW of ${stats.avgWrapTime.toFixed(0)} mins per shift. Elevated post-call documentation cycles reduce active dialer queue availability. Re-coaching recommended.`
      });
    }

    if (stats.avgIdleTime > 110) {
      list.push({
        type: 'critical',
        title: 'System Queue Stall Warning',
        desc: `Agent remains waiting in Ready/Idle states for an average of ${stats.avgIdleTime.toFixed(0)} mins per shift. This indicates dialer queue starvation, low contacts volume, or pacing lags.`
      });
    }

    if (stats.avgAuxTime > 75) {
      list.push({
        type: 'warning',
        title: 'Offline Break Aux Overrun',
        desc: `Offline auxiliary states (lunch, breaks, bathroom) average ${stats.avgAuxTime.toFixed(0)} mins, exceeding the 60-min standard shift allowance. Advise agent to adhere to SLA roster schedules.`
      });
    }

    if (stats.avgTalkTime > 0 && stats.avgLoginTime > 0 && (stats.avgTalkTime / stats.avgLoginTime) > 0.45) {
      list.push({
        type: 'success',
        title: 'Elite Phone Occupancy',
        desc: `Direct live phone conversational occupancy comprises ${((stats.avgTalkTime / stats.avgLoginTime) * 100).toFixed(0)}% of total logged hours. Strong dedication to customer engagement.`
      });
    }

    return list;
  }, [stats, agentLogs]);

  // Chart data formatting
  const progressionChartData = useMemo(() => {
    return agentLogs.map(l => ({
      date: new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      'Shift Rating': l.performanceScore,
      'Productivity %': l.productivity,
      'Sales Secured': l.sales,
      'Target Goal': l.target
    }));
  }, [agentLogs]);

  if (!existLog) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col gap-6" id="agent-profile-fullhistory">
      {/* Profile Header */}
      <div className="flex justify-between items-start border-b border-zinc-150 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-display font-medium text-xl text-zinc-900 dark:text-zinc-50">{agentName}</h3>
            <span className="text-[10px] uppercase font-bold py-0.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-full border border-indigo-200/50">
              {existLog.team}
            </span>
            <span className="text-[10px] font-mono py-0.5 px-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
              {agentLogs.length} Shifts Audited
            </span>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-650 transition cursor-pointer border border-zinc-205 dark:border-zinc-700"
          title="Return to general dashboards"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/60 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Overall Core Rating</span>
          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-display block mt-1">
            {stats.avgScore.toFixed(1)}%
          </span>
          <span className="text-[9px] text-zinc-400 mt-0.5 block font-mono">Combined shift average</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/60 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Target Attainment</span>
          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-display block mt-1">
            {stats.meetCount.toFixed(1)}%
          </span>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Shifts query target reached</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/60 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Outbound Productivity</span>
          <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-display block mt-1 flex items-center gap-2">
            <span className="font-mono">{stats.avgProd.toFixed(1)}%</span>
            <div className="h-1 flex-1 bg-zinc-200 dark:bg-zinc-700 rounded overflow-hidden max-w-[40px]">
              <div className="h-full bg-amber-500" style={{ width: `${stats.avgProd}%` }} />
            </div>
          </span>
          <span className="text-[9px] text-zinc-400 mt-0.5 block font-mono">Dialer utilization rate</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800/60 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Total Connections</span>
          <span className="text-xl font-bold font-display block mt-1 text-indigo-500">
            {stats.totalCalls} <span className="text-xs font-normal text-zinc-400">calls</span>
          </span>
          <span className="text-[9px] text-zinc-405 mt-0.5 block">Aggregated interaction counts</span>
        </div>
      </div>

      {/* Trajectory Key-Diagnostician */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs font-semibold ${trajectoryDetails.color}`}>
        <div className="flex items-center gap-2.5">
          {trajectoryDetails.icon}
          <span>Performance Trajectory Quotient: <strong className="font-bold">{trajectoryDetails.label}</strong></span>
        </div>
        <div className="text-[10px] font-mono opacity-80">
          Agent Average: {(stats.totalCalls > 0 ? ((stats.totalSales + (stats.totalBSales || 0)) / stats.totalCalls) * 100 : 0).toFixed(1)}%
        </div>
      </div>

      {/* Chart and Sub-Calculations columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progression Line Chart & Shift Table */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-zinc-50/50 dark:bg-zinc-800/10 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Performance Path Timeline
              </h4>
              <span className="text-[10px] text-zinc-400 font-mono">Shift rating vs. Dialer productivity</span>
            </div>
            
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressionChartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.25} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#a1a1aa', fontSize: 9, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', background: '#1c1917', border: 'none', color: '#fff' }} />
                  <Line type="monotone" name="Shift Rating %" dataKey="Shift Rating" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Productivity %" dataKey="Productivity %" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Call Dispositions and Time Management Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Call Outcome Dispositions Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <PhoneCall className="w-4 h-4 text-indigo-500" />
                  Call Dispositions Outcome Mix
                </h4>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-mono">
                  {Math.round(stats.totalCalls)} sum
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {/* Sale Dispo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-650 dark:text-zinc-350 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block shrink-0"></span>
                      Sales Conversions (Sale)
                    </span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                      {Math.round(stats.avgDispoSale * agentLogs.length)} <span className="text-[9px] font-normal text-zinc-400">({(stats.totalCalls > 0 ? (stats.avgDispoSale / (stats.totalCalls/agentLogs.length)) * 100 : 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.totalCalls > 0 ? (stats.avgDispoSale / (stats.totalCalls/agentLogs.length)) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* Callback Dispo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-650 dark:text-zinc-350 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block shrink-0"></span>
                      Follow-Up Scheduled (Callback)
                    </span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                      {Math.round(stats.avgDispoCallback * agentLogs.length)} <span className="text-[9px] font-normal text-zinc-400">({(stats.totalCalls > 0 ? (stats.avgDispoCallback / (stats.totalCalls/agentLogs.length)) * 100 : 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${stats.totalCalls > 0 ? (stats.avgDispoCallback / (stats.totalCalls/agentLogs.length)) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* Not Interested Dispo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-650 dark:text-zinc-350 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block shrink-0"></span>
                      Declined (Not Interested)
                    </span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                      {Math.round(stats.avgDispoNotInterested * agentLogs.length)} <span className="text-[9px] font-normal text-zinc-400">({(stats.totalCalls > 0 ? (stats.avgDispoNotInterested / (stats.totalCalls/agentLogs.length)) * 100 : 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${stats.totalCalls > 0 ? (stats.avgDispoNotInterested / (stats.totalCalls/agentLogs.length)) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* Busy Dispo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-650 dark:text-zinc-355 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full inline-block shrink-0"></span>
                      Line Busy (Busy)
                    </span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                      {Math.round(stats.avgDispoBusy * agentLogs.length)} <span className="text-[9px] font-normal text-zinc-400">({(stats.totalCalls > 0 ? (stats.avgDispoBusy / (stats.totalCalls/agentLogs.length)) * 100 : 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${stats.totalCalls > 0 ? (stats.avgDispoBusy / (stats.totalCalls/agentLogs.length)) * 100 : 0}%` }}></div>
                  </div>
                </div>

                {/* No Answer Dispo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-650 dark:text-zinc-355 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-sky-400 rounded-full inline-block shrink-0"></span>
                      No Answer /RNA/Voicemail
                    </span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100">
                      {Math.round(stats.avgDispoNoAnswer * agentLogs.length)} <span className="text-[9px] font-normal text-zinc-400">({(stats.totalCalls > 0 ? (stats.avgDispoNoAnswer / (stats.totalCalls/agentLogs.length)) * 105 : 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full" style={{ width: `${stats.totalCalls > 0 ? (stats.avgDispoNoAnswer / (stats.totalCalls/agentLogs.length)) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Time Management Distribution Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
                  <Clock className="w-4 h-4 text-amber-500 animate-spin-slow" />
                  Time Management Breakdown
                </h4>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-mono font-semibold">
                  Shift: {Math.round(stats.avgLoginTime)} mins avg
                </span>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] text-zinc-500 leading-relaxed">
                  Proportionate distribution of active shifts logged hours (talk, ready/idle timers, handling):
                </div>

                {stats.avgLoginTime > 0 ? (
                  <div className="h-5 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex shadow-inner border border-zinc-200 dark:border-zinc-750">
                    <div 
                      className="bg-indigo-600 h-full hover:brightness-110 transition-all cursor-pointer" 
                      style={{ width: `${Math.max(2, (stats.avgTalkTime / stats.avgLoginTime) * 100)}%` }}
                      title={`Talk Time: ${Math.round(stats.avgTalkTime)} mins`}
                    />
                    <div 
                      className="bg-rose-500 h-full hover:brightness-110 transition-all cursor-pointer" 
                      style={{ width: `${Math.max(2, (stats.avgWrapTime / stats.avgLoginTime) * 100)}%` }}
                      title={`Wrap/ACW Time: ${Math.round(stats.avgWrapTime)} mins`}
                    />
                    <div 
                      className="bg-amber-500 h-full hover:brightness-110 transition-all cursor-pointer" 
                      style={{ width: `${Math.max(2, (stats.avgHoldTime / stats.avgLoginTime) * 100)}%` }}
                      title={`Hold Time: ${Math.round(stats.avgHoldTime)} mins`}
                    />
                    <div 
                      className="bg-violet-500 h-full hover:brightness-110 transition-all cursor-pointer" 
                      style={{ width: `${Math.max(2, (stats.avgAuxTime / stats.avgLoginTime) * 100)}%` }}
                      title={`Aux/Break Hours: ${Math.round(stats.avgAuxTime)} mins`}
                    />
                    <div 
                      className="bg-zinc-300 dark:bg-zinc-650 h-full hover:brightness-110 transition-all cursor-pointer" 
                      style={{ width: `${Math.max(2, (stats.avgIdleTime / stats.avgLoginTime) * 100)}%` }}
                      title={`Queue waiting (Idle): ${Math.round(stats.avgIdleTime)} mins`}
                    />
                  </div>
                ) : (
                  <div className="text-center text-xs text-zinc-400 py-4 font-mono">No time management spreadsheet variables loaded</div>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px] font-medium pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                      <span>Talk Dialogue</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{Math.round(stats.avgTalkTime)}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                      <span>Wrap/ACW</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{Math.round(stats.avgWrapTime)}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span>Hold Call</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{Math.round(stats.avgHoldTime)}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>
                      <span>Aux/Breaks</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{Math.round(stats.avgAuxTime)}m</span>
                  </div>
                  <div className="flex items-center justify-between col-span-2 border-t border-dashed border-zinc-150 dark:border-zinc-800/80 pt-1">
                    <div className="flex items-center gap-1 text-zinc-650 dark:text-zinc-300 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-zinc-350 dark:bg-zinc-600 shrink-0"></span>
                      <span>Queue Idle Wait (Dialer Ready)</span>
                    </div>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 font-semibold">{Math.round(stats.avgIdleTime)} mins</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Core Analytics Formulations block */}
          <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-850 p-4 rounded-xl border border-zinc-150 dark:border-zinc-800/80">
            <h4 className="text-xs font-bold text-zinc-650 dark:text-zinc-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-display">
              <Calculator className="w-4 h-4 text-emerald-500" />
              Standard Billing & Operational Formulas
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              These verified financial & administrative definitions compute real-time score values on standard system reports:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase mb-1">Shift Rating Score</span>
                <code className="text-[10.5px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold block bg-zinc-50 dark:bg-zinc-950 p-1 rounded text-center">
                  (Prod * 0.5) + (Sales / Goal * 50)
                </code>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase mb-1">Agent Average</span>
                <code className="text-[10.5px] font-mono text-amber-600 dark:text-amber-400 font-semibold block bg-zinc-50 dark:bg-zinc-950 p-1 rounded text-center animate-pulse">
                  ((Sales + B Sales) / Calls) * 100
                </code>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-bold text-zinc-400 block uppercase mb-1">Productivity Quotient</span>
                <code className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold block bg-zinc-50 dark:bg-zinc-950 p-1 rounded text-center">
                  (Talk Time + Ready Secs) / Active Time
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Algorithmic Diagnostics (Realistic Read-through notes) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-emerald-500 animate-pulse" />
              Dynamic Performance Diagnoses
            </h4>
            <p className="text-[11px] text-zinc-400">
              Computed diagnostics pointing exactly to what is affecting this agent's KPIs:
            </p>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {computedDiagnostics.map((diag, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                    diag.type === 'critical' 
                      ? 'bg-rose-50/70 border-rose-100 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-300' 
                      : diag.type === 'warning' 
                      ? 'bg-amber-50/70 border-amber-100 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-300' 
                      : diag.type === 'success' 
                      ? 'bg-emerald-50/70 border-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-300' 
                      : 'bg-indigo-50/70 border-indigo-100 text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-300'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1 leading-none uppercase text-[10px]">
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {diag.title}
                  </span>
                  <p className="opacity-95 leading-relaxed text-[11px]">{diag.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Interactive KPI Projection Emulator Sandbox */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-3.5">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Calculator className="w-4 h-4 text-indigo-500" />
                KPI Rating Projection sandbox
              </h4>
              <p className="text-[10px] text-zinc-400 mt-1">
                Estimate how improving their metrics changes their overall ratings score:
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Sliders */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-zinc-500 dark:text-zinc-400">Projection Dialing Productivity:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{simProductivity}%</span>
                </div>
                <input 
                  type="range" min="20" max="100" step="5"
                  value={simProductivity} 
                  onChange={(e) => setSimProductivity(parseInt(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex gap-4">
                <div className="space-y-1 w-1/2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block">Projected Sales</label>
                  <input 
                    type="number" min="0" max="40"
                    value={simSales} 
                    onChange={(e) => setSimSales(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 w-1/2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block">Active Target</label>
                  <input 
                    type="number" min="1" max="40"
                    value={simTarget} 
                    onChange={(e) => setSimTarget(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Simulation Output Indicator */}
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between mt-1 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase block tracking-wider">Estimated Score</span>
                  <span className="text-[10px] text-zinc-405">Heuristic prediction output</span>
                </div>
                <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 font-mono">
                  {simEstimatedScore}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Administrative Comments Logbook & Absolute Timeline List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-zinc-150 dark:border-zinc-800">
        
        {/* Left: Administrative Persistent Coaching Logs */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              Administrative Coaching Journal
            </h4>
            <span className="text-[11px] text-zinc-405 leading-relaxed block">
              As an Administrator, add persistent shift logs, training progress, and coaching session targets. These logs persist on reloads.
            </span>

            {/* Note submit form */}
            <form onSubmit={handleAddNote} className="flex flex-col gap-2">
              <textarea
                placeholder="Log notes regarding this agent. Mention training, headset hardware swaps, attendance obstacles, or direct goals..."
                rows={3}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="w-full text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
              />
              <button
                type="submit"
                disabled={submittingNote || !newNoteText.trim()}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer text-left"
              >
                {submittingNote ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Recording Log...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Commit Coaching Entry
                  </>
                )}
              </button>
            </form>

            {/* Render Journal List */}
            <div className="space-y-3.5 max-h-[240px] overflow-y-auto pr-1">
              <h5 className="text-[10px] uppercase font-bold text-zinc-401 tracking-wider border-b pb-1 dark:border-zinc-800">
                Logged Journal Entries ({notes.length})
              </h5>
              
              {notesLoading ? (
                <div className="text-center py-4 text-xs text-zinc-400">Loading journal logs...</div>
              ) : notes.length === 0 ? (
                <div className="text-center py-4 text-xs text-zinc-400 italic">No notes logged for this agent. Keep first records above.</div>
              ) : (
                [...notes].reverse().map((note) => (
                  <div key={note.id} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-150 dark:border-zinc-800 text-xs flex flex-col gap-1.5 shadow-sm">
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                      <span className="font-bold text-zinc-700 dark:text-zinc-350">{note.author}</span>
                      <span>{note.date}</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans text-[11.5px] whitespace-pre-wrap">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Absolute Timeline Shifting Observations (Audit Log) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 px-1 bg-white dark:bg-zinc-900">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Shift Logs History Table
          </h4>
          <div className="overflow-x-auto border border-zinc-150 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 px-3 text-right">Sales / Quota</th>
                  <th className="py-2.5 px-3 text-right">B Sales</th>
                  <th className="py-2.5 px-3 text-right">Productivity</th>
                  <th className="py-2.5 px-3 text-right">Dialer Calls</th>
                  <th className="py-2.5 px-3 text-center">Dispositions Mix (S - CB - NI - B - NA)</th>
                  <th className="py-2.5 px-3 text-right">Agent Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-155 dark:divide-zinc-800 font-medium text-zinc-700 dark:text-zinc-300">
                {[...agentLogs].reverse().map((log) => {
                  const isGoalMet = log.sales >= log.target;
                  const bSalesVal = log.bSales !== undefined ? log.bSales : 0;
                  const callsVal = log.callsCount !== undefined ? log.callsCount : 0;
                  const devAgAvg = callsVal > 0 ? (((log.sales + bSalesVal) / callsVal) * 100).toFixed(1) + '%' : '0.0%';
                  
                  const saleDisp = log.dispoSale !== undefined ? log.dispoSale : log.sales;
                  const cbDisp = log.dispoCallback || 0;
                  const niDisp = log.dispoNotInterested || 0;
                  const busyDisp = log.dispoBusy || 0;
                  const naDisp = log.dispoNoAnswer || 0;

                  return (
                    <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                        <div className="flex flex-col gap-0.5">
                          <span>{new Date(log.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {log.loginTime !== undefined && log.loginTime > 0 && (
                              <span 
                                className="inline-flex items-center text-[8px] tracking-wide font-bold uppercase px-1 py-0.5 bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 rounded cursor-help border border-amber-200/30" 
                                title={`Time Management: Logged ${log.loginTime}m | Talk ${log.talkTime}m | Idle ${log.idleTime}m`}
                              >
                                {log.loginTime}m Shift
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {log.performanceScore}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-mono ${isGoalMet ? 'text-emerald-600 font-bold' : ''}`}>{log.sales}</span>
                        <span className="text-[10px] text-zinc-400 font-sans font-normal"> / {log.target}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                        {bSalesVal}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {log.productivity}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {callsVal}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col items-center gap-1 w-40 mx-auto">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono leading-none">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold" title="Sale">{saleDisp}</span>
                            <span className="text-zinc-350 dark:text-zinc-600">·</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold" title="Callback">{cbDisp}</span>
                            <span className="text-zinc-350 dark:text-zinc-600">·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold" title="Not Interested">{niDisp}</span>
                            <span className="text-zinc-350 dark:text-zinc-600">·</span>
                            <span className="text-zinc-500 font-bold" title="Busy">{busyDisp}</span>
                            <span className="text-zinc-350 dark:text-zinc-600">·</span>
                            <span className="text-sky-500 dark:text-sky-400 font-bold" title="No Answer">{naDisp}</span>
                          </div>
                          {callsVal > 0 ? (
                            <div className="h-1 w-full rounded-sm overflow-hidden flex bg-zinc-100 dark:bg-zinc-800">
                              <div className="bg-emerald-500 h-full hover:brightness-110 transition-all text-center" style={{ width: `${(saleDisp / callsVal) * 100}%` }} title={`S: ${saleDisp}`} />
                              <div className="bg-indigo-500 h-full hover:brightness-110 transition-all text-center" style={{ width: `${(cbDisp / callsVal) * 100}%` }} title={`CB: ${cbDisp}`} />
                              <div className="bg-amber-500 h-full hover:brightness-110 transition-all text-center" style={{ width: `${(niDisp / callsVal) * 100}%` }} title={`NI: ${niDisp}`} />
                              <div className="bg-zinc-400 h-full hover:brightness-110 transition-all text-center" style={{ width: `${(busyDisp / callsVal) * 100}%` }} title={`B: ${busyDisp}`} />
                              <div className="bg-sky-450 bg-sky-400 h-full hover:brightness-110 transition-all text-center" style={{ width: `${(naDisp / callsVal) * 100}%` }} title={`NA: ${naDisp}`} />
                            </div>
                          ) : (
                            <div className="h-1 w-full rounded-sm bg-zinc-150 dark:bg-zinc-800" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-500">
                        {devAgAvg}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
