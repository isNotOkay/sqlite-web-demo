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
  MatNoDataRow,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';
import {MatPaginator, PageEvent} from '@angular/material/paginator';
import {MatDivider} from '@angular/material/divider';
import {MatSort, MatSortHeader, Sort} from '@angular/material/sort';

import {finalize, forkJoin, Subscription} from 'rxjs';

import {DataApiService} from './services/data-api.service';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';

import * as _ from 'underscore';
import {RelationType} from './enums/relation-type.enum';
import {ListItemModel} from './models/list-item.model';
import {RelationApiModel} from './models/api/relation.api-model';
import {PagedResultApiModel} from './models/api/paged-result.api-model';
import {NavSectionComponent} from './nav-section/nav-section.component';
import {DEFAULT_PAGE_INDEX, DEFAULT_PAGE_SIZE} from './constants/api-params.constants';
import {RowModel} from './models/row.model';
import {SignalRService} from './services/signalr.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatTable,
    MatHeaderCell,
    MatCell,
    MatColumnDef,
    MatHeaderRow,
    MatRow,
    MatRowDef,
    MatHeaderRowDef,
    MatHeaderCellDef,
    MatCellDef,
    MatPaginator,
    LoadingIndicator,
    MatButtonModule,
    MatDivider,
    MatSort,
    MatSortHeader,
    NavSectionComponent,
    MatNoDataRow,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  protected loadingRows = signal(true);
  protected loadedTablesAndViews = signal(false);
  protected tableItems = signal<ListItemModel[]>([]);
  protected viewItems = signal<ListItemModel[]>([]);
  protected selectedListItem = signal<ListItemModel | null>(null);
  protected columnNames = signal<string[]>([]);
  protected rows = signal<Record<string, unknown>[]>([]);
  protected totalCount = signal(0);
  protected pageIndex = signal(DEFAULT_PAGE_INDEX);
  protected pageSize = signal(DEFAULT_PAGE_SIZE);
  protected sortBy = signal<string | null>(null);
  protected sortDir = signal<'asc' | 'desc'>('asc');
  protected sort = viewChild.required(MatSort);
  private loadRowsSubscription?: Subscription;
  private readonly dataApiService = inject(DataApiService);
  private readonly signalR = inject(SignalRService);

  ngOnInit(): void {
    this.signalR.start();
    this.loadTablesAndViews();
  }

  /** Programmatically select by type + id */
  protected selectById(relationType: RelationType, id: string): void {
    const pool = relationType === RelationType.Table ? this.tableItems() : this.viewItems();
    const found = pool.find((i) => i.id === id);
    if (found) this.selectListItem(found);
  }

  private loadRows(): void {
    const listItem = this.selectedListItem();
    if (!listItem) return;

    this.loadingRows.set(true);
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
      .pipe(finalize(() => this.loadingRows.set(false)))
      .subscribe({
        next: (result: PagedResultApiModel<RowModel>) => {
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
    forkJoin([this.dataApiService.loadTables(), this.dataApiService.loadViews()]).subscribe({
      next: ([tablesRes, viewsRes]: [PagedResultApiModel<RelationApiModel>, PagedResultApiModel<RelationApiModel>]) => {
        const tableItems = this.toListItems(tablesRes?.items ?? [], RelationType.Table);
        const viewItems = this.toListItems(viewsRes?.items ?? [], RelationType.View);

        this.tableItems.set(tableItems);
        this.viewItems.set(viewItems);

        // Pick first as a fallback (will be overwritten below if vw_holidays exists)
        this.selectFirstAvailable();

        // ✅ Test selection: auto-select the view "vw_holidays" when available
        this.selectById(RelationType.View, 'vw_holidays');

        this.loadedTablesAndViews.set(true);
      },
      error: () => {
        this.tableItems.set([]);
        this.viewItems.set([]);
        this.loadingRows.set(false);
      },
    });
  }

  private toListItems(relations: RelationApiModel[] | null | undefined, type: RelationType): ListItemModel[] {
    return (relations ?? []).map((relation) => ({
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
    else this.loadingRows.set(false);
  }

  protected selectListItem(item: ListItemModel): void {
    const selectedItem = this.selectedListItem();
    if (selectedItem?.id === item.id && selectedItem?.relationType === item.relationType) return;

    this.selectedListItem.set(item);
    this.pageIndex.set(0);

    // reset sorting when switching objects
    this.sortBy.set(null);
    this.sortDir.set('asc');

    const sort = this.sort();
    if (sort) {
      sort.active = '';
      sort.direction = '';
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
