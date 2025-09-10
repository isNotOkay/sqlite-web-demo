import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult } from '../models/paged-result.model';
import { Relation } from '../models/relation.model';
import { Row } from '../models/row.model';

@Injectable({ providedIn: 'root' })
export class DataApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5282';

  listTables(
    pageIndex = 0,
    pageSize = 50,
    sortBy: string | null = 'Name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult<Relation>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResult<Relation>>(`${this.baseUrl}/api/tables`, { params });
  }

  listViews(
    pageIndex = 0,
    pageSize = 50,
    sortBy: string | null = 'Name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult<Relation>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResult<Relation>>(`${this.baseUrl}/api/views`, { params });
  }

  getRows<T = Row>(
    kind: 'table' | 'view',
    id: string,
    pageIndex: number, // 0-based from UI
    pageSize: number,
    sortBy?: string | null,
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult<T>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy ?? null, sortDir);
    const path = kind === 'table' ? 'tables' : 'views';
    return this.http.get<PagedResult<T>>(
      `${this.baseUrl}/api/${path}/${encodeURIComponent(id)}`,
      { params }
    );
  }

  private buildParams(
    pageIndex: number,
    pageSize: number,
    sortBy: string | null,
    sortDir: 'asc' | 'desc'
  ): HttpParams {
    let params = new HttpParams()
      .set('page', String(pageIndex + 1)) // API expects 1-based
      .set('pageSize', String(pageSize));

    if (sortBy && sortBy.trim().length > 0) {
      params = params.set('sortBy', sortBy).set('sortDir', sortDir);
    }
    return params;
  }
}
