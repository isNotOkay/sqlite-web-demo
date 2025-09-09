// src/app/services/data-api.service.ts
import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams, HttpResponse} from '@angular/common/http';
import {delay, map, Observable} from 'rxjs';
import {PagedResult} from '../models/paged-result.model';

type TableInfo = { name: string; rowCount?: number; columns?: string[] };
type ViewInfo = { name: string; columns?: string[] };

@Injectable({providedIn: 'root'})
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

  // NEW: optional sortBy/sortDir
  getRows(
    kind: 'table' | 'view',
    id: string,
    pageIndex: number,
    pageSize: number,
    sortBy?: string | null,
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult<Record<string, unknown>>> {
    let params = new HttpParams()
      .set('page', String(pageIndex + 1))
      .set('pageSize', String(pageSize));

    if (sortBy && sortBy.trim().length > 0) {
      params = params
        .set('sortBy', sortBy)
        .set('sortDir', sortDir);
    }

    return this.http
      .get<any>(`${this.baseUrl}/api/${kind === 'table' ? 'tables' : 'views'}/${encodeURIComponent(id)}`, {
        params,
        observe: 'response'
      })
      .pipe(
        delay(200),
        map((res: HttpResponse<any>) => {
          const body = res.body ?? {};
          const items: Record<string, unknown>[] = Array.isArray(body.data) ? body.data : [];
          const total = typeof body.totalRows === 'number' ? body.totalRows : items.length;
          return {items, total};
        })
      );
  }
}
