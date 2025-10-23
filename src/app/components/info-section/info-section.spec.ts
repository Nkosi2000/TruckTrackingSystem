import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoSection } from './info-section';

describe('InfoSection', () => {
  let component: InfoSection;
  let fixture: ComponentFixture<InfoSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InfoSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
