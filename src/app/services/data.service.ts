// file: src/app/services/data.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface PeriodicElement {
  name: string;
  position: number;
  weight: number;
  symbol: string;
}

@Injectable({ providedIn: 'root' })
export class Data {
  getElements(): Observable<PeriodicElement[]> {
    const elements: PeriodicElement[] = Array.from({ length: 100 }, (_, i) => {
      const position = i + 1;
      return {
        position,
        name: `Element ${position}`,
        weight: Number((Math.random() * 200).toFixed(4)), // random-ish weight
        symbol: `E${position}` // fake symbol
      };
    });

    return of(elements);
  }
}
