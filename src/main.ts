// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core'; // Angular 20
import { AppComponent } from './app/app.component';

import { MatPaginatorIntl } from '@angular/material/paginator';

export function paginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  // Empty strings => tooltips disappear (but also aria-labels!)
  intl.nextPageLabel = '';
  intl.previousPageLabel = '';
  intl.firstPageLabel = '';
  intl.lastPageLabel = '';
  // keep or change others as you like
  intl.itemsPerPageLabel = 'Items per page';
  return intl;
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: MatPaginatorIntl, useFactory: paginatorIntl },
    provideZonelessChangeDetection(),
    provideHttpClient(),
  ],
});
