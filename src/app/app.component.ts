import {Component, inject, OnInit, signal, viewChild} from '@angular/core';

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
import {MatDivider} from '@angular/material/divider';
import {MatSort, MatSortHeader, Sort} from '@angular/material/sort';

import {finalize, forkJoin, Subscription} from 'rxjs';

import {DataApiService} from './services/data-api.service';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';

import * as _ from 'underscore';
import {RelationType} from './enums/relation-type.enum';
import {ListItem} from './models/list-item.model';
import {Relation} from './models/relation.model';
import {PagedResult} from './models/paged-result.model';
import {NavSectionComponent} from './nav-section/nav-section.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatTable, MatHeaderCell, MatCell, MatColumnDef,
    MatHeaderRow, MatRow, MatRowDef, MatHeaderRowDef,
    MatHeaderCellDef, MatCellDef,
    MatPaginator, LoadingIndicator, MatButtonModule, MatDivider,
    MatSort, MatSortHeader, NavSectionComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  protected loading = signal(true);
  protected tableItems = signal<ListItem[]>([]);
  protected viewItems = signal<ListItem[]>([]);
  protected selectedListItem = signal<ListItem | null>(null);
  protected columnNames = signal<string[]>([]);
  protected rows = signal<Record<string, unknown>[]>([]);
  protected totalCount = signal(0);
  protected pageIndex = signal(0);
  protected pageSize = signal(50);
  protected sortBy = signal<string | null>(null);
  protected sortDir = signal<'asc' | 'desc'>('asc');
  protected sort = viewChild.required(MatSort);
  protected readonly RelationType = RelationType;

  private loadRowsSubscription?: Subscription;
  private readonly dataApiService = inject(DataApiService);

  ngOnInit(): void {
    this.loadTablesAndViews();
  }

  private loadRows(): void {
    const listItem = this.selectedListItem();
    if (!listItem) return;

    this.loading.set(true);
    this.loadRowsSubscription?.unsubscribe();

    this.loadRowsSubscription = this.dataApiService
      .loadRows(
        listItem.relationType,
        listItem.id,
        this.pageIndex(),
        this.pageSize(),
        this.sortBy(),
        this.sortDir()
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result: PagedResult) => {
          this.rows.set(result.items ?? []);
          this.totalCount.set((result.total as number) ?? 0);
        },
        error: () => {
          this.rows.set([]);
          this.totalCount.set(0);
        },
      });
  }

  private loadTablesAndViews(): void {
    forkJoin([
      this.dataApiService.loadTables(),
      this.dataApiService.loadViews(),
    ]).subscribe({
      next: ([tablesRes, viewsRes]: [PagedResult<Relation>, PagedResult<Relation>]) => {
        const tableItems = this.toListItems(tablesRes?.items ?? [], RelationType.Table);
        const viewItems = this.toListItems(viewsRes?.items ?? [], RelationType.View);

        this.tableItems.set(tableItems);
        this.viewItems.set(viewItems);

        this.selectFirstAvailable();
      },
      error: () => {
        this.tableItems.set([]);
        this.viewItems.set([]);
        this.loading.set(false);
      },
    });
  }

  private toListItems(relations: Relation[] | null | undefined, type: RelationType): ListItem[] {
    return (relations ?? []).map(relation => ({
      id: relation.name,
      label: relation.name,
      relationType: type,
      columns: relation.columns ?? [],
    }));
  }

  private updateColumns(): void {
    const cols = this.selectedListItem()?.columns ?? [];
    this.columnNames.set(cols);
  }

  private selectFirstAvailable(): void {
    const first = this.tableItems()[0] ?? this.viewItems()[0] ?? null;

    this.selectedListItem.set(first);
    this.pageIndex.set(0);
    this.sortBy.set(null);
    this.sortDir.set('asc');

    this.updateColumns();

    if (first) this.loadRows();
    else this.loading.set(false);
  }

  protected selectItem(item: ListItem): void {
    const sel = this.selectedListItem();
    if (sel?.id === item.id && sel?.relationType === item.relationType) return;

    this.selectedListItem.set(item);
    this.pageIndex.set(0);

    // reset sorting when switching objects
    this.sortBy.set(null);
    this.sortDir.set('asc');

    const sort = this.sort();
    if (sort) {
      sort.active = '' as any;
      sort.direction = '' as any;
    }

    this.updateColumns();
    this.loadRows();
  }

  protected onPage(pageEvent: PageEvent): void {
    this.pageIndex.set(pageEvent.pageIndex);
    this.pageSize.set(pageEvent.pageSize);
    this.loadRows();
  }

  protected onSort(sort: Sort): void {
    if (!sort.direction) {
      this.sortBy.set(null);
      this.sortDir.set('asc');
    } else {
      this.sortBy.set(sort.active);
      this.sortDir.set(sort.direction as 'asc' | 'desc');
    }
    this.pageIndex.set(0);
    this.loadRows();
  }

  protected isNumber(value: unknown): boolean {
    return _.isNumber(value);
  }
}
