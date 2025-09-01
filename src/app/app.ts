import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';

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
export class App implements OnInit, AfterViewInit {
  // ---------- TREE ----------
  treeData: NavNode[] = [
    {
      name: 'Tables',
      children: [
        { name: 'Users' },
        { name: 'Orders' },
        { name: 'Products' },
        { name: 'Audit Logs' },
      ],
    },
    {
      name: 'Views',
      children: [
        { name: 'Active Users' },
        { name: 'Sales Summary' },
        { name: 'Inventory Status' },
      ],
    },
  ];

  childrenAccessor = (node: NavNode) => node.children ?? [];
  hasChild = (_: number, node: NavNode) => !!node.children && node.children.length > 0;

  // single-selection (leaves only)
  selectedNode: NavNode | null = null;

  /** A node is top-level if it is a direct item of the root array. */
  isTopLevel = (node: NavNode) => this.treeData.includes(node);

  /** Only non top-level nodes (i.e., leaves in our data) are selectable. */
  isSelectable = (node: NavNode) => !this.isTopLevel(node);

  /** Selected predicate used for class binding. */
  isSelected = (node: NavNode) => this.selectedNode === node;

  selectNode(node: NavNode) {
    if (!this.isSelectable(node)) return; // ignore clicks on Tables/Views
    this.selectedNode = node;
  }

  // ---------- TABLE ----------
  displayedColumns: string[] = ['position', 'name', 'weight', 'symbol'];
  dataSource = new MatTableDataSource<PeriodicElement>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private readonly data = inject(Data);

  ngOnInit(): void {
    this.data.getElements().subscribe(rows => {
      this.dataSource.data = rows;
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
        this.paginator.pageSize = 50;   // fixed page size
        this.paginator.firstPage();
      }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.paginator.pageSize = 50;
    this.paginator.firstPage();
  }
}
