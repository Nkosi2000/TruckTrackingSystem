import { TestBed } from '@angular/core/testing';

import { Bay } from './bay';

describe('Bay', () => {
  let service: Bay;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Bay);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
