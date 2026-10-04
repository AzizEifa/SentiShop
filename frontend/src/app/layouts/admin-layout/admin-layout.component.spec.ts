import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';

describe('AdminLayoutComponent (back-office)', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  it('affiche les 6 pages dans la navigation', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar nav a'))
      .map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/dashboard', '/reviews', '/analyze', '/import', '/compare', '/users']);
  });

  it("indique si l'API répond", fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    tick(0);
    http.expectOne('/actuator/health').flush({ status: 'UP' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('API connectée');
    discardPeriodicTasks();
  }));

  it("indique quand l'API est hors ligne", fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    tick(0);
    http.expectOne('/actuator/health').flush(null, { status: 504, statusText: 'Gateway Timeout' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('API hors ligne');
    discardPeriodicTasks();
  }));
});
