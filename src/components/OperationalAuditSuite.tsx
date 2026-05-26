import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle2, SlidersHorizontal, Search, MessageSquare, 
  TrendingDown, ShieldCheck, Calculator, HelpCircle, Activity, RefreshCw, ChevronRight, UserCheck
} from 'lucide-react';
import { AgentPerformanceRecord } from '../types';

interface OperationalAuditSuiteProps {
  filteredRecords: AgentPerformanceRecord[];
}

interface CombinedNote {
  id: string;
  date: string;
  author: string;
  text: string;
  agentName: string;
}

export default function OperationalAuditSuite({ filteredRecords }: OperationalAuditSuiteProps) {
  // Policy SLA triggers (Adjustable sliders)
  const [slaScoreLimit, setSlaScoreLimit] = useState<number>(75);
  const [slaSuccessRateRequired, setSlaSuccessRateRequired] = useState<number>(80);

  // Search filter for flagged agents & comments
  const [agentIssueSearch, setAgentIssueSearch] = useState('');
  const [notesSearch, setNotesSearch] = useState('');

  // Combined administrative comments state
  const [notesList, setNotesList] = useState<CombinedNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState(false);
  const [triggerRefreshStamp, setTriggerRefreshStamp] = useState(0);

  // Fetch comments logged on server across all agents
  useEffect(() => {
    setNotesLoading(true);
    setNotesError(false);
    fetch('/api/agent-notes-all')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotesList(data.notes || []);
        } else {
          setNotesError(true);
        }
      })
      .catch(err => {
        console.error('Failed to preload combined coaching comments:', err);
        setNotesError(true);
      })
      .finally(() => setNotesLoading(false));
  }, [triggerRefreshStamp, filteredRecords]);

  // Aggregate user records on the fly to detect alerts based on SLA rules
  const flaggedAgents = useMemo(() => {
    if (filteredRecords.length === 0) return [];

    // Group logs by agent name
    const grouped = new Map<string, AgentPerformanceRecord[]>();
    filteredRecords.forEach(r => {
      const arr = grouped.get(r.agentName) || [];
      arr.push(r);
      grouped.set(r.agentName, arr);
    });

    const results: {
      agentName: string;
      team: string;
      avgScore: number;
      targetMetRate: number;
      totalSales: number;
      totalCalls: number;
      issuesList: { title: string; desc: string; severity: 'critical' | 'warning' | 'info' }[];
    }[] = [];

    grouped.forEach((logs, name) => {
      const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let sumScore = 0;
      let sumSales = 0;
      let sumBSales = 0;
      let sumProd = 0;
      let sumCalls = 0;
      let targetMeetCount = 0;

      logs.forEach(l => {
        sumScore += l.performanceScore;
        sumSales += l.sales;
        sumBSales += l.bSales !== undefined ? l.bSales : 0;
        sumProd += l.productivity;
        sumCalls += l.callsCount;

        if (l.sales >= l.target) targetMeetCount++;
      });

      const count = logs.length;
      const avgScore = sumScore / count;
      const targetMetRate = (targetMeetCount / count) * 100;
      const conversionRatio = sumCalls > 0 ? ((sumSales + sumBSales) / sumCalls) * 100 : 0;

      const issues: { title: string; desc: string; severity: 'critical' | 'warning' | 'info' }[] = [];

      // Metric Issue Rule 1: Rating is below current user slider threshold
      if (avgScore < slaScoreLimit) {
        issues.push({
          title: 'SLA Score Exception Triggered',
          desc: `Combined performance rating average is ${avgScore.toFixed(1)}%, lagging below defined administrative baseline of ${slaScoreLimit}%.`,
          severity: avgScore < (slaScoreLimit - 8) ? 'critical' : 'warning'
        });
      }

      // Metric Issue Rule 3: Quota consistency rate is too low
      if (targetMetRate < slaSuccessRateRequired) {
        issues.push({
          title: 'Quota Deficit Fluctuation',
          desc: `Exceeded or matched daily campaign target quotas in only ${targetMetRate.toFixed(0)}% of shifts (Minimum threshold set to ${slaSuccessRateRequired}%).`,
          severity: targetMetRate < 45 ? 'critical' : 'warning'
        });
      }

      // Metric Issue Rule 4: Conversion Bottleneck (Productive dialing but low closures)
      const avgProductivity = sumProd / count;
      if (avgProductivity > 80 && conversionRatio > 0 && conversionRatio < 7.5) {
        issues.push({
          title: 'High Rebuttal Squeeze (Conversion Deficit)',
          desc: `High average team productivity is active at ${avgProductivity.toFixed(1)}%, but conversion efficiency is low at ${conversionRatio.toFixed(1)}% (${sumSales} units in ${sumCalls} outbound calls). Shows difficulty handling final customer rebuttals.`,
          severity: 'info'
        });
      }

      // Metric Issue Rule 5: Sharp Performance Drop across Timeline
      if (sorted.length >= 3) {
        const firstRating = sorted[0].performanceScore;
        const lastRating = sorted[sorted.length - 1].performanceScore;
        const timelineDrop = firstRating - lastRating;
        if (timelineDrop >= 12) {
          issues.push({
            title: 'Critical Timeline Slope Decline',
            desc: `Performance score dropped from initial rating of ${firstRating}% to latest shift rating of ${lastRating}% (Slide of -${timelineDrop}%). Indicates recent operational hurdles.`,
            severity: 'warning'
          });
        }
      }

      // If any issues are found, include this agent in flagged list
      if (issues.length > 0) {
        results.push({
          agentName: name,
          team: logs[0]?.team || 'Team Alpha',
          avgScore,
          targetMetRate,
          totalSales: sumSales,
          totalCalls: sumCalls,
          issuesList: issues
        });
      }
    });

    return results;
  }, [filteredRecords, slaScoreLimit, slaSuccessRateRequired]);

  // Apply search query to flagged list
  const filteredFlaggedList = useMemo(() => {
    if (!agentIssueSearch.trim()) return flaggedAgents;
    const query = agentIssueSearch.toLowerCase();
    return flaggedAgents.filter(item => 
      item.agentName.toLowerCase().includes(query) || 
      item.team.toLowerCase().includes(query) ||
      item.issuesList.some(issue => issue.title.toLowerCase().includes(query) || issue.desc.toLowerCase().includes(query))
    );
  }, [flaggedAgents, agentIssueSearch]);

  // Apply search query to comments history List
  const filteredNotesList = useMemo(() => {
    if (!notesSearch.trim()) return notesList;
    const query = notesSearch.toLowerCase();
    return notesList.filter(note => 
      note.agentName.toLowerCase().includes(query) || 
      note.text.toLowerCase().includes(query) ||
      note.author.toLowerCase().includes(query) ||
      note.date.includes(query)
    );
  }, [notesList, notesSearch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="operational-audit-suite">
      
      {/* Column 1: SLA Threshold configuration & Performance Math */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        
        {/* Policy Trigger Sliders */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <h4 className="font-display font-medium text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <SlidersHorizontal className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                SLA Exception Alerts Config
              </h4>
              <p className="text-xs text-zinc-500 mt-1">Adjust policy targets to dynamically flag underperforming outliers.</p>
            </div>
          </div>

          <div className="space-y-4">
            
            {/* Slider A: Score SLA */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-650 dark:text-zinc-300">Min Standard Rating Score:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{slaScoreLimit}%</span>
              </div>
              <input 
                type="range" min="60" max="95" step="1"
                value={slaScoreLimit} 
                onChange={(e) => setSlaScoreLimit(parseInt(e.target.value))}
                className="w-full accent-indigo-600 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-zinc-400 block">Flag agents whose combined score falls below this baseline.</span>
            </div>

            {/* Slider B: Quota Attainment Ratio */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-650 dark:text-zinc-300">Min Quota Consistency Ratio:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{slaSuccessRateRequired}%</span>
              </div>
              <input 
                type="range" min="40" max="100" step="5"
                value={slaSuccessRateRequired} 
                onChange={(e) => setSlaSuccessRateRequired(parseInt(e.target.value))}
                className="w-full accent-indigo-600 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-zinc-400 block">% of shifts in which the agent must achieve target.</span>
            </div>

          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800 text-[10.5px] text-zinc-500 font-mono flex items-center justify-between mt-2">
            <span>Resulting Flagged Count:</span>
            <strong className="text-zinc-800 dark:text-zinc-200 text-xs font-bold font-display px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded">
              {flaggedAgents.length} Agents Exceptioned
            </strong>
          </div>
        </div>

        {/* Operational Math Formulas panel */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h4 className="font-display font-medium text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-emerald-500" />
            Standard Formula reference
          </h4>
          <p className="text-[11px] text-zinc-500">
            These formulas compute the mathematical figures driving the dynamic table dashboards:
          </p>
          <div className="space-y-3.5">
            <div className="border-b dark:border-zinc-800 pb-2.5">
              <span className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 block">Shift Rating Score (%)</span>
              <p className="text-[10px] text-zinc-450 mt-0.5 block leading-relaxed">
                Reflects dialing productiveness and conversion attainment:
              </p>
              <code className="text-[10px] font-mono block bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded text-indigo-600 dark:text-indigo-400 font-semibold mt-1 rounded text-center">
                (Productivity * 0.5) + (Sales / Goal * 50)
              </code>
            </div>

            <div>
              <span className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 block">Conversion Efficiency (%)</span>
              <p className="text-[10px] text-zinc-455 mt-0.5 block leading-relaxed">
                Percentage of dialer contacts generating a campaign sale:
              </p>
              <code className="text-[10px] font-mono block bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded text-amber-500 dark:text-amber-400 font-semibold mt-1 rounded text-center">
                (Sales Secured / Connected Dialer Calls) * 100
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Column 2: Flagged Agent Warning Center (Issue List cards) */}
      <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h4 className="font-display font-medium text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
            Direct Issue Diagnostic Scanner
          </h4>
          <p className="text-xs text-zinc-500 mt-1">Rule-based warning center highlighting precise obstacles.</p>
        </div>

        {/* Search tool for issues list */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search flagged results or issues..."
            value={agentIssueSearch}
            onChange={(e) => setAgentIssueSearch(e.target.value)}
            className="w-full text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Issue Cards */}
        <div className="flex-1 overflow-y-auto max-h-[460px] pr-1 space-y-4">
          {filteredFlaggedList.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">All shifts optimal</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Adjust sliders to broaden warning capture filters.</p>
            </div>
          ) : (
            filteredFlaggedList.map((item, index) => (
              <div 
                key={index}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 relative flex flex-col gap-3 hover:border-zinc-300 transition"
                id={`audit-card-${item.agentName.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {/* Header info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-semibold text-xs text-zinc-850 dark:text-white uppercase tracking-wide">
                      {item.agentName}
                    </h5>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                      {item.team}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                    {item.avgScore.toFixed(1)}% Rating
                  </span>
                </div>

                {/* Main stats block */}
                <div className="grid grid-cols-3 gap-1.5 p-2 bg-white dark:bg-zinc-950 border rounded-lg border-zinc-200 dark:border-zinc-800 text-center font-mono text-[10px] font-semibold text-zinc-500">
                  <div>
                    <span className="block text-zinc-400 text-[8px] uppercase">Volume Sales</span>
                    <strong className="text-emerald-500">
                      {item.totalSales} units
                    </strong>
                  </div>
                  <div>
                    <span className="block text-zinc-400 text-[8px] uppercase">Goal Attain</span>
                    <strong className={item.targetMetRate < slaSuccessRateRequired ? "text-rose-500" : "text-emerald-500"}>
                      {item.targetMetRate.toFixed(0)}%
                    </strong>
                  </div>
                  <div>
                    <span className="block text-zinc-400 text-[8px] uppercase">Dial Convers.</span>
                    <strong>
                      {item.totalCalls > 0 ? ((item.totalSales / item.totalCalls) * 100).toFixed(1) : 0}%
                    </strong>
                  </div>
                </div>

                {/* Computed list of reasons */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-zinc-402 block uppercase tracking-wider">Identified Roadblocks:</span>
                  {item.issuesList.map((issue, idx) => {
                    const isCritical = issue.severity === 'critical';
                    const hoverColor = isCritical 
                      ? 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30' 
                      : issue.severity === 'warning'
                      ? 'bg-amber-50/50 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20'
                      : 'bg-indigo-50/50 border-indigo-100 dark:bg-indigo-950/10 dark:border-indigo-900/20';

                    return (
                      <div key={idx} className={`p-2 rounded-lg border flex gap-1.5 text-[10.5px] leading-relaxed text-zinc-650 dark:text-zinc-300 ${hoverColor}`}>
                        <ChevronRight className="w-3 h-3 shrink-0 text-zinc-400 mt-0.5" />
                        <div>
                          <strong className="font-bold underline uppercase text-[9px] block mb-0.5">
                            {issue.title}
                          </strong>
                          {issue.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 3: Cross-Agent Chronic Administrative Logs */}
      <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
          <div>
            <h4 className="font-display font-medium text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              Chronological Admin Comment Registry
            </h4>
            <span className="text-xs text-zinc-500 mt-1">Unified search index of persistent notes written by managers.</span>
          </div>
          <button 
            onClick={() => setTriggerRefreshStamp(prev => prev + 1)}
            className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 cursor-pointer"
            title="Refresh comment registry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search for notes */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search notes text or author..."
            value={notesSearch}
            onChange={(e) => setNotesSearch(e.target.value)}
            className="w-full text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500 text-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto max-h-[460px] pr-1 space-y-3">
          {notesLoading ? (
            <div className="text-center py-10 text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" /> Let's index recorded shift logs...
            </div>
          ) : notesError ? (
            <div className="text-center py-10 text-xs text-rose-500">
              Failed to load administrative notes registry.
            </div>
          ) : filteredNotesList.length === 0 ? (
            <div className="text-center py-16 text-zinc-404 italic">
              No matching logged comments found. Add notes on individual profile drilldowns.
            </div>
          ) : (
            filteredNotesList.map((note) => (
              <div 
                key={note.id} 
                className="p-3 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs flex flex-col gap-1.5 hover:border-indigo-200/50 transition shadow-sm"
              >
                <div className="flex justify-between items-center bg-white dark:bg-zinc-950 p-1 px-1.5 border rounded-lg">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px] uppercase flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-indigo-505" />
                    {note.agentName}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono font-semibold">{note.date}</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11.5px] whitespace-pre-wrap font-sans mt-0.5">
                  "{note.text}"
                </p>
                <div className="text-[9px] text-zinc-450 mt-1 italic text-right">
                  Logged by: <strong className="font-semibold text-zinc-500">{note.author}</strong>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
