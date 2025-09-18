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
  type: RelationType;
  name: string
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
    this.reloadTablesAndViews({initial: true});
  }

  protected selectListItem(item: ListItemModel): void {
    const selectedItem = this.selectedListItem();
    if (selectedItem?.id === item.id && selectedItem?.relationType === item.relationType) return;
    this.applySelection(item, false);
  }

  protected onPage(pageEvent: PageEvent): void {
    this.pageIndex.set(pageEvent.pageIndex);
    this.pageSize.set(pageEvent.pageSize);
    this.loadRows();
  }


  private listenToSignalREvents(): void {
    this.signalRService.start();

    // CREATE → reload and select created object
    this.signalRService.onCreateRelation$.subscribe((event: CreateRelationEvent) => {
      this.reloadTablesAndViews({select: {type: event.type, name: event.name}});
      this.notificationService.info(`${getRelationTypeName(event.type)} "${event.name}" wurde erstellt.`);
    });

    // DELETE → reload; keep previous selection if it still exists; clear it if it was deleted
    this.signalRService.onDeleteRelation$.subscribe((event: DeleteRelationEvent): void => {
      this.reloadTablesAndViews({preserve: this.selectedListItem(), deleted: {type: event.type, name: event.name}});
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

  private reloadTablesAndViews(options: {
    initial?: boolean;
    select?: SelectTarget;
    preserve?: ListItemModel | null;
    deleted?: SelectTarget;
  } = {}): void {
    forkJoin([this.apiService.loadTables(), this.apiService.loadViews()]).subscribe({
      next: ([tablesResponse, viewsResponse]) => {
        this.setRelations(tablesResponse, viewsResponse);
        this.updateListAndSelectionAfterReload(this.resolveNextSelectedListItem(options), Boolean(options.initial));
      },
      error: () => this.notificationService.error('Fehler beim Aktualisieren der Tabellen und Ansichten.'),
    });
  }

  private resolveNextSelectedListItem(options: {
    initial?: boolean;
    select?: SelectTarget;
    preserve?: ListItemModel | null;
    deleted?: SelectTarget;
  }): ListItemModel | null {
    // explicit select by type+name (e.g., on create)
    if (options.select) {
      const type = options.select.type === 'view' ? RelationType.View : RelationType.Table;
      return this.findInLists(type, options.select.name);
    }

    // preserve previous (e.g., on delete)
    if (options.preserve) {
      const delType = options.deleted?.type === 'view' ? RelationType.View : RelationType.Table;
      const wasDeleted =
        !!options.deleted &&
        options.preserve.relationType === delType &&
        options.preserve.id === options.deleted.name;

      return wasDeleted ? null : this.findInLists(options.preserve.relationType, options.preserve.id);
    }

    // initial load: pick first table, else first view
    if (options.initial) {
      return this.tableItems()[0] ?? this.viewItems()[0] ?? null;
    }

    return null;
  }

  private updateListAndSelectionAfterReload(next: ListItemModel | null, initial: boolean): void {
    if (next) {
      // preserve paging/sort for runtime refreshes; reset only on very first load
      this.applySelection(next, /*preservePagingAndSort*/ !initial);
    } else {
      this.clearSelectionAndView();
    }
    if (initial) this.loadedTablesAndViews.set(true);
  }


  private setRelations(
    tablesRes: PagedResultApiModel<RelationApiModel>,
    viewsRes: PagedResultApiModel<RelationApiModel>,
  ): void {
    this.tableItems.set(this.toListItems(tablesRes?.items ?? [], RelationType.Table));
    this.viewItems.set(this.toListItems(viewsRes?.items ?? [], RelationType.View));
  }

  private findInLists(type: RelationType, id: string): ListItemModel | null {
    const pool = type === RelationType.Table ? this.tableItems() : this.viewItems();
    return pool.find(i => i.id === id) ?? null;
  }

  private applySelection(item: ListItemModel, preservePagingAndSort: boolean): void {
    this.selectedListItem.set(item);

    if (!preservePagingAndSort) {
      this.pageIndex.set(0);
      this.sortBy.set(null);
      this.sortDir.set('asc');

      const sort = this.sort();
      if (sort) {
        sort.active = '';
        sort.direction = '';
      }
    }

    this.updateColumns();
    this.loadRows();
  }

  private clearSelectionAndView(): void {
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
