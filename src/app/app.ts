import { Component, inject, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';

import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import {
  MatCell, MatCellDef, MatColumnDef, MatHeaderCell, MatHeaderCellDef,
  MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef, MatTable
} from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';

import { DataApiService } from './services/data-api.service';
import { GridRow } from './models/grid';

import { of, Subject, forkJoin } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';

interface NavNode {
  id?: string;                    // database object name
  kind?: 'table' | 'view';        // object type
  name: string;                   // label to render
  children?: NavNode[];           // for groups
  placeholder?: boolean;          // non-selectable info row
}

type LoadParams = { id: string; kind: 'table' | 'view'; pageIndex: number; pageSize: number };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    // Tree
    MatTreeModule, MatButtonModule, MatIconModule,
    // Table
    MatTable, MatHeaderCell, MatCell, MatColumnDef,
    MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
    MatHeaderCellDef, MatCellDef,
    // Paginator
    MatPaginator, LoadingIndicator,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected loading: WritableSignal<boolean> = signal(true);

  // -------- TREE (populated at runtime) ----------
  treeData: NavNode[] = [
    { name: 'Tables', children: [] },
    { name: 'Views',  children: [] },
  ];

  childrenAccessor = (node: NavNode) => node.children ?? [];
  hasChild = (_: number, node: NavNode) => !!node.children && node.children.length > 0;

  selectedNode: NavNode | null = null;

  // Top-level groups have no `id`
  isTopLevel = (node: NavNode) => !node.id;
  // Selectable = leaf with a real id and not a placeholder
  isSelectable = (node: NavNode) => !!node.id && !node.placeholder;
  isSelected = (node: NavNode) => this.selectedNode === node;

  // -------- GRID ----------
  columns: string[] = [];
  displayedColumns: string[] = [];
  rows: GridRow[] = [];
  total = 0;

  pageIndex = 0;
  pageSize = 50;

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  private readonly api = inject(DataApiService);
  private readonly load$ = new Subject<LoadParams>();

  ngOnInit(): void {
    // Build the tree from API — replace the entire array so the tree reevaluates templates.
    forkJoin({
      tables: this.api.listTables().pipe(catchError(() => of([]))),
      views:  this.api.listViews().pipe(catchError(() => of([]))),
    }).subscribe(({ tables, views }) => {
      let tableLeaves: NavNode[] = (tables ?? []).map(t => ({ id: t.name, name: t.name, kind: 'table' as const }));
      let viewLeaves:  NavNode[] = (views  ?? []).map(v => ({ id: v.name, name: v.name, kind: 'view'  as const }));

      if (tableLeaves.length === 0) {
        tableLeaves = [{ name: 'No tables found', placeholder: true }];
      }
      if (viewLeaves.length === 0) {
        viewLeaves = [{ name: 'No views found', placeholder: true }];
      }

      this.treeData = [
        { name: 'Tables', children: tableLeaves },
        { name: 'Views',  children: viewLeaves  },
      ];

      // Default selection: first real (non-placeholder) item (tables first, then views)
      const firstReal =
        tableLeaves.find(n => !n.placeholder) ??
        viewLeaves.find(n => !n.placeholder) ?? null;

      this.selectedNode = firstReal;
      this.pageIndex = 0;
      if (this.selectedNode) this.pushLoad();
      else this.loading.set(false); // nothing to load
    });

    // Data loading pipeline
    this.load$
      .pipe(
        distinctUntilChanged(
          (a, b) => a.id === b.id && a.kind === b.kind && a.pageIndex === b.pageIndex && a.pageSize === b.pageSize
        ),
        tap(() => this.loading.set(true)),
        switchMap(({ id, kind, pageIndex, pageSize }) =>
          this.api.getRows(kind, id, pageIndex, pageSize).pipe(
            catchError(() => of({ items: [], total: 0 }))
          )
        )
      )
      .subscribe(({ items, total }) => {
        this.rows = items;
        this.total = total;

        // Infer column list from current page
        const keys: string[] = [];
        const seen = new Set<string>();
        if (this.rows.length > 0) {
          for (const k of Object.keys(this.rows[0]!)) { seen.add(k); keys.push(k); }
          for (const r of this.rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
        }
        this.columns = keys;
        this.displayedColumns = [...this.columns];
        this.loading.set(false);
      });
  }

  // ---- UI handlers ----
  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return; // ignore groups & placeholders
    if (this.selectedNode === node) return;

    this.selectedNode = node;
    this.pageIndex = 0;
    this.pushLoad();
  }

  onPage(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.pushLoad();
  }

  private pushLoad() {
    const node = this.selectedNode;
    if (!node?.id || !node?.kind) return;
    this.load$.next({ id: node.id, kind: node.kind, pageIndex: this.pageIndex, pageSize: this.pageSize });
  }
}
