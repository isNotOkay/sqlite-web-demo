import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavSectionComponent } from './nav-section.component';

describe('NavSection', () => {
  let component: NavSectionComponent;
  let fixture: ComponentFixture<NavSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
