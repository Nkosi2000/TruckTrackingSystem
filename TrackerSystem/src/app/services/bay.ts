import { Injectable, inject, NgZone } from '@angular/core';
import { 
  Database, 
  ref, 
  set, 
  remove, 
  onValue, 
} from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';

export interface Bay {
  id: string;
  truck: string;
  startedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class BayService {
  private db = inject(Database);
  private ngZone = inject(NgZone);
  
  private readonly DB_ROOT = 'truck-loading';
  private readonly NUM_BAYS = 7;
  private readonly WARNING_SECONDS = 45 * 60; // 45 min
  private readonly OVERTIME_SECONDS = 60 * 60; // 60 min

  private baysSubject = new BehaviorSubject<{ [key: string]: Bay }>({});
  public bays$ = this.baysSubject.asObservable();

  constructor() {
    this.initializeBays();
  }

  private initializeBays(): void {
  // Run Firebase operations inside NgZone to avoid the warning
  this.ngZone.runOutsideAngular(() => {
    for (let i = 1; i <= this.NUM_BAYS; i++) {
      const bayId = `bay${i}`;
      const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
        
      onValue(bayRef, (snapshot) => {
        const data = snapshot.val();
        // When we get data, run back in Angular zone for change detection
        this.ngZone.run(() => {
          const currentBays = this.baysSubject.value;
            
          if (data) {
            this.baysSubject.next({
              ...currentBays,
              [bayId]: data
            });
          } else {
            const { [bayId]: removed, ...remaining } = currentBays;
            this.baysSubject.next(remaining);
          }
        });
      });
    }
  });
}

  startLoading(bayId: string, truckNo: string): Promise<void> {
    const payload: Bay = {
      id: bayId,
      truck: truckNo,
      startedAt: Date.now()
    };
    
    const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
    return set(bayRef, payload);
  }

  resetBay(bayId: string): Promise<void> {
    const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
    return remove(bayRef);
  }

  resetAllBays(): Promise<void[]> {
    const promises: Promise<void>[] = [];
    for (let i = 1; i <= this.NUM_BAYS; i++) {
      promises.push(this.resetBay(`bay${i}`));
    }
    return Promise.all(promises);
  }

  calculateElapsedTime(startedAt: number): string {
    const now = Date.now();
    const elapsedSec = Math.floor((now - startedAt) / 1000);
    return this.secondsToHMS(elapsedSec);
  }

  getStatus(startedAt: number): { status: string, class: string } {
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    
    if (elapsedSec > this.OVERTIME_SECONDS) {
      return { status: 'Overtime', class: 'status-ot' };
    } else if (elapsedSec > this.WARNING_SECONDS) {
      return { status: 'Warning', class: 'status-warn' };
    } else if (startedAt) {
      return { status: 'On Track', class: 'status-on' };
    } else {
      return { status: 'Empty', class: 'bay-empty' };
    }
  }

  private secondsToHMS(totalSeconds: number): string {
    if (totalSeconds < 0) totalSeconds = 0;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }
}
