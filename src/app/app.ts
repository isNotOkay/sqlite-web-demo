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

import { Data, PeriodicElement } from './services/data.service';

interface NavNode {
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
      children: [{ name: 'Users' }, { name: 'Orders' }, { name: 'Products' }, { name: 'Audit Logs' }],
    },
    {
      name: 'Views',
      children: [{ name: 'Active Users' }, { name: 'Sales Summary' }, { name: 'Inventory Status' }],
    },
  ];

  childrenAccessor = (node: NavNode) => node.children ?? [];
  hasChild = (_: number, node: NavNode) => !!node.children && node.children.length > 0;

  // single-selection (leaves only)
  selectedNode: NavNode | null = null;
  isTopLevel = (node: NavNode) => this.treeData.includes(node);
  isSelectable = (node: NavNode) => !this.isTopLevel(node);
  isSelected = (node: NavNode) => this.selectedNode === node;
  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return;
    this.selectedNode = node;
  }

  // ---------- TABLE + PAGINATION ----------
  readonly pageSize = 50;
  displayedColumns: string[] = ['position', 'name', 'weight', 'symbol'];

  // Non-nullable dataSource with an initial empty array -> avoids TS2532 in template
  dataSource = new MatTableDataSource<PeriodicElement>([]);

  // Make paginator available in ngOnInit
  @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;

  private readonly data = inject(Data);

  ngOnInit(): void {
    // Attach paginator once
    this.dataSource.paginator = this.paginator;
    this.paginator.pageSize = this.pageSize;

    // Load data
    this.data.getElements().subscribe(rows => {
      this.dataSource.data = rows;
      this.paginator.firstPage(); // apply slice immediately
    });
  }
}
