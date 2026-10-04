import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { AccountApi } from '../../core/api/account-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuthResponse, User } from '../../core/models/models';
import { ProfilePageComponent } from './profile-page.component';

const user: User = { id: 1, email: 'sara@test.local', fullName: 'Sara Benali', role: 'CLIENT', avatarUrl: null, createdAt: new Date().toISOString() };

describe('ProfilePageComponent', () => {
  let api: jasmine.SpyObj<AccountApi>;
  let auth: AuthService;

  beforeEach(() => {
    api = jasmine.createSpyObj<AccountApi>('AccountApi', ['updateProfile', 'changePassword', 'uploadAvatar', 'removeAvatar']);
    TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(), { provide: AccountApi, useValue: api }],
    });
    auth = TestBed.inject(AuthService);
    spyOn(auth, 'user').and.returnValue(user);
  });

  it('enregistre le profil et remplace la session (nouveau jeton)', () => {
    const res: AuthResponse = { token: 't2', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { ...user, fullName: 'Sara B.' } };
    api.updateProfile.and.returnValue(of(res));
    const replace = spyOn(auth, 'replaceSession');
    const cmp = TestBed.createComponent(ProfilePageComponent).componentInstance;
    expect(cmp.profileChanged()).toBeFalse();
    cmp.fullName = 'Sara B.';
    expect(cmp.profileChanged()).toBeTrue();
    cmp.saveProfile();
    expect(api.updateProfile).toHaveBeenCalledWith('Sara B.', 'sara@test.local');
    expect(replace).toHaveBeenCalledWith(res);
  });

  it('email déjà utilisé : erreur sous le champ email', () => {
    api.updateProfile.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Un compte existe déjà avec cet email.' } })));
    const cmp = TestBed.createComponent(ProfilePageComponent).componentInstance;
    cmp.email = 'admin@sentishop.local';
    cmp.saveProfile();
    expect(cmp.profileErrors()['email']).toBe('Un compte existe déjà avec cet email.');
  });

  it('mot de passe : règles locales puis erreur « actuel incorrect » sous le bon champ', () => {
    api.changePassword.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Mot de passe actuel incorrect.' } })));
    const cmp = TestBed.createComponent(ProfilePageComponent).componentInstance;
    cmp.newPassword.set('court');
    cmp.savePassword();
    expect(cmp.passwordErrors()['currentPassword']).toBeTruthy();
    expect(api.changePassword).not.toHaveBeenCalled();
    cmp.currentPassword = 'faux';
    cmp.newPassword.set('Nouveau123');
    cmp.savePassword();
    expect(cmp.passwordErrors()['currentPassword']).toBe('Mot de passe actuel incorrect.');
  });

  it('photo de profil : type vérifié avant envoi', () => {
    const cmp = TestBed.createComponent(ProfilePageComponent).componentInstance;
    cmp.onAvatar({ target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })], value: '' } } as unknown as Event);
    expect(cmp.avatarError()).toContain('Format');
    expect(api.uploadAvatar).not.toHaveBeenCalled();
  });
});
