import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ReviewEvent } from '../models/models';
import { NotificationService } from './notification.service';

/** WebSocket simulé : on pilote l'ouverture, les messages et la fermeture. */
class FakeSocket {
  static last: FakeSocket;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  constructor(public url: string) { FakeSocket.last = this; }
  send(data: string) { this.sent.push(data); }
  close() { this.onclose?.(); }
  receive(msg: object) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

const event = (id: number): ReviewEvent => ({
  type: 'review.created', id, text: 'Colis abîmé', product: 'Casque', label: 'NEGATIVE',
  score: 0.9, rating: 2, authorName: 'Sara', createdAt: new Date().toISOString(),
});

describe('NotificationService (temps réel)', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'token').and.returnValue('jwt-admin');
    service = TestBed.inject(NotificationService);
    service.socketFactory = (url) => new FakeSocket(url) as unknown as WebSocket;
  });

  it("s'authentifie dans le premier message (jeton absent de l'URL)", () => {
    service.connect();
    FakeSocket.last.onopen?.();
    expect(FakeSocket.last.url).toMatch(/\/ws\/notifications$/);
    expect(JSON.parse(FakeSocket.last.sent[0])).toEqual({ type: 'auth', token: 'jwt-admin' });
    FakeSocket.last.receive({ type: 'ready' });
    expect(service.connected()).toBeTrue();
  });

  it('nouvel avis : notification non lue, alerte éphémère et événement diffusé', fakeAsync(() => {
    const received: ReviewEvent[] = [];
    service.reviews$.subscribe((e) => received.push(e));
    service.connect();
    FakeSocket.last.receive(event(1));
    FakeSocket.last.receive(event(2));

    expect(service.unread()).toBe(2);
    expect(service.items()[0].id).toBe(2); // le plus récent en premier
    expect(service.toasts().length).toBe(2);
    expect(received.map((e) => e.id)).toEqual([1, 2]);

    service.markAllRead();
    expect(service.unread()).toBe(0);
    tick(7000);
    expect(service.toasts().length).toBe(0); // les alertes disparaissent seules
    service.disconnect();
  }));

  it('coupure : reconnexion automatique avec délai croissant', fakeAsync(() => {
    service.connect();
    const first = FakeSocket.last;
    first.onclose?.();
    tick(999);
    expect(FakeSocket.last).toBe(first);
    tick(1);
    expect(FakeSocket.last).not.toBe(first); // 1re tentative après 1 s
    FakeSocket.last.onclose?.();
    tick(1999);
    const second = FakeSocket.last;
    tick(1);
    expect(FakeSocket.last).not.toBe(second); // 2e tentative après 2 s
    service.disconnect();
  }));

  it('déconnexion volontaire : pas de reconnexion', fakeAsync(() => {
    service.connect();
    const socket = FakeSocket.last;
    service.disconnect();
    tick(60_000);
    expect(FakeSocket.last).toBe(socket);
  }));
});
