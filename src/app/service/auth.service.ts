import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface AuthUser {
  user_id: string;
  email: string;
  org_id: string;
  app_role: 'admin' | 'sales' | 'viewer';
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  org_id: string;
  app_role: string;
  user_id: string;
  exp: number;
}

const REFRESH_TOKEN_KEY = 'crm_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  // Access token lives in memory only — never touches localStorage
  private accessToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router) {}

  // ── Bootstrap ────────────────────────────────────────────

  /**
   * Called once in main.ts before the app renders.
   * If a refresh token exists in localStorage, silently exchange it for
   * a new access token so the user doesn't have to log in again.
   */
  async init(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;

    try {
      await this.doRefresh(refreshToken);
    } catch {
      // Refresh token expired or invalid — clear it and show login
      this.clearTokens();
    }
  }

  // ── Public API ────────────────────────────────────────────

  isLoggedIn(): boolean {
    return this.accessToken !== null;
  }

  getUser(): AuthUser | null {
    return this.currentUser;
  }

  getOrgId(): string {
    return this.currentUser?.org_id ?? '';
  }

  /**
   * Returns a valid access token, refreshing silently if it expired.
   * Components and ApiService call this — they never touch tokens directly.
   */
  async getToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    return this.accessToken;
  }

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${environment.authUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Login failed');
    }

    const data = await res.json();
    this.storeTokens(data.access_token, data.refresh_token);
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      // Best-effort — don't block logout if the request fails
      fetch(`${environment.authUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    this.clearTokens();
    this.router.navigate(['/login']);
  }

  async register(email: string, password: string, appRole: string): Promise<void> {
    const res = await fetch(`${environment.authUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, app_role: appRole }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Registration failed');
    }
  }

  // ── Token management (private) ─────────────────────────────

  private storeTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    const payload = this.parseAccessToken(accessToken);
    this.currentUser = payload ? {
      user_id:  payload.user_id,
      email:    payload.email,
      org_id:   payload.org_id,
      app_role: payload.app_role as AuthUser['app_role'],
    } : null;
    this.scheduleRefresh(accessToken);
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.currentUser = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private scheduleRefresh(accessToken: string): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    const payload = this.parseAccessToken(accessToken);
    if (!payload) return;

    // Refresh 60 seconds before expiry
    const expiresInMs = payload.exp * 1000 - Date.now();
    const refreshInMs = Math.max(expiresInMs - 60_000, 0);

    this.refreshTimer = setTimeout(async () => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        this.clearTokens();
        this.router.navigate(['/login']);
        return;
      }
      try {
        await this.doRefresh(refreshToken);
      } catch {
        this.clearTokens();
        this.router.navigate(['/login']);
      }
    }, refreshInMs);
  }

  private async doRefresh(refreshToken: string): Promise<void> {
    const res = await fetch(`${environment.authUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh failed');

    const data = await res.json();
    this.storeTokens(data.access_token, data.refresh_token);
  }

  private parseAccessToken(token: string): TokenPayload | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload)) as TokenPayload;
    } catch {
      return null;
    }
  }
}
