export interface BayData {
  id: string;
  truck?: string;
  startedAt?: number;
  elapsedTime?: string;
  status?: 'empty' | 'on-track' | 'warning' | 'overtime';
  clockedTimes?: ClockedTime[];
}

export interface ClockedTime {
  id: string;
  elapsedTime: string; // Format: "HH:MM:SS"
  clockedAt: number; // Timestamp
  truckNumber: string;
  bayId: string;
  bayNumber: string;
  totalSeconds: number; // For easy sorting/calculation
  date: string; // Format: "YYYY-MM-DD" for easy querying
}