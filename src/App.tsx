import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart4, Calendar, User, Search, Filter, Shield, Moon, Sun, 
  Download, FileDown, ArrowUpDown, ChevronDown, Laptop, 
  LogOut, ShieldAlert, Sparkles, CheckCircle, Clock, RefreshCw, BarChart,
  Menu, X
} from 'lucide-react';

import { AgentPerformanceRecord, PerformanceFilter, MetricSummary, UserSession } from './types';
import { getInitialMockData, getDemoAgentsData, TEAMS } from './mockData';
import MetricCards from './components/MetricCards';
import ExcelUploader from './components/ExcelUploader';
import AgentLeaderboard from './components/AgentLeaderboard';
import PerformanceTrends from './components/PerformanceTrends';
import OperationalAuditSuite from './components/OperationalAuditSuite';
import AgentProfileView from './components/AgentProfileView';

export default function App() {
  const [records, setRecords] = useState<AgentPerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Theme & User Settings
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserSession>({
    username: 'admin',
    role: 'Administrator',
    isAuthenticated: true
  });

  // active filters
  const [filters, setFilters] = useState<PerformanceFilter>({
    startDate: '',
    endDate: '',
    team: '',
    agentName: ''
  });

  // Selected agent for detailed drilldown
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  
  // Active timing tab: daily, weekly, or monthly comparisons
  const [evaluationPeriod, setEvaluationPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Fetch performance data from full-stack backend
  const fetchRecords = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      const response = await fetch('/api/performance');
      const data = await response.json();
      if (data.success) {
        setRecords(data.records);
      } else {
        throw new Error(data.error || 'Server rejected query');
      }
    } catch (err: any) {
      console.warn('Backend sync unavailable, using local mock state.', err);
      // Fallback safely to compiled mock data on connection timeouts
      setRecords(getInitialMockData());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Update records on upload
  const handleDataUploaded = async (newRecords: AgentPerformanceRecord[], append: boolean) => {
    try {
      const response = await fetch('/api/performance/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: newRecords, mode: append ? 'append' : 'replace' })
      });
      const data = await response.json();
      if (data.success) {
        await fetchRecords();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Failed to post data to server storage, fallback to local state mutation.', error);
      if (append) {
        setRecords(prev => [...prev, ...newRecords]);
      } else {
        setRecords(newRecords);
      }
    }
  };

  // Restore baseline
  const handleResetData = async () => {
    try {
      const res = await fetch('/api/performance/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchRecords();
      }
    } catch (error) {
      setRecords(getInitialMockData());
    }
    // Clear selection
    setSelectedAgentName('');
  };

  // Populate synthesized demo data
  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      const demoData = getDemoAgentsData();
      await handleDataUploaded(demoData, false);
    } catch (err) {
      console.error('Failed to load demo data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique filters from loaded list
  const uniqueMetadata = useMemo(() => {
    const teams = new Set<string>();
    const agents = new Set<string>();

    records.forEach(r => {
      if (r.team) teams.add(r.team);
      if (r.agentName) agents.add(r.agentName);
    });

    return {
      teams: Array.from(teams).sort(),
      agents: Array.from(agents).sort()
    };
  }, [records]);

  // Apply sequential strict filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. Team level filter (Restricted if user is Team Leader)
      if (currentUser.role === 'Team Leader' && currentUser.team && r.team !== currentUser.team) {
        return false;
      }
      if (filters.team && r.team !== filters.team) return false;

      // 2. Search query agent name
      if (filters.agentName && !r.agentName.toLowerCase().includes(filters.agentName.toLowerCase())) {
        return false;
      }

      // 4. Date ranges
      if (filters.startDate && r.date < filters.startDate) return false;
      if (filters.endDate && r.date > filters.endDate) return false;

      return true;
    });
  }, [records, filters, currentUser]);

  // Calculate high value metrics
  const activeSummaryStats = useMemo<MetricSummary>(() => {
    if (filteredRecords.length === 0) {
      return { averageScore: 0, totalSales: 0, totalBSales: 0, totalCalls: 0, averageProductivity: 0, targetAchievement: 0, activeAgentsCount: 0 };
    }

    let totalScore = 0;
    let totalSales = 0;
    let totalBSales = 0;
    let totalCalls = 0;
    let totalProd = 0;
    let achievedTargetsCounts = 0;
    const agents = new Set<string>();

    filteredRecords.forEach(r => {
      totalScore += r.performanceScore;
      totalSales += r.sales;
      totalBSales += r.bSales !== undefined ? r.bSales : 0;
      totalCalls += r.callsCount !== undefined ? r.callsCount : 0;
      totalProd += r.productivity;
      
      if (r.sales >= r.target) {
        achievedTargetsCounts++;
      }
      agents.add(r.agentName);
    });

    return {
      averageScore: totalScore / filteredRecords.length,
      totalSales,
      totalBSales,
      totalCalls,
      averageProductivity: totalProd / filteredRecords.length,
      targetAchievement: (achievedTargetsCounts / filteredRecords.length) * 100,
      activeAgentsCount: agents.size
    };
  }, [filteredRecords]);

  // Focus and highlight poorest performing teams and agents across active indices
  const underperformanceSpotlight = useMemo(() => {
    if (filteredRecords.length === 0) return null;

    const teamTotals: Record<string, { totalScore: number; count: number }> = {};
    const agentTotals: Record<string, { totalScore: number; count: number; team: string }> = {};

    filteredRecords.forEach(r => {
      if (r.team) {
        if (!teamTotals[r.team]) {
          teamTotals[r.team] = { totalScore: 0, count: 0 };
        }
        teamTotals[r.team].totalScore += r.performanceScore;
        teamTotals[r.team].count += 1;
      }

      if (r.agentName) {
        if (!agentTotals[r.agentName]) {
          agentTotals[r.agentName] = { totalScore: 0, count: 0, team: r.team || 'Unassigned' };
        }
        agentTotals[r.agentName].totalScore += r.performanceScore;
        agentTotals[r.agentName].count += 1;
      }
    });

    const teamsList = Object.keys(teamTotals).map(name => ({
      name,
      avgScore: teamTotals[name].totalScore / teamTotals[name].count
    }));
    teamsList.sort((a, b) => a.avgScore - b.avgScore);
    const poorestTeam = teamsList.length > 0 ? teamsList[0] : null;

    const agentsList = Object.keys(agentTotals).map(name => ({
      name,
      team: agentTotals[name].team,
      avgScore: agentTotals[name].totalScore / agentTotals[name].count
    }));
    agentsList.sort((a, b) => a.avgScore - b.avgScore);
    const poorestAgents = agentsList.slice(0, 3);

    return {
      poorestTeam,
      poorestAgents
    };
  }, [filteredRecords]);

  // Export filtered logs to CSV instantly
  const exportActiveToCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = ['Record ID', 'Agent Name', 'Date', 'Team', 'Sales / Conversions', 'Productivity %', 'Target Goal', 'Overall Score'];
    const rows = filteredRecords.map(r => [
      r.id,
      r.agentName,
      r.date,
      r.team,
      r.sales.toString(),
      r.productivity.toString(),
      r.target.toString(),
      r.performanceScore.toString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agent_performance_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // print preview action (perfect for PDF downloads)
  const triggerPrintPDF = () => {
    window.print();
  };

  // Grouped Comparison Views (Daily, Weekly, Monthly lists)
  const periodAgreedData = useMemo(() => {
    if (filteredRecords.length === 0) return [];

    // Daily View: Already direct records
    if (evaluationPeriod === 'daily') {
      return [...filteredRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 40); // Top 40 recent logs
    }

    // Weekly View: group dates by Year-Week index
    if (evaluationPeriod === 'weekly') {
      const weekMap = new Map<string, { label: string; count: number; totalScore: number; sales: number; bSales: number; callsCount: number }>();
      
      filteredRecords.forEach(r => {
        // Get week number helper
        const d = new Date(r.date);
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        const weekKey = `${d.getUTCFullYear()}-W${weekNo}`;

        const entry = weekMap.get(weekKey) || {
          label: `${d.getUTCFullYear()} Week ${weekNo}`,
          count: 0,
          totalScore: 0,
          sales: 0,
          bSales: 0,
          callsCount: 0
        };

        entry.count++;
        entry.totalScore += r.performanceScore;
        entry.sales += r.sales;
        entry.bSales += r.bSales !== undefined ? r.bSales : 0;
        entry.callsCount += r.callsCount !== undefined ? r.callsCount : 0;
        weekMap.set(weekKey, entry);
      });

      return Array.from(weekMap.entries()).map(([key, value]) => ({
        key,
        period: value.label,
        avgScore: value.totalScore / value.count,
        totalSales: value.sales,
        totalBSales: value.bSales,
        totalCalls: value.callsCount,
        sampleCount: value.count
      }));
    }

    // Monthly View: group by Year-Month
    const monthMap = new Map<string, { label: string; count: number; totalScore: number; sales: number; bSales: number; callsCount: number }>();
    filteredRecords.forEach(r => {
      const [year, month] = r.date.split('-');
      const monthKey = `${year}-${month}`;
      const monthsLegend = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = `${monthsLegend[parseInt(month) - 1]} ${year}`;

      const entry = monthMap.get(monthKey) || {
        label: monthLabel,
        count: 0,
        totalScore: 0,
        sales: 0,
        bSales: 0,
        callsCount: 0
      };

      entry.count++;
      entry.totalScore += r.performanceScore;
      entry.sales += r.sales;
      entry.bSales += r.bSales !== undefined ? r.bSales : 0;
      entry.callsCount += r.callsCount !== undefined ? r.callsCount : 0;
      monthMap.set(monthKey, entry);
    });

    return Array.from(monthMap.entries()).map(([key, value]) => ({
      key,
      period: value.label,
      avgScore: value.totalScore / value.count,
      totalSales: value.sales,
      totalBSales: value.bSales,
      totalCalls: value.callsCount,
      sampleCount: value.count
    }));
  }, [filteredRecords, evaluationPeriod]);

  // Handle filter resets
  const clearAllFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      team: '',
      agentName: ''
    });
  };

  return (
    <div className={`${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50/55 text-zinc-800'} min-h-screen font-sans antialiased transition-colors duration-200 flex`} id="main-root-workspace">
      
      {/* Mobile Drawer Navigation Sidebar */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs z-50 md:hidden flex justify-start animate-fade-in" onClick={() => setIsMobileNavOpen(false)}>
          <div className="w-72 bg-zinc-900 border-r border-zinc-800 h-full p-6 flex flex-col justify-between shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-8 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5 text-white">
                  <BarChart4 className="w-5 h-5 text-indigo-500" />
                  <span className="font-bold font-display text-base">Optix Navigation</span>
                </div>
                <button onClick={() => setIsMobileNavOpen(false)} className="p-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[9px] font-bold text-zinc-500 block uppercase px-3 py-1 mb-2 tracking-widest">Navigation List</span>
              <nav className="space-y-2">
                <a 
                  href="#metric-kpi-scorecards" 
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileNavOpen(false);
                    document.getElementById('metric-kpi-scorecards')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 bg-zinc-800 text-white rounded-lg text-xs font-semibold hover:text-white transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-505"></span> Dashboard Metrics
                </a>
                <a 
                  href="#filter-center-panel" 
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileNavOpen(false);
                    document.getElementById('filter-center-panel')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Demographic Filters
                </a>
                <a 
                  href="#excel-uploader-card" 
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileNavOpen(false);
                    document.getElementById('excel-uploader-card')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Excel Data Ingestion
                </a>
                <a 
                  href="#agents-leaderboard-card" 
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileNavOpen(false);
                    document.getElementById('agents-leaderboard-card')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Leaderboards Ranking
                </a>
                <a 
                  href="#operational-audit-suite" 
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileNavOpen(false);
                    document.getElementById('operational-audit-suite')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-zinc-400 hover:bg-zinc-800/50 rounded-lg text-xs transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Operational Audit Suite
                </a>
              </nav>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-505 tracking-wider block mb-1.5 px-3.5">🔎 Profile Drilldown</span>
                <div className="px-3.5">
                  <select
                    value={selectedAgentName}
                    onChange={(e) => {
                      setSelectedAgentName(e.target.value);
                      setIsMobileNavOpen(false);
                    }}
                    className="w-full text-xs font-semibold bg-zinc-800/80 border border-zinc-700/80 rounded-lg p-2.5 text-zinc-205 select-none"
                  >
                    <option value="" className="text-zinc-500 bg-zinc-900">Select Agent...</option>
                    {uniqueMetadata.agents.map(aName => (
                      <option key={aName} value={aName} className="text-zinc-300 bg-zinc-900">{aName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-zinc-850/40 border border-zinc-800/80 text-[10px] text-zinc-500 font-mono">
              Optix Central Console • Web Portal
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR - FROM THE DESIGN HTML */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex-col shrink-0 hidden md:flex print:hidden sticky top-0 h-screen overflow-y-auto" id="left-sidebar">
        <div className="p-6 flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
                <BarChart4 className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white font-display">Optix Agent</span>
            </div>
            
            <nav className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 block uppercase px-3 py-1 mb-1 tracking-widest">Navigation</span>
              <a 
                href="#metric-kpi-scorecards" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('metric-kpi-scorecards')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-3 px-3 py-2 bg-zinc-800 text-white rounded-md text-xs font-semibold leading-relaxed"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Dashboard Metrics
              </a>
              <a 
                href="#filter-center-panel" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('filter-center-panel')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-805/40 rounded-md text-xs transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Demographic Filters
              </a>
              <a 
                href="#excel-uploader-card" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('excel-uploader-card')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-805/40 rounded-md text-xs transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Excel Data Ingestion
              </a>
              <a 
                href="#agents-leaderboard-card" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('agents-leaderboard-card')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-805/40 rounded-md text-xs transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Leaderboards Ranking
              </a>
              <a 
                href="#operational-audit-suite" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('operational-audit-suite')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-805/40 rounded-md text-xs transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span> Operational Audit Suite
              </a>
            </nav>

            {/* Quick Agent Profile Access dropdown in Sidebar */}
            <div className="mt-6 pt-6 border-t border-zinc-800/80">
              <span className="text-[10px] font-bold text-zinc-500 block uppercase px-3 py-1 mb-2 tracking-widest">Profiles & Coaching</span>
              <div className="px-3">
                <select
                  value={selectedAgentName}
                  onChange={(e) => setSelectedAgentName(e.target.value)}
                  className="w-full text-xs font-semibold bg-zinc-800 border border-zinc-850 rounded-lg p-2.5 text-zinc-350 focus:outline-none focus:border-indigo-500 select-none cursor-pointer"
                >
                  <option value="" className="text-zinc-600 bg-zinc-900 font-sans">🔎 Select Agent...</option>
                  {uniqueMetadata.agents.map(aName => (
                    <option key={aName} value={aName} className="text-zinc-300 bg-zinc-900 font-sans">{aName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-850/40 border border-zinc-800/80">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-display">Data Engine</p>
            <div 
              onClick={() => {
                document.getElementById('excel-uploader-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="border-2 border-dashed border-zinc-800 hover:border-indigo-505/50 rounded-lg p-4 text-center cursor-pointer transition-colors bg-zinc-955/20"
            >
              <p className="text-[10px] text-zinc-400">Drag Excel file here</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane next to sidebar */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* 1. Header Toolbar */}
        <header className="sticky top-0 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-40 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none print:hidden">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileNavOpen(true)}
              className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/15 md:hidden hover:bg-indigo-700 transition cursor-pointer flex items-center justify-center border-none focus:outline-none"
              title="Open section directory"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display font-medium text-lg tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                Agent Performance Tracker
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30 px-2 py-0.5 rounded font-sans uppercase">
                  Active
                </span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-404 mt-0.5">Automated Excel evaluations integrated with rule-based diagnostic alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Theme switcher */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 cursor-pointer"
              title="Toggle contrast mode styling"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500 animate-spin" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User simulation role picker */}
            <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-90 px-3 py-1.5 rounded-xl text-xs w-fit">
              <Shield className="w-4 h-4 text-indigo-505 animate-pulse" />
              <div className="text-left hidden sm:block">
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{currentUser.username}</span>
                <span className="text-[10px] text-zinc-400 block">{currentUser.role}</span>
              </div>
              
              <select
                value={currentUser.role}
                onChange={(e) => setCurrentUser(prev => ({
                  ...prev,
                  role: e.target.value as any,
                  team: e.target.value === 'Team Leader' ? 'Sales Alpha' : undefined
                }))}
                className="ml-2 text-[10.5px] font-semibold text-zinc-650 dark:text-zinc-350 cursor-pointer border border-zinc-250 dark:border-zinc-800 rounded bg-white dark:bg-zinc-800 px-1 py-0.5 focus:outline-none"
              >
                <option value="Administrator">Administrator</option>
                <option value="Team Leader">Team Leader</option>
                <option value="Viewer">Viewer (Read-Only)</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Content Workspace Layout */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 relative">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-zinc-650 dark:text-zinc-350">Reading database schemas, optimizing analytics engines...</p>
          </div>
        ) : (
          <>
            {/* Quick action bar / print setup */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl print:hidden">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportActiveToCSV}
                  disabled={filteredRecords.length === 0}
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-150 dark:hover:bg-zinc-750 px-4 py-2 rounded-xl flex items-center gap-2 transition border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 cursor-pointer text-left"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export to CSV
                </button>
                <button
                  onClick={triggerPrintPDF}
                  disabled={filteredRecords.length === 0}
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-150 dark:hover:bg-zinc-750 px-4 py-2 rounded-xl flex items-center gap-2 transition border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 cursor-pointer text-left"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Print / Export to PDF
                </button>
              </div>

              <div className="text-xs text-zinc-400 font-medium">
                Showing <span className="font-bold text-zinc-700 dark:text-zinc-200">{filteredRecords.length} calculated shifts</span> for <span className="font-bold text-zinc-700 dark:text-zinc-200">{activeSummaryStats.activeAgentsCount} highlighted agents</span>
              </div>
            </div>

            {/* 2. Interactive Search & Filters Panel */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 print:hidden" id="filter-center-panel">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h4 className="font-display font-medium text-sm text-zinc-850 dark:text-zinc-100 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  Filter Operational Demographics
                </h4>
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 transition"
                >
                  Clear All Filters
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
                {/* Search query */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by agent name..."
                    value={filters.agentName}
                    onChange={(e) => setFilters(p => ({ ...p, agentName: e.target.value }))}
                    className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 px-9 focus:outline-none focus:border-indigo-500 font-medium text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Team Selection */}
                <select
                  value={filters.team}
                  onChange={(e) => setFilters(p => ({ ...p, team: e.target.value }))}
                  disabled={currentUser.role === 'Team Leader'}
                  className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 focus:outline-none focus:border-indigo-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-60 cursor-pointer md:col-span-2"
                >
                  <option value="">-- View All Teams --</option>
                  {uniqueMetadata.teams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {/* Start Date */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 shrink-0 select-none">Start</span>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))}
                    className="text-xs bg-transparent text-zinc-800 dark:text-zinc-100 py-2 focus:outline-none w-full cursor-pointer"
                  />
                </div>

                {/* End Date */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 shrink-0 select-none">End</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))}
                    className="text-xs bg-transparent text-zinc-100 py-2 focus:outline-none w-full cursor-pointer text-zinc-800"
                  />
                </div>
              </div>
            </section>

            {/* Excel Uploader module */}
            <section className="print:hidden">
              <ExcelUploader 
                onDataLoaded={handleDataUploaded}
                onReset={handleResetData}
                onLoadDemo={handleLoadDemo}
                currentCount={records.length}
                existingRecords={records}
              />
            </section>

            {/* 3. Core KPI Statistics */}
            <MetricCards summary={activeSummaryStats} allRecords={records} />

            {/* Remediation & Underperformance Alert Center */}
            {underperformanceSpotlight && records.length > 0 && (
              <section className="bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/10 dark:to-amber-950/11 border border-red-200 dark:border-red-950 rounded-2xl p-5 shadow-sm mt-4 relative overflow-hidden" id="underperformance-spotlight-alert-center animate-fade-in">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
                  <ShieldAlert className="w-24 h-24 text-red-500" />
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <h4 className="font-display font-medium text-sm uppercase tracking-wider text-red-800 dark:text-red-400 flex items-center gap-1.5">
                    Critical Performance Spotlight
                  </h4>
                  <span className="text-[10px] bg-red-100 dark:bg-rose-950/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-md font-bold">Action Needed</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Poorest Team Card */}
                  {underperformanceSpotlight.poorestTeam && (
                    <div className="bg-white/80 dark:bg-zinc-900/60 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Poorest Performing Team</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100 font-display">
                          {underperformanceSpotlight.poorestTeam.name}
                        </span>
                        <span className="text-sm font-bold text-red-650 dark:text-red-400 font-mono">
                          {underperformanceSpotlight.poorestTeam.avgScore.toFixed(1)}% Average
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                        Overall evaluating metrics indicate that the <span className="font-semibold text-zinc-800 dark:text-zinc-200">{underperformanceSpotlight.poorestTeam.name}</span> team currently registers below standard baseline values. Support and supervisory review recommended.
                      </p>
                    </div>
                  )}

                  {/* Poorest Agents Card */}
                  <div className="bg-white/80 dark:bg-zinc-900/60 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Lowest Performing Agent Spotlights</span>
                      <div className="mt-2.5 divide-y divide-zinc-150 dark:divide-zinc-800">
                        {underperformanceSpotlight.poorestAgents.map((agent, index) => (
                          <div key={agent.name} className="py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                #{index + 1}
                              </span>
                              <div>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{agent.name}</span>
                                <span className="text-[10px] text-zinc-400 block">{agent.team}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-red-650 dark:text-red-400">
                                {agent.avgScore.toFixed(1)}%
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedAgentName(agent.name);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="text-[10px] bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-300 px-2.5 py-1 rounded border border-red-200/40 hover:border-red-300 font-semibold cursor-pointer transition-colors"
                              >
                                View Profile
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Drilldown Agent Profile Panel (if selected) */}
            {selectedAgentName && (
              <section className="z-10 animate-fade-in relative">
                <AgentProfileView 
                  agentName={selectedAgentName}
                  records={records}
                  onClose={() => setSelectedAgentName('')}
                  currentUser={currentUser}
                />
              </section>
            )}

            {/* 4. Leaderboard Panel (Full Width) */}
            <div className="w-full">
              <AgentLeaderboard 
                records={filteredRecords}
                onSelectAgent={(name) => setSelectedAgentName(name)}
                selectedAgentName={selectedAgentName}
              />
            </div>

            {/* Dynamic Charts visual trends */}
            <section>
              <PerformanceTrends records={filteredRecords} />
            </section>

            {/* 5. Direct Operational Auditing & Chronological Comment Registry */}
            <section className="print:hidden">
              <OperationalAuditSuite filteredRecords={filteredRecords} />
            </section>

            {/* 6. Hourly / Daily, Weekly, Monthly performance comparison list */}
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div>
                  <h4 className="font-display font-medium text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    Comparative Shift Logs Tabulation
                  </h4>
                  <p className="text-xs text-zinc-500 m-0.5">
                    Toggle evaluations of daily records, aggregated iso-weeks, or billing months.
                  </p>
                </div>

                {/* Period tabs */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border">
                  <button
                    onClick={() => setEvaluationPeriod('daily')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded transition ${
                      evaluationPeriod === 'daily' 
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Daily Shifts
                  </button>
                  <button
                    onClick={() => setEvaluationPeriod('weekly')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded transition ${
                      evaluationPeriod === 'weekly' 
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Weekly Rollup
                  </button>
                  <button
                    onClick={() => setEvaluationPeriod('monthly')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded transition ${
                      evaluationPeriod === 'monthly' 
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    Monthly Comparisons
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-zinc-150 dark:border-zinc-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Timeline Identifier</th>
                      {evaluationPeriod === 'daily' && <th className="py-2.5 px-3">Agent</th>}
                      {evaluationPeriod === 'daily' && <th className="py-2.5 px-3">Demographics (Team)</th>}
                      <th className="py-2.5 px-3 text-right">Avg Rating Score</th>
                      <th className="py-2.5 px-3 text-right">Sales</th>
                      <th className="py-2.5 px-3 text-right">B Sales</th>
                      <th className="py-2.5 px-3 text-right">Calls Count</th>
                      {evaluationPeriod === 'daily' && <th className="py-2.5 px-3 text-center">Dispositions Mix (S - CB - NI - B - NA)</th>}
                      <th className="py-2.5 px-3 text-right">Agent Average</th>
                      {evaluationPeriod !== 'daily' && <th className="py-2.5 px-3 text-right">Audit Sample Size</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-350">
                    {periodAgreedData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-zinc-400">
                           No representative log points to list inside specified date bounds.
                        </td>
                      </tr>
                    ) : (
                      periodAgreedData.map((row: any, index: number) => {
                        const salesVal = row.sales !== undefined ? row.sales : row.totalSales;
                        const bSalesVal = row.bSales !== undefined ? row.bSales : (row.totalBSales || 0);
                        const callsVal = row.callsCount !== undefined ? row.callsCount : (row.totalCalls || 0);
                        const agentAvgPercent = callsVal > 0 ? (((salesVal + bSalesVal) / callsVal) * 100).toFixed(1) + '%' : '0.0%';

                        const saleDisp = row.dispoSale !== undefined ? row.dispoSale : salesVal;
                        const cbDisp = row.dispoCallback || 0;
                        const niDisp = row.dispoNotInterested || 0;
                        const busyDisp = row.dispoBusy || 0;
                        const naDisp = row.dispoNoAnswer || 0;

                        return (
                          <tr key={row.key || row.id || index} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-900/60 font-medium">
                            <td className="py-2.5 px-3 font-mono font-bold text-zinc-850 dark:text-zinc-200">
                              {evaluationPeriod === 'daily' 
                                ? new Date(row.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                : row.period
                              }
                            </td>
                            {evaluationPeriod === 'daily' && (
                              <td 
                                className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                onClick={() => setSelectedAgentName(row.agentName)}
                              >
                                {row.agentName}
                              </td>
                            )}
                            {evaluationPeriod === 'daily' && (
                              <td className="py-2.5 px-3 text-zinc-500">
                                {row.team}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-50">
                              {(row.performanceScore !== undefined ? row.performanceScore : row.avgScore).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-zinc-800 dark:text-zinc-200">
                              {salesVal}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                              {bSalesVal}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                              {callsVal}
                            </td>
                            {evaluationPeriod === 'daily' && (
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col items-center gap-1 w-36 mx-auto">
                                  <div className="flex items-center gap-1.5 text-[9px] font-mono leading-none font-bold">
                                    <span className="text-emerald-600 dark:text-emerald-400" title="Sale">{saleDisp}</span>
                                    <span className="text-zinc-350 dark:text-zinc-650">·</span>
                                    <span className="text-indigo-600 dark:text-indigo-400" title="Callback">{cbDisp}</span>
                                    <span className="text-zinc-350 dark:text-zinc-650">·</span>
                                    <span className="text-amber-600 dark:text-amber-400" title="Not Interested">{niDisp}</span>
                                    <span className="text-zinc-350 dark:text-zinc-650">·</span>
                                    <span className="text-zinc-500" title="Busy">{busyDisp}</span>
                                    <span className="text-zinc-350 dark:text-zinc-650">·</span>
                                    <span className="text-sky-504 dark:text-sky-450 text-sky-500" title="No Answer">{naDisp}</span>
                                  </div>
                                  {callsVal > 0 ? (
                                    <div className="h-1 w-full rounded-sm overflow-hidden flex bg-zinc-100 dark:bg-zinc-800">
                                      <div className="bg-emerald-500 h-full hover:brightness-110" style={{ width: `${(saleDisp / callsVal) * 100}%` }} title={`S: ${saleDisp}`} />
                                      <div className="bg-indigo-500 h-full hover:brightness-110" style={{ width: `${(cbDisp / callsVal) * 100}%` }} title={`CB: ${cbDisp}`} />
                                      <div className="bg-amber-500 h-full hover:brightness-110" style={{ width: `${(niDisp / callsVal) * 100}%` }} title={`NI: ${niDisp}`} />
                                      <div className="bg-zinc-400 h-full hover:brightness-110" style={{ width: `${(busyDisp / callsVal) * 100}%` }} title={`B: ${busyDisp}`} />
                                      <div className="bg-sky-400 h-full hover:brightness-110" style={{ width: `${(naDisp / callsVal) * 100}%` }} title={`NA: ${naDisp}`} />
                                    </div>
                                  ) : (
                                    <div className="h-1 w-full rounded-sm bg-zinc-150 dark:bg-zinc-800" />
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-500">
                              {agentAvgPercent}
                            </td>
                            {evaluationPeriod !== 'daily' && (
                              <td className="py-2.5 px-3 text-right font-mono text-zinc-400 dark:text-zinc-500">
                                {row.sampleCount} shifts
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="text-center py-10 text-xs text-zinc-400 dark:text-zinc-500 select-none print:hidden border-t border-zinc-200 dark:border-zinc-900 mt-12 bg-white dark:bg-zinc-950">
        <p>© 2026 Agent Performance Evaluation Center. Absolute precision performance management reporting.</p>
      </footer>
      </div>
    </div>
  );
}
