// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient} from '@angular/common/http';
import {provideZonelessChangeDetection} from '@angular/core'; // Angular 20
import {App} from './app/app';

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),   // 🔑 no Zone.js needed
    provideHttpClient(),
  ],
});
