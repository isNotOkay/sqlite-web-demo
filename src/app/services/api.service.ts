import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResultApiModel } from '../models/api/paged-result.api-model';
import { RelationApiModel } from '../models/api/relation.api-model';
import { RelationType } from '../enums/relation-type.enum';
import { DEFAULT_PAGE_INDEX, DEFAULT_PAGE_SIZE } from '../constants/api-params.constants';
import { RowModel } from '../models/row.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private readonly apiPrefix = '/api/web-viewer';

  loadTables(
    pageIndex = DEFAULT_PAGE_INDEX,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy: string | null = 'Name',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Observable<PagedResultApiModel<RelationApiModel>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResultApiModel<RelationApiModel>>(
      `${this.apiPrefix}/tables`,
      { params },
    );
  }

  loadViews(
    pageIndex = DEFAULT_PAGE_INDEX,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy: string | null = 'Name',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Observable<PagedResultApiModel<RelationApiModel>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResultApiModel<RelationApiModel>>(
      `${this.apiPrefix}/views`,
      { params },
    );
  }

  loadRows(
    relationType: RelationType,
    id: string,
    pageIndex: number,
    pageSize: number,
    sortBy?: string | null,
    sortDir: 'asc' | 'desc' = 'asc',
  ): Observable<PagedResultApiModel<RowModel>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy ?? null, sortDir);
    const path = relationType === RelationType.Table ? 'tables' : 'views';
    return this.http.get<PagedResultApiModel<RowModel>>(
      `${this.apiPrefix}/${path}/${encodeURIComponent(id)}`,
      { params },
    );
  }

  private buildParams(pageIndex: number, pageSize: number, sortBy: string | null, sortDir: 'asc' | 'desc'): HttpParams {
    let params = new HttpParams()
      .set('page', String(pageIndex + 1))   // backend is 1-based
      .set('pageSize', String(pageSize));

    if (sortBy && sortBy.trim().length > 0) {
      params = params.set('sortBy', sortBy).set('sortDir', sortDir);
    }
    return params;
  }
}
