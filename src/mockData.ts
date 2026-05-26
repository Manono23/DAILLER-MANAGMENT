import { AgentPerformanceRecord, UserSession } from './types';

export const TEAMS = ['Sales Alpha', 'Outbound Beta', 'Customer Success', 'Tech Escalations'];

// Helper to generate a date range
function generateDateRange(daysBack: number): string[] {
  const dates: string[] = [];
  const start = new Date('2026-04-26'); // Approx 30 days before May 26, 2026
  for (let i = 0; i < daysBack; i++) {
    const nextDate = new Date(start);
    nextDate.setDate(start.getDate() + i);
    dates.push(nextDate.toISOString().split('T')[0]);
  }
  return dates;
}

export const MOCK_USERS: UserSession[] = [
  { username: 'admin', role: 'Administrator', isAuthenticated: true },
  { username: 'manager', role: 'Team Leader', team: 'Sales Alpha', isAuthenticated: true },
  { username: 'success_lead', role: 'Team Leader', team: 'Customer Success', isAuthenticated: true }
];

export function getInitialMockData(): AgentPerformanceRecord[] {
  return [];
}

export function getDemoAgentsData(): AgentPerformanceRecord[] {
  const dates = generateDateRange(30);
  const records: AgentPerformanceRecord[] = [];

  const agents = [
    {
      name: 'Sarah Jenkins',
      team: 'Sales Alpha',
      baseSales: 12,
      baseScore: 92,
      baseProd: 88,
      trend: 'improving' // performance improving
    },
    {
      name: 'Michael Chang',
      team: 'Sales Alpha',
      baseSales: 8,
      baseScore: 82,
      baseProd: 80,
      trend: 'sudden_drop' // Drop in productivity around day 20-25
    },
    {
      name: 'David Miller',
      team: 'Outbound Beta',
      baseSales: 4,
      baseScore: 58,
      baseProd: 55,
      trend: 'declining' // stable underperformer
    },
    {
      name: 'Elena Rostova',
      team: 'Customer Success',
      baseSales: 9,
      baseScore: 85,
      baseProd: 85,
      trend: 'consistent' // Extremely consistent
    },
    {
      name: 'Marcus Vance',
      team: 'Tech Escalations',
      baseSales: 6,
      baseScore: 65,
      baseProd: 70,
      trend: 'rising' // Progressively getting higher everyday
    },
    {
      name: 'Amina Yusuf',
      team: 'Customer Success',
      baseSales: 14,
      baseScore: 94,
      baseProd: 90,
      trend: 'consistent'
    },
    {
      name: 'Chloe Lebon',
      team: 'Outbound Beta',
      baseSales: 10,
      baseScore: 78,
      baseProd: 76,
      trend: 'unstable' // High success but random drops affecting scores
    },
    {
      name: 'Ryan Gallagher',
      team: 'Tech Escalations',
      baseSales: 7,
      baseScore: 74,
      baseProd: 75,
      trend: 'consistent'
    }
  ];

  let idCounter = 1;

  dates.forEach((date, dateIndex) => {
    // Determine day of week
    const d = new Date(date);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const isWeekend = dayName === 'Sat' || dayName === 'Sun';

    agents.forEach((agent) => {
      // Skip or scale down values on weekends slightly
      const seed = Math.sin(dateIndex * 5 + agent.name.charCodeAt(0)) * 10;
      const isOff = isWeekend && (seed > 0);
      if (isOff) return;

      // Calculate productivity & sales based on trend & date index
      let salesScale = 1;

      if (agent.trend === 'rising') {
        salesScale = 0.75 + (dateIndex / 30) * 0.55;
      } else if (agent.trend === 'sudden_drop') {
        if (dateIndex >= 18 && dateIndex <= 24) {
          salesScale = 0.45;
        } else if (dateIndex > 24) {
          salesScale = 0.85; // slightly lower recovery
        }
      } else if (agent.trend === 'declining') {
        salesScale = 1.0 - (dateIndex / 30) * 0.35;
      } else if (agent.trend === 'improving') {
        salesScale = 0.9 + (dateIndex / 30) * 0.3;
      } else if (agent.trend === 'unstable') {
        const dropSeed = Math.abs(seed) % 100;
        if (dropSeed < 30) {
          salesScale = 0.5;
        }
      }

      const dailyVariance = (Math.sin(dateIndex * 1.5 + agent.name.length) * 1.5); // some noise
      const target = Math.round((agent.baseSales * 1.2)); // Target is slightly above baseline

      let sales = Math.round(Math.max(0, agent.baseSales * salesScale + dailyVariance));
      let bSales = Math.round(sales * 0.45 + (Math.abs(seed) % 3));
      let productivity = Math.round(Math.max(20, Math.min(100, agent.baseProd * salesScale + dailyVariance * 4)));
      
      // Calculate Overall score as: 50% productivity + 50% target attainment (capped at 100%)
      const targetAttainment = Math.min(100, (sales / Math.max(1, target)) * 100);
      let performanceScore = Math.round(productivity * 0.5 + targetAttainment * 0.5);
      performanceScore = Math.max(10, Math.min(100, performanceScore));

      const callsCount = Math.max(15, Math.round(productivity * 0.8 + (sales * 4) + dailyVariance * 2));

      // 1. Core Call Dispositions formulation
      const dispoSale = sales;
      const dispoCallback = Math.round(sales * (0.8 + Math.abs(seed % 5) * 0.15));
      const remainingCalls1 = Math.max(0, callsCount - dispoSale - dispoCallback);
      const dispoNotInterested = Math.round(remainingCalls1 * 0.5);
      const remainingCalls2 = Math.max(0, remainingCalls1 - dispoNotInterested);
      const dispoBusy = Math.round(remainingCalls2 * 0.4);
      const dispoNoAnswer = Math.max(0, remainingCalls2 - dispoBusy);

      // 2. Core Time Management allocation (must sum up closely to logintime)
      const loginTime = 480 + Math.round(dailyVariance * 8); // ~8 hours (480 mins)
      const auxTime = 45 + Math.round(Math.abs(seed % 3) * 10); // break / lunch / training (~45-75 mins)
      const holdTime = Math.round(callsCount * (0.15 + Math.abs(seed % 3) * 0.08)); // shorter duration (~5-20 mins)
      const wrapTime = Math.round(callsCount * (0.6 + Math.abs(seed % 2) * 0.25)); // aftermath call documentation (~15-50 mins)
      
      // Talk duration modeled based on call counts
      let talkTime = Math.round(callsCount * (2.1 + Math.sin(dateIndex * 0.4) * 0.3));
      
      // Verify times fit within the loginTime envelope
      if (talkTime + wrapTime + holdTime + auxTime > loginTime - 15) {
        talkTime = Math.max(10, loginTime - wrapTime - holdTime - auxTime - 15);
      }
      const idleTime = Math.max(5, loginTime - talkTime - wrapTime - holdTime - auxTime);

      records.push({
        id: `rec-${idCounter++}`,
        agentName: agent.name,
        date,
        team: agent.team,
        sales,
        bSales,
        productivity,
        target,
        performanceScore,
        callsCount,
        
        // Dispositions
        dispoSale,
        dispoNoAnswer,
        dispoBusy,
        dispoNotInterested,
        dispoCallback,

        // Time Metrics
        talkTime,
        wrapTime,
        holdTime,
        idleTime,
        auxTime,
        loginTime
      });
    });
  });

  return records;
}
