import { Component, inject, OnInit, OnDestroy, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BayService } from '../../services/bay';
import { Bay, ClockedTime, DisplayBay } from '../../models/bay-data';
import { Subscription, interval } from 'rxjs';
import * as XLSX from 'xlsx';

// Import modular components
import { Header } from '../header/header';
import { Hero } from '../hero/hero';
import { BayGrid } from '../bay-grid/bay-grid';
import { Reporting } from '../reporting/reporting';
import { QuickActions } from '../quick-actions/quick-actions';
import { InfoSection } from '../info-section/info-section';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-bay-tracker',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    Header,
    Hero,
    BayGrid,
    Reporting,
    QuickActions,
    InfoSection,
    Footer
  ],
  templateUrl: './bay-tracker.html',
  styleUrls: ['./bay-tracker.css']
})
export class BayTracker implements OnInit, OnDestroy {
  private bayService = inject(BayService);
  private timerSubscription?: Subscription;
  private dataSubscription?: Subscription;
  
  readonly NUM_BAYS = 7;
  
  // State signals
  bays = signal<DisplayBay[]>([]);
  isDarkMode = signal(false);
  isMobileMenuOpen = signal(false);
  currentYear = new Date().getFullYear();

  // UI state
  showStats = signal(false);
  statsData = signal<any>(null);
  showAdvancedReports = signal(false);
  showCollectionStatus = signal(false);
  showRecentTimes = signal(false);
  collectionAccessible = signal(true);
  isLoading = signal(false);
  
  // Data
  recentClockedTimes = signal<ClockedTime[]>([]);
  
  reportFilters = signal({
    dateFrom: this.getTodayDate(),
    dateTo: this.getTodayDate(),
    bayId: '',
    truckNumber: ''
  });

  quickReportOptions = signal([
    { label: 'Today', days: 0 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 }
  ]);

  // FIXED: Added computed signals for counts
  activeBaysCount = computed(() => {
    return this.bays().filter(bay => bay.startedAt > 0).length;
  });

  completedTodayCount = computed(() => {
    // You'll need to implement this based on your actual completed bays logic
    return 0; // Placeholder
  });

  bayOptions = computed(() => {
    return Array.from({ length: this.NUM_BAYS }, (_, i) => ({
      value: `bay${i + 1}`,
      label: `Bay ${i + 1}`
    }));
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.isMobileMenuOpen() && !target.closest('nav') && !target.closest('.mobile-menu-toggle')) {
      this.closeMobileMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isMobileMenuOpen()) {
      this.closeMobileMenu();
    }
    if (this.showStats()) {
      this.showStats.set(false);
    }
    if (this.showAdvancedReports()) {
      this.showAdvancedReports.set(false);
    }
  }

  ngOnInit(): void {
    console.log('🏁 BayTracker: ngOnInit started');
    this.initializeApp();

    // // comprehensive testing
    // setTimeout(() => {
    //   this.runComprehensiveTests();
    // }, 3000);
  }

  // private async runComprehensiveTests(): Promise<void> {
  //   console.log('🧪 BayTracker: Running comprehensive tests...');
    
  //   // Test 1: Check service state
  //   console.log('🧪 Test 1 - Service State:', this.bayService.getCurrentState());
    
  //   // Test 2: Check Firebase connection
  //   const firebaseConnected = await this.bayService.testFirebaseConnection();
  //   console.log('🧪 Test 2 - Firebase Connection:', firebaseConnected);
    
  //   // Test 3: Check current bays data
  //   console.log('🧪 Test 3 - Current Bays Signal:', this.bays());
  //   console.log('🧪 Test 3 - Bays Array Length:', this.bays().length);
    
  //   // Test 4: Manually test creating a bay
  //   const testBay = this.bayService.createDefaultDisplayBay('testBay1');
  //   console.log('🧪 Test 4 - Test Bay Creation:', testBay);
    
  //   // Test 5: Check if we can start a bay
  //   console.log('🧪 Test 5 - Testing bay start capability...');
    
  //   console.log('🧪 BayTracker: Comprehensive tests completed');
  // }

  private async initializeApp(): Promise<void> {
  console.log('🏁 BayTracker: initializeApp started');
  
  const savedTheme = localStorage.getItem('darkMode');
  if (savedTheme === 'true') {
    this.isDarkMode.set(true);
  }

  console.log('🏁 BayTracker: Checking collection access...');
  await this.checkCollectionAccess();

  console.log('🏁 BayTracker: Subscribing to bay data...');
  this.dataSubscription = this.bayService.bays$.subscribe({
    next: (baysData) => {
      console.log('🏁 BayTracker: bays$ emitted data:', baysData);
      console.log('🏁 BayTracker: baysData keys:', Object.keys(baysData));
      console.log('🏁 BayTracker: baysData values:', Object.values(baysData));
      this.updateBaysDisplay(baysData);
    },
    error: (error) => {
      console.error('🏁 BayTracker: Error in bays$ subscription:', error);
    },
    complete: () => {
      console.log('🏁 BayTracker: bays$ subscription completed');
    }
  });

  console.log('🏁 BayTracker: Starting timer...');
  this.timerSubscription = interval(1000).subscribe(() => {
    this.updateTimers();
  });

  console.log('🏁 BayTracker: Loading recent clocked times...');
  await this.loadRecentClockedTimes();
  
  console.log('🏁 BayTracker: App initialization complete');
}

  ngOnDestroy(): void {
    console.log('🏁 BayTracker: ngOnDestroy');
    this.timerSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  // FIXED: Update to work with array instead of object
  private updateBaysDisplay(baysData: { [key: string]: Bay }): void {

    console.log('🏁 BayTracker: updateBaysDisplay called with:', baysData);

    const baysArray: DisplayBay[] = [];
    
    for (let i = 1; i <= this.NUM_BAYS; i++) {
      const bayId = `bay${i}`;
      const bayData = baysData[bayId];
      
      if (bayData) {
        console.log(`🏁 BayTracker: Processing bay ${bayId} with data:`, bayData);
        baysArray.push(this.bayService.createDisplayBay(bayData));
      } else {
        console.log(`🏁 BayTracker: Creating default bay ${bayId}`);
        baysArray.push(this.bayService.createDefaultDisplayBay(bayId));
      }
    }

    console.log('🏁 BayTracker: Final bays array:', baysArray);
    this.bays.set(baysArray);
  }

  // FIXED: Update to work with array
  private updateTimers(): void {
    const updatedBays = this.bays().map(bay => {
      if (bay.startedAt) {
        const elapsedTime = this.bayService.calculateElapsedTime(bay.startedAt);
        const statusInfo = this.bayService.getStatus(bay.startedAt);
        return {
          ...bay,
          elapsedTime,
          status: statusInfo.status,
          statusClass: statusInfo.class
        };
      }
      return bay;
    });
    
    this.bays.set(updatedBays);
  }

  // FIXED: Add event handler methods for BayGrid outputs
  onThemeToggle(): void {
    this.toggleDarkMode();
  }

  onStatsRequest(): void {
    this.getClockedTimeStats();
  }

  onStatsClose(): void {
    this.showStats.set(false);
  }

  onExportData(): void {
    this.exportClockedTimes();
  }

  onExportStatus(): void {
    this.exportCurrentStatus();
  }

  onResetAllBays(): void {
    this.resetAllBays();
  }

  onBayStarted(event: { bayId: string, truckNo: string }): void {
    this.startLoading(event.bayId, event.truckNo);
  }

  onBayReset(bayId: string): void {
    this.resetBay(bayId);
  }

  onTimeClocked(bayId: string): void {
    this.clockTime(bayId);
  }

  // method to test the subscription
  testSubscription(): void {
    console.log('🧪 BayTracker: Testing subscription...');
    console.log('🧪 Current bays signal:', this.bays());
    console.log('🧪 Bays array length:', this.bays().length);
    
    // Manually trigger an update to see if the subscription is working
    this.bayService.bays$.subscribe(data => {
      console.log('🧪 Manual subscription test - data:', data);
    }).unsubscribe();
  }

  // Service wrapper methods
  async startLoading(bayId: string, truckNo: string): Promise<void> {
    try {
      await this.bayService.startLoading(bayId, truckNo);
    } catch (error) {
      console.error('Error starting loading:', error);
      alert('Failed to start loading. Please try again.');
    }
  }

  async resetBay(bayId: string): Promise<void> {
    if (confirm('Reset this bay? This will clear the truck and timer for everyone.')) {
      try {
        await this.bayService.resetBay(bayId);
      } catch (error) {
        console.error('Error resetting bay:', error);
        alert('Failed to reset bay. Please try again.');
      }
    }
  }

  async resetAllBays(): Promise<void> {
    if (confirm('Clear all bays? This will remove all ongoing loads for everyone.')) {
      try {
        await this.bayService.resetAllBays();
      } catch (error) {
        console.error('Error resetting all bays:', error);
        alert('Failed to reset all bays. Please try again.');
      }
    }
  }

  async clockTime(bayId: string): Promise<void> {
    const bay = this.bays().find(b => b.id === bayId);
    if (!bay?.startedAt) {
      alert('Cannot clock time - bay is not active');
      return;
    }

    if (confirm('Clock in current time for this bay?')) {
      this.isLoading.set(true);
      try {
        await this.bayService.clockTime(bayId);
        await this.loadRecentClockedTimes();
        this.showTemporaryMessage('Time clocked successfully!', 'success');
      } catch (error: any) {
        console.error('Error clocking time:', error);
        if (error.message?.includes('PERMISSION_DENIED') || error.code === 'PERMISSION_DENIED') {
          alert('Permission denied. Please check Firebase database rules.');
        } else {
          alert('Failed to clock time. Please try again.');
        }
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async getClockedTimeStats(): Promise<void> {
    this.isLoading.set(true);
    try {
      const stats = await this.bayService.getClockedTimeStats();
      this.statsData.set(stats);
      this.showStats.set(true);
    } catch (error) {
      console.error('Error getting stats:', error);
      this.showTemporaryMessage('Failed to load statistics', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportClockedTimes(): Promise<void> {
    this.isLoading.set(true);
    try {
      const allClockedTimes = await this.bayService.getAllClockedTimes();
      if (allClockedTimes.length === 0) {
        this.showTemporaryMessage('No clocked times data available to export', 'warning');
        return;
      }
      await this.exportToExcel(allClockedTimes, 'clocked-times-full-export');
      this.showTemporaryMessage('Excel file exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting clocked times:', error);
      this.showTemporaryMessage('Failed to export data', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async runAdvancedReport(filters: any): Promise<void> {
    this.isLoading.set(true);
    try {
      let clockedTimes = await this.bayService.getClockedTimesByDateRange(
        filters.dateFrom, 
        filters.dateTo
      );
      
      if (filters.bayId) {
        clockedTimes = clockedTimes.filter(time => time.bayId === filters.bayId);
      }
      if (filters.truckNumber) {
        clockedTimes = clockedTimes.filter(time => 
          time.truckNumber.toLowerCase().includes(filters.truckNumber.toLowerCase())
        );
      }
      
      if (clockedTimes.length === 0) {
        this.showTemporaryMessage('No data found for the selected filters', 'warning');
        return;
      }
      
      const filename = `advanced-report-${filters.dateFrom}-to-${filters.dateTo}`;
      await this.exportToExcel(clockedTimes, filename);
      this.showTemporaryMessage('Excel report generated successfully!', 'success');
    } catch (error) {
      console.error('Error running advanced report:', error);
      this.showTemporaryMessage('Failed to generate report', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async runQuickReport(days: number): Promise<void> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateDaysAgo(days);
    
    const filters = {
      dateFrom: startDate,
      dateTo: endDate,
      bayId: '',
      truckNumber: ''
    };
    
    await this.runAdvancedReport(filters);
  }

  async exportCurrentStatus(): Promise<void> {
    this.isLoading.set(true);
    try {
      const activeBays = this.getBaysArray().filter(bay => bay.startedAt > 0);
      
      if (activeBays.length === 0) {
        this.showTemporaryMessage('No active bays to export', 'warning');
        return;
      }

      const statusData = activeBays.map(bay => ({
        'Bay ID': bay.id,
        'Bay Number': this.getBayNumber(bay.id),
        'Truck Number': bay.truck,
        'Start Time': this.formatStartTime(bay.startedAt),
        'Elapsed Time': bay.elapsedTime,
        'Status': bay.status,
        'Last Updated': new Date().toLocaleString()
      }));

      await this.exportStatusToExcel(statusData, 'current-bay-status');
      this.showTemporaryMessage('Current status exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting current status:', error);
      this.showTemporaryMessage('Failed to export current status', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Utility methods
  getBaysArray(): DisplayBay[] {
    return this.bays();
  }

  getBayNumber(bayId: string): string {
    return bayId.replace('bay', '');
  }

  getActiveBaysCount(): number {
    return this.activeBaysCount();
  }

  getCompletedTodayCount(): number {
    return this.completedTodayCount();
  }

  getBayOptions(): { value: string, label: string }[] {
    return this.bayOptions();
  }

  formatStartTime(startedAt: number): string {
    return startedAt ? new Date(startedAt).toLocaleTimeString() : '—';
  }


  // UI methods
  toggleDarkMode(): void {
    this.isDarkMode.set(!this.isDarkMode());
    localStorage.setItem('darkMode', this.isDarkMode().toString());
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  onNavLinkClick(): void {
    this.closeMobileMenu();
  }

  toggleAdvancedReports(): void {
    this.showAdvancedReports.set(!this.showAdvancedReports());
    if (this.showAdvancedReports()) {
      this.reportFilters.set({
        dateFrom: this.getTodayDate(),
        dateTo: this.getTodayDate(),
        bayId: '',
        truckNumber: ''
      });
    }
  }

  toggleRecentTimes(): void {
    this.showRecentTimes.set(!this.showRecentTimes());
    if (this.showRecentTimes()) {
      this.loadRecentClockedTimes();
    }
  }

  toggleCollectionStatus(): void {
    this.showCollectionStatus.set(!this.showCollectionStatus());
    if (this.showCollectionStatus()) {
      this.checkCollectionAccess();
    }
  }

  // Service methods
  async checkCollectionAccess(): Promise<void> {
    try {
      const accessible = await this.bayService.isCollectionAccessible();
      this.collectionAccessible.set(accessible);
    } catch (error) {
      console.error('Error checking collection access:', error);
      this.collectionAccessible.set(false);
    }
  }

  async loadRecentClockedTimes(): Promise<void> {
    try {
      const times = await this.bayService.getRecentClockedTimes(5);
      this.recentClockedTimes.set(times);
    } catch (error) {
      console.error('Error loading recent clocked times:', error);
      this.recentClockedTimes.set([]);
    }
  }

  // Private helper methods
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  private showTemporaryMessage(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    console.log(`${type.toUpperCase()}: ${message}`);
    if (type === 'error') {
      alert(message);
    }
  }

  private async exportToExcel(data: any[], baseFilename: string): Promise<void> {
    // Prepare data for Excel
    const excelData = this.prepareExcelData(data);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Main data worksheet
    const wsData = XLSX.utils.json_to_sheet(excelData.formattedData, { header: excelData.headers });
    
    // Apply styling to the worksheet
    this.applyExcelFormatting(wsData, excelData.headers);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, wsData, 'Clocked Times');
    
    // Create summary worksheet
    const summaryData = this.generateSummaryData(data);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Create bay statistics worksheet
    const bayStatsData = this.generateBayStatistics(data);
    const wsBayStats = XLSX.utils.json_to_sheet(bayStatsData);
    XLSX.utils.book_append_sheet(wb, wsBayStats, 'Bay Statistics');
    
    // Generate Excel file and download
    const filename = `${baseFilename}-${this.getTodayDate()}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  private prepareExcelData(data: any[]): { formattedData: any[], headers: string[] } {
    const formattedData = data.map(item => ({
      'Record ID': item.id,
      'Bay ID': item.bayId,
      'Bay Number': item.bayNumber,
      'Truck Number': item.truckNumber,
      'Elapsed Time': item.elapsedTime,
      'Total Seconds': item.totalSeconds,
      'Clock Time': new Date(item.clockedAt).toLocaleTimeString(),
      'Clock Date': new Date(item.clockedAt).toLocaleDateString(),
      'Date (YYYY-MM-DD)': item.date,
      'Timestamp': new Date(item.clockedAt).toISOString(),
      'Day of Week': new Date(item.clockedAt).toLocaleDateString('en-US', { weekday: 'long' }),
      'Week Number': this.getWeekNumber(new Date(item.clockedAt))
    }));

    const headers = [
      'Record ID',
      'Bay ID', 
      'Bay Number',
      'Truck Number',
      'Elapsed Time',
      'Total Seconds',
      'Clock Time',
      'Clock Date',
      'Date (YYYY-MM-DD)',
      'Timestamp',
      'Day of Week',
      'Week Number'
    ];

    return { formattedData, headers };
  }

  private applyExcelFormatting(worksheet: XLSX.WorkSheet, headers: string[]): void {
    // Set column widths
    const colWidths = [
      { wch: 20 }, // Record ID
      { wch: 10 }, // Bay ID
      { wch: 12 }, // Bay Number
      { wch: 15 }, // Truck Number
      { wch: 15 }, // Elapsed Time
      { wch: 15 }, // Total Seconds
      { wch: 15 }, // Clock Time
      { wch: 15 }, // Clock Date
      { wch: 18 }, // Date (YYYY-MM-DD)
      { wch: 25 }, // Timestamp
      { wch: 12 }, // Day of Week
      { wch: 12 }  // Week Number
    ];
    
    worksheet['!cols'] = colWidths;

    // Add auto filter to headers
    if (!worksheet['!ref']) return;
    
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({
      s: { r: range.s.r, c: range.s.c },
      e: { r: range.s.r, c: range.e.c }
    })};

    // Freeze header row
    worksheet['!freeze'] = { x: 0, y: 1 };

    // Add header style (bold)
    if (!worksheet['!rows']) worksheet['!rows'] = [];
    worksheet['!rows'][0] = { hpt: 20, hidden: false };
  }

  private generateSummaryData(data: any[]): any[] {
    if (data.length === 0) {
      return [{ 'Summary': 'No data available' }];
    }

    const totalRecords = data.length;
    const totalSeconds = data.reduce((sum, item) => sum + (item.totalSeconds || 0), 0);
    const averageSeconds = Math.floor(totalRecords > 0 ? totalSeconds / totalRecords : 0);
    const averageTime = this.secondsToHMS(averageSeconds);

    // Group by bay
    const baySummary: { [key: string]: number } = {};
    const bayTotalSeconds: { [key: string]: number } = {};
    
    data.forEach(item => {
      baySummary[item.bayId] = (baySummary[item.bayId] || 0) + 1;
      bayTotalSeconds[item.bayId] = (bayTotalSeconds[item.bayId] || 0) + (item.totalSeconds || 0);
    });

    // Group by date
    const dateSummary: { [key: string]: number } = {};
    data.forEach(item => {
      dateSummary[item.date] = (dateSummary[item.date] || 0) + 1;
    });

    // Group by truck number
    const truckSummary: { [key: string]: number } = {};
    data.forEach(item => {
      if (item.truckNumber) {
        truckSummary[item.truckNumber] = (truckSummary[item.truckNumber] || 0) + 1;
      }
    });

    const summary = [
      { 'Metric': 'Total Records', 'Value': totalRecords },
      { 'Metric': 'Total Time (seconds)', 'Value': totalSeconds },
      { 'Metric': 'Total Time (HH:MM:SS)', 'Value': this.secondsToHMS(totalSeconds) },
      { 'Metric': 'Average Time', 'Value': averageTime },
      { 'Metric': 'Average Time (seconds)', 'Value': averageSeconds },
      { 'Metric': '', 'Value': '' },
      { 'Metric': 'Records by Bay', 'Value': '' }
    ];

    // Add bay breakdown - FIXED: Proper object assignment
    Object.entries(baySummary)
      .sort(([bayA], [bayB]) => bayA.localeCompare(bayB))
      .forEach(([bay, count]) => {
        const avgBaySeconds = Math.floor(bayTotalSeconds[bay] / count);
        const bayRow: any = { 
          'Metric': `  ${bay}`, 
          'Value': count
        };
        bayRow['Total Time'] = this.secondsToHMS(bayTotalSeconds[bay]);
        bayRow['Average Time'] = this.secondsToHMS(avgBaySeconds);
        summary.push(bayRow);
      });

    summary.push({ 'Metric': '', 'Value': '' });
    summary.push({ 'Metric': 'Records by Date', 'Value': '' });

    // Add date breakdown
    Object.entries(dateSummary)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .forEach(([date, count]) => {
        summary.push({ 'Metric': `  ${date}`, 'Value': count });
      });

    summary.push({ 'Metric': '', 'Value': '' });
    summary.push({ 'Metric': 'Top Trucks', 'Value': '' });

    // Add top trucks
    Object.entries(truckSummary)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 10)
      .forEach(([truck, count]) => {
        summary.push({ 'Metric': `  ${truck}`, 'Value': count });
      });

    return summary;
  }

  private generateBayStatistics(data: any[]): any[] {
    if (data.length === 0) {
      return [{ 'Bay Statistics': 'No data available' }];
    }

    const bayStats: { [key: string]: { count: number, totalSeconds: number, trucks: Set<string> } } = {};
    
    // Calculate statistics per bay
    data.forEach(item => {
      if (!bayStats[item.bayId]) {
        bayStats[item.bayId] = { count: 0, totalSeconds: 0, trucks: new Set() };
      }
      bayStats[item.bayId].count++;
      bayStats[item.bayId].totalSeconds += item.totalSeconds || 0;
      if (item.truckNumber) {
        bayStats[item.bayId].trucks.add(item.truckNumber);
      }
    });

    const statistics = [
      ['Bay ID', 'Total Records', 'Total Time (HH:MM:SS)', 'Total Time (seconds)', 'Average Time', 'Unique Trucks'],
      ...Object.entries(bayStats)
        .sort(([bayA], [bayB]) => bayA.localeCompare(bayB))
        .map(([bayId, stats]) => [
          bayId,
          stats.count,
          this.secondsToHMS(stats.totalSeconds),
          stats.totalSeconds,
          this.secondsToHMS(Math.floor(stats.totalSeconds / stats.count)),
          stats.trucks.size
        ])
    ];

    return statistics;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private async exportStatusToExcel(data: any[], baseFilename: string): Promise<void> {
    const wb = XLSX.utils.book_new();
    
    // Current Status Worksheet
    const wsStatus = XLSX.utils.json_to_sheet(data);
    this.applyStatusFormatting(wsStatus);
    XLSX.utils.book_append_sheet(wb, wsStatus, 'Current Status');
    
    // Summary Worksheet
    const summaryData = this.generateStatusSummary(data);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Bay Performance Worksheet
    const performanceData = this.generatePerformanceMetrics(data);
    const wsPerformance = XLSX.utils.json_to_sheet(performanceData);
    XLSX.utils.book_append_sheet(wb, wsPerformance, 'Performance Metrics');
    
    const filename = `${baseFilename}-${this.getTodayDate()}-${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  private applyStatusFormatting(worksheet: XLSX.WorkSheet): void {
    // Set column widths for status report
    const colWidths = [
      { wch: 10 }, // Bay ID
      { wch: 12 }, // Bay Number
      { wch: 15 }, // Truck Number
      { wch: 20 }, // Start Time
      { wch: 15 }, // Elapsed Time
      { wch: 12 }, // Status
      { wch: 25 }  // Last Updated
    ];
    
    worksheet['!cols'] = colWidths;

    // Add auto filter
    if (worksheet['!ref']) {
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({
        s: { r: range.s.r, c: range.s.c },
        e: { r: range.s.r, c: range.e.c }
      })};
    }

    // Freeze header row
    worksheet['!freeze'] = { x: 0, y: 1 };
  }

  private generateStatusSummary(data: any[]): any[] {
    if (data.length === 0) {
      return [['Summary', 'No active bays']];
    }

    const totalActive = data.length;
    const statusCount: { [key: string]: number } = {};
    const totalElapsedSeconds = data.reduce((total, bay) => {
      const elapsed = this.parseTimeToSeconds(bay['Elapsed Time']);
      return total + (isNaN(elapsed) ? 0 : elapsed);
    }, 0);

    data.forEach(bay => {
      const status = bay['Status'] || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    const summary = [
      ['Export Date', new Date().toLocaleString()],
      ['Total Active Bays', totalActive],
      ['Average Elapsed Time', this.secondsToHMS(Math.floor(totalElapsedSeconds / totalActive))],
      ['Total Elapsed Time', this.secondsToHMS(totalElapsedSeconds)],
      [''],
      ['Status Breakdown', '']
    ];

    Object.entries(statusCount)
      .sort(([, countA], [, countB]) => countB - countA)
      .forEach(([status, count]) => {
        summary.push([status, count]);
      });

    summary.push(['']);
    summary.push(['Bay Details', '']);
    summary.push(['Bay Number', 'Truck Number', 'Elapsed Time', 'Status']);

    data.sort((a, b) => a['Bay Number'].localeCompare(b['Bay Number']))
      .forEach(bay => {
        summary.push([
          bay['Bay Number'],
          bay['Truck Number'],
          bay['Elapsed Time'],
          bay['Status']
        ]);
      });

    return summary;
  }

  private generatePerformanceMetrics(data: any[]): any[] {
    if (data.length === 0) {
      return [['Performance Metrics', 'No data available']];
    }

    const metrics = [
      ['Performance Metrics', 'Value', 'Description'],
      ['Report Generated', new Date().toLocaleString(), 'Date and time of report generation'],
      ['Total Active Bays', data.length, 'Number of currently active loading bays'],
      ['Bays Utilization', `${((data.length / this.NUM_BAYS) * 100).toFixed(1)}%`, 'Percentage of total bays currently in use']
    ];

    // Calculate elapsed time statistics
    const elapsedTimes = data.map(bay => this.parseTimeToSeconds(bay['Elapsed Time'])).filter(time => !isNaN(time));
    
    if (elapsedTimes.length > 0) {
      const maxTime = Math.max(...elapsedTimes);
      const minTime = Math.min(...elapsedTimes);
      const avgTime = elapsedTimes.reduce((sum, time) => sum + time, 0) / elapsedTimes.length;

      metrics.push(
        ['Longest Active Time', this.secondsToHMS(maxTime), 'Bay with the longest ongoing loading operation'],
        ['Shortest Active Time', this.secondsToHMS(minTime), 'Bay with the shortest ongoing loading operation'],
        ['Average Active Time', this.secondsToHMS(Math.floor(avgTime)), 'Average time across all active bays']
      );
    }

    // Truck statistics
    const uniqueTrucks = new Set(data.map(bay => bay['Truck Number']).filter(truck => truck && truck !== '—'));
    metrics.push(
      ['Unique Trucks', uniqueTrucks.size, 'Number of distinct trucks currently being loaded']
    );

    return metrics;
  }

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '—' || timeString === '00:00:00') return 0;
    
    const parts = timeString.split(':').map(part => parseInt(part, 10));
    if (parts.length !== 3) return 0;
    
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  private secondsToHMS(totalSeconds: number): string {
    if (totalSeconds < 0) totalSeconds = 0;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }

  // Add to BayTracker class
async testStartBay1(): Promise<void> {
  console.log('🧪 Manual Test: Starting Bay 1');
  try {
    await this.startLoading('bay1', 'TEST123');
    console.log('🧪 Manual Test: Bay 1 started successfully');
  } catch (error) {
    console.error('🧪 Manual Test: Failed to start Bay 1:', error);
  }
}

async testResetAll(): Promise<void> {
  console.log('🧪 Manual Test: Resetting all bays');
  try {
    await this.resetAllBays();
    console.log('🧪 Manual Test: All bays reset successfully');
  } catch (error) {
    console.error('🧪 Manual Test: Failed to reset bays:', error);
  }
}
}