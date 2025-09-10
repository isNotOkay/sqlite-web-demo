import {Component, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {ListItem} from '../models/list-item.model';

@Component({
  selector: 'app-nav-section',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './nav-section.component.html',
  styleUrls: ['./nav-section.component.scss'],
})
export class NavSectionComponent {
  // Inputs (signals)
  label = input.required<string>();
  items = input<ListItem[]>([]);
  selected = input<ListItem | null>(null);
  emptyText = input('No items');

  // Output (signal)
  select = output<ListItem>();
}
