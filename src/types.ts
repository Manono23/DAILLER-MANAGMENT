export interface AgentPerformanceRecord {
  id: string;
  agentName: string;
  date: string; // YYYY-MM-DD
  team: string;
  sales: number;
  bSales: number;
  productivity: number; // percentage (0 - 100) or hours/cases index
  target: number; // baseline units (e.g. sales threshold)
  performanceScore: number; // overall combined score (0 - 100)
  callsCount: number;

  // Call Dispositions tracking
  dispoSale: number;
  dispoNoAnswer: number;
  dispoBusy: number;
  dispoNotInterested: number;
  dispoCallback: number;

  // Time Management duration (in minutes)
  talkTime: number;
  wrapTime: number; // After Call Work (ACW)
  holdTime: number;
  idleTime: number; // Idle / Waiting for calls
  auxTime: number; // Break, lunch, training, or meeting time
  loginTime: number; // Total logged-in hours/minutes
}

export type PerformanceFilter = {
  startDate: string;
  endDate: string;
  team: string;
  agentName: string;
};

export interface AgentInsight {
  type: 'success' | 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  metric?: string;
  agentName?: string;
}

export interface MetricSummary {
  averageScore: number;
  totalSales: number;
  totalBSales: number;
  totalCalls: number;
  averageProductivity: number;
  targetAchievement: number; // percentage of target reached
  activeAgentsCount: number;
}

export interface UserSession {
  username: string;
  role: 'Administrator' | 'Team Leader' | 'Viewer';
  team?: string;
  isAuthenticated: boolean;
}

