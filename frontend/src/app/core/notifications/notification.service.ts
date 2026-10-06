import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ReviewEvent } from '../models/models';

export interface AppNotification extends ReviewEvent { read: boolean; receivedAt: number; }
export interface Toast { key: number; event: ReviewEvent; }

/** Événement produit par l'application elle-même (import, indisponibilité de l'IA). */
export type SystemKind = 'import.done' | 'import.errors' | 'analysis.unavailable';
export interface SystemNotification {
  kind: SystemKind;
  title: string;
  message: string;
  /** Page concernée (ex. /import, /dashboard). */
  link?: string;
  read: boolean;
  receivedAt: number;
}

/** Fil unique (avis + événements de l'application), du plus récent au plus ancien. */
export type FeedItem =
  | { source: 'review'; item: AppNotification }
  | { source: 'system'; item: SystemNotification };

const MAX_ITEMS = 50;
const TOAST_MS = 7000;
const MAX_TOASTS = 3;

/** Fabrique de WebSocket remplaçable dans les tests. */
export type SocketFactory = (url: string) => WebSocket;

/**
 * Notifications temps réel des administrateurs (WebSocket /ws/notifications).
 * Le jeton est envoyé dans le premier message (pas dans l'URL) ; reconnexion automatique avec délai croissant.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private socket?: WebSocket;
  private running = false;
  private attempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private toastKey = 0;

  /** Remplacée par les tests. */
  socketFactory: SocketFactory = (url) => new WebSocket(url);

  /** Avis publiés ou modifiés par les clients (temps réel). */
  readonly items = signal<AppNotification[]>([]);
  /** Événements de l'application pendant la session (imports, IA indisponible). */
  readonly system = signal<SystemNotification[]>([]);
  readonly toasts = signal<Toast[]>([]);
  readonly connected = signal(false);
  readonly unread = computed(() => this.items().filter((n) => !n.read).length + this.system().filter((n) => !n.read).length);
  readonly feed = computed<FeedItem[]>(() =>
    [
      ...this.items().map((item) => ({ source: 'review' as const, item })),
      ...this.system().map((item) => ({ source: 'system' as const, item })),
    ].sort((a, b) => b.item.receivedAt - a.item.receivedAt)
  );
  /** Flux des nouveaux avis, pour rafraîchir les pages ouvertes. */
  readonly reviews$ = new Subject<ReviewEvent>();

  connect() {
    if (this.running) return;
    this.running = true;
    this.open();
  }

  disconnect() {
    this.running = false;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = undefined;
    this.connected.set(false);
  }

  markAllRead() {
    this.items.update((list) => list.map((n) => ({ ...n, read: true })));
    this.system.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  /** Marque une notification comme lue (receivedAt sert d'identifiant). */
  markRead(receivedAt: number) {
    this.items.update((list) => list.map((n) => (n.receivedAt === receivedAt ? { ...n, read: true } : n)));
    this.system.update((list) => list.map((n) => (n.receivedAt === receivedAt ? { ...n, read: true } : n)));
  }

  clear() { this.items.set([]); this.system.set([]); }

  /** Ajoute une notification produite par l'application (ex. fin d'un import). */
  notify(event: Pick<SystemNotification, 'kind' | 'title' | 'message' | 'link'>) {
    // horodatage unique même pour deux événements dans la même milliseconde
    const last = Math.max(0, ...this.system().map((n) => n.receivedAt), ...this.items().map((n) => n.receivedAt));
    this.system.update((list) => [{ ...event, read: false, receivedAt: Math.max(Date.now(), last + 1) }, ...list].slice(0, MAX_ITEMS));
  }

  dismiss(key: number) {
    this.toasts.update((list) => list.filter((t) => t.key !== key));
  }

  private open() {
    const token = this.auth.token();
    if (!token) { this.running = false; return; }
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = this.socketFactory(`${protocol}://${location.host}/ws/notifications`);
    this.socket = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (msg) => this.handle(msg.data);
    ws.onclose = () => {
      this.connected.set(false);
      if (this.socket === ws) this.socket = undefined;
      if (this.running) this.scheduleReconnect();
    };
  }

  private handle(data: unknown) {
    let msg: { type?: string };
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (msg.type === 'ready') {
      this.connected.set(true);
      this.attempt = 0;
    } else if (msg.type === 'review.created' || msg.type === 'review.updated' || msg.type === 'review.deleted') {
      const event = msg as unknown as ReviewEvent;
      // nouvel avis : notification + alerte ; avis modifié : notification discrète ; suppression : rafraîchissement seul
      if (event.type !== 'review.deleted') {
        this.items.update((list) => [{ ...event, read: false, receivedAt: Date.now() }, ...list].slice(0, MAX_ITEMS));
      }
      if (event.type === 'review.created') this.pushToast(event);
      this.reviews$.next(event);
    }
  }

  private pushToast(event: ReviewEvent) {
    const key = ++this.toastKey;
    this.toasts.update((list) => [...list, { key, event }].slice(-MAX_TOASTS));
    setTimeout(() => this.dismiss(key), TOAST_MS);
  }

  /** 1 s, 2 s, 4 s… jusqu'à 30 s entre deux tentatives. */
  private scheduleReconnect() {
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt++);
    this.reconnectTimer = setTimeout(() => { if (this.running) this.open(); }, delay);
  }
}
