import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ConfirmService } from '../service/confirm.service';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [NgClass],
  template: `
    @if (cs.dialog().visible) {
      <div class="confirm-backdrop" (click)="cs.respond(false)">
        <div class="confirm-modal" (click)="$event.stopPropagation()" role="dialog" [attr.aria-label]="cs.dialog().title">
          <h3 class="confirm-title">{{ cs.dialog().title }}</h3>
          <p class="confirm-msg">{{ cs.dialog().message }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" (click)="cs.respond(false)">{{ cs.dialog().cancelLabel }}</button>
            <button class="btn-confirm" [ngClass]="{ 'btn-danger': cs.dialog().danger }" (click)="cs.respond(true)">
              {{ cs.dialog().confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, .48);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .confirm-modal {
      background: #fff;
      border-radius: 10px;
      padding: 24px 28px;
      width: 400px;
      max-width: 92vw;
      box-shadow: 0 8px 40px rgba(0, 0, 0, .24);
      animation: confirm-in .18s ease;
    }
    @keyframes confirm-in {
      from { opacity: 0; transform: scale(.95); }
      to   { opacity: 1; transform: scale(1); }
    }
    .confirm-title {
      margin: 0 0 10px;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }
    .confirm-msg {
      margin: 0 0 22px;
      font-size: 14px;
      color: #4b5563;
      line-height: 1.55;
    }
    .confirm-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .btn-cancel,
    .btn-confirm {
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: background .15s;
    }
    .btn-cancel {
      background: #f1f5f9;
      color: #374151;
    }
    .btn-cancel:hover { background: #e2e8f0; }
    .btn-confirm {
      background: #1d4ed8;
      color: #fff;
    }
    .btn-confirm:hover         { background: #1e40af; }
    .btn-confirm.btn-danger    { background: #dc2626; }
    .btn-confirm.btn-danger:hover { background: #b91c1c; }
  `]
})
export class ConfirmComponent {
  cs = inject(ConfirmService);
}
