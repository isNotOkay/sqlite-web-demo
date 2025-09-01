// src/app/services/data-api.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { GridDataset, GridRow } from '../models/grid';

export interface PagedResult<T> {
  items: T[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class DataApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';

// src/app/services/data-api.service.ts
  getDataset(id: string): Observable<GridDataset> {
    // Ask json-server to filter datasets by id
    const params = new HttpParams().set('id', id);
    return this.http
      .get<GridDataset[]>(`${this.baseUrl}/datasets`, { params })
      .pipe(
        map(arr => {
          const ds = arr[0];
          if (!ds) throw new Error(`Dataset not found: ${id}`);
          return ds;
        })
      );
  }


  /** json-server pagination: supports both array+X-Total-Count and envelope { data, items }. */
  getRows(id: string, pageIndex: number, pageSize: number): Observable<PagedResult<GridRow>> {
    const params = new HttpParams()
      .set('_page', String(pageIndex + 1))  // json-server is 1-based
      .set('_per_page', String(pageSize));  // use per-page style

    return this.http
      .get<any>(`${this.baseUrl}/${id}`, { params, observe: 'response' })
      .pipe(
        map((res: HttpResponse<any>) => {
          const body = res.body;

          // Newer json-server: envelope { data: GridRow[], items: number, ... }
          if (body && Array.isArray(body.data)) {
            const items: GridRow[] = body.data;
            const total =
              typeof body.items === 'number'
                ? body.items
                : Number(res.headers.get('X-Total-Count') ?? items.length);
            return { items, total };
          }

          // Older json-server: body is the array, total comes from header
          if (Array.isArray(body)) {
            return {
              items: body as GridRow[],
              total: Number(res.headers.get('X-Total-Count') ?? body.length),
            };
          }

          // Fallback (unexpected shape)
          return { items: [], total: 0 };
        })
      );
  }
}
