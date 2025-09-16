import {Injectable} from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {Observable, Subject} from 'rxjs';

export interface SelectRelationEvent {
  type: 'table' | 'view';
  name: string;
}

@Injectable({providedIn: 'root'})
export class SignalRService {
  private hub?: signalR.HubConnection;
  private selectRelationSubject = new Subject<SelectRelationEvent>();
  readonly onSelectRelation$: Observable<SelectRelationEvent> = this.selectRelationSubject.asObservable();

  start(): void {
    if (this.hub?.state === signalR.HubConnectionState.Connected) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/notifications')
      .withAutomaticReconnect()
      .build();

    this.hub.on('SelectRelation', (payload: any) => {
      const type = (payload?.type ?? '').toString().toLowerCase();
      const name = (payload?.name ?? '').toString();
      if ((type === 'table' || type === 'view') && name) {
        this.selectRelationSubject.next({type, name});
      }
    });

    this.hub.start().catch(err => console.error('SignalR start error', err));
  }
}
