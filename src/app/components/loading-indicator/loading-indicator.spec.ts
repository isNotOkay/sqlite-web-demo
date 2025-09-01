import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingIndicator } from './loading-indicator';

describe('LoadingIndicator', () => {
  let component: LoadingIndicator;
  let fixture: ComponentFixture<LoadingIndicator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingIndicator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingIndicator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
