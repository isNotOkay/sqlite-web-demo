import {Injectable} from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {Observable, Subject} from 'rxjs';
import {RelationType} from '../enums/relation-type.enum';

export interface CreateRelationEvent {
  relationType: RelationType;
  name: string;
}

export interface DeleteRelationEvent {
  relationType: RelationType;
  name: string;
}

@Injectable({providedIn: 'root'})
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

    this.hub.on('CreateRelation', (payload: any) => {
      const relationType = (payload?.relationType ?? payload?.type ?? '')
        .toString()
        .toLowerCase() as RelationType;
      const name = (payload?.name ?? '').toString();

      if ((relationType === 'table' || relationType === 'view') && name) {
        this.createRelationSubject.next({ relationType, name });
      }
    });

    this.hub.on('DeleteRelation', (payload: any) => {
      const relationType = (payload?.relationType ?? payload?.type ?? '')
        .toString()
        .toLowerCase() as RelationType;
      const name = (payload?.name ?? '').toString();

      if ((relationType === 'table' || relationType === 'view') && name) {
        this.deleteRelationSubject.next({ relationType, name });
      }
    });


    this.hub.start().catch(err => console.error('SignalR start error', err));
  }
}
