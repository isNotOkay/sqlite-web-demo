import { Component, OnInit, ViewChild, inject } from '@angular/core';

import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import {
  MatTable, MatHeaderCell, MatCell, MatColumnDef,
  MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
  MatHeaderCellDef, MatCellDef, MatTableDataSource
} from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';

import { DataApiService } from './services/data-api.service';
import { GridColumn, GridDataset, GridRow } from './models/grid';

interface NavNode {
  id?: string;         // set on leaves (e.g., "users", "orders")
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
    MatPaginator
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  // ---------- TREE ----------
  treeData: NavNode[] = [
    {
      name: 'Tables',
      children: [
        { id: 'users',  name: 'Users' },
        { id: 'orders', name: 'Orders' },
        { id: 'products', name: 'Products' },     // add these to db.json when ready
        { id: 'audit-logs', name: 'Audit Logs' }  // add later too
      ],
    },
    {
      name: 'Views',
      children: [
        { id: 'active-users',   name: 'Active Users' },   // add later
        { id: 'sales-summary',  name: 'Sales Summary' },  // add later
        { id: 'inventory-status', name: 'Inventory Status' } // add later
      ],
    },
  ];

  childrenAccessor = (node: NavNode) => node.children ?? [];
  hasChild = (_: number, node: NavNode) => !!node.children && node.children.length > 0;

  // selection (leaves only)
  selectedNode: NavNode | null = null;
  isTopLevel = (node: NavNode) => this.treeData.includes(node);
  isSelectable = (node: NavNode) => !this.isTopLevel(node) && !!node.id;
  isSelected = (node: NavNode) => this.selectedNode === node;

  // ---------- TABLE ----------
  readonly pageSize = 50;
  columns: GridColumn[] = [];
  displayedColumns: string[] = [];                 // keys for Material header/row defs
  dataSource = new MatTableDataSource<GridRow>([]);
  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  private readonly api = inject(DataApiService);

  ngOnInit(): void {
    // paginator
    this.dataSource.paginator = this.paginator;
    this.paginator.pageSize = this.pageSize;

    // load a default dataset (users) on first render
    this.loadDataset('users');
  }

  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return;
    this.selectedNode = node;
    this.loadDataset(node.id!);
  }

  private loadDataset(id: string) {
    this.api.getDataset(id).subscribe((ds: GridDataset) => {
      this.columns = ds.columns ?? [];
      this.displayedColumns = this.columns.map(c => c.key);
      this.dataSource.data = ds.rows ?? [];
      this.paginator.firstPage();
    });
  }
}
