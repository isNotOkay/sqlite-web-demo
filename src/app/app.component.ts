import {Component, inject, OnInit, signal, viewChild, WritableSignal} from '@angular/core';

import {MatButtonModule} from '@angular/material/button';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable
} from '@angular/material/table';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {MatDivider} from '@angular/material/divider';
import {MatSort, MatSortHeader, Sort} from '@angular/material/sort';

import {forkJoin, of, Subject} from 'rxjs';
import {catchError, switchMap, tap} from 'rxjs/operators';

import {DataApiService} from './services/data-api.service';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';

import * as _ from 'underscore';
import {RelationType} from './enums/relation-type.enum';
import {ListItem} from './models/list-item.model';
import {LoadParams} from './models/load-params.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatTable, MatHeaderCell, MatCell, MatColumnDef,
    MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
    MatHeaderCellDef, MatCellDef,
    MatPaginator, LoadingIndicator, MatButtonModule, MatDivider,
    MatSort, MatSortHeader,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  protected loading: WritableSignal<boolean> = signal(true);

  // CHANGED: keep UI-bound list as a signal so change detection runs
  protected listItems = signal<ListItem[]>([]);

  protected selectedListItem: ListItem | null = null;
  protected columnNames: string[] = [];
  protected displayedColumns: string[] = [];
  protected rows: Record<string, unknown>[] = [];
  protected total = 0;
  protected pageIndex = 0;
  protected pageSize = 50;
  protected sortBy: string | null = null;
  protected sortDir: 'asc' | 'desc' = 'asc';
  protected sort = viewChild.required(MatSort);
  protected readonly RelationType = RelationType;
  private readonly dataApiService = inject(DataApiService);
  private readonly load$ = new Subject<LoadParams>();

  ngOnInit(): void {

    // Fetch tables + views, then build flat list (use per-stream fallbacks)
    forkJoin({
      tables: this.dataApiService.listTables().pipe(catchError(() => of([]))),
      views: this.dataApiService.listViews().pipe(catchError(() => of([]))),
    }).subscribe(({tables, views}) => {
      const tableItems: ListItem[] = (tables ?? []).map(t => ({
        id: t.name,
        label: t.name,
        relationType: RelationType.Table as const,
      }));
      const viewItems: ListItem[] = (views ?? []).map(v => ({
        id: v.name,
        label: v.name,
        relationType: RelationType.View as const,
      }));
      this.listItems.set([...tableItems, ...viewItems]);

      // auto-select first available to kick off loading
      this.selectFirstAvailable();
    });

    this.load$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({id, relationType, pageIndex, pageSize, sortBy, sortDir}) =>
          this.dataApiService
            .getRows(relationType, id, pageIndex, pageSize, sortBy, sortDir ?? 'asc')
            .pipe(catchError(() => of({items: [], total: 0})))
        )
      )
      .subscribe(({items, total}) => {
        this.rows = items;
        this.total = total;

        // Infer columns (stable order)
        const keys: string[] = [];
        const seen = new Set<string>();
        if (this.rows.length) {
          for (const k of Object.keys(this.rows[0]!)) {
            seen.add(k);
            keys.push(k);
          }
          for (const row of this.rows) {
            for (const key of Object.keys(row)) {
              if (!seen.has(key)) {
                seen.add(key);
                keys.push(key);
              }
            }
          }
        }
        this.columnNames = keys;
        this.displayedColumns = [...this.columnNames];
        this.loading.set(false);
      });
  }

  protected selectItem(item: ListItem): void {
    if (this.selectedListItem?.id === item.id && this.selectedListItem?.relationType === item.relationType) return;

    this.selectedListItem = item;
    this.pageIndex = 0;

    // reset sorting when switching objects
    this.sortBy = null;
    this.sortDir = 'asc';
    const sort = this.sort();
    if (sort) {
      sort.active = '' as any;
      sort.direction = '' as any;
    }
    this.pushLoad();
  }

  protected isNumericColumn(columnName: string): boolean {
    const first = this.rows.find(row => {
      const value = row[columnName];
      return value != null && value !== '';
    });
    return first ? _.isNumber((first as any)[columnName]) : false;
  }

  protected onPage(pageEvent: PageEvent): void {
    this.pageIndex = pageEvent.pageIndex;
    this.pageSize = pageEvent.pageSize;
    this.pushLoad();
  }

  protected onSort(sort: Sort): void {
    if (!sort.direction) {
      this.sortBy = null;
      this.sortDir = 'asc';
    } else {
      this.sortBy = sort.active;
      this.sortDir = sort.direction as 'asc' | 'desc';
    }
    this.pageIndex = 0;
    this.pushLoad();
  }

  protected hasRelationType(relationType: RelationType): boolean {
    return this.listItems().some(item => item.relationType === relationType);
  }

  private selectFirstAvailable(): void {
    const items = this.listItems();
    this.selectedListItem = items[0] ?? null;
    this.pageIndex = 0;
    this.sortBy = null;
    this.sortDir = 'asc';
    if (this.selectedListItem) this.pushLoad();
    else this.loading.set(false);
  }


  private pushLoad(): void {
    if (!this.selectedListItem) return;
    this.load$.next({
      id: this.selectedListItem.id,
      relationType: this.selectedListItem.relationType,
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
      sortBy: this.sortBy ?? undefined,
      sortDir: this.sortBy ? this.sortDir : undefined,
    });
  }
}
