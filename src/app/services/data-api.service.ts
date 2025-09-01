import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import {delay, map, Observable} from 'rxjs';
import { GridRow, PagedResult } from '../models/grid';

@Injectable({ providedIn: 'root' })
export class DataApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';

  /**
   * Load paginated rows from a top-level collection (/users, /orders, /products, /audit-logs).
   * Supports both json-server shapes:
   *  - array body + X-Total-Count header
   *  - envelope { data: [...], items: N, ... }
   */
  getRows(id: string, pageIndex: number, pageSize: number): Observable<PagedResult<GridRow>> {
    const params = new HttpParams()
      .set('_page', String(pageIndex + 1))   // json-server is 1-based
      .set('_per_page', String(pageSize));

    return this.http
      .get<any>(`${this.baseUrl}/${id}`, { params, observe: 'response' })
      .pipe(
        delay(500),
        map((res: HttpResponse<any>) => {
          const body = res.body;

          // Envelope style
          if (body && Array.isArray(body.data)) {
            const items: GridRow[] = body.data;
            const total =
              typeof body.items === 'number'
                ? body.items
                : Number(res.headers.get('X-Total-Count') ?? items.length);
            return { items, total };
          }

          // Array + header style
          if (Array.isArray(body)) {
            return {
              items: body as GridRow[],
              total: Number(res.headers.get('X-Total-Count') ?? body.length),
            };
          }

          return { items: [], total: 0 };
        })
      );
  }
}
