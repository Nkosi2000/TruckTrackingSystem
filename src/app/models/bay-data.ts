export interface Bay {
  id: string;
  truck: string;
  startedAt: number;
  clockedTimes?: ClockedTime[];
}

export interface DisplayBay extends Bay {
  elapsedTime: string;
  status: string;
  statusClass: string;
}

export interface ClockedTime {
  id: string;
  elapsedTime: string;
  clockedAt: number;
  truckNumber: string;
  bayId: string;
  bayNumber: string;
  totalSeconds: number;
  date: string;
}