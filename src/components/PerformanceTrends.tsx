import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Award, Activity, Target } from 'lucide-react';
import { AgentPerformanceRecord } from '../types';

interface PerformanceTrendsProps {
  records: AgentPerformanceRecord[];
}

export default function PerformanceTrends({ records }: PerformanceTrendsProps) {
  const [activeChart, setActiveChart] = useState<'trend' | 'target' | 'volume'>('trend');

  // 1. Line Chart Data: Daily chronological averages
  const chronologicalData = useMemo(() => {
    if (records.length === 0) return [];
    
    // Group records by Date
    const groups = new Map<string, { totalScore: number; totalProd: number; count: number }>();
    records.forEach(r => {
      const val = groups.get(r.date) || { totalScore: 0, totalProd: 0, count: 0 };
      val.totalScore += r.performanceScore;
      val.totalProd += r.productivity;
      val.count++;
      groups.set(r.date, val);
    });

    return Array.from(groups.entries())
      .map(([date, val]) => ({
        dateString: date,
        formattedDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Avg Performance': Math.round(val.totalScore / val.count),
        'Avg Productivity': Math.round(val.totalProd / val.count)
      }))
      .sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());
  }, [records]);

  // 2. Bar Chart Data: Targets vs Actuals for each Agent
  const agentComparisonData = useMemo(() => {
    if (records.length === 0) return [];

    const agentGroup = new Map<string, { actualSales: number; targetSales: number }>();
    records.forEach(r => {
      const val = agentGroup.get(r.agentName) || { actualSales: 0, targetSales: 0 };
      val.actualSales += r.sales;
      val.targetSales += r.target;
      agentGroup.set(r.agentName, val);
    });

    return Array.from(agentGroup.entries())
      .map(([agentName, val]) => ({
        name: agentName,
        'Actual Closures': val.actualSales,
        'Target Quota': val.targetSales
      }))
      .sort((a, b) => b['Actual Closures'] - a['Actual Closures']);
  }, [records]);

  // 3. Productivity Breakdown: Pie Chart categories (High, Medium, Under-benchmark)
  const productivityBreakdownData = useMemo(() => {
    if (records.length === 0) return [];

    let superior = 0; // >= 85
    let normal = 0;   // 70 - 85
    let coaching = 0; // < 70

    records.forEach(r => {
      if (r.productivity >= 85) superior++;
      else if (r.productivity >= 70) normal++;
      else coaching++;
    });

    const total = records.length;

    return [
      { name: 'Superior (85%+)', value: superior, percentage: total > 0 ? (superior / total) * 100 : 0 },
      { name: 'Optimal (70-85%)', value: normal, percentage: total > 0 ? (normal / total) * 100 : 0 },
      { name: 'Under Benchmark (<70%)', value: coaching, percentage: total > 0 ? (coaching / total) * 100 : 0 }
    ].filter(item => item.value > 0);
  }, [records]);

  // Styling helpers
  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b'];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5" id="performance-trends-card">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="font-display font-medium text-lg text-zinc-900 dark:text-zinc-150 flex items-center gap-2">
            Dynamic Analytical Visualizations
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Evaluate moving averages, sales targets, and productivity distributions.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveChart('trend')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeChart === 'trend' 
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350'
            }`}
          >
            Daily Trends
          </button>
          <button
            onClick={() => setActiveChart('target')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeChart === 'target' 
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350'
            }`}
          >
            Target Quotas
          </button>
          <button
            onClick={() => setActiveChart('volume')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeChart === 'volume' 
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350'
            }`}
          >
            Productivity Distribution
          </button>
        </div>
      </div>

      <div className="h-80 w-full flex items-center justify-center">
        {records.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">No telemetry recorded for these visualization criteria.</p>
        ) : activeChart === 'trend' ? (
          /* Render Chronological Line Graph */
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chronologicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="prodColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="formattedDate" 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis 
                domain={[0, 100]} 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255,255,255,0.95)', 
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  fontSize: '12px'
                }}
              />
              <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingBottom: '16px' }} />
              <Area type="monotone" dataKey="Avg Performance" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreColor)" />
              <Area type="monotone" dataKey="Avg Productivity" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#prodColor)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : activeChart === 'target' ? (
          /* Render Target Comparison Bar Graph */
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
              <XAxis 
                dataKey="name" 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#71717a', fontSize: 9 }}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255,255,255,0.95)', 
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingBottom: '16px' }} />
              <Bar dataKey="Actual Closures" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Target Quota" fill="#e4e4e7" stroke="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          /* Render Key Breakdown Pie Chart */
          <div className="flex flex-col md:flex-row items-center justify-around w-full h-full gap-5">
            <div className="w-1/2 h-full min-h-[200px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productivityBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {productivityBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} observations`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center flex flex-col justify-center items-center">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-display">{records.length}</span>
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Observations</span>
              </div>
            </div>

            {/* Custom Pie Legend */}
            <div className="flex flex-col gap-3 shrink-0">
              {productivityBreakdownData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />
                  <div>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{item.name}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">
                      {item.value} days monitored ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
