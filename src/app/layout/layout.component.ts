import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../service/auth.service';
import { ToastComponent } from './toast.component';
import { ConfirmComponent } from './confirm.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastComponent, ConfirmComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  sidebarCollapsed = false;

  constructor(public authService: AuthService) {}

  get isAdmin(): boolean {
    return this.authService.getUser()?.app_role === 'admin';
  }
}
