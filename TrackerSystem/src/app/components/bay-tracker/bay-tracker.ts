import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BayService, Bay } from '../../services/bay';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-bay-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bay-tracker.html',
  styleUrls: ['./bay-tracker.css']
})
export class BayTracker implements OnInit, OnDestroy {
  private bayService = inject(BayService);
  private timerSubscription?: Subscription;
  private dataSubscription?: Subscription;
  
  readonly NUM_BAYS = 7;
  bays: { [key: string]: Bay & { elapsedTime: string, status: string, statusClass: string } } = {};
  truckInputs: { [key: string]: string } = {};
  isDarkMode = false;
  currentYear = new Date().getFullYear();

    toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode.toString());
  }

  ngOnInit(): void {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'true') {
      this.isDarkMode = true;
      
    }

    // Subscribe to bay data changes
    this.dataSubscription = this.bayService.bays$.subscribe(baysData => {
      this.updateBaysDisplay(baysData);
    });

    // Update timers every second
    this.timerSubscription = interval(1000).subscribe(() => {
      this.updateTimers();
    });
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  private updateBaysDisplay(baysData: { [key: string]: Bay }): void {
    for (let i = 1; i <= this.NUM_BAYS; i++) {
      const bayId = `bay${i}`;
      const bayData = baysData[bayId];
      
      if (bayData) {
        const statusInfo = this.bayService.getStatus(bayData.startedAt);
        this.bays[bayId] = {
          ...bayData,
          elapsedTime: this.bayService.calculateElapsedTime(bayData.startedAt),
          status: statusInfo.status,
          statusClass: statusInfo['class']
        };
      } else {
        this.bays[bayId] = {
          id: bayId,
          truck: '',
          startedAt: 0,
          elapsedTime: '00:00:00',
          status: 'Available',
          statusClass: 'empty'
        };
      }
    }
  }

  private updateTimers(): void {
    Object.keys(this.bays).forEach(bayId => {
      const bay = this.bays[bayId];
      if (bay.startedAt) {
        bay.elapsedTime = this.bayService.calculateElapsedTime(bay.startedAt);
        const statusInfo = this.bayService.getStatus(bay.startedAt);
        bay.status = statusInfo.status;
        bay.statusClass = statusInfo['class'];
      }
    });
  }

  // Helper methods for template
  getBaysArray(): any[] {
    return Object.values(this.bays);
  }

  getBayNumber(bayId: string): string {
    return bayId.replace('bay', '');
  }

  getActiveBaysCount(): number {
    return Object.values(this.bays).filter(bay => bay.startedAt > 0).length;
  }

  getCompletedTodayCount(): number {
    // You can implement this based on your service logic
    // For now, returning a placeholder
    return 0;
  }

  getInputPlaceholder(status: string): string {
    return status === 'Available' ? 'Enter Truck No (e.g. T001)' : 'Truck is loading...';
  }

  startLoading(bayId: string): void {
    const truckNo = this.truckInputs[bayId]?.trim();
    if (!truckNo) {
      alert('Please enter Truck No');
      return;
    }
    
    this.bayService.startLoading(bayId, truckNo).catch(error => {
      console.error('Error starting loading:', error);
      alert('Failed to start loading. Please try again.');
    });
    
    this.truckInputs[bayId] = '';
  }

  resetBay(bayId: string): void {
    if (confirm('Reset this bay? This will clear the truck and timer for everyone.')) {
      this.bayService.resetBay(bayId).catch(error => {
        console.error('Error resetting bay:', error);
      });
    }
  }

  resetAllBays(): void {
    if (confirm('Clear all bays? This will remove all ongoing loads for everyone.')) {
      this.bayService.resetAllBays().catch(error => {
        console.error('Error resetting all bays:', error);
      });
    }
  }

  formatStartTime(startedAt: number): string {
    return startedAt ? new Date(startedAt).toLocaleTimeString() : '—';
  }

  trackByBayId(index: number, item: any): string {
    return item.id;
  }
}