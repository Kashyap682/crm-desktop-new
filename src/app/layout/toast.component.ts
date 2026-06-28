import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ToastService } from '../service/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [ngClass]="'toast--' + toast.type">
          <span class="toast-icon">{{ icons[toast.type] }}</span>
          <span class="toast-msg">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 420px;
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 500;
      color: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,.25);
      animation: toast-in .2s ease;
      pointer-events: all;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .toast--success { background: #16a34a; }
    .toast--error   { background: #dc2626; }
    .toast--warning { background: #b45309; }
    .toast--info    { background: #1d4ed8; }
    .toast-icon { font-size: 20px; flex-shrink: 0; font-style: normal; }
    .toast-msg  { flex: 1; line-height: 1.5; word-break: break-word; }
    .toast-close {
      background: none;
      border: none;
      color: rgba(255,255,255,.75);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
      flex-shrink: 0;
      transition: color .15s;
    }
    .toast-close:hover { color: #fff; }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
  readonly icons: Record<string, string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  };
}
