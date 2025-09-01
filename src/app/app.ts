// file: src/app/app.ts
import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import {
  MatTable, MatHeaderCell, MatCell, MatColumnDef,
  MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
  MatHeaderCellDef, MatCellDef, MatTableDataSource
} from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Data, PeriodicElement } from './services/data.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatTable, MatHeaderCell, MatCell, MatColumnDef,
    MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
    MatHeaderCellDef, MatCellDef,
    MatPaginator
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, AfterViewInit {
  private readonly data = inject(Data);

  displayedColumns: string[] = ['position', 'name', 'weight', 'symbol'];
  dataSource = new MatTableDataSource<PeriodicElement>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit(): void {
    this.data.getElements().subscribe(rows => {
      this.dataSource.data = rows;

      // If paginator is already available, wire it now and enforce 50 rows
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
        this.paginator.pageSize = 50;
        this.paginator.firstPage(); // ensures the slice is applied immediately
      }
    });
  }

  ngAfterViewInit(): void {
    // Wire paginator after view init (covers the case where data arrives later)
    this.dataSource.paginator = this.paginator;
    this.paginator.pageSize = 50;
    this.paginator.firstPage();
  }
}
