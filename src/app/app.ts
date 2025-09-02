// src/app/app.ts
import {Component, inject, OnInit, signal, ViewChild, WritableSignal} from '@angular/core';

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

import {DataApiService} from './services/data-api.service';
import {GridRow} from './models/grid';

import {forkJoin, of, Subject} from 'rxjs';
import {catchError, distinctUntilChanged, switchMap, tap} from 'rxjs/operators';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';
import {MatDivider} from '@angular/material/divider';

// NEW: material sort
import {MatSort, MatSortHeader, Sort} from '@angular/material/sort';

interface NavNode {
  id?: string;
  kind?: 'table' | 'view';
  name: string;
  children?: NavNode[];
  placeholder?: boolean;
}

// add sorting into load params
type LoadParams = {
  id: string;
  kind: 'table' | 'view';
  pageIndex: number;
  pageSize: number;
  sortBy?: string | null;
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
export class App implements OnInit {
  protected loading: WritableSignal<boolean> = signal(true);

  treeData: NavNode[] = [
    {name: 'Tables', children: []},
    {name: 'Views', children: []},
  ];
  selectedNode: NavNode | null = null;

  isSelectable = (node: NavNode) => !!node.id && !node.placeholder;
  isSelected = (node: NavNode) => this.selectedNode === node;

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
  private readonly load$ = new Subject<LoadParams>();

  ngOnInit(): void {
    // Build the sections from API.
    forkJoin({
      tables: this.api.listTables().pipe(catchError(() => of([]))),
      views: this.api.listViews().pipe(catchError(() => of([]))),
    }).subscribe(({tables, views}) => {
      let tableLeaves: NavNode[] = (tables ?? []).map(t => ({id: t.name, name: t.name, kind: 'table' as const}));
      let viewLeaves: NavNode[] = (views ?? []).map(v => ({id: v.name, name: v.name, kind: 'view' as const}));

      if (tableLeaves.length === 0) tableLeaves = [{name: 'No tables found', placeholder: true}];
      if (viewLeaves.length === 0) viewLeaves = [{name: 'No views found', placeholder: true}];

      this.treeData = [
        {name: 'Tables', children: tableLeaves},
        {name: 'Views', children: viewLeaves},
      ];

      const firstReal =
        tableLeaves.find(n => !n.placeholder) ??
        viewLeaves.find(n => !n.placeholder) ?? null;

      this.selectedNode = firstReal;
      this.pageIndex = 0;
      this.sortBy = null; // reset sort when app starts
      this.sortDir = 'asc';
      if (this.selectedNode) this.pushLoad();
      else this.loading.set(false);
    });

    // Data loading pipeline
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
          this.api.getRows(kind, id, pageIndex, pageSize, sortBy ?? undefined, sortDir ?? 'asc').pipe(
            catchError(() => of({items: [], total: 0}))
          )
        )
      )
      .subscribe(({items, total}) => {
        this.rows = items;
        this.total = total;

        // Infer columns from current page (keeps order stable)
        const keys: string[] = [];
        const seen = new Set<string>();
        if (this.rows.length > 0) {
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

  // ---- UI handlers ----
  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return;
    if (this.selectedNode === node) return;

    this.selectedNode = node;
    this.pageIndex = 0;

    // reset sort when switching objects
    this.sortBy = null;
    this.sortDir = 'asc';
    if (this.sort) this.sort.active = this.sort.direction = '' as any;

    this.pushLoad();
  }

  onPage(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.pushLoad();
  }

  // NEW: react to header clicks
  onSort(e: Sort) {
    // Angular Material gives direction '' when cleared
    if (!e.direction) {
      this.sortBy = null;
      this.sortDir = 'asc';
    } else {
      this.sortBy = e.active;
      this.sortDir = e.direction as 'asc' | 'desc';
    }
    // Reset to first page on sort change
    this.pageIndex = 0;
    this.pushLoad();
  }

  private pushLoad() {
    const node = this.selectedNode;
    if (!node?.id || !node?.kind) return;

    this.load$.next({
      id: node.id,
      kind: node.kind,
      pageIndex: this.pageIndex,
      pageSize: this.pageSize,
      sortBy: this.sortBy ?? undefined,
      sortDir: this.sortBy ? this.sortDir : undefined, // only send dir when sorting
    });
  }
}
