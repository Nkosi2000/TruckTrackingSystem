import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BayGrid } from './bay-grid';

describe('BayGrid', () => {
  let component: BayGrid;
  let fixture: ComponentFixture<BayGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BayGrid]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BayGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
