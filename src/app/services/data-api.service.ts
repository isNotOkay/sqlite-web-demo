import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {PagedResult} from '../models/paged-result.model';
import {Relation} from '../models/relation.model';
import {RelationType} from '../enums/relation-type.enum';

@Injectable({providedIn: 'root'})
export class DataApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5282';

  loadTables(
    pageIndex = 0,
    pageSize = 50,
    sortBy: string | null = 'name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult<Relation>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResult<Relation>>(`${this.baseUrl}/api/tables`, {params});
  }

  loadViews(
    pageIndex = 0,
    pageSize = 50,
    sortBy: string | null = 'name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult<Relation>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResult<Relation>>(`${this.baseUrl}/api/views`, {params});
  }

  loadRows(
    relationType: RelationType,
    id: string,
    pageIndex: number,
    pageSize: number,
    sortBy?: string | null,
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResult> {
    const params = this.buildParams(pageIndex, pageSize, sortBy ?? null, sortDir);
    const path = relationType === RelationType.Table ? 'tables' : 'views';
    return this.http.get<PagedResult>(
      `${this.baseUrl}/api/${path}/${encodeURIComponent(id)}`,
      {params}
    );
  }

  private buildParams(
    pageIndex: number,
    pageSize: number,
    sortBy: string | null,
    sortDir: 'asc' | 'desc'
  ): HttpParams {
    let params = new HttpParams()
      .set('page', pageIndex + 1)
      .set('pageSize', pageSize);

    if (sortBy && sortBy.trim().length > 0) {
      params = params.set('sortBy', sortBy).set('sortDir', sortDir);
    }
    return params;
  }
}
