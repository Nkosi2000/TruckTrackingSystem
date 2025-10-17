export interface BayData {
  id: string;
  truck?: string;
  startedAt?: number;
  elapsedTime?: string;
  status?: 'empty' | 'on-track' | 'warning' | 'overtime';
}
