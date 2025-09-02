import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private hub?: signalR.HubConnection;
  private readonly baseUrl = 'http://localhost:5282'; // same as your API

  async start(): Promise<void> {
    if (this.hub) return;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/hubs/notifications`, {
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .build();

    // On message, just alert for now (you can inject a Snackbar later)
    this.hub.on('notify', (message: string) => {
      window.alert(message ?? 'Notification received');
    });

    await this.hub.start();
    // Optional: let the server know the client is ready
    // await this.hub.send('ready');
  }

  async stop(): Promise<void> {
    if (!this.hub) return;
    await this.hub.stop();
    this.hub = undefined;
  }
}
