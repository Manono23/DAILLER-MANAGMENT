import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { getInitialMockData } from './src/mockData'; // Use ESM extension or ts import depending on tsx resolution
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';

dotenv.config();

const PERSISTENT_FILE = path.join(process.cwd(), 'performance_records.json');
const NOTES_FILE = path.join(process.cwd(), 'agent_notes.json');

const allExpectedFields = [
  { key: 'agentName', fallback: ['agent', 'agent name', 'name', 'employee', 'staff', 'agent_name', 'resource', 'csr'] },
  { key: 'date', fallback: ['date', 'day', 'timestamp', 'period', 'date_str', 'date stamp', 'dt', 'shift date', 'work date'] },
  { key: 'team', fallback: ['team', 'group', 'department', 'division', 'campaign', 'lob'] },
  { key: 'sales', fallback: ['sales', 'conversion', 'revenue', 'deals', 'sold', 'conversions', 'closes', 'sale'] },
  { key: 'bSales', fallback: ['b sales', 'b_sales', 'bsales', 'b-sales', 'secondary sales', 'secondary_sales', 'backupsales', 'backup sales'] },
  { key: 'callsCount', fallback: ['calls', 'calls_count', 'interactions', 'volume', 'total calls', 'total_calls', 'dialer calls', 'contacts'] },
  { key: 'productivity', fallback: ['productivity', 'productivity_rate', 'cases', 'efficiency', 'occupancy', 'prod%'] },
  { key: 'target', fallback: ['target', 'quota', 'goal', 'expected', 'targets', 'sla'] },
  { key: 'performanceScore', fallback: ['score', 'performance_score', 'rating', 'eval', 'qa score', 'qa_score', 'overall score', 'kpi'] },
  { key: 'dispoSale', fallback: ['dispo_sale', 'dispo sale', 'sale dispo', 'interested', 'converts', 'sold_dispo'] },
  { key: 'dispoNoAnswer', fallback: ['no answer', 'answering machine', 'rna', 'no_answer', 'noanswer', 'unanswered', 'vm', 'voicemail'] },
  { key: 'dispoBusy', fallback: ['busy', 'line busy', 'dispo_busy', 'busy signal', 'busy_dispo'] },
  { key: 'dispoNotInterested', fallback: ['not interested', 'decline', 'declined', 'refused', 'no interest', 'dispo_decline', 'uninterested'] },
  { key: 'dispoCallback', fallback: ['callback', 'call back', 'follow up', 'schedule callback', 'dispo_callback', 'callbacks'] },
  { key: 'talkTime', fallback: ['talktime', 'talk time', 'talk', 'talking', 'talk_duration', 'talk duration', 'speaking time'] },
  { key: 'wrapTime', fallback: ['wraptime', 'wrap time', 'acw', 'wrap_duration', 'after call work', 'acw duration'] },
  { key: 'holdTime', fallback: ['holdtime', 'hold time', 'hold_duration', 'on hold', 'hold duration'] },
  { key: 'idleTime', fallback: ['idletime', 'idle time', 'ready time', 'available time', 'waiting', 'idle', 'standby'] },
  { key: 'auxTime', fallback: ['auxtime', 'aux time', 'break', 'lunch', 'break time', 'aux', 'meeting', 'training', 'aux duration'] },
  { key: 'loginTime', fallback: ['logintime', 'login time', 'logged time', 'duration', 'shift length', 'total logged', 'total time'] }
];

function scanAndLoadExcel(): any[] | null {
  try {
    const files = fs.readdirSync(process.cwd());
    const spreadsheetFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv'));
    if (!spreadsheetFile) return null;

    const fullPath = path.join(process.cwd(), spreadsheetFile);
    console.log(`[Auto-Import] Found spreadsheet file: ${spreadsheetFile}. Ingesting...`);
    
    const workbook = XLSX.readFile(fullPath, { cellDates: true });
    if (workbook.SheetNames.length === 0) return null;

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

    if (rows.length === 0) return null;

    const keys = Object.keys(rows[0]);
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

    if (!autoMap['agentName']) {
      const fallbackMatch = keys.find(k => k.toLowerCase().includes('agent') || k.toLowerCase().includes('name') || k.toLowerCase().includes('staff') || k.toLowerCase() === 'csr');
      if (fallbackMatch) autoMap['agentName'] = fallbackMatch;
    }
    if (!autoMap['date']) {
      const fallbackMatch = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('day') || k.toLowerCase().includes('time') || k.toLowerCase().includes('period') || k.toLowerCase() === 'dt');
      if (fallbackMatch) autoMap['date'] = fallbackMatch;
    }

    if (!autoMap['agentName'] || !autoMap['date']) {
      console.warn('[Auto-Import] Skip excel automated load: mandatory columns ("Agent Name" and "Date") could not be resolved.');
      return null;
    }

    const importedRecords: any[] = [];
    rows.forEach((row, idx) => {
      const agentRaw = row[autoMap['agentName']]?.toString()?.trim();
      if (!agentRaw) return;

      const agentName = agentRaw;

      let dateStr = '';
      const rawDate = row[autoMap['date']];
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split('T')[0];
      } else if (rawDate) {
        const parsedT = Date.parse(rawDate.toString().trim());
        if (!isNaN(parsedT)) {
          dateStr = new Date(parsedT).toISOString().split('T')[0];
        } else {
          dateStr = rawDate.toString().trim();
        }
      }
      if (!dateStr || dateStr === 'Invalid Date') {
        dateStr = new Date().toISOString().split('T')[0];
      }

      const team = autoMap['team'] ? row[autoMap['team']]?.toString()?.trim() || 'Unassigned' : 'Unassigned';

      const getNum = (key: string, backup: number) => {
        if (!autoMap[key]) return backup;
        const val = parseFloat(row[autoMap[key]]);
        return isNaN(val) ? backup : val;
      };

      const sales = autoMap['sales'] ? getNum('sales', 0) : 0;
      const bSales = autoMap['bSales'] ? getNum('bSales', 0) : 0;
      const target = autoMap['target'] ? getNum('target', Math.round(sales * 1.1 + 1)) : 10;
      
      let productivity = autoMap['productivity'] ? getNum('productivity', 80) : 80;
      if (productivity > 0 && productivity <= 1) productivity = Math.round(productivity * 100);

      const callsCount = autoMap['callsCount'] ? getNum('callsCount', Math.round(productivity * 0.8 + sales * 2)) : Math.round(productivity * 0.8 + sales * 2 || 35);

      const loginTime = autoMap['loginTime'] ? getNum('loginTime', 480) : 480;
      const auxTime = autoMap['auxTime'] ? getNum('auxTime', 60) : 60;
      const holdTime = autoMap['holdTime'] ? getNum('holdTime', Math.round(callsCount * 0.3)) : Math.round(callsCount * 0.3);
      const wrapTime = autoMap['wrapTime'] ? getNum('wrapTime', Math.round(callsCount * 0.7)) : Math.round(callsCount * 0.7);
      let talkTime = autoMap['talkTime'] ? getNum('talkTime', Math.round(callsCount * 2.3)) : Math.round(callsCount * 2.3);

      if (!autoMap['talkTime'] && (talkTime + wrapTime + holdTime + auxTime > loginTime - 15)) {
        talkTime = Math.max(10, loginTime - wrapTime - holdTime - auxTime - 15);
      }
      const idleTime = autoMap['idleTime'] ? getNum('idleTime', Math.max(5, loginTime - talkTime - wrapTime - holdTime - auxTime)) : Math.max(5, loginTime - talkTime - wrapTime - holdTime - auxTime);

      const occupied = talkTime + wrapTime + holdTime;
      const calcProd = Math.min(100, Math.round((occupied / Math.max(1, loginTime - auxTime)) * 100));
      const finalProd = autoMap['productivity'] ? productivity : calcProd;

      const salesRate = Math.min(100, (sales / Math.max(1, target)) * 100);
      const calcScore = Math.round((finalProd * 0.5) + (salesRate * 0.5));
      const finalScore = autoMap['performanceScore'] ? getNum('performanceScore', calcScore) : calcScore;

      const dispoSale = autoMap['dispoSale'] ? getNum('dispoSale', sales) : sales;
      const dispoCallback = autoMap['dispoCallback'] ? getNum('dispoCallback', Math.round(sales * 1.1)) : Math.round(sales * 1.1);
      const rem1 = Math.max(0, callsCount - dispoSale - dispoCallback);
      const dispoNotInterested = autoMap['dispoNotInterested'] ? getNum('dispoNotInterested', Math.round(rem1 * 0.5)) : Math.round(rem1 * 0.5);
      const rem2 = Math.max(0, rem1 - dispoNotInterested);
      const dispoBusy = autoMap['dispoBusy'] ? getNum('dispoBusy', Math.round(rem2 * 0.4)) : Math.round(rem2 * 0.4);
      const dispoNoAnswer = autoMap['dispoNoAnswer'] ? getNum('dispoNoAnswer', Math.max(0, rem2 - dispoBusy)) : Math.max(0, rem2 - dispoBusy);

      importedRecords.push({
        id: `auto-${Date.now()}-${idx}`,
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
    });

    return importedRecords;
  } catch (err) {
    console.error('[Auto-Import] Failed reading or parsing Excel:', err);
    return null;
  }
}

// Standard in-memory data store with disk persistence fallback
let serverStoreRecords: any[] = [];
try {
  const excelData = scanAndLoadExcel();
  if (excelData && excelData.length > 0) {
    serverStoreRecords = excelData;
    fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(serverStoreRecords, null, 2), 'utf-8');
    console.log(`[Auto-Import] Successfully synchronized ${serverStoreRecords.length} records dynamically from Excel file.`);
  } else if (fs.existsSync(PERSISTENT_FILE)) {
    const raw = fs.readFileSync(PERSISTENT_FILE, 'utf-8');
    serverStoreRecords = JSON.parse(raw);
    console.log(`Loaded ${serverStoreRecords.length} records safely from persistent storage.`);
  } else {
    serverStoreRecords = getInitialMockData();
    fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(serverStoreRecords, null, 2), 'utf-8');
    console.log(`Initialized persistent storage with ${serverStoreRecords.length} mock records.`);
  }
} catch (err) {
  console.error('Failed to load/initialize persistent file, utilizing in-memory fallback:', err);
  serverStoreRecords = getInitialMockData();
}

// In-memory caching with disk persistence for agent-specific coaching logs
let serverStoreNotes: Record<string, any[]> = {};
try {
  if (fs.existsSync(NOTES_FILE)) {
    const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
    serverStoreNotes = JSON.parse(raw);
    console.log(`Successfully loaded coaching logs from persistent notes storage.`);
  } else {
    // Populate with realistic base analytical findings
    serverStoreNotes = {
      'Sarah Jenkins': [
        { id: 'note-1', date: '2026-05-24', author: 'Administrator', text: 'Sarah has maintained a stellar punctuality record in the Retention campaign. In-queue metrics show her objection-rebuttals are extremely effective, converting 15% more leads than the cohort average.' }
      ],
      'Michael Chang': [
        { id: 'note-2', date: '2026-05-23', author: 'Administrator', text: 'Michael experienced a noticeable productivity and attendance dip during Week 3. In our review meeting, he mentioned internet hardware outages at his work-from-home setup. Replaced his dialer headset and provided a secondary LTE backup router to address stability issues.' }
      ],
      'David Miller': [
        { id: 'note-3', date: '2026-05-22', author: 'Administrator', text: 'David’s conversion rates are lagging. Needs coaching to prevent raw call numbers from dipping when answering tough rebuttals. We scheduled a 1-on-1 session next Tuesday to review his call evaluation recordings.' }
      ],
      'Elena Rostova': [
        { id: 'note-4', date: '2026-05-21', author: 'Administrator', text: 'Elena shows excellent consistency across Q2 Customer Care. Average ratings are stable. Suggested introducing her as lead mentor for incoming outbound trainees next month.' }
      ]
    };
    fs.writeFileSync(NOTES_FILE, JSON.stringify(serverStoreNotes, null, 2), 'utf-8');
  }
} catch (err) {
  console.error('Failed to load/initialize coaching notes storage:', err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // API Route: Get all performance records
  app.get('/api/performance', (req, res) => {
    try {
      res.json({
        success: true,
        records: serverStoreRecords,
        count: serverStoreRecords.length
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Upload performance records (replaces or appends)
  app.post('/api/performance/upload', (req, res) => {
    try {
      const { records, mode } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ success: false, error: 'Records must be an array' });
      }

      if (mode === 'replace') {
        serverStoreRecords = records;
      } else {
        // Mode is append
        serverStoreRecords = [...serverStoreRecords, ...records];
      }

      // Sync safely to disk
      fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(serverStoreRecords, null, 2), 'utf-8');

      res.json({
        success: true,
        message: `Successfully uploaded ${records.length} records.`,
        totalCount: serverStoreRecords.length
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Reset configuration
  app.post('/api/performance/reset', (req, res) => {
    try {
      serverStoreRecords = getInitialMockData();
      fs.writeFileSync(PERSISTENT_FILE, JSON.stringify(serverStoreRecords, null, 2), 'utf-8');
      res.json({ success: true, message: 'Database successfully reset to standard baseline mockup data.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Get coaching notes for an agent
  app.get('/api/agent-notes/:agentName', (req, res) => {
    try {
      const { agentName } = req.params;
      const notes = serverStoreNotes[agentName] || [];
      res.json({ success: true, notes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Add a coaching note for an agent
  app.post('/api/agent-notes/:agentName', (req, res) => {
    try {
      const { agentName } = req.params;
      const { author, text } = req.body;
      
      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, error: 'Note comments cannot be blank' });
      }

      if (!serverStoreNotes[agentName]) {
        serverStoreNotes[agentName] = [];
      }

      const newNote = {
        id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: new Date().toISOString().split('T')[0],
        author: author || 'System Log',
        text: text.trim()
      };

      serverStoreNotes[agentName].push(newNote);
      fs.writeFileSync(NOTES_FILE, JSON.stringify(serverStoreNotes, null, 2), 'utf-8');

      res.json({ success: true, note: newNote, notes: serverStoreNotes[agentName] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Get all coaching notes combined across all agents
  app.get('/api/agent-notes-all', (req, res) => {
    try {
      const allNotes: any[] = [];
      Object.keys(serverStoreNotes).forEach(agentName => {
        if (Array.isArray(serverStoreNotes[agentName])) {
          serverStoreNotes[agentName].forEach((note: any) => {
            allNotes.push({
              ...note,
              agentName
            });
          });
        }
      });
      // Sort chronologically (latest first)
      allNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      res.json({ success: true, notes: allNotes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started on port ${PORT}`);
  });
}

startServer();
