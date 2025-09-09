import {AfterViewInit, Component, inject, OnInit, signal, ViewChild, WritableSignal} from '@angular/core';

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
import {GridRow} from './models/grid';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';
import {RealtimeService, RemoteSelection} from './services/realtime.service';

import * as _ from 'underscore';


type Kind = 'table' | 'view';

interface ListItem {
  id: string;           // object name (e.g., "Users", "Orders")
  kind: Kind;           // 'table' | 'view'
  label: string;        // what we render in the sidebar
}

type LoadParams = {
  id: string;
  kind: Kind;
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

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

  items: ListItem[] = [];              // flat list of tables + views
  selected: ListItem | null = null;    // current selection

  columns: string[] = [];
  displayedColumns: string[] = [];
  rows: GridRow[] = [];
  total = 0;
  pageIndex = 0;
  pageSize = 50;
  sortBy: string | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  @ViewChild(MatPaginator, {static: true}) paginator!: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort!: MatSort;

  private readonly api = inject(DataApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly load$ = new Subject<LoadParams>();

  // if a remote selection lands before items are loaded
  private pendingSelection: RemoteSelection | null = null;

  ngOnInit(): void {
    // start SignalR
    this.realtime.start().catch(err => console.error('SignalR start error', err));

    // fetch tables + views, then build flat list
    forkJoin({
      tables: this.api.listTables().pipe(catchError(() => of([]))),
      views: this.api.listViews().pipe(catchError(() => of([]))),
    }).subscribe(({tables, views}) => {
      const tableItems: ListItem[] = (tables ?? []).map(t => ({id: t.name, label: t.name, kind: 'table' as const}));
      const viewItems: ListItem[] = (views ?? []).map(v => ({id: v.name, label: v.name, kind: 'view' as const}));

      this.items = [
        ...tableItems,
        ...viewItems,
      ];

      // select something
      if (this.pendingSelection) {
        const {kind, id} = this.pendingSelection;
        this.pendingSelection = null;
        if (!this.trySelect(kind, id)) this.selectFirstAvailable();
      } else {
        this.selectFirstAvailable();
      }
    });

    // load pipeline
    this.load$
      .pipe(
        distinctUntilChanged((a, b) =>
          a.id === b.id &&
          a.kind === b.kind &&
          a.pageIndex === b.pageIndex &&
          a.pageSize === b.pageSize &&
          (a.sortBy ?? null) === (b.sortBy ?? null) &&
          (a.sortDir ?? 'asc') === (b.sortDir ?? 'asc')
        ),
        tap(() => this.loading.set(true)),
        switchMap(({id, kind, pageIndex, pageSize, sortBy, sortDir}) =>
          this.api.getRows(kind, id, pageIndex, pageSize, sortBy, sortDir ?? 'asc')
            .pipe(catchError(() => of({items: [], total: 0})))
        )
      )
      .subscribe(({items, total}) => {
        this.rows = items;
        this.total = total;

        // infer columns (stable order)
        const keys: string[] = [];
        const seen = new Set<string>();
        if (this.rows.length) {
          for (const k of Object.keys(this.rows[0]!)) {
            seen.add(k);
            keys.push(k);
          }
          for (const r of this.rows) for (const k of Object.keys(r)) if (!seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        }
        this.columns = keys;
        this.displayedColumns = [...this.columns];
        this.loading.set(false);
      });
  }

  ngAfterViewInit(): void {
    this.realtime.selection$.subscribe(sel => {
      if (!this.items.length) {
        this.pendingSelection = sel;
        return;
      }
      if (!this.trySelect(sel.kind, sel.id)) {
        console.warn('Remote selection not found:', sel);
      }
    });
  }

  // ---- selection + load ----
  selectItem(item: ListItem) {
    if (this.selected?.id === item.id && this.selected?.kind === item.kind) return;

    this.selected = item;
    this.pageIndex = 0;

    // reset sorting when switching objects
    this.sortBy = null;
    this.sortDir = 'asc';
    if (this.sort) this.sort.active = this.sort.direction = '' as any;

    this.pushLoad();
  }


  protected isNumericColumn(column: string): boolean {
    for (const row of this.rows) {
      const value = (row as any)[column];
      if (value != null && value !== '') {
        return _.isNumber(value) || (_.isString(value) && _.isNumber(Number(value)));
      }
    }
    return false;
  }

  private selectFirstAvailable() {
    this.selected = this.items[0] ?? null;
    this.pageIndex = 0;
    this.sortBy = null;
    this.sortDir = 'asc';
    if (this.selected) this.pushLoad();
    else this.loading.set(false);
  }

  private trySelect(kind: Kind, id: string): boolean {
    const found = this.items.find(i => i.kind === kind && i.id === id);
    if (!found) return false;
    this.selectItem(found);
    return true;
  }

  private pushLoad() {
    if (!this.selected) return;
    this.load$.next({
      id: this.selected.id,
      kind: this.selected.kind,
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
      sortBy: this.sortBy ?? undefined,
      sortDir: this.sortBy ? this.sortDir : undefined,
    });
  }

  // ---- ui handlers ----

  onPage(pageEvent: PageEvent) {
    this.pageIndex = pageEvent.pageIndex;
    this.pageSize = pageEvent.pageSize;
    this.pushLoad();
  }

  onSort(sort: Sort) {
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


  hasKind(kind: 'table' | 'view'): boolean {
    return this.items.some(item => item.kind === kind);
  }

}
