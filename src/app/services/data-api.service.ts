import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { delay, map, Observable } from 'rxjs';
import { GridRow, PagedResult } from '../models/grid';

@Injectable({ providedIn: 'root' })
export class DataApiService {
  private http = inject(HttpClient);
  // Your .NET API (runs on 5282 per your logs)
  private readonly baseUrl = 'http://localhost:5282';

  /**
   * Load paginated rows from /data/{tableName}?page=&pageSize=
   * Backend response shape:
   * {
   *   table: string,
   *   page: number,
   *   pageSize: number,
   *   totalRows: number,
   *   totalPages: number,
   *   data: Array<object>
   * }
   */
  getRows(tableName: string, pageIndex: number, pageSize: number): Observable<PagedResult<GridRow>> {
    const params = new HttpParams()
      .set('page', String(pageIndex + 1))  // backend is 1-based
      .set('pageSize', String(pageSize));

    return this.http
      .get<any>(`${this.baseUrl}/data/${encodeURIComponent(tableName)}`, { params, observe: 'response' })
      .pipe(
        delay(200), // small UX delay; optional
        map((res: HttpResponse<any>) => {
          const body = res.body ?? {};
          const items: GridRow[] = Array.isArray(body.data) ? body.data : [];
          const total = typeof body.totalRows === 'number' ? body.totalRows : items.length;
          return { items, total };
        })
      );
  }
}
