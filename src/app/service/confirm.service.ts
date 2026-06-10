import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in red — use for destructive actions */
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private _resolve: ((value: boolean) => void) | null = null;

  readonly dialog = signal<{
    visible: boolean;
    message: string;
    title: string;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
  }>({
    visible: false,
    message: '',
    title: 'Confirm',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false,
  });

  /**
   * Show a modal confirmation dialog.
   * Returns a Promise<boolean> — true if the user confirmed, false if cancelled.
   *
   * Usage:
   *   if (!await this.confirmService.confirm('Delete this record?', { danger: true })) return;
   */
  confirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return new Promise(resolve => {
      this._resolve = resolve;
      this.dialog.set({
        visible:      true,
        message,
        title:        opts.title        ?? 'Confirm',
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        cancelLabel:  opts.cancelLabel  ?? 'Cancel',
        danger:       opts.danger       ?? false,
      });
    });
  }

  respond(result: boolean): void {
    this.dialog.update(d => ({ ...d, visible: false }));
    this._resolve?.(result);
    this._resolve = null;
  }
}
