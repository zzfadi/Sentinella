export enum MonitoringTier {
  OFF = 'OFF',
  WATCHDOG = 'WATCHDOG', // Tier 1: Low power, motion only
  ANALYZER = 'ANALYZER', // Tier 2: Frequent AI checks, posture analysis
  EXPERT = 'EXPERT'      // Tier 3: Deep analysis, high latency
}

export enum RiskLevel {
  SAFE = 'SAFE',
  CAUTION = 'CAUTION',
  DANGER = 'DANGER'
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  tier: MonitoringTier;
  message: string;
  riskLevel: RiskLevel;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  posture: string;
  faceVisible: boolean;
  notes: string;
}

export interface SystemStatus {
  tier: MonitoringTier;
  fps: number;
  activityScore: number; // 0-100
  lastAnalysis: Date | null;
}