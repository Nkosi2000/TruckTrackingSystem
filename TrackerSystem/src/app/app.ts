import { Component, signal } from '@angular/core';
import { BayTracker } from './components/bay-tracker/bay-tracker';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BayTracker],
  template: `<app-bay-tracker></app-bay-tracker>`,
  // styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('TrackerSystem');
}
