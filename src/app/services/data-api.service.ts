import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GridDataset } from '../models/grid';

@Injectable({ providedIn: 'root' })
export class DataApiService {
  private http = inject(HttpClient);
  // Adjust for your dev server host/port
  private readonly baseUrl = 'http://localhost:3000';

  /** Load one dataset by id (e.g., "users", "orders"). */
  getDataset(id: string): Observable<GridDataset> {
    return this.http.get<GridDataset>(`${this.baseUrl}/data/${id}`);
  }

  /** (Optional) list all datasets. */
  listDatasets(): Observable<GridDataset[]> {
    return this.http.get<GridDataset[]>(`${this.baseUrl}/data`);
  }
}
