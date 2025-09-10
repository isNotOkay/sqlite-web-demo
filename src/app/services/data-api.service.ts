import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {PagedResultApiModel} from '../models/api/paged-result.model';
import {RelationApiModel} from '../models/api/relation.model';
import {RelationType} from '../enums/relation-type.enum';
import {DEFAULT_PAGE_INDEX, DEFAULT_PAGE_SIZE} from '../constants/api-params.constants';
import {RowModel} from '../models/row.model';

@Injectable({providedIn: 'root'})
export class DataApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5282';

  loadTables(
    pageIndex = DEFAULT_PAGE_INDEX,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy: string | null = 'name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResultApiModel<RelationApiModel>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResultApiModel<RelationApiModel>>(`${this.baseUrl}/api/tables`, {params});
  }

  loadViews(
    pageIndex = DEFAULT_PAGE_INDEX,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy: string | null = 'name',
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResultApiModel<RelationApiModel>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy, sortDir);
    return this.http.get<PagedResultApiModel<RelationApiModel>>(`${this.baseUrl}/api/views`, {params});
  }

  loadRows(
    relationType: RelationType,
    id: string,
    pageIndex: number,
    pageSize: number,
    sortBy?: string | null,
    sortDir: 'asc' | 'desc' = 'asc'
  ): Observable<PagedResultApiModel<RowModel>> {
    const params = this.buildParams(pageIndex, pageSize, sortBy ?? null, sortDir);
    const path = relationType === RelationType.Table ? 'tables' : 'views';
    return this.http.get<PagedResultApiModel<RowModel>>(
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
