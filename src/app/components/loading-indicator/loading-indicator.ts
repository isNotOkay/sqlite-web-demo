import {Component} from '@angular/core';
import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: 'app-loading-indicator',
  imports: [
    MatProgressSpinner
  ],
  templateUrl: './loading-indicator.html',
  styleUrl: './loading-indicator.scss'
})
export class LoadingIndicator {

}
