import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BayService, Bay } from '../../services/bay';
import { ClockedTime } from '../../models/bay-data';
import { Subscription, interval } from 'rxjs';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-bay-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bay-tracker.html',
  styleUrls: ['./bay-tracker.css']
})
export class BayTracker implements OnInit, OnDestroy {
  private bayService = inject(BayService);
  public Object = Object;
  private timerSubscription?: Subscription;
  private dataSubscription?: Subscription;
  
  readonly NUM_BAYS = 7;
  bays: { [key: string]: Bay & { elapsedTime: string, status: string, statusClass: string } } = {};
  truckInputs: { [key: string]: string } = {};
  isDarkMode = false;
  isMobileMenuOpen = false;
  currentYear = new Date().getFullYear();

  // Enhanced properties for reporting and stats
  showStats = false;
  statsData: any = null;
  showAdvancedReports = false;
  showCollectionStatus = false;
  collectionAccessible = true;
  isLoading = false;
  
  reportFilters = {
    dateFrom: this.getTodayDate(),
    dateTo: this.getTodayDate(),
    bayId: '',
    truckNumber: ''
  };

  // Quick report options
  quickReportOptions = [
    { label: 'Today', days: 0 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 }
  ];

  // Recent clocked times for dashboard
  recentClockedTimes: ClockedTime[] = [];
  showRecentTimes = false;

  // Add click listener to close mobile menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.isMobileMenuOpen && !target.closest('nav') && !target.closest('.mobile-menu-toggle')) {
      this.closeMobileMenu();
    }
  }

  // Add escape key listener to close mobile menu
  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
    if (this.showStats) {
      this.showStats = false;
    }
    if (this.showAdvancedReports) {
      this.showAdvancedReports = false;
    }
  }

  // Theme management
  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode.toString());
  }

  // Mobile menu management
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  onNavLinkClick(): void {
    this.closeMobileMenu();
  }

  ngOnInit(): void {
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme === 'true') {
      this.isDarkMode = true;
    }

    // Check collection accessibility
    await this.checkCollectionAccess();

    // Subscribe to bay data changes
    this.dataSubscription = this.bayService.bays$.subscribe(baysData => {
      this.updateBaysDisplay(baysData);
    });

    // Update timers every second
    this.timerSubscription = interval(1000).subscribe(() => {
      this.updateTimers();
    });

    // Load initial recent clocked times
    await this.loadRecentClockedTimes();
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  // Bay management methods
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

  // Template helper methods
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
    return Object.values(this.bays).filter(bay => 
      bay.startedAt > 0 && this.bayService.getStatus(bay.startedAt).status === 'Complete'
    ).length;
  }

  getInputPlaceholder(status: string): string {
    return status === 'Available' ? 'Enter Truck No (e.g. T001)' : 'Truck is loading...';
  }

  // Bay operations
  async startLoading(bayId: string): Promise<void> {
    const truckNo = this.truckInputs[bayId]?.trim();
    if (!truckNo) {
      alert('Please enter Truck No');
      return;
    }
    
    try {
      await this.bayService.startLoading(bayId, truckNo);
      this.truckInputs[bayId] = '';
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

  formatStartTime(startedAt: number): string {
    return startedAt ? new Date(startedAt).toLocaleTimeString() : '—';
  }

  trackByBayId(index: number, item: any): string {
    return item.id;
  }

  // Clock in time methods
  getClockedTimes(bayId: string): ClockedTime[] {
    return this.bayService.getClockedTimes(bayId);
  }

  formatClockedTime(clockedAt: number): string {
    return new Date(clockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatClockedDate(clockedAt: number): string {
    return new Date(clockedAt).toLocaleDateString();
  }

  hasClockedTimes(bayId: string): boolean {
    return this.getClockedTimes(bayId).length > 0;
  }

  async clockTime(bayId: string): Promise<void> {
    if (!this.bays[bayId]?.startedAt) {
      alert('Cannot clock time - bay is not active');
      return;
    }

    if (confirm('Clock in current time for this bay?')) {
      this.isLoading = true;
      try {
        const clockedTimeId = await this.bayService.clockTime(bayId);
        console.log(`Time clocked successfully: ${clockedTimeId}`);
        
        // Refresh recent times
        await this.loadRecentClockedTimes();
        
        // Show success feedback
        this.showTemporaryMessage('Time clocked successfully!', 'success');
      } catch (error: any) {
        console.error('Error clocking time:', error);
        
        if (error.message?.includes('PERMISSION_DENIED') || error.code === 'PERMISSION_DENIED') {
          alert('Permission denied. Please check Firebase database rules.');
        } else {
          alert('Failed to clock time. Please try again.');
        }
      } finally {
        this.isLoading = false;
      }
    }
  }

  // Reporting and statistics methods
  async getClockedTimeStats(): Promise<void> {
    this.isLoading = true;
    try {
      this.statsData = await this.bayService.getClockedTimeStats();
      this.showStats = true;
    } catch (error) {
      console.error('Error getting stats:', error);
      this.showTemporaryMessage('Failed to load statistics', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // UPDATED: Export to Excel instead of CSV
  async exportClockedTimes(): Promise<void> {
    this.isLoading = true;
    try {
      const allClockedTimes = await this.bayService.getAllClockedTimes();
      
      if (allClockedTimes.length === 0) {
        this.showTemporaryMessage('No clocked times data available to export', 'warning');
        return;
      }
      
      // Create formatted Excel file
      await this.exportToExcel(allClockedTimes, 'clocked-times-full-export');
      this.showTemporaryMessage('Excel file exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting clocked times:', error);
      this.showTemporaryMessage('Failed to export data', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // UPDATED: Run advanced report with Excel export
  async runAdvancedReport(): Promise<void> {
    if (!this.reportFilters.dateFrom || !this.reportFilters.dateTo) {
      alert('Please select both start and end dates for the report.');
      return;
    }

    this.isLoading = true;
    try {
      let clockedTimes = await this.bayService.getClockedTimesByDateRange(
        this.reportFilters.dateFrom, 
        this.reportFilters.dateTo
      );
      
      // Apply additional filters
      if (this.reportFilters.bayId) {
        clockedTimes = clockedTimes.filter(time => time.bayId === this.reportFilters.bayId);
      }
      if (this.reportFilters.truckNumber) {
        clockedTimes = clockedTimes.filter(time => 
          time.truckNumber.toLowerCase().includes(this.reportFilters.truckNumber.toLowerCase())
        );
      }
      
      if (clockedTimes.length === 0) {
        this.showTemporaryMessage('No data found for the selected filters', 'warning');
        return;
      }
      
      const filename = `advanced-report-${this.reportFilters.dateFrom}-to-${this.reportFilters.dateTo}`;
      await this.exportToExcel(clockedTimes, filename);
      this.showTemporaryMessage('Excel report generated successfully!', 'success');
    } catch (error) {
      console.error('Error running advanced report:', error);
      this.showTemporaryMessage('Failed to generate report', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // NEW: Excel export method with formatting
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
    
    // Generate Excel file and download
    const filename = `${baseFilename}-${this.getTodayDate()}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // NEW: Prepare data for Excel export with proper formatting
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
      'Timestamp': new Date(item.clockedAt).toISOString()
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
      'Timestamp'
    ];

    return { formattedData, headers };
  }

  // NEW: Apply Excel formatting
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
      { wch: 25 }  // Timestamp
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
  }

  // NEW: Generate summary data for second worksheet
  private generateSummaryData(data: any[]): any[] {
    if (data.length === 0) {
      return [{ 'Summary': 'No data available' }];
    }

    const totalRecords = data.length;
    const totalSeconds = data.reduce((sum, item) => sum + (item.totalSeconds || 0), 0);
    const averageSeconds = Math.floor(totalSeconds / totalRecords);
    const averageTime = this.secondsToHMS(averageSeconds);

    // Group by bay
    const baySummary: { [key: string]: number } = {};
    data.forEach(item => {
      baySummary[item.bayId] = (baySummary[item.bayId] || 0) + 1;
    });

    // Group by date
    const dateSummary: { [key: string]: number } = {};
    data.forEach(item => {
      dateSummary[item.date] = (dateSummary[item.date] || 0) + 1;
    });

    const summary = [
      { 'Metric': 'Total Records', 'Value': totalRecords },
      { 'Metric': 'Total Time (seconds)', 'Value': totalSeconds },
      { 'Metric': 'Average Time', 'Value': averageTime },
      { 'Metric': 'Average Time (seconds)', 'Value': averageSeconds },
      { 'Metric': '', 'Value': '' },
      { 'Metric': 'Records by Bay', 'Value': '' }
    ];

    // Add bay breakdown
    Object.entries(baySummary).forEach(([bay, count]) => {
      summary.push({ 'Metric': `  ${bay}`, 'Value': count });
    });

    summary.push({ 'Metric': '', 'Value': '' });
    summary.push({ 'Metric': 'Records by Date', 'Value': '' });

    // Add date breakdown
    Object.entries(dateSummary)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .forEach(([date, count]) => {
        summary.push({ 'Metric': `  ${date}`, 'Value': count });
      });

    return summary;
  }

  // Quick report methods
  async runQuickReport(days: number): Promise<void> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateDaysAgo(days);
    
    this.reportFilters.dateFrom = startDate;
    this.reportFilters.dateTo = endDate;
    
    await this.runAdvancedReport();
  }

  // NEW: Export current bay status to Excel
  async exportCurrentStatus(): Promise<void> {
    this.isLoading = true;
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
      this.isLoading = false;
    }
  }

  // NEW: Export bay status to Excel
  private async exportStatusToExcel(data: any[], baseFilename: string): Promise<void> {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths for status report
    const colWidths = [
      { wch: 10 }, // Bay ID
      { wch: 12 }, // Bay Number
      { wch: 15 }, // Truck Number
      { wch: 15 }, // Start Time
      { wch: 15 }, // Elapsed Time
      { wch: 12 }, // Status
      { wch: 20 }  // Last Updated
    ];
    
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Current Status');
    const filename = `${baseFilename}-${this.getTodayDate()}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // Collection management
  async checkCollectionAccess(): Promise<void> {
    try {
      this.collectionAccessible = await this.bayService.isCollectionAccessible();
    } catch (error) {
      console.error('Error checking collection access:', error);
      this.collectionAccessible = false;
    }
  }

  async loadRecentClockedTimes(): Promise<void> {
    try {
      this.recentClockedTimes = await this.bayService.getRecentClockedTimes(5);
    } catch (error) {
      console.error('Error loading recent clocked times:', error);
      this.recentClockedTimes = [];
    }
  }

  async clearAllClockedTimes(): Promise<void> {
    if (confirm('Are you sure you want to clear ALL clocked times? This action cannot be undone.')) {
      this.isLoading = true;
      try {
        await this.bayService.clearAllClockedTimes();
        this.showTemporaryMessage('All clocked times cleared successfully', 'success');
        await this.loadRecentClockedTimes();
      } catch (error) {
        console.error('Error clearing clocked times:', error);
        this.showTemporaryMessage('Failed to clear clocked times', 'error');
      } finally {
        this.isLoading = false;
      }
    }
  }

  // Utility methods
  private secondsToHMS(totalSeconds: number): string {
    if (totalSeconds < 0) totalSeconds = 0;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  getBayOptions(): { value: string, label: string }[] {
    return Array.from({ length: this.NUM_BAYS }, (_, i) => ({
      value: `bay${i + 1}`,
      label: `Bay ${i + 1}`
    }));
  }

  // UI helper methods
  private showTemporaryMessage(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    console.log(`${type.toUpperCase()}: ${message}`);
    if (type === 'error') {
      alert(message);
    }
  }

  // Format elapsed time for display
  formatElapsedTime(seconds: number): string {
    return this.bayService.calculateElapsedTime(Date.now() - (seconds * 1000));
  }

  // Get status color based on status class
  getStatusColor(statusClass: string): string {
    const colors: { [key: string]: string } = {
      'empty': '#6B7280',
      'status-on': '#10B981',
      'status-warn': '#F59E0B',
      'status-ot': '#EF4444'
    };
    return colors[statusClass] || '#6B7280';
  }

  // Reset report filters
  resetReportFilters(): void {
    this.reportFilters = {
      dateFrom: this.getTodayDate(),
      dateTo: this.getTodayDate(),
      bayId: '',
      truckNumber: ''
    };
  }

  // Toggle sections
  toggleAdvancedReports(): void {
    this.showAdvancedReports = !this.showAdvancedReports;
    if (this.showAdvancedReports) {
      this.resetReportFilters();
    }
  }

  toggleRecentTimes(): void {
    this.showRecentTimes = !this.showRecentTimes;
    if (this.showRecentTimes) {
      this.loadRecentClockedTimes();
    }
  }

  toggleCollectionStatus(): void {
    this.showCollectionStatus = !this.showCollectionStatus;
    if (this.showCollectionStatus) {
      this.checkCollectionAccess();
    }
  }

  // Get total clocked times count
  async getTotalClockedTimes(): Promise<number> {
    try {
      return await this.bayService.getClockedTimesCount();
    } catch (error) {
      console.error('Error getting total count:', error);
      return 0;
    }
  }
}