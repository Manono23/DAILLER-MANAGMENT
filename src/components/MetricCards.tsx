import React from 'react';
import { Award, DollarSign, Activity, Users, Percent, Target } from 'lucide-react';
import { AgentPerformanceRecord, MetricSummary } from '../types';

interface MetricCardsProps {
  summary: MetricSummary;
  allRecords: AgentPerformanceRecord[];
}

export default function MetricCards({ summary, allRecords }: MetricCardsProps) {
  // Let's also compute a subset of indicators to show +/- compared to previous dates if applicable (e.g. static baseline comparison)
  const scoreBadgeColor = summary.averageScore >= 85 
    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30' 
    : summary.averageScore >= 70 
    ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 darl:border-amber-900/30'
    : 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="metric-kpi-scorecards">
      {/* 1. Combined Performance Score */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider block">Avg Evaluation Score</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 font-display mt-1 block">
              {summary.averageScore.toFixed(1)}%
            </span>
          </div>
          <div className="p-2 w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <Award className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase py-0.5 px-2 rounded-full border ${scoreBadgeColor}`}>
            {summary.averageScore >= 85 ? 'Optimized' : summary.averageScore >= 75 ? 'Satisfactory' : 'Coaching Required'}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Industry standard: 75%</span>
        </div>
      </div>

      {/* 2. Total Conversions/Sales */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider block">Aggregate Volume</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 font-display">
                {summary.totalSales.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-550 dark:text-zinc-400 font-semibold font-sans">Sales</span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                + {summary.totalBSales.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400 font-normal">B Sales</span>
            </div>
          </div>
          <div className="p-2 w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-880/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-450 font-medium">Agent Average:</span>
            <span className="text-sm font-extrabold text-amber-500 font-mono">
              {summary.totalCalls > 0 ? (((summary.totalSales + summary.totalBSales) / summary.totalCalls) * 100).toFixed(1) : '0.0'}%
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[9px] text-zinc-400 font-medium">
            <span>Formula:</span>
            <span className="font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-950/40 px-1 py-0.5 rounded">((Sales + B Sales) / Calls) * 100</span>
          </div>
        </div>
      </div>

      {/* 3. Average Productivity Level */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider block">Avg Productivity Rate</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 font-display mt-1 block">
              {summary.averageProductivity.toFixed(1)}%
            </span>
          </div>
          <div className="p-2 w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1 w-full">
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-amber-500 h-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, summary.averageProductivity))}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right">Activity benchmark: 80%</span>
        </div>
      </div>

      {/* 4. Active Agents Coordinated */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider block">Coordinated Agents</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 font-display mt-1 block font-sans">
              {summary.activeAgentsCount} <span className="text-xs font-normal text-zinc-400">active</span>
            </span>
          </div>
          <div className="p-2 w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <Users className="w-5 h-5 text-indigo-505" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
            100% Floor Engagement
          </span>
        </div>
      </div>
    </div>
  );
}
