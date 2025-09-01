import { Component, OnInit, ViewChild, inject, signal, WritableSignal } from '@angular/core';

import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import {
  MatTable, MatHeaderCell, MatCell, MatColumnDef,
  MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
  MatHeaderCellDef, MatCellDef
} from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';

import { DataApiService } from './services/data-api.service';
import { GridRow } from './models/grid';
import { LoadingIndicator } from './components/loading-indicator/loading-indicator';
import { finalize } from 'rxjs';

interface NavNode {
  id?: string;            // "users" | "orders" | "products" | "audit-logs"
  name: string;
  children?: NavNode[];
}

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
  treeData: NavNode[] = [
    {
      name: 'Tables',
      children: [
        { id: 'users',       name: 'Users' },
        { id: 'orders',      name: 'Orders' },
        { id: 'products',    name: 'Products' },
        { id: 'audit-logs',  name: 'Audit Logs' },
      ],
    },
    {
      name: 'Views',
      children: [
        { id: 'active-users',      name: 'Active Users' },
        { id: 'sales-summary',     name: 'Sales Summary' },
        { id: 'inventory-status',  name: 'Inventory Status' },
      ],
    },
  ];

  childrenAccessor = (node: NavNode) => node.children ?? [];
  hasChild = (_: number, node: NavNode) => !!node.children && node.children.length > 0;

  selectedNode: NavNode | null = null;
  isTopLevel = (node: NavNode) => this.treeData.includes(node);
  isSelectable = (node: NavNode) => !this.isTopLevel(node) && !!node.id;
  isSelected = (node: NavNode) => this.selectedNode === node;

  // -------- GRID (server-side paging; columns inferred from rows) ----------
  columns: string[] = [];         // column keys inferred per page
  displayedColumns: string[] = []; // material needs a second array
  rows: GridRow[] = [];
  total = 0;

  pageIndex = 0;
  pageSize = 50;

  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  private readonly api = inject(DataApiService);

  ngOnInit(): void {
    // Default dataset
    this.selectedNode = { id: 'users', name: 'Users' };
    this.loadRows();
  }

  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return;
    this.selectedNode = node;
    this.pageIndex = 0; // reset page when switching datasets
    this.loadRows();
  }

  onPage(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    this.pageSize = e.pageSize;
    this.loadRows();
  }

  private loadRows() {
    this.loading.set(true);
    const id = this.selectedNode?.id ?? 'users';

    this.api.getRows(id, this.pageIndex, this.pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(res => {
        this.rows  = res.items;
        this.total = res.total;

        // Infer columns from current page (first row order, then union).
        const keys: string[] = [];
        const seen = new Set<string>();
        if (this.rows.length > 0) {
          Object.keys(this.rows[0]!).forEach(k => { seen.add(k); keys.push(k); });
          for (const r of this.rows) {
            for (const k of Object.keys(r)) {
              if (!seen.has(k)) { seen.add(k); keys.push(k); }
            }
          }
        }
        this.columns = keys;
        this.displayedColumns = [...this.columns];
      });
  }
}
