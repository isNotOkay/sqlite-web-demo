import {Injectable} from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {Subject} from 'rxjs';
import {RelationType} from '../enums/relation-type.enum';

export type RemoteSelection = { relationType: RelationType; id: string };

@Injectable({providedIn: 'root'})
export class RealtimeService {
  private hub?: signalR.HubConnection;
  private readonly baseUrl = 'http://localhost:5282';

  // Emits when the server asks to select a node
  readonly selection$ = new Subject<RemoteSelection>();

  async start(): Promise<void> {
    if (this.hub) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/hubs/notifications`, {
        // If your server CORS policy uses AllowAnyOrigin(), keep this false.
        // If you configured AllowCredentials + WithOrigins, you can omit this.
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .build();

    // Plain message demo (optional)
    this.hub.on('notify', (message: string) => {
      window.alert(message ?? 'Notification received');
    });

    // NEW: selection message
    this.hub.on('selectNode', (payload: any) => {
      if (!payload) return;
      const kind = (payload.kind ?? '').toString().toLowerCase();
      const id = (payload.id ?? '').toString();
      if ((kind === 'table' || kind === 'view') && id) {
        this.selection$.next({relationType: kind, id} as RemoteSelection);
      }
    });

    await this.hub.start();
  }

  async stop(): Promise<void> {
    if (!this.hub) return;
    await this.hub.stop();
    this.hub = undefined;
  }
}
