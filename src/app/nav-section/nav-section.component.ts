import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ListItemModel } from '../models/list-item.model';
import {MatDivider} from '@angular/material/divider';

@Component({
  selector: 'app-nav-section',
  standalone: true,
  imports: [MatButtonModule, MatDivider],
  templateUrl: './nav-section.component.html',
  styleUrls: ['./nav-section.component.scss'],
})
export class NavSectionComponent {
  label = input.required<string>();
  items = input<ListItemModel[]>([]);
  selected = input<ListItemModel | null>(null);
  emptyText = input('No items');
  selectionChange = output<ListItemModel>();
}
