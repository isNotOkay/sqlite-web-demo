import {Injectable} from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({providedIn: 'root'})
export class SignalRService {
  private hub?: signalR.HubConnection;

  start(): void {
    if (this.hub?.state === signalR.HubConnectionState.Connected) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/notifications')              // same host/path as API
      .withAutomaticReconnect()
      .build();

    // Handle the "Announcement" event from the server
    this.hub.on('Announcement', (payload: { title: string; message: string }) => {
      alert('received signal r event');
    });

    // Start the connection
    this.hub.start().catch(err => console.error('SignalR start error', err));
  }

  // (Optional) If you later want the client to send messages to the hub:
  // sendSomething(...) { return this.hub?.invoke('SomeMethod', data); }
}
