import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Reporting } from './reporting';

describe('Reporting', () => {
  let component: Reporting;
  let fixture: ComponentFixture<Reporting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reporting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Reporting);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
