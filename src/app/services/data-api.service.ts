import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { delay, map, Observable } from 'rxjs';
import { GridRow, PagedResult } from '../models/grid';

type TableInfo = { name: string; rowCount?: number; columns?: string[] };
type ViewInfo  = { name: string; columns?: string[] };

@Injectable({ providedIn: 'root' })
export class DataApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5282';

  listTables(): Observable<TableInfo[]> {
    return this.http.get<{ items: TableInfo[] }>(`${this.baseUrl}/api/tables`)
      .pipe(map(r => r.items ?? []));
  }

  listViews(): Observable<ViewInfo[]> {
    return this.http.get<{ items: ViewInfo[] }>(`${this.baseUrl}/api/views`)
      .pipe(map(r => r.items ?? []));
  }

  getRows(kind: 'table' | 'view', id: string, pageIndex: number, pageSize: number): Observable<PagedResult<GridRow>> {
    const params = new HttpParams()
      .set('page', String(pageIndex + 1))
      .set('pageSize', String(pageSize));

    return this.http
      .get<any>(`${this.baseUrl}/api/${kind === 'table' ? 'tables' : 'views'}/${encodeURIComponent(id)}`, { params, observe: 'response' })
      .pipe(
        delay(200),
        map((res: HttpResponse<any>) => {
          const body = res.body ?? {};
          const items: GridRow[] = Array.isArray(body.data) ? body.data : [];
          const total = typeof body.totalRows === 'number' ? body.totalRows : items.length;
          return { items, total };
        })
      );
  }
}
