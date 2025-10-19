import { Injectable, inject, NgZone } from '@angular/core';
import { 
  Database, 
  ref, 
  set, 
  remove, 
  onValue, 
  update,
  push
} from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { ClockedTime } from '../models/bay-data';

export interface Bay {
  id: string;
  truck: string;
  startedAt: number;
  clockedTimes?: ClockedTime[];
}

@Injectable({
  providedIn: 'root'
})
export class BayService {
  private db = inject(Database);
  private ngZone = inject(NgZone);
  
  private readonly DB_ROOT = 'truck-loading';
  private readonly CLOCKED_TIMES_ROOT = 'clocked-times';
  private readonly NUM_BAYS = 7;
  private readonly WARNING_SECONDS = 45 * 60;
  private readonly OVERTIME_SECONDS = 60 * 60;

  private baysSubject = new BehaviorSubject<{ [key: string]: Bay }>({});
  public bays$ = this.baysSubject.asObservable();

  constructor() {
    this.initializeBays();
  }

  private initializeBays(): void {
    // Run the entire initialization inside ngZone
    this.ngZone.run(() => {
      for (let i = 1; i <= this.NUM_BAYS; i++) {
        const bayId = `bay${i}`;
        const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
          
        onValue(bayRef, (snapshot) => {
          // Ensure this runs in Angular zone for change detection
          this.ngZone.run(() => {
            const data = snapshot.val();
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
        }, (error) => {
          this.ngZone.run(() => {
            console.error(`Error listening to bay ${bayId}:`, error);
          });
        });
      }
    });
  }

  async startLoading(bayId: string, truckNo: string): Promise<void> {
    return this.ngZone.run(() => {
      const payload: Bay = {
        id: bayId,
        truck: truckNo,
        startedAt: Date.now()
      };
      
      const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
      return set(bayRef, payload);
    });
  }

  async resetBay(bayId: string): Promise<void> {
    return this.ngZone.run(() => {
      const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
      return remove(bayRef);
    });
  }

  async resetAllBays(): Promise<void[]> {
    return this.ngZone.run(() => {
      const promises: Promise<void>[] = [];
      for (let i = 1; i <= this.NUM_BAYS; i++) {
        promises.push(this.resetBay(`bay${i}`));
      }
      return Promise.all(promises);
    });
  }

  // Clock time - writes to separate collection with proper zone handling
  async clockTime(bayId: string): Promise<string> {
    return this.ngZone.run(async () => {
      try {
        const bay = this.baysSubject.value[bayId];
        if (!bay || !bay.startedAt) {
          throw new Error('Bay is not active');
        }

        const elapsedTime = this.calculateElapsedTime(bay.startedAt);
        const totalSeconds = this.calculateTotalSeconds(bay.startedAt);
        
        const clockedTime: ClockedTime = {
          id: `clocked_${Date.now()}`,
          elapsedTime: elapsedTime,
          clockedAt: Date.now(),
          truckNumber: bay.truck,
          bayId: bayId,
          bayNumber: bayId.replace('bay', ''),
          totalSeconds: totalSeconds,
          date: new Date().toISOString().split('T')[0]
        };

        // Write to separate collection
        const clockedTimeRef = push(ref(this.db, this.CLOCKED_TIMES_ROOT));
        const clockedTimeId = clockedTimeRef.key;
        
        if (!clockedTimeId) {
          throw new Error('Failed to generate clocked time ID');
        }

        await set(clockedTimeRef, clockedTime);

        // Also update the bay with the clocked time for quick access in UI
        const existingClockedTimes = bay.clockedTimes || [];
        const updatedClockedTimes = [...existingClockedTimes, {
          ...clockedTime,
          id: clockedTimeId
        }];

        const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
        await update(bayRef, {
          clockedTimes: updatedClockedTimes
        });

        console.log(`Time clocked for ${bayId}: ${elapsedTime} (ID: ${clockedTimeId})`);
        return clockedTimeId;
      } catch (error) {
        console.error('Error clocking time:', error);
        throw error;
      }
    });
  }

  // Helper method to update clocked times in bay node
  private async updateBayClockedTimes(bayId: string, clockedTime: ClockedTime): Promise<void> {
    return this.ngZone.run(async () => {
      const bay = this.baysSubject.value[bayId];
      const existingClockedTimes = bay?.clockedTimes || [];
      const updatedClockedTimes = [...existingClockedTimes, clockedTime];

      const bayRef = ref(this.db, `${this.DB_ROOT}/${bayId}`);
      await update(bayRef, {
        clockedTimes: updatedClockedTimes
      });
    });
  }

  // Get all clocked times from the separate collection with proper zone handling
  getAllClockedTimes(): Promise<ClockedTime[]> {
    return new Promise((resolve, reject) => {
      this.ngZone.run(() => {
        const clockedTimesRef = ref(this.db, this.CLOCKED_TIMES_ROOT);
        
        onValue(clockedTimesRef, (snapshot) => {
          this.ngZone.run(() => {
            try {
              const data = snapshot.val();
              if (data) {
                const clockedTimes: ClockedTime[] = Object.keys(data).map(key => ({
                  id: key,
                  ...data[key]
                }));
                resolve(clockedTimes);
              } else {
                resolve([]);
              }
            } catch (error) {
              reject(error);
            }
          });
        }, (error) => {
          this.ngZone.run(() => {
            reject(error);
          });
        }, { onlyOnce: true });
      });
    });
  }

  // Get clocked times for a specific bay from the separate collection
  getClockedTimesByBay(bayId: string): Promise<ClockedTime[]> {
    return new Promise((resolve, reject) => {
      this.ngZone.run(() => {
        const clockedTimesRef = ref(this.db, this.CLOCKED_TIMES_ROOT);
        
        onValue(clockedTimesRef, (snapshot) => {
          this.ngZone.run(() => {
            try {
              const data = snapshot.val();
              if (data) {
                const clockedTimes: ClockedTime[] = Object.keys(data)
                  .map(key => ({
                    id: key,
                    ...data[key]
                  }))
                  .filter(clockedTime => clockedTime.bayId === bayId)
                  .sort((a, b) => b.clockedAt - a.clockedAt);
                resolve(clockedTimes);
              } else {
                resolve([]);
              }
            } catch (error) {
              reject(error);
            }
          });
        }, (error) => {
          this.ngZone.run(() => {
            reject(error);
          });
        }, { onlyOnce: true });
      });
    });
  }

  // Get clocked times by date range
  getClockedTimesByDateRange(startDate: string, endDate: string): Promise<ClockedTime[]> {
    return new Promise((resolve, reject) => {
      this.ngZone.run(() => {
        const clockedTimesRef = ref(this.db, this.CLOCKED_TIMES_ROOT);
        
        onValue(clockedTimesRef, (snapshot) => {
          this.ngZone.run(() => {
            try {
              const data = snapshot.val();
              if (data) {
                const clockedTimes: ClockedTime[] = Object.keys(data)
                  .map(key => ({
                    id: key,
                    ...data[key]
                  }))
                  .filter(clockedTime => {
                    const clockedDate = clockedTime.date;
                    return clockedDate >= startDate && clockedDate <= endDate;
                  })
                  .sort((a, b) => b.clockedAt - a.clockedAt);
                resolve(clockedTimes);
              } else {
                resolve([]);
              }
            } catch (error) {
              reject(error);
            }
          });
        }, (error) => {
          this.ngZone.run(() => {
            reject(error);
          });
        }, { onlyOnce: true });
      });
    });
  }

  // Get clocked times by truck number
  getClockedTimesByTruck(truckNumber: string): Promise<ClockedTime[]> {
    return new Promise((resolve, reject) => {
      this.ngZone.run(() => {
        const clockedTimesRef = ref(this.db, this.CLOCKED_TIMES_ROOT);
        
        onValue(clockedTimesRef, (snapshot) => {
          this.ngZone.run(() => {
            try {
              const data = snapshot.val();
              if (data) {
                const clockedTimes: ClockedTime[] = Object.keys(data)
                  .map(key => ({
                    id: key,
                    ...data[key]
                  }))
                  .filter(clockedTime => clockedTime.truckNumber === truckNumber)
                  .sort((a, b) => b.clockedAt - a.clockedAt);
                resolve(clockedTimes);
              } else {
                resolve([]);
              }
            } catch (error) {
              reject(error);
            }
          });
        }, (error) => {
          this.ngZone.run(() => {
            reject(error);
          });
        }, { onlyOnce: true });
      });
    });
  }

  // Delete a specific clocked time
  async deleteClockedTime(clockedTimeId: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        const clockedTimeRef = ref(this.db, `${this.CLOCKED_TIMES_ROOT}/${clockedTimeId}`);
        await remove(clockedTimeRef);
      } catch (error) {
        console.error('Error deleting clocked time:', error);
        throw error;
      }
    });
  }

  // Get statistics for reporting
  async getClockedTimeStats(): Promise<{
    totalClockedTimes: number;
    averageTime: string;
    byBay: { [bayId: string]: number };
    byTruck: { [truckNumber: string]: number };
    byDate: { [date: string]: number };
  }> {
    return this.ngZone.run(async () => {
      try {
        const allClockedTimes = await this.getAllClockedTimes();
        
        const stats = {
          totalClockedTimes: allClockedTimes.length,
          averageTime: '00:00:00',
          byBay: {} as { [bayId: string]: number },
          byTruck: {} as { [truckNumber: string]: number },
          byDate: {} as { [date: string]: number }
        };

        if (allClockedTimes.length === 0) {
          return stats;
        }

        // Calculate average time
        const totalSeconds = allClockedTimes.reduce((sum, time) => sum + time.totalSeconds, 0);
        const averageSeconds = Math.floor(totalSeconds / allClockedTimes.length);
        stats.averageTime = this.secondsToHMS(averageSeconds);

        // Group by bay
        allClockedTimes.forEach(time => {
          stats.byBay[time.bayId] = (stats.byBay[time.bayId] || 0) + 1;
        });

        // Group by truck
        allClockedTimes.forEach(time => {
          stats.byTruck[time.truckNumber] = (stats.byTruck[time.truckNumber] || 0) + 1;
        });

        // Group by date
        allClockedTimes.forEach(time => {
          stats.byDate[time.date] = (stats.byDate[time.date] || 0) + 1;
        });

        return stats;
      } catch (error) {
        console.error('Error getting clocked time stats:', error);
        // Return empty stats instead of throwing
        return {
          totalClockedTimes: 0,
          averageTime: '00:00:00',
          byBay: {},
          byTruck: {},
          byDate: {}
        };
      }
    });
  }

  // Helper method: Calculate total seconds for easy sorting
  private calculateTotalSeconds(startedAt: number): number {
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  // Get clocked times for a specific bay (from local state for UI)
  getClockedTimes(bayId: string): ClockedTime[] {
    const bay = this.baysSubject.value[bayId];
    return bay?.clockedTimes || [];
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

  // New method: Clear all clocked times from the collection (for admin purposes)
  async clearAllClockedTimes(): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        const clockedTimesRef = ref(this.db, this.CLOCKED_TIMES_ROOT);
        await remove(clockedTimesRef);
        console.log('All clocked times cleared from collection');
      } catch (error) {
        console.error('Error clearing clocked times:', error);
        throw error;
      }
    });
  }

  // New method: Get clocked times count (for quick stats)
  async getClockedTimesCount(): Promise<number> {
    return this.ngZone.run(async () => {
      try {
        const allClockedTimes = await this.getAllClockedTimes();
        return allClockedTimes.length;
      } catch (error) {
        console.error('Error getting clocked times count:', error);
        return 0;
      }
    });
  }

  // New method: Get recent clocked times (last N entries)
  async getRecentClockedTimes(limit: number = 10): Promise<ClockedTime[]> {
    return this.ngZone.run(async () => {
      try {
        const allClockedTimes = await this.getAllClockedTimes();
        return allClockedTimes
          .sort((a, b) => b.clockedAt - a.clockedAt)
          .slice(0, limit);
      } catch (error) {
        console.error('Error getting recent clocked times:', error);
        return [];
      }
    });
  }

  // New method: Check if collection is accessible
  async isCollectionAccessible(): Promise<boolean> {
    return this.ngZone.run(async () => {
      try {
        const clockedTimesRef = ref(this.db, this.CLOCKED_TIMES_ROOT);
        return new Promise((resolve) => {
          onValue(clockedTimesRef, 
            () => resolve(true), 
            (error) => resolve(false), 
            { onlyOnce: true }
          );
        });
      } catch (error) {
        return false;
      }
    });
  }
}