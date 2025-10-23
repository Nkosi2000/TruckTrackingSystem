import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reporting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporting.html',
  styleUrls: ['./reporting.css']
})
export class Reporting {
  // Expose Object to template for Object.keys() usage
  public Object = Object;

  // Inputs - use non-signal types
  isLoading = input<boolean>(false);
  statsData = input<any>(null);
  showStats = input<boolean>(false);
  showAdvancedReports = input<boolean>(false);
  reportFilters = input<any>({});
  quickReportOptions = input<any[]>([]);
  
  // Outputs
  statsRequested = output<void>();
  exportRequested = output<void>();
  quickReportRequested = output<number>();
  advancedReportRequested = output<any>();
  statsToggled = output<void>();
  advancedReportsToggled = output<void>();

  localFilters = {
    dateFrom: this.getTodayDate(),
    dateTo: this.getTodayDate(),
    bayId: '',
    truckNumber: ''
  };

  // Helper method for bay options in template
  getBayOptions(): { value: string, label: string }[] {
    return [
      { value: 'bay1', label: 'Bay 1' },
      { value: 'bay2', label: 'Bay 2' },
      { value: 'bay3', label: 'Bay 3' },
      { value: 'bay4', label: 'Bay 4' },
      { value: 'bay5', label: 'Bay 5' },
      { value: 'bay6', label: 'Bay 6' },
      { value: 'bay7', label: 'Bay 7' }
    ];
  }

  onStatsRequest(): void {
    this.statsRequested.emit();
  }

  onExport(): void {
    this.exportRequested.emit();
  }

  onQuickReport(days: number): void {
    this.quickReportRequested.emit(days);
  }

  onAdvancedReport(): void {
    this.advancedReportRequested.emit(this.localFilters);
  }

  onToggleStats(): void {
    this.statsToggled.emit();
  }

  onToggleAdvancedReports(): void {
    this.advancedReportsToggled.emit();
  }

  onResetFilters(): void {
    this.localFilters = {
      dateFrom: this.getTodayDate(),
      dateTo: this.getTodayDate(),
      bayId: '',
      truckNumber: ''
    };
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}