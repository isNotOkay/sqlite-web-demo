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

import {finalize, forkJoin, Observable, Subscription} from 'rxjs';

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
import {CreateRelationEvent, DeleteRelationEvent, SignalRService} from './services/signalr.service';
import {ToastService} from './services/toast.service';
import {MatSnackBarModule} from '@angular/material/snack-bar';

type SelectTarget = { type: 'table' | 'view'; name: string };

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

  // Optional to avoid NG0951 when the table isn't rendered yet
  protected sort = viewChild(MatSort); // MatSort | undefined

  private loadRowsSubscription?: Subscription;
  private readonly dataApiService = inject(DataApiService);
  private readonly signalR = inject(SignalRService);
  private readonly toast = inject(ToastService);

  // ───────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Start SignalR
    this.signalR.start();

    // CREATE → reload and select created object
    this.signalR.onCreateRelation$.subscribe((evt: CreateRelationEvent) => {
      const noun = evt.type === 'view' ? 'Ansicht' : 'Tabelle';
      this.reloadTablesAndViews({select: {type: evt.type, name: evt.name}});
      this.toast.show(`${noun} "${evt.name}" wurde erstellt.`);
    });

    // DELETE → reload; keep previous selection if it still exists; clear it if it was deleted
    this.signalR.onDeleteRelation$.subscribe((evt: DeleteRelationEvent) => {
      const noun = evt.type === 'view' ? 'Ansicht' : 'Tabelle';
      this.reloadTablesAndViews({preserve: this.selectedListItem(), deleted: {type: evt.type, name: evt.name}});
      this.toast.show(`${noun} "${evt.name}" wurde gelöscht.`);
    });

    // Initial load
    this.reloadTablesAndViews({initial: true});
  }

  protected selectListItem(item: ListItemModel): void {
    const selectedItem = this.selectedListItem();
    if (selectedItem?.id === item.id && selectedItem?.relationType === item.relationType) return;
    this.applySelection(item, /*preservePagingAndSort*/ false);
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


  private reloadTablesAndViews(opts: {
    initial?: boolean;
    select?: SelectTarget;
    preserve?: ListItemModel | null;
    deleted?: SelectTarget;
  } = {}): void {
    this.loadTablesAndViews().subscribe({
      next: ([tablesRes, viewsRes]) => {
        this.setRelations(tablesRes, viewsRes);
        const listItem = this.getNextSelectedListItem(opts);
        this.updateListAndSelectionAfterReload(listItem, Boolean(opts.initial));
      },
      error: () => this.toast.showError('Fehler beim Aktualisieren der Tabellen und Ansichten.'),
    });
  }

  private getNextSelectedListItem(opts: {
    initial?: boolean;
    select?: SelectTarget;
    preserve?: ListItemModel | null;
    deleted?: SelectTarget;
  }): ListItemModel | null {
    // explicit select by type+name (e.g., on create)
    if (opts.select) {
      const type = opts.select.type === 'view' ? RelationType.View : RelationType.Table;
      return this.findInLists(type, opts.select.name);
    }

    // preserve previous (e.g., on delete)
    if (opts.preserve) {
      const delType = opts.deleted?.type === 'view' ? RelationType.View : RelationType.Table;
      const wasDeleted =
        !!opts.deleted &&
        opts.preserve.relationType === delType &&
        opts.preserve.id === opts.deleted.name;

      return wasDeleted ? null : this.findInLists(opts.preserve.relationType, opts.preserve.id);
    }

    // initial load: pick first table, else first view
    if (opts.initial) {
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


  /** Fetch tables & views in parallel */
  private loadTablesAndViews(): Observable<[PagedResultApiModel<RelationApiModel>, PagedResultApiModel<RelationApiModel>]> {
    return forkJoin([this.dataApiService.loadTables(), this.dataApiService.loadViews()]);
  }

  /** Update signals from API results */
  private setRelations(
    tablesRes: PagedResultApiModel<RelationApiModel>,
    viewsRes: PagedResultApiModel<RelationApiModel>,
  ): void {
    this.tableItems.set(this.toListItems(tablesRes?.items ?? [], RelationType.Table));
    this.viewItems.set(this.toListItems(viewsRes?.items ?? [], RelationType.View));
  }

  /** Find an item in current lists */
  private findInLists(type: RelationType, id: string): ListItemModel | null {
    const pool = type === RelationType.Table ? this.tableItems() : this.viewItems();
    return pool.find(i => i.id === id) ?? null;
  }

  // ───────────────────────────────────────────────────────────────
  // Selection & rows
  // ───────────────────────────────────────────────────────────────

  /** Apply selection and (optionally) preserve page/sort state */
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

  /** Clear UI when no selection exists */
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
          this.toast.showError('Fehler beim Laden der Daten.');
        },
      });
  }
}
