import { Component, output } from '@angular/core';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  templateUrl: './quick-actions.html',
  styleUrls: ['./quick-actions.css']
})
export class QuickActions {
  recentTimesToggled = output<void>();
  collectionStatusToggled = output<void>();
  advancedReportsToggled = output<void>();
  exportStatusRequested = output<void>();

  onRecentTimesToggle(): void {
    this.recentTimesToggled.emit();
  }

  onCollectionStatusToggle(): void {
    this.collectionStatusToggled.emit();
  }

  onAdvancedReportsToggle(): void {
    this.advancedReportsToggled.emit();
  }

  onExportStatus(): void {
    this.exportStatusRequested.emit();
  }
}