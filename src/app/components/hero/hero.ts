import { Component, input } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  templateUrl: './hero.html',
  styleUrls: ['./hero.css']
})
export class Hero {
  numBays = input(0);
  activeBaysCount = input(0);
  completedTodayCount = input(0);
}