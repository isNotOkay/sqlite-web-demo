import {inject, Injectable} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';

@Injectable({providedIn: 'root'})
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  show(message: string, action = 'Schließen', duration = 6000): void {
    this.snackBar.open(message, action, {duration, verticalPosition: 'top', horizontalPosition: 'right'});
  }

  showError(message: string): void {
    this.show(message, 'Schließen', 6000);
  }
}
