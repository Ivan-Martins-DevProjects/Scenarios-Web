import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthUser, LoginRequest, LoginResponse } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;

  private readonly _user = signal<AuthUser | null>(this.restoreUser());

  /** Usuário autenticado atual (null quando deslogado). */
  readonly user = this._user.asReadonly();

  isLoggedIn(): boolean {
    return !!this.getToken() && !!this._user();
  }

  /** Verifica se o usuário autenticado possui uma das roles informadas (por nome). */
  hasRole(...roles: string[]): boolean {
    const user = this._user();
    return !!user?.role_name && roles.includes(user.role_name);
  }

  getToken(): string | null {
    return localStorage.getItem(environment.tokenKey);
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, payload);
  }

  me() {
    return this.http.get<{ user: AuthUser }>(`${this.apiUrl}/auth/me`);
  }

  persistSession(response: LoginResponse) {
    localStorage.setItem(environment.tokenKey, response.token);
    localStorage.setItem(environment.userKey, JSON.stringify(response.user));
    this._user.set(response.user);
  }

  logout() {
    localStorage.removeItem(environment.tokenKey);
    localStorage.removeItem(environment.userKey);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private restoreUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(environment.userKey);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
