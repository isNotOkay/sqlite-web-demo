// file: src/app/app.ts
import { Component, OnInit, AfterViewInit, ViewChild, inject } from '@angular/core';
import {
  MatCell, MatCellDef,
  MatColumnDef,
  MatHeaderCell, MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource
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
      this.dataSource.data = rows;          // fill table from service
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator; // hook up the paginator
  }
}
