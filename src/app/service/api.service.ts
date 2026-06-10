import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * Replacement for DBService — same method signatures, calls PostgREST instead of IndexedDB.
 *
 * Store name → PostgREST table mapping handles the rename from IndexedDB names
 * (camelCase / hyphenated) to Postgres table names (snake_case).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {

  private readonly storeMap: Record<string, string> = {
    customers:          'customers',
    inquiries:          'inquiries',
    inventory:          'inventory',
    offers:             'offers',
    vendors:            'vendors',
    orders:             'sales_orders',        // legacy IndexedDB name
    salesOrders:        'sales_orders',
    sales_order_items:  'sales_order_items',
    purchaseOrders:     'purchase_orders',
    invoices:           'invoices',
    proformas:          'proformas',
    payments:           'payments',
    reminders:          'reminders',
    'reminder-history': 'reminder_history',
    rfqs:               'rfqs',
    documents:          'documents',
    authUsers:          'auth_users',
  };

  constructor(private auth: AuthService) {}

  // ── Helpers ──────────────────────────────────────────────

  private table(storeName: string): string {
    const t = this.storeMap[storeName];
    if (!t) throw new Error(`Unknown store: "${storeName}"`);
    return t;
  }

  private async headers(): Promise<HeadersInit> {
    const token = await this.auth.getToken();
    return {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      'Prefer':        'return=representation',
    };
  }

  private url(table: string, query = ''): string {
    return `${environment.apiUrl}/${table}${query ? '?' + query : ''}`;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PostgREST error ${res.status}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  /**
   * Automatically injects org_id on every write so components don't have to.
   */
  private withOrg(obj: any): any {
    return { org_id: this.auth.getOrgId(), ...obj };
  }

  // ── CRUD (mirrors DBService API) ──────────────────────────

  async getAll(storeName: string): Promise<any[]> {
    const res = await fetch(this.url(this.table(storeName)), {
      headers: await this.headers(),
    });
    return this.handleResponse<any[]>(res);
  }

  async getById(storeName: string, id: any): Promise<any> {
    const res = await fetch(this.url(this.table(storeName), `id=eq.${id}`), {
      headers: await this.headers(),
    });
    const rows = await this.handleResponse<any[]>(res);
    return rows?.[0] ?? null;
  }

  async add(storeName: string, obj: any): Promise<string> {
    // Strip client-side id if present — let Postgres generate the UUID
    const { id: _id, ...rest } = obj;
    const res = await fetch(this.url(this.table(storeName)), {
      method:  'POST',
      headers: await this.headers(),
      body:    JSON.stringify(this.withOrg(rest)),
    });
    const rows = await this.handleResponse<any[]>(res);
    return rows?.[0]?.id;
  }

  async put(storeName: string, obj: any): Promise<string> {
    if (obj.id) {
      // Update existing record
      const res = await fetch(this.url(this.table(storeName), `id=eq.${obj.id}`), {
        method:  'PATCH',
        headers: await this.headers(),
        body:    JSON.stringify(obj),
      });
      const rows = await this.handleResponse<any[]>(res);
      return rows?.[0]?.id;
    } else {
      // No id — treat as insert
      return this.add(storeName, obj);
    }
  }

  async delete(storeName: string, key: any): Promise<void> {
    const table = this.table(storeName);

    // inventory is keyed by name, vendors by vendorId
    const filter = this.pkFilter(storeName, key);

    const res = await fetch(this.url(table, filter), {
      method:  'DELETE',
      headers: await this.headers(),
    });
    await this.handleResponse<void>(res);
  }

  /**
   * Delete every row matching the given column filters.
   * e.g. deleteWhere('customers', { org_id: '...' })
   */
  async deleteWhere(storeName: string, params: Record<string, any>): Promise<void> {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join('&');
    const res = await fetch(this.url(this.table(storeName), query), {
      method:  'DELETE',
      headers: await this.headers(),
    });
    await this.handleResponse<void>(res);
  }

  async searchInStore(storeName: string, predicate: (item: any) => boolean): Promise<any[]> {
    // PostgREST can't run arbitrary JS predicates — fetch all and filter client-side.
    // Replace with proper PostgREST filters when migrating individual components.
    const all = await this.getAll(storeName);
    return all.filter(predicate);
  }

  // ── PostgREST query helpers ───────────────────────────────

  /**
   * Filter records by one or more column values.
   * e.g. filter('invoices', { status: 'Pending', customer_id: 'uuid' })
   */
  async filter(storeName: string, params: Record<string, any>): Promise<any[]> {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join('&');
    const res = await fetch(this.url(this.table(storeName), query), {
      headers: await this.headers(),
    });
    return this.handleResponse<any[]>(res);
  }

  /** Expose org_id so components can use it for filtered deletes, etc. */
  getOrgId(): string { return this.auth.getOrgId(); }

  // ── Convenience wrappers (matches DBService domain methods) ───

  async getAllCustomers()   { return this.getAll('customers'); }
  async getAllVendors()     { return this.getAll('vendors'); }
  async getAllInquiries()   { return this.getAll('inquiries'); }
  async getAllOrders()      { return this.getAll('salesOrders'); }
  async getAllInvoices()    { return this.getAll('invoices'); }
  async getAllProformas()   { return this.getAll('proformas'); }
  async getAllProducts()    { return this.getAll('inventory'); }
  async getAllReminders()   { return this.getAll('reminders'); }
  async getAllPurchaseOrders() { return this.getAll('purchaseOrders'); }
  async getSalesOrders()   { return this.getAll('salesOrders'); }

  // ── Private helpers ───────────────────────────────────────

  private pkFilter(storeName: string, key: any): string {
    switch (storeName) {
      case 'inventory': return `name=eq.${encodeURIComponent(key)}`;
      default:          return `id=eq.${key}`;
    }
  }
}
