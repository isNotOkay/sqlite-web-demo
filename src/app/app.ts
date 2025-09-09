// src/app/app.ts
import {AfterViewInit, Component, inject, OnInit, signal, viewChild, WritableSignal} from '@angular/core';

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
import {catchError, distinctUntilChanged, switchMap, tap} from 'rxjs/operators';

import {DataApiService} from './services/data-api.service';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';
import {RealtimeService, RemoteSelection} from './services/realtime.service';

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
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, AfterViewInit {
  protected loading: WritableSignal<boolean> = signal(true);
  protected items: ListItem[] = [];               // flat list of tables + views
  protected selected: ListItem | null = null;     // current selection
  protected columns: string[] = [];
  protected displayedColumns: string[] = [];
  protected rows: Record<string, unknown>[] = [];
  protected total = 0;
  protected pageIndex = 0;
  protected pageSize = 50;
  protected sortBy: string | null = null;
  protected sortDir: 'asc' | 'desc' = 'asc';
  protected sort = viewChild.required(MatSort);
  protected readonly RelationType = RelationType;
  private readonly api = inject(DataApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly load$ = new Subject<LoadParams>();
  private pendingSelection: RemoteSelection | null = null;


  ngOnInit(): void {
    // Start SignalR
    this.realtime.start().catch(err => console.error('SignalR start error', err));

    // Fetch tables + views, then build flat list
    forkJoin({
      tables: this.api.listTables().pipe(catchError(() => of([]))),
      views: this.api.listViews().pipe(catchError(() => of([]))),
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

      this.items = [...tableItems, ...viewItems];

      // Apply pending remote selection or pick first available
      if (this.pendingSelection) {
        const {relationType, id} = this.pendingSelection;
        this.pendingSelection = null;
        if (!this.trySelect(relationType, id)) this.selectFirstAvailable();
      } else {
        this.selectFirstAvailable();
      }
    });

    // Data loading pipeline
    this.load$
      .pipe(
        distinctUntilChanged((a, b) =>
          a.id === b.id &&
          a.relationType === b.relationType &&
          a.pageIndex === b.pageIndex &&
          a.pageSize === b.pageSize &&
          (a.sortBy ?? null) === (b.sortBy ?? null) &&
          (a.sortDir ?? 'asc') === (b.sortDir ?? 'asc')
        ),
        tap(() => this.loading.set(true)),
        switchMap(({id, relationType, pageIndex, pageSize, sortBy, sortDir}) =>
          this.api.getRows(relationType, id, pageIndex, pageSize, sortBy, sortDir ?? 'asc')
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
        this.columns = keys;
        this.displayedColumns = [...this.columns];
        this.loading.set(false);
      });
  }

  ngAfterViewInit(): void {
    this.realtime.selection$.subscribe(selection => {
      if (!this.items.length) {
        this.pendingSelection = selection;
        return;
      }
      if (!this.trySelect(selection.relationType, selection.id)) {
        console.warn('Remote selection not found:', selection);
      }
    });
  }

  protected selectItem(item: ListItem): void {
    if (this.selected?.id === item.id && this.selected?.relationType === item.relationType) return;

    this.selected = item;
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
    for (const row of this.rows) {
      const cellValue = (row as any)[columnName];

      // skip empty values
      if (cellValue == null || cellValue === '') {
        continue;
      }

      // treat numbers and numeric strings as numeric (per your request)
      if (_.isNumber(cellValue)) return true;
      if (_.isString(cellValue) && _.isNumber(Number(cellValue))) return true;

      // first non-empty sample is not numeric
      return false;
    }
    // no non-empty values found
    return false;
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
    return this.items.some(item => item.relationType === relationType);
  }

  private selectFirstAvailable(): void {
    this.selected = this.items[0] ?? null;
    this.pageIndex = 0;
    this.sortBy = null;
    this.sortDir = 'asc';
    if (this.selected) this.pushLoad();
    else this.loading.set(false);
  }

  private trySelect(relationType: RelationType, id: string): boolean {
    const found = this.items.find(item => item.relationType === relationType && item.id === id);
    if (!found) return false;
    this.selectItem(found);
    return true;
  }

  private pushLoad(): void {
    if (!this.selected) return;
    this.load$.next({
      id: this.selected.id,
      relationType: this.selected.relationType,
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
      sortBy: this.sortBy ?? undefined,
      sortDir: this.sortBy ? this.sortDir : undefined,
    });
  }
}
