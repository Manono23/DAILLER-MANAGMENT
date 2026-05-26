import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, FileSpreadsheet, Check, AlertCircle, RefreshCw, 
  ChevronDown, ChevronUp, Download, Database, Trash2
} from 'lucide-react';
import { AgentPerformanceRecord } from '../types';

interface ExcelUploaderProps {
  onDataLoaded: (records: AgentPerformanceRecord[], append: boolean) => void;
  onReset: () => void;
  onLoadDemo?: () => void;
  currentCount: number;
  existingRecords: AgentPerformanceRecord[];
}

export default function ExcelUploader({ onDataLoaded, onReset, onLoadDemo, currentCount, existingRecords }: ExcelUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [detectedFormatMsg, setDetectedFormatMsg] = useState<string | null>(null);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping states
  const [mapping, setMapping] = useState<Record<string, string>>({
    agentName: '',
    date: '',
    team: '',
    sales: '',
    bSales: '',
    productivity: '',
    target: '',
    performanceScore: '',
    callsCount: '',
    dispoSale: '',
    dispoNoAnswer: '',
    dispoBusy: '',
    dispoNotInterested: '',
    dispoCallback: '',
    talkTime: '',
    wrapTime: '',
    holdTime: '',
    idleTime: '',
    auxTime: '',
    loginTime: ''
  });

  const allExpectedFields = [
    { key: 'agentName', label: 'Agent Name', required: true, fallback: ['agent', 'agent name', 'name', 'employee', 'staff', 'agent_name', 'resource', 'csr'] },
    { key: 'date', label: 'Date', required: true, fallback: ['date', 'day', 'timestamp', 'period', 'date_str', 'date stamp', 'dt', 'shift date', 'work date'] },
    { key: 'team', label: 'Team Name', required: false, fallback: ['team', 'group', 'department', 'division', 'campaign', 'lob'] },
    { key: 'sales', label: 'Sales / Conversions', required: false, fallback: ['sales', 'conversion', 'revenue', 'deals', 'sold', 'conversions', 'closes', 'sale'] },
    { key: 'bSales', label: 'B Sales', required: false, fallback: ['b sales', 'b_sales', 'bsales', 'b-sales', 'secondary sales', 'secondary_sales', 'backupsales', 'backup sales'] },
    { key: 'callsCount', label: 'Total Calls Count', required: false, fallback: ['calls', 'calls_count', 'interactions', 'volume', 'total calls', 'total_calls', 'dialer calls', 'contacts'] },
    { key: 'productivity', label: 'Productivity Level (%)', required: false, fallback: ['productivity', 'productivity_rate', 'cases', 'efficiency', 'occupancy', 'prod%'] },
    { key: 'target', label: 'Sales Targets / Quota', required: false, fallback: ['target', 'quota', 'goal', 'expected', 'targets', 'sla'] },
    { key: 'performanceScore', label: 'Overall Score (0-100)', required: false, fallback: ['score', 'performance_score', 'rating', 'eval', 'qa score', 'qa_score', 'overall score', 'kpi'] },
    { key: 'dispoSale', label: 'Outcome: Sales', required: false, fallback: ['dispo_sale', 'dispo sale', 'sale dispo', 'interested', 'converts', 'sold_dispo'] },
    { key: 'dispoNoAnswer', label: 'Outcome: No Answer', required: false, fallback: ['no answer', 'answering machine', 'rna', 'no_answer', 'noanswer', 'unanswered', 'vm', 'voicemail'] },
    { key: 'dispoBusy', label: 'Outcome: Busy', required: false, fallback: ['busy', 'line busy', 'dispo_busy', 'busy signal', 'busy_dispo'] },
    { key: 'dispoNotInterested', label: 'Outcome: Declined', required: false, fallback: ['not interested', 'decline', 'declined', 'refused', 'no interest', 'dispo_decline', 'uninterested'] },
    { key: 'dispoCallback', label: 'Outcome: Callback', required: false, fallback: ['callback', 'call back', 'follow up', 'schedule callback', 'dispo_callback', 'callbacks'] },
    { key: 'talkTime', label: 'Talk Time (Mins)', required: false, fallback: ['talktime', 'talk time', 'talk', 'talking', 'talk_duration', 'talk duration', 'speaking time'] },
    { key: 'wrapTime', label: 'Wrap Time / ACW (Mins)', required: false, fallback: ['wraptime', 'wrap time', 'acw', 'wrap_duration', 'after call work', 'acw duration'] },
    { key: 'holdTime', label: 'Hold Time (Mins)', required: false, fallback: ['holdtime', 'hold time', 'hold_duration', 'on hold', 'hold duration'] },
    { key: 'idleTime', label: 'Standby / Idle (Mins)', required: false, fallback: ['idletime', 'idle time', 'ready time', 'available time', 'waiting', 'idle', 'standby'] },
    { key: 'auxTime', label: 'Aux / Breaks (Mins)', required: false, fallback: ['auxtime', 'aux time', 'break', 'lunch', 'break time', 'aux', 'meeting', 'training', 'aux duration'] },
    { key: 'loginTime', label: 'Shift Duration (Mins)', required: false, fallback: ['logintime', 'login time', 'logged time', 'duration', 'shift length', 'total logged', 'total time'] }
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setParsing(true);
    setUploadError(null);
    setUploadSuccess(null);
    setDetectedFormatMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error('Excel file contains no visible sheets.');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });
        
        if (rows.length === 0) {
          throw new Error('Spreadsheet worksheet is completely empty.');
        }

        const keys = Object.keys(rows[0]);
        setAvailableHeaders(keys);
        setParsedRows(rows);

        // Heuristic automatic mapping detection
        const autoMap: Record<string, string> = {};
        allExpectedFields.forEach(field => {
          const match = keys.find(k => {
            const lowerK = k.toLowerCase().trim().replace(/[\s_-]/g, '');
            return field.fallback.some(fb => {
              const lowerFb = fb.toLowerCase().trim().replace(/[\s_-]/g, '');
              return lowerK === lowerFb || lowerK.includes(lowerFb) || lowerFb.includes(lowerK);
            });
          });
          autoMap[field.key] = match || '';
        });

        // Smart fallbacks for mandatory fields
        if (!autoMap['agentName']) {
          const fallbackMatch = keys.find(k => k.toLowerCase().includes('agent') || k.toLowerCase().includes('name') || k.toLowerCase().includes('staff') || k.toLowerCase() === 'csr');
          if (fallbackMatch) autoMap['agentName'] = fallbackMatch;
        }
        if (!autoMap['date']) {
          const fallbackMatch = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('day') || k.toLowerCase().includes('time') || k.toLowerCase().includes('period') || k.toLowerCase() === 'dt');
          if (fallbackMatch) autoMap['date'] = fallbackMatch;
        }

        setMapping(autoMap);

        // Ensure we matched required headers to authorize auto-load
        if (autoMap['agentName'] && autoMap['date']) {
          const results = executeUnifiedSmartImport(rows, keys, autoMap);
          setUploadSuccess(
            `Excel file processed and reflected instantly! Automatically ingested ${results.totalLoadedCount} granular shift records (merged ${results.updatedCount} updates and created ${results.createdCount} new timelines).`
          );
          setDetectedFormatMsg(`⚡ Auto-Detected System Structure: ${results.formatDesc}`);
        } else {
          setUploadError(
            `Unable to auto-detect "Agent Name" or "Date" headers in your Excel file. Please double-check your file columns, or set mappings manually below.`
          );
          setShowAdvancedMapping(true);
        }
      } catch (err: any) {
        setUploadError(err.message || 'Fatal error occurred when processing spreadsheet file.');
        setParsedRows([]);
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read file from local disk.');
      setParsing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const executeUnifiedSmartImport = (rows: any[], keys: string[], autoMapping: Record<string, string>) => {
    const fileAgentKey = autoMapping.agentName;
    const fileDateKey = autoMapping.date;

    if (!fileAgentKey || !fileDateKey) {
      throw new Error(`Agent Name and Date columns are missing in mapping config.`);
    }

    let datasetCopy: AgentPerformanceRecord[] = [...existingRecords];
    let createdCount = 0;
    let updatedCount = 0;

    // Classification indices
    const hasPerformanceInfo = !!autoMapping.sales || !!autoMapping.callsCount || !!autoMapping.performanceScore || !!autoMapping.productivity;
    const hasTimingInfo = !!autoMapping.talkTime || !!autoMapping.wrapTime || !!autoMapping.auxTime || !!autoMapping.loginTime;

    rows.forEach((row, idx) => {
      const agentRaw = row[fileAgentKey]?.toString()?.trim();
      if (!agentRaw) return; // Skip empty rows

      const agentName = agentRaw;

      // Date standardizer
      let dateStr = '';
      const rawDate = row[fileDateKey];
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split('T')[0];
      } else if (rawDate) {
        const parsedTimestamp = Date.parse(rawDate.toString().trim());
        if (!isNaN(parsedTimestamp)) {
          dateStr = new Date(parsedTimestamp).toISOString().split('T')[0];
        } else {
          dateStr = rawDate.toString().trim();
        }
      }
      
      if (!dateStr || dateStr === 'Invalid Date') {
        dateStr = new Date().toISOString().split('T')[0];
      }

      const team = autoMapping.team ? row[autoMapping.team]?.toString()?.trim() || 'Unassigned' : 'Unassigned';

      const getNum = (key: string, backup: number) => {
        if (!autoMapping[key]) return backup;
        const val = parseFloat(row[autoMapping[key]]);
        return isNaN(val) ? backup : val;
      };

      const matchIdx = datasetCopy.findIndex(
        r => r.agentName.toLowerCase() === agentName.toLowerCase() && r.date === dateStr
      );

      if (matchIdx !== -1) {
        // --- SMART MERGE ---
        const existing = datasetCopy[matchIdx];

        if (team !== 'Unassigned') existing.team = team;
        
        if (autoMapping.sales) existing.sales = getNum('sales', existing.sales);
        if (autoMapping.bSales) existing.bSales = getNum('bSales', existing.bSales || 0);
        if (autoMapping.target) existing.target = getNum('target', existing.target);
        if (autoMapping.callsCount) existing.callsCount = getNum('callsCount', existing.callsCount);

        // Dispositions
        existing.dispoSale = autoMapping.dispoSale ? getNum('dispoSale', existing.dispoSale) : (autoMapping.sales ? existing.sales : existing.dispoSale);
        if (autoMapping.dispoCallback) existing.dispoCallback = getNum('dispoCallback', existing.dispoCallback);
        if (autoMapping.dispoNotInterested) existing.dispoNotInterested = getNum('dispoNotInterested', existing.dispoNotInterested);
        if (autoMapping.dispoBusy) existing.dispoBusy = getNum('dispoBusy', existing.dispoBusy);
        if (autoMapping.dispoNoAnswer) existing.dispoNoAnswer = getNum('dispoNoAnswer', existing.dispoNoAnswer);

        // Times
        if (autoMapping.talkTime) existing.talkTime = getNum('talkTime', existing.talkTime);
        if (autoMapping.wrapTime) existing.wrapTime = getNum('wrapTime', existing.wrapTime);
        if (autoMapping.holdTime) existing.holdTime = getNum('holdTime', existing.holdTime);
        if (autoMapping.auxTime) existing.auxTime = getNum('auxTime', existing.auxTime);
        if (autoMapping.loginTime) existing.loginTime = getNum('loginTime', existing.loginTime);
        
        if (autoMapping.idleTime) {
          existing.idleTime = getNum('idleTime', existing.idleTime);
        } else if (autoMapping.talkTime || autoMapping.wrapTime || autoMapping.holdTime || autoMapping.auxTime || autoMapping.loginTime) {
          existing.idleTime = Math.max(0, existing.loginTime - existing.talkTime - existing.wrapTime - existing.holdTime - existing.auxTime);
        }

        // Productivity
        if (autoMapping.productivity) {
          let prod = getNum('productivity', existing.productivity);
          if (prod > 0 && prod <= 1) prod = Math.round(prod * 100);
          existing.productivity = Math.round(Math.min(100, Math.max(0, prod)));
        } else if (hasTimingInfo) {
          const occupied = existing.talkTime + existing.wrapTime + existing.holdTime;
          existing.productivity = Math.min(100, Math.round((occupied / Math.max(1, existing.loginTime - existing.auxTime)) * 100));
        }

        // Combined overall performance score
        if (autoMapping.performanceScore) {
          let score = getNum('performanceScore', existing.performanceScore);
          if (score > 0 && score <= 1) score = Math.round(score * 100);
          existing.performanceScore = Math.round(Math.min(100, Math.max(0, score)));
        } else {
          const salesRate = Math.min(100, (existing.sales / Math.max(1, existing.target)) * 100);
          existing.performanceScore = Math.round((existing.productivity * 0.5) + (salesRate * 0.5));
        }

        updatedCount++;
      } else {
        // --- NEW RECORD ---
        const sales = autoMapping.sales ? getNum('sales', 0) : 0;
        const target = autoMapping.target ? getNum('target', Math.round(sales * 1.1 + 1)) : 10;
        
        let productivity = autoMapping.productivity ? getNum('productivity', 80) : 80;
        if (productivity > 0 && productivity <= 1) productivity = Math.round(productivity * 100);

        const callsCount = autoMapping.callsCount ? getNum('callsCount', Math.round(productivity * 0.8 + sales * 2)) : Math.round(productivity * 0.8 + sales * 2 || 35);

        // Timings Setup
        const loginTime = autoMapping.loginTime ? getNum('loginTime', 480) : 480;
        const auxTime = autoMapping.auxTime ? getNum('auxTime', 60) : 60;
        const holdTime = autoMapping.holdTime ? getNum('holdTime', Math.round(callsCount * 0.3)) : Math.round(callsCount * 0.3);
        const wrapTime = autoMapping.wrapTime ? getNum('wrapTime', Math.round(callsCount * 0.7)) : Math.round(callsCount * 0.7);
        let talkTime = autoMapping.talkTime ? getNum('talkTime', Math.round(callsCount * 2.3)) : Math.round(callsCount * 2.3);

        if (!autoMapping.talkTime && (talkTime + wrapTime + holdTime + auxTime > loginTime - 15)) {
          talkTime = Math.max(10, loginTime - wrapTime - holdTime - auxTime - 15);
        }
        const idleTime = autoMapping.idleTime 
          ? getNum('idleTime', Math.max(5, loginTime - talkTime - wrapTime - holdTime - auxTime)) 
          : Math.max(5, loginTime - talkTime - wrapTime - holdTime - auxTime);

        let finalProd = productivity;
        if (hasTimingInfo && !autoMapping.productivity) {
          const occupied = talkTime + wrapTime + holdTime;
          finalProd = Math.min(100, Math.round((occupied / Math.max(1, loginTime - auxTime)) * 100));
        }

        let finalScore = autoMapping.performanceScore ? getNum('performanceScore', 75) : 75;
        if (finalScore > 0 && finalScore <= 1) finalScore = Math.round(finalScore * 100);
        if (!autoMapping.performanceScore) {
          const salesRate = Math.min(100, (sales / Math.max(1, target)) * 100);
          finalScore = Math.round((finalProd * 0.5) + (salesRate * 0.5));
        }

        // Dispositions
        const dispoSale = autoMapping.dispoSale ? getNum('dispoSale', sales) : sales;
        const bSales = autoMapping.bSales ? getNum('bSales', 0) : 0;
        const dispoCallback = autoMapping.dispoCallback ? getNum('dispoCallback', Math.round(sales * 1.1)) : Math.round(sales * 1.1);
        const rem1 = Math.max(0, callsCount - dispoSale - dispoCallback);
        const dispoNotInterested = autoMapping.dispoNotInterested ? getNum('dispoNotInterested', Math.round(rem1 * 0.5)) : Math.round(rem1 * 0.5);
        const rem2 = Math.max(0, rem1 - dispoNotInterested);
        const dispoBusy = autoMapping.dispoBusy ? getNum('dispoBusy', Math.round(rem2 * 0.4)) : Math.round(rem2 * 0.4);
        const dispoNoAnswer = autoMapping.dispoNoAnswer ? getNum('dispoNoAnswer', Math.max(0, rem2 - dispoBusy)) : Math.max(0, rem2 - dispoBusy);

        datasetCopy.push({
          id: `excel-auto-${Date.now()}-${idx}`,
          agentName,
          date: dateStr,
          team,
          sales,
          bSales,
          productivity: Math.round(Math.min(100, Math.max(0, finalProd))),
          target,
          performanceScore: Math.round(Math.min(100, Math.max(0, finalScore))),
          callsCount,
          dispoSale,
          dispoNoAnswer,
          dispoBusy,
          dispoNotInterested,
          dispoCallback,
          talkTime,
          wrapTime,
          holdTime,
          idleTime,
          auxTime,
          loginTime
        });

        createdCount++;
      }
    });

    onDataLoaded(datasetCopy, false);

    let formatDesc = '📊 Standard Unified Tracker';
    if (hasPerformanceInfo && hasTimingInfo) {
      formatDesc = '⚡ Combined Performance & Real-Time AUX Logs';
    } else if (hasPerformanceInfo) {
      formatDesc = '📈 Outcomes & Call Dispositions Log';
    } else if (hasTimingInfo) {
      formatDesc = '⏱️ Shift Time Management Breakdown';
    }

    return {
      formatDesc,
      createdCount,
      updatedCount,
      totalLoadedCount: rows.length
    };
  };

  const forceReapplyImport = () => {
    if (parsedRows.length === 0) return;
    try {
      const results = executeUnifiedSmartImport(parsedRows, availableHeaders, mapping);
      setUploadSuccess(
        `Custom column mapping applied and updated! Re-processed ${results.totalLoadedCount} shift records successfully.`
      );
    } catch (err: any) {
      setUploadError(err.message || 'Error occurred applying your custom mappings.');
    }
  };

  const downloadSampleCombinedCSV = () => {
    const headers = [
      'Agent Name', 'Date', 'Team', 'Sales', 'Target', 'Calls', 
      'Talk Time (Mins)', 'Wrap Time (Mins)', 'Hold Time (Mins)', 'Aux Time (Mins)', 'Total Logged (Mins)',
      'Dispo: Sale', 'Dispo: No Answer', 'Dispo: Busy', 'Dispo: Not Interested', 'Dispo: Callback'
    ];
    const rows = [
      ['Sarah Jenkins', '2026-05-25', 'Sales Alpha', '15', '12', '85', '280', '65', '15', '60', '480', '15', '22', '15', '20', '13'],
      ['Michael Chang', '2026-05-25', 'Sales Alpha', '4', '10', '35', '150', '80', '35', '80', '480', '4', '10', '5', '10', '6'],
      ['David Miller', '2026-05-25', 'Outbound Beta', '0', '8', '5', '35', '15', '10', '60', '480', '0', '2', '1', '1', '1']
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(cell => `"${cell}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "agent_performance_time_combined.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm" id="excel-uploader-card">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-display font-medium text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            Automatic Excel Loader & Allocator
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Drag and drop or select your Excel tracker to instantly parse and update all agent profiles and charts automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button 
            onClick={downloadSampleCombinedCSV}
            className="text-[11px] font-medium text-zinc-650 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition bg-zinc-50 dark:bg-zinc-805 hover:bg-zinc-100 dark:hover:bg-zinc-750 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3" />
            Download Sample Excel
          </button>

          {onLoadDemo && (
            <button
              onClick={onLoadDemo}
              className="text-[11px] font-medium text-indigo-650 dark:text-indigo-455 hover:text-indigo-750 bg-indigo-50 dark:bg-indigo-950/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1 border border-indigo-200/40 cursor-pointer"
              title="Populate table with synthesized demo agents for testing"
            >
              <Database className="w-3 h-3" />
              Load Demo Agents
            </button>
          )}
          
          <button
            onClick={onReset}
            className="text-[11px] font-medium text-red-650 hover:text-red-750 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1 border border-red-200/40 cursor-pointer"
            title="Clear and erase all loaded agent records completely"
          >
            <Trash2 className="w-3 h-3" />
            Clear All Data
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 text-xs rounded-xl flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-bold">Unrecognized Excel Column Structure</p>
            <p className="opacity-90 mt-0.5">{uploadError}</p>
          </div>
        </div>
      )}

      {uploadSuccess && (
        <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-start gap-2.5 animate-fade-in shadow-sm">
          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5 font-bold" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 dark:text-zinc-100">Excel Data Synchronized Successfully!</p>
            <p className="opacity-95 mt-0.5 leading-relaxed text-zinc-650 dark:text-zinc-350">{uploadSuccess}</p>
          </div>
        </div>
      )}

      {detectedFormatMsg && (
        <div className="mb-4 p-2.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/10 text-indigo-700 dark:text-indigo-400 text-xs rounded-xl flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 shrink-0 font-bold" />
          <span>{detectedFormatMsg}</span>
        </div>
      )}

      {/* Drag & Drop Target Area */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/10' 
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 bg-zinc-50/50 dark:bg-zinc-800/10'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
          className="hidden" 
        />
        
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-855 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
          {parsing ? (
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          ) : (
            <Upload className="w-5.5 h-5.5 text-indigo-500" />
          )}
        </div>
        <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-200">
          {parsing ? 'Extracting tracking sheets...' : 'Drop your Excel/CSV here or click to choose file'}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block max-w-md mx-auto leading-relaxed">
          Matches headers automatically. Imports call outcome statistics, dispositions, and logged AUX timings to formulate real-time agent profiles instantly.
        </p>
      </div>

      {availableHeaders.length > 0 && (
        <div className="mt-4 border-t border-zinc-150 dark:border-zinc-800/80 pt-4">
          <button 
            onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
            className="flex items-center gap-1 text-xs font-semibold text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer bg-transparent border-0 outline-none"
          >
            {showAdvancedMapping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{showAdvancedMapping ? "Hide Advanced Tuning Controls" : "Show / Tune Advanced Column Mapping"}</span>
          </button>

          {showAdvancedMapping && (
            <div className="mt-3 bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-150 dark:border-zinc-800/50 p-4 rounded-xl animate-fade-in">
              <div className="mb-3">
                <h4 className="text-xs font-bold text-zinc-750 dark:text-zinc-300 uppercase tracking-wide">Adjust Variable Integrations</h4>
                <p className="text-[10.5px] text-zinc-500 dark:text-zinc-405 mt-0.5">
                  Change matches below if the automated guess missed matching unique headers on your file, then click "Apply Column Tuning".
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {allExpectedFields.map(field => (
                  <div key={field.key} className="flex flex-col gap-1 bg-white dark:bg-zinc-900 p-2 text-xs rounded border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-zinc-700 dark:text-zinc-350 block truncate">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </span>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded p-1 focus:outline-none focus:border-indigo-550 w-full cursor-pointer mt-1"
                    >
                      <option value="">(Ignore Column)</option>
                      {availableHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setShowAdvancedMapping(false)}
                  className="text-[11px] border border-zinc-200 dark:border-zinc-700 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold px-4 py-2 rounded transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={forceReapplyImport}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white text-[11px] font-bold px-4 py-2 rounded transition cursor-pointer shadow-sm shadow-indigo-100 dark:shadow-none"
                >
                  Apply Column Tuning
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
