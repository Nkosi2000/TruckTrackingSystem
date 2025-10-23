import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClockedTime, DisplayBay } from '../../models/bay-data';
import { BayService } from '../../services/bay';

@Component({
  selector: 'app-bay-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bay-grid.html',
  styleUrls: ['./bay-grid.css']
})
export class BayGrid {
  private bayService = inject(BayService);

  // Inputs
  bays = input<DisplayBay[]>([]);
  numBays = input(0);
  isLoading = input(false);
  showStats = input(false);
  statsData = input<any>(null);
  activeBaysCount = input(0);
  completedTodayCount = input(0);
  bayOptions = input<{value: string, label: string}[]>([]);
  
  // Outputs
  themeToggled = output<void>();
  statsRequested = output<void>();
  statsClosed = output<void>();
  exportDataRequested = output<void>();
  exportStatusRequested = output<void>();
  allBaysReset = output<void>();
  bayStarted = output<{bayId: string, truckNo: string}>();
  bayReset = output<string>();
  timeClocked = output<string>();

  truckInputs: { [key: string]: string } = {};

  // Template helper methods
  getBayNumber(bayId: string): string {
    return bayId.replace('bay', '');
  }

  getInputPlaceholder(status: string): string {
    return status === 'Available' ? 'Enter Truck No (e.g. T001)' : 'Truck is loading...';
  }

  trackByBayId(index: number, item: any): string {
    return item.id;
  }

  formatStartTime(startedAt: number): string {
    return startedAt ? new Date(startedAt).toLocaleTimeString() : '—';
  }

  getClockedTimes(bayId: string): ClockedTime[] {
    return this.bayService.getClockedTimes(bayId);
  }

  formatClockedTime(clockedAt: number): string {
    return new Date(clockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  hasClockedTimes(bayId: string): boolean {
    return this.getClockedTimes(bayId).length > 0;
  }

  getStatusColor(statusClass: string): string {
    const colors: { [key: string]: string } = {
      'empty': '#6B7280',
      'status-on': '#10B981',
      'status-warn': '#F59E0B',
      'status-ot': '#EF4444'
    };
    return colors[statusClass] || '#6B7280';
  }

  // FIXED: Add helper methods for stats display
  hasBayStats(): boolean {
    const byBay = this.statsData()?.byBay;
    if (!byBay) return false;
    
    // Check if any bay has a count > 0
    return this.bayOptions().some(bay => byBay[bay.value] > 0);
  }

  getBayStatCount(bayId: string): number {
    return this.statsData()?.byBay?.[bayId] || 0;
  }

  // Bay operations
  startLoading(bayId: string): void {
    const truckNo = this.truckInputs[bayId]?.trim();
    if (truckNo) {
      this.bayStarted.emit({ bayId, truckNo });
      this.truckInputs[bayId] = '';
    }
  }

  resetBay(bayId: string): void {
    this.bayReset.emit(bayId);
  }

  onClockTime(bayId: string): void {
    this.timeClocked.emit(bayId);
  }

  onThemeToggle(): void {
    this.themeToggled.emit();
  }

  onStatsRequest(): void {
    this.statsRequested.emit();
  }

  onStatsClose(): void {
    this.statsClosed.emit();
  }

  onExportData(): void {
    this.exportDataRequested.emit();
  }

  onExportStatus(): void {
    this.exportStatusRequested.emit();
  }

  onResetAllBays(): void {
    this.allBaysReset.emit();
  }
}