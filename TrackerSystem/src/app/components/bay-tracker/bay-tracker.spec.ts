import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BayTracker } from './bay-tracker';

describe('BayTracker', () => {
  let component: BayTracker;
  let fixture: ComponentFixture<BayTracker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BayTracker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BayTracker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
