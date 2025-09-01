import { Component, inject, OnInit, signal, ViewChild, WritableSignal } from '@angular/core';

import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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
import { MatPaginator, PageEvent } from '@angular/material/paginator';

import { DataApiService } from './services/data-api.service';
import { GridRow } from './models/grid';
import { LoadingIndicator } from './components/loading-indicator/loading-indicator';

import { of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';

interface NavNode {
  id?: string;  // table name in SQLite, e.g. "Users" | "Orders"
  name: string;
  children?: NavNode[];
}

type LoadParams = { id: string; pageIndex: number; pageSize: number };

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
    // Paginator + overlay
    MatPaginator, LoadingIndicator,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected loading: WritableSignal<boolean> = signal(true);

  // -------- TREE ----------
  // Keep IDs exactly equal to the SQLite table names:
  treeData: NavNode[] = [
    {
      name: 'Tables',
      children: [
        { id: 'Users',  name: 'Users'  },
        { id: 'Orders', name: 'Orders' },
      ],
    },
    // You can add "Views" or more tables later when they exist in SQLite.
  ];

  childrenAccessor = (node: NavNode) => node.children ?? [];
  hasChild = (_: number, node: NavNode) => !!node.children && node.children.length > 0;

  selectedNode: NavNode | null = null;
  isTopLevel = (node: NavNode) => this.treeData.includes(node);
  isSelectable = (node: NavNode) => !this.isTopLevel(node) && !!node.id;
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

  // Stream that drives requests; switchMap on this cancels previous in-flight call
  private readonly load$ = new Subject<LoadParams>();

  ngOnInit(): void {
    // Wire the request pipeline with cancellation and simple error handling
    this.load$
      .pipe(
        distinctUntilChanged(
          (a, b) => a.id === b.id && a.pageIndex === b.pageIndex && a.pageSize === b.pageSize
        ),
        tap(() => this.loading.set(true)),
        switchMap(({ id, pageIndex, pageSize }) =>
          this.api.getRows(id, pageIndex, pageSize).pipe(
            catchError(() => of({ items: [], total: 0 }))
          )
        )
      )
      .subscribe(({ items, total }) => {
        this.rows = items;
        this.total = total;

        // Infer columns from current page
        const keys: string[] = [];
        const seen = new Set<string>();
        if (this.rows.length > 0) {
          Object.keys(this.rows[0]!).forEach(k => {
            seen.add(k);
            keys.push(k);
          });
          for (const r of this.rows) {
            for (const k of Object.keys(r)) {
              if (!seen.has(k)) {
                seen.add(k);
                keys.push(k);
              }
            }
          }
        }
        this.columns = keys;
        this.displayedColumns = [...this.columns];

        this.loading.set(false);
      });

    // Default dataset on load
    this.selectedNode = { id: 'Users', name: 'Users' };
    this.pushLoad();
  }

  // ---- UI handlers ----
  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return;
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

  // Emit current params into the stream
  private pushLoad() {
    const id = this.selectedNode?.id ?? 'Users';
    this.load$.next({ id, pageIndex: this.pageIndex, pageSize: this.pageSize });
  }
}
