import {
  Component,
  input,
  output,
  ViewChild,
  ViewChildren,
  ElementRef,
  QueryList,
  AfterViewInit,
  effect,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ListItemModel } from '../models/list-item.model';
import { MatDivider } from '@angular/material/divider';

@Component({
  selector: 'app-nav-section',
  standalone: true,
  imports: [MatButtonModule, MatDivider],
  templateUrl: './nav-section.component.html',
  styleUrls: ['./nav-section.component.scss'],
})
export class NavSectionComponent implements AfterViewInit {
  label = input.required<string>();
  items = input<ListItemModel[]>([]);
  selected = input<ListItemModel | null>(null);
  emptyText = input('No items');
  selectionChange = output<ListItemModel>();

  @ViewChild('list', { static: true }) listEl!: ElementRef<HTMLDivElement>;
  @ViewChildren('btn') buttons!: QueryList<ElementRef<HTMLButtonElement>>;

  ngAfterViewInit(): void {
    // If the rendered list of buttons changes (e.g., new data), keep selection in view.
    this.buttons.changes.subscribe(() => this.scrollSelectedIntoView());
    // First render
    queueMicrotask(() => this.scrollSelectedIntoView());
  }

  // React to selection and items signal changes.
  // After change detection, scroll the selected button into view.
  private _selEffect = effect(() => {
    this.selected();
    this.items();
    queueMicrotask(() => this.scrollSelectedIntoView());
  });

  private scrollSelectedIntoView(): void {
    const sel = this.selected();
    if (!sel || !this.buttons?.length) return;

    const idx = this.items().findIndex(
      (i) => i.id === sel.id && i.relationType === sel.relationType
    );
    if (idx < 0) return;

    const btn = this.buttons.get(idx)?.nativeElement;
    if (!btn) return;

    btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
