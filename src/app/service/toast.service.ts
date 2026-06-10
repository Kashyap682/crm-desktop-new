import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string, duration = 3000) { this._push('success', message, duration); }
  error(message: string, duration = 5000)   { this._push('error',   message, duration); }
  warning(message: string, duration = 4000) { this._push('warning', message, duration); }
  info(message: string, duration = 3500)    { this._push('info',    message, duration); }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private _push(type: ToastType, message: string, duration: number) {
    const id = ++this._nextId;
    this.toasts.update(list => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
