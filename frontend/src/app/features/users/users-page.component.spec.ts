import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AdminApi } from '../../core/api/admin-api.service';
import { UserRow } from '../../core/models/models';
import { UsersPageComponent } from './users-page.component';

const row = (id: number, fullName: string, role: 'ADMIN' | 'CLIENT', reviewCount = 0): UserRow =>
  ({ id, fullName, email: `${fullName.split(' ')[0].toLowerCase()}@test.local`, role, reviewCount, createdAt: new Date().toISOString() });

describe('UsersPageComponent', () => {
  beforeEach(() => {
    const api = jasmine.createSpyObj<AdminApi>('AdminApi', {
      users: of([row(1, 'Administrateur', 'ADMIN'), row(2, 'Sara Benali', 'CLIENT', 3), row(3, 'Yasmine Haddad', 'CLIENT', 1)]),
    });
    TestBed.configureTestingModule({ imports: [UsersPageComponent], providers: [provideRouter([]), provideHttpClient(), { provide: AdminApi, useValue: api }] });
  });

  it('compte les rôles et les avis', () => {
    const cmp = TestBed.createComponent(UsersPageComponent);
    cmp.detectChanges();
    expect(cmp.componentInstance.count('CLIENT')).toBe(2);
    expect(cmp.componentInstance.count('ADMIN')).toBe(1);
    expect(cmp.componentInstance.totalReviews()).toBe(4);
  });

  it('filtre par rôle et par recherche', () => {
    const cmp = TestBed.createComponent(UsersPageComponent).componentInstance;
    cmp.ngOnInit();
    cmp.role.set('CLIENT');
    expect(cmp.filtered().length).toBe(2);
    cmp.query.set('yasmine');
    expect(cmp.filtered().map((u) => u.fullName)).toEqual(['Yasmine Haddad']);
  });
});
