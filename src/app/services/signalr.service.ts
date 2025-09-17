import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';

export interface CreateRelationEvent {
  type: 'table' | 'view';
  name: string;
}

export interface DeleteRelationEvent {
  type: 'table' | 'view';
  name: string;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hub?: signalR.HubConnection;

  private createRelationSubject = new Subject<CreateRelationEvent>();
  private deleteRelationSubject = new Subject<DeleteRelationEvent>();

  /** Emits when the backend confirms a newly created table/view */
  readonly onCreateRelation$: Observable<CreateRelationEvent> = this.createRelationSubject.asObservable();
  /** Emits when the backend confirms a deleted table/view */
  readonly onDeleteRelation$: Observable<DeleteRelationEvent> = this.deleteRelationSubject.asObservable();

  start(): void {
    if (this.hub?.state === signalR.HubConnectionState.Connected) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/notifications')
      .withAutomaticReconnect()
      .build();

    // 🔔 create
    this.hub.on('CreateRelation', (payload: any) => {
      const type = (payload?.type ?? '').toString().toLowerCase() as 'table' | 'view';
      const name = (payload?.name ?? '').toString();
      if ((type === 'table' || type === 'view') && name) {
        this.createRelationSubject.next({ type, name });
      }
    });

    // 🔔 delete
    this.hub.on('DeleteRelation', (payload: any) => {
      const type = (payload?.type ?? '').toString().toLowerCase() as 'table' | 'view';
      const name = (payload?.name ?? '').toString();
      if ((type === 'table' || type === 'view') && name) {
        this.deleteRelationSubject.next({ type, name });
      }
    });

    this.hub.start().catch(err => console.error('SignalR start error', err));
  }
}
