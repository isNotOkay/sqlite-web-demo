// file: src/app/app.ts
import { Component, OnInit, inject } from '@angular/core';
import {
  MatCell, MatCellDef,
  MatColumnDef,
  MatHeaderCell, MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable
} from '@angular/material/table';
import { Data, PeriodicElement } from './services/data.service';

@Component({
  selector: 'app-root',
  imports: [MatTable, MatHeaderCell, MatCell, MatColumnDef, MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef, MatHeaderCellDef, MatCellDef],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true
})
export class App implements OnInit {
  private readonly data = inject(Data);

  displayedColumns: string[] = ['position', 'name', 'weight', 'symbol'];
  dataSource: PeriodicElement[] = [];

  ngOnInit(): void {
    this.data.getElements().subscribe(rows => {
      this.dataSource = rows;
    });
  }
}
