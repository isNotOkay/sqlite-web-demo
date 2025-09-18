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

import {ApiService} from './services/api.service';
import {LoadingIndicator} from './components/loading-indicator/loading-indicator';
import {RelationType} from './enums/relation-type.enum';
import {ListItemModel} from './models/list-item.model';
import {RelationApiModel} from './models/api/relation.api-model';
import {PagedResultApiModel} from './models/api/paged-result.api-model';
import {NavSectionComponent} from './nav-section/nav-section.component';
import {DEFAULT_PAGE_INDEX, DEFAULT_PAGE_SIZE} from './constants/api-params.constants';
import {RowModel} from './models/row.model';
import {CreateRelationEvent, DeleteRelationEvent, SignalRService} from './services/signalr.service';
import {NotificationService} from './services/notification.service';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {IsNumberPipe} from './pipes/is-numper.pipe';
import {getRelationTypeName} from './utils/sql.util';

interface SelectTarget {
  relationType: RelationType;
  name: string;
}

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
    MatSnackBarModule,
    IsNumberPipe,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  protected readonly loadingRows = signal(true);
  protected readonly loadedTablesAndViews = signal(false);
  protected readonly tableItems = signal<ListItemModel[]>([]);
  protected readonly viewItems = signal<ListItemModel[]>([]);
  protected readonly selectedListItem = signal<ListItemModel | null>(null);
  protected readonly columnNames = signal<string[]>([]);
  protected readonly rows = signal<Record<string, unknown>[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly pageIndex = signal(DEFAULT_PAGE_INDEX);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly sortBy = signal<string | null>(null);
  protected readonly sortDir = signal<'asc' | 'desc'>('asc');
  protected readonly sort = viewChild(MatSort);
  private readonly apiService = inject(ApiService);
  private readonly signalRService = inject(SignalRService);
  private readonly notificationService = inject(NotificationService);
  private loadRowsSubscription?: Subscription;

  ngOnInit(): void {
    this.listenToSignalREvents();
    this.loadTablesAndViews();
  }

  protected onSelectionChange(item: ListItemModel): void {
    this.selectListItem(item);
  }

  private selectListItem(item: ListItemModel): void {
    this.selectedListItem.set(item);
    this.pageIndex.set(0);
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

  private listenToSignalREvents(): void {
    this.signalRService.start();

    // CREATE → after reload, select the created object
    this.signalRService.onCreateRelation$.subscribe((event: CreateRelationEvent) => {
      this.loadTablesAndViews({relationType: event.type, name: event.name});
      this.notificationService.info(`${getRelationTypeName(event.type)} "${event.name}" wurde erstellt.`);
    });

    // DELETE → just reload; if the currently selected item still exists it stays, otherwise the page clears
    this.signalRService.onDeleteRelation$.subscribe((event: DeleteRelationEvent): void => {
      this.loadTablesAndViews();
      this.notificationService.info(`${getRelationTypeName(event.type)} "${event.name}" wurde gelöscht.`);
    });
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

  /**
   * Reload tables and views.
   * If a SelectTarget is provided (e.g. after CREATE), prefer selecting that.
   * Otherwise, keep the current selection if it still exists; if not, clear.
   */
  private loadTablesAndViews(selectTarget?: SelectTarget): void {
    forkJoin([this.apiService.loadTables(), this.apiService.loadViews()]).subscribe({
      next: ([tablesResponse, viewsResponse]) => {
        this.tableItems.set(this.toListItems(tablesResponse.items, RelationType.Table));
        this.viewItems.set(this.toListItems(viewsResponse.items, RelationType.View));
        this.loadedTablesAndViews.set(true);

        let listItem: ListItemModel | null = null;

        if (selectTarget) {
          const type = selectTarget.relationType === RelationType.View ? RelationType.View : RelationType.Table;
          listItem = this.findInLists(type, selectTarget.name);
        }

        if (listItem) {
          this.selectListItem(listItem);
        } else {
          this.clearSelectedListItem();
        }
      },
      error: () => this.notificationService.error('Fehler beim Aktualisieren der Tabellen und Ansichten.'),
    });
  }

  private findInLists(type: RelationType, id: string): ListItemModel | null {
    const listItems = type === RelationType.Table ? this.tableItems() : this.viewItems();
    return listItems.find(item => item.id === id) ?? null;
  }

  private clearSelectedListItem(): void {
    this.selectedListItem.set(null);
    this.columnNames.set([]);
    this.rows.set([]);
    this.totalCount.set(0);
    this.loadingRows.set(false);
  }

  private updateColumns(): void {
    const cols = this.selectedListItem()?.columns ?? [];
    this.columnNames.set(cols);
  }

  private toListItems(relations: RelationApiModel[] | null | undefined, type: RelationType): ListItemModel[] {
    return (relations ?? []).map((relation) => ({
      id: relation.name,
      label: relation.name,
      relationType: type,
      columns: relation.columns ?? [],
    }));
  }

  private loadRows(): void {
    const listItem = this.selectedListItem();
    if (!listItem) return;

    this.loadingRows.set(true);
    this.loadRowsSubscription?.unsubscribe();

    this.loadRowsSubscription = this.apiService
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
          this.notificationService.error('Fehler beim Laden der Daten.');
        },
      });
  }
}
