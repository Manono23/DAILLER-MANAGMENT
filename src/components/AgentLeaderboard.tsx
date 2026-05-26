import React, { useMemo } from 'react';
import { ShieldAlert, TrendingDown, ArrowUpRight, TrendingUp, Sparkles, CheckCircle, Search, HelpCircle } from 'lucide-react';
import { AgentPerformanceRecord } from '../types';

interface AgentLeaderboardProps {
  records: AgentPerformanceRecord[];
  onSelectAgent: (name: string) => void;
  selectedAgentName: string;
}

export interface CalculatedAgentStats {
  agentName: string;
  team: string;
  avgScore: number;
  totalSales: number;
  totalBSales: number;
  agentAverage: number;
  averageProductivity: number;
  totalCalls: number;
  trendClassification: 'improving' | 'declining' | 'stable' | 'sudden_drop' | 'highly_consistent';
  variance: number;
  slope: number;
  dispoSale: number;
  dispoCallback: number;
  dispoNotInterested: number;
  dispoBusy: number;
  dispoNoAnswer: number;
}

export default function AgentLeaderboard({ records, onSelectAgent, selectedAgentName }: AgentLeaderboardProps) {
  // Let's compute individual agent stats
  const agentCalculations = useMemo(() => {
    if (records.length === 0) return [];

    // Group records by Agent Name
    const groups = new Map<string, AgentPerformanceRecord[]>();
    records.forEach(r => {
      const arr = groups.get(r.agentName) || [];
      arr.push(r);
      groups.set(r.agentName, arr);
    });

    const calculated: CalculatedAgentStats[] = [];

    groups.forEach((agentRecords, name) => {
      // Sort logs chronologically to evaluate trend slopes
      const sorted = [...agentRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const count = sorted.length;
      let sumScore = 0;
      let sumSales = 0;
      let sumBSales = 0;
      let sumProductivity = 0;
      let sumCalls = 0;
      let sumDispoSale = 0;
      let sumDispoCallback = 0;
      let sumDispoNotInterested = 0;
      let sumDispoBusy = 0;
      let sumDispoNoAnswer = 0;

      sorted.forEach(r => {
        sumScore += r.performanceScore;
        sumSales += r.sales;
        sumBSales += r.bSales !== undefined ? r.bSales : 0;
        sumProductivity += r.productivity;
        sumCalls += r.callsCount;
        sumDispoSale += r.dispoSale !== undefined ? r.dispoSale : r.sales;
        sumDispoCallback += r.dispoCallback !== undefined ? r.dispoCallback : 0;
        sumDispoNotInterested += r.dispoNotInterested !== undefined ? r.dispoNotInterested : 0;
        sumDispoBusy += r.dispoBusy !== undefined ? r.dispoBusy : 0;
        sumDispoNoAnswer += r.dispoNoAnswer !== undefined ? r.dispoNoAnswer : 0;
      });

      const avgScore = sumScore / count;
      const averageProductivity = sumProductivity / count;
      const agentAverage = sumCalls > 0 ? ((sumSales + sumBSales) / sumCalls) * 100 : 0;

      // Calculate variance in score (to detect "Highly Consistent" agents)
      let scoreVarianceSum = 0;
      sorted.forEach(r => {
        const diff = r.performanceScore - avgScore;
        scoreVarianceSum += diff * diff;
      });
      const variance = count > 1 ? Math.sqrt(scoreVarianceSum / (count - 1)) : 0;

      // Detect "Sudden Drops in Productivity":
      // Compare the last 6 records (representing approximately the last week) 
      // against the records preceding them (up to 12 records back).
      let trendClassification: CalculatedAgentStats['trendClassification'] = 'stable';
      let slope = 0;

      if (count >= 8) {
        const splitIndex = Math.max(2, Math.floor(count * 0.7)); // last 30% of timeline
        const baselineRecords = sorted.slice(0, splitIndex);
        const recentRecords = sorted.slice(splitIndex);

        const avgBaseProd = baselineRecords.reduce((sum, r) => sum + r.productivity, 0) / baselineRecords.length;
        const avgRecentProd = recentRecords.reduce((sum, r) => sum + r.productivity, 0) / recentRecords.length;

        // Is productivity drop greater than 15%?
        if (avgBaseProd > 60 && (avgBaseProd - avgRecentProd) >= 15) {
          trendClassification = 'sudden_drop';
        } else {
          // Check performance score progression as slope
          const firstThird = sorted.slice(0, Math.max(1, Math.floor(count / 3)));
          const lastThird = sorted.slice(Math.max(1, Math.floor(count * 2 / 3)));
          
          const avgFirstThirdScore = firstThird.reduce((sum, r) => sum + r.performanceScore, 0) / firstThird.length;
          const avgLastThirdScore = lastThird.reduce((sum, r) => sum + r.performanceScore, 0) / lastThird.length;

          slope = avgLastThirdScore - avgFirstThirdScore;

          if (slope > 8) {
            trendClassification = 'improving';
          } else if (slope < -8) {
            trendClassification = 'declining';
          } else if (variance < 5.5 && avgScore > 75) {
            // High stability and acceptable score
            trendClassification = 'highly_consistent';
          }
        }
      } else {
        // Less than 8 logs: simple overall slope
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        slope = last.performanceScore - first.performanceScore;
        if (slope > 10) trendClassification = 'improving';
        else if (slope < -10) trendClassification = 'declining';
      }

      calculated.push({
        agentName: name,
        team: sorted[0].team,
        avgScore,
        totalSales: sumSales,
        totalBSales: sumBSales,
        agentAverage,
        averageProductivity,
        totalCalls: sumCalls,
        trendClassification,
        variance,
        slope,
        dispoSale: sumDispoSale,
        dispoCallback: sumDispoCallback,
        dispoNotInterested: sumDispoNotInterested,
        dispoBusy: sumDispoBusy,
        dispoNoAnswer: sumDispoNoAnswer
      });
    });

    // Default sorting: Order by highest Average Performance Score
    return calculated.sort((a, b) => b.avgScore - a.avgScore);
  }, [records]);

  // Status highlights mapping
  const getBadgeDetails = (trend: CalculatedAgentStats['trendClassification'], score: number) => {
    if (trend === 'sudden_drop') {
      return {
        label: 'Sudden Drop',
        color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/30',
        icon: <ShieldAlert className="w-3 h-3" />
      };
    }
    if (trend === 'improving') {
      return {
        label: 'Improving Trend',
        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30',
        icon: <ArrowUpRight className="w-3 h-3" />
      };
    }
    if (trend === 'declining') {
      return {
        label: 'Declining',
        color: 'bg-red-50 text-red-700 dark:bg-red-950/10 dark:text-red-300 border-red-200 dark:border-red-900/30',
        icon: <TrendingDown className="w-3 h-3" />
      };
    }
    if (trend === 'highly_consistent') {
      return {
        label: 'Highly Consistent',
        color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-900/30',
        icon: <CheckCircle className="w-3 h-3" />
      };
    }
    if (score >= 88) {
      return {
        label: 'Top Performer',
        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/30',
        icon: <Sparkles className="w-3 h-3" />
      };
    }
    if (score < 68) {
      return {
        label: 'Need Coaching',
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 border-amber-200 dark:border-amber-900/30',
        icon: <TrendingDown className="w-3 h-3" />
      };
    }
    return {
      label: 'Stable Performer',
      color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
      icon: <TrendingUp className="w-3 h-3" />
    };
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col overflow-hidden" id="agent-leaderboard-container">
      <div className="p-6 border-b border-zinc-250 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-medium text-lg text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            Agent Performance Rankings
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Dynamic rolling scores evaluating daily shifts. Click any agent row to inspect historic logs.
          </p>
        </div>
        
        {/* Simple Legend */}
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex flex-wrap gap-1.5 md:justify-end text-[10px]">
            <span className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-medium">Top (&gt;88%)</span>
            <span className="px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 font-medium">Sudden Drops</span>
            <span className="px-2.5 py-1 rounded bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 font-medium">Consistent</span>
            <span className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-medium font-sans">Under (&lt;68%)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[9px] text-zinc-505 dark:text-zinc-400 font-bold uppercase tracking-wide">
            <span className="text-zinc-400 normal-case font-medium">Dispositions Legend:</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span> S: Sale</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 rounded-full inline-block"></span> CB: Callback</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block"></span> NI: Not Interested</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-zinc-400 rounded-full inline-block"></span> B: Busy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-sky-400 rounded-full inline-block"></span> NA: No Answer</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              <th className="py-3 px-4 text-center w-12">Rank</th>
              <th className="py-3 px-4">Agent Name</th>
              <th className="py-3 px-4">Team</th>
              <th className="py-3 px-4 text-right">Avg Score</th>
              <th className="py-3 px-4 text-right">Sales / B Sales</th>
              <th className="py-3 px-4 text-right">Calls</th>
              <th className="py-3 px-4 text-right font-semibold">Agent Average</th>
              <th className="py-3 px-4 text-center">Dispositions Breakdown (Total)</th>
              <th className="py-3 px-4 text-right">Productivity</th>
              <th className="py-3 px-4 text-center w-36">Trajectory Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
            {agentCalculations.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                  No representative logs match the active query. Upload spreadsheets to initialize charts.
                </td>
              </tr>
            ) : (
              agentCalculations.map((stats, idx) => {
                const badge = getBadgeDetails(stats.trendClassification, stats.avgScore);
                const isSelected = selectedAgentName === stats.agentName;

                return (
                  <tr 
                    key={stats.agentName}
                    onClick={() => onSelectAgent(stats.agentName)}
                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/10 font-medium' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold ${
                        idx === 0 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400' 
                          : idx === 1 
                          ? 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300' 
                          : idx === 2 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-display font-medium text-zinc-800 dark:text-zinc-200">
                      {stats.agentName}
                    </td>
                    <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                      {stats.team}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold font-mono text-zinc-900 dark:text-zinc-50">
                      {stats.avgScore.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-700 dark:text-zinc-300 font-mono">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{stats.totalSales}</span> <span className="text-[10px] text-zinc-400">/</span> <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats.totalBSales}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                      {stats.totalCalls}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-amber-600 dark:text-amber-400">
                      {stats.agentAverage.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 w-44 mx-auto">
                        <div className="flex items-center justify-between text-[9px] font-semibold font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400" title="Sales: dispoSale">S:{stats.dispoSale}</span>
                          <span className="text-indigo-605 dark:text-indigo-400" title="Callbacks scheduled">CB:{stats.dispoCallback}</span>
                          <span className="text-amber-600 dark:text-amber-400" title="Not Interested">NI:{stats.dispoNotInterested}</span>
                          <span className="text-zinc-500" title="Busy lines">B:{stats.dispoBusy}</span>
                          <span className="text-sky-505 dark:text-sky-400" title="No Answer / AnswerMachine">NA:{stats.dispoNoAnswer}</span>
                        </div>
                        {stats.totalCalls > 0 ? (
                          <div className="h-1.5 w-full rounded-sm bg-zinc-100 dark:bg-zinc-850 overflow-hidden flex">
                            <div 
                              className="bg-emerald-500 h-full hover:opacity-80 transition-opacity" 
                              style={{ width: `${(stats.dispoSale / stats.totalCalls) * 100}%` }}
                              title={`Sales (Close): ${stats.dispoSale}`}
                            />
                            <div 
                              className="bg-indigo-500 h-full hover:opacity-80 transition-opacity" 
                              style={{ width: `${(stats.dispoCallback / stats.totalCalls) * 100}%` }}
                              title={`Callbacks: ${stats.dispoCallback}`}
                            />
                            <div 
                              className="bg-amber-500 h-full hover:opacity-80 transition-opacity" 
                              style={{ width: `${(stats.dispoNotInterested / stats.totalCalls) * 100}%` }}
                              title={`Not Interested: ${stats.dispoNotInterested}`}
                            />
                            <div 
                              className="bg-zinc-400 h-full hover:opacity-80 transition-opacity" 
                              style={{ width: `${(stats.dispoBusy / stats.totalCalls) * 100}%` }}
                              title={`Busy: ${stats.dispoBusy}`}
                            />
                            <div 
                              className="bg-sky-450 bg-sky-400 h-full hover:opacity-80 transition-opacity" 
                              style={{ width: `${(stats.dispoNoAnswer / stats.totalCalls) * 100}%` }}
                              title={`No Answer / RNA: ${stats.dispoNoAnswer}`}
                            />
                          </div>
                        ) : (
                          <div className="h-1.5 w-full rounded-sm bg-zinc-150 dark:bg-zinc-800" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-mono">
                        <span className="font-semibold">{stats.averageProductivity.toFixed(1)}%</span>
                        <div className="w-12 bg-zinc-150 dark:bg-zinc-800 h-1 rounded overflow-hidden hidden sm:block">
                          <div 
                            className="bg-amber-500 h-full" 
                            style={{ width: `${stats.averageProductivity}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
