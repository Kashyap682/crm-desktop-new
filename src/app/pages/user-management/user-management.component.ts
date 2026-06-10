import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../service/api.service';
import { AuthService } from '../../service/auth.service';
import { ToastService } from '../../service/toast.service';

interface OrgUser {
  id: string;
  email: string;
  appRole: 'admin' | 'sales' | 'viewer';
  isActive: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {

  users: OrgUser[] = [];
  currentUserId: string | undefined;

  isLoading = false;
  errorMsg = '';
  successMsg = '';

  // Add user form
  showAddModal = false;
  addForm = { email: '', password: '', appRole: 'sales' as 'admin' | 'sales' | 'viewer' };
  addError = '';
  addLoading = false;

  // Change role
  roleUpdating: string | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.currentUserId = this.authService.getUser()?.user_id;
    this.loadUsers();
  }

  async loadUsers() {
    this.isLoading = true;
    this.errorMsg = '';
    try {
      const rows = await this.apiService.filter('authUsers', { org_id: this.apiService.getOrgId() });
      this.users = rows
        .map((r: any) => ({
          id:        r.id,
          email:     r.email,
          appRole:   r.app_role as OrgUser['appRole'],
          isActive:  r.is_active,
          createdAt: r.created_at,
        }))
        .sort((a: OrgUser, b: OrgUser) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
    } catch (e: any) {
      this.errorMsg = 'Failed to load users.';
    }
    this.isLoading = false;
  }

  openAddModal() {
    this.addForm = { email: '', password: '', appRole: 'sales' };
    this.addError = '';
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  async addUser() {
    this.addError = '';
    if (!this.addForm.email.trim() || !this.addForm.password.trim()) {
      this.addError = 'Email and password are required.';
      return;
    }
    if (this.addForm.password.length < 8) {
      this.addError = 'Password must be at least 8 characters.';
      return;
    }
    this.addLoading = true;
    try {
      await this.authService.register(
        this.addForm.email.trim().toLowerCase(),
        this.addForm.password,
        this.addForm.appRole
      );
      this.successMsg = `User ${this.addForm.email} created successfully.`;
      this.closeAddModal();
      await this.loadUsers();
      setTimeout(() => { this.successMsg = ''; }, 4000);
    } catch (e: any) {
      this.addError = e.message || 'Failed to create user.';
    }
    this.addLoading = false;
  }

  async changeRole(user: OrgUser, newRole: string) {
    if (user.id === this.currentUserId) {
      this.toastService.warning("You can't change your own role");
      return;
    }
    this.roleUpdating = user.id;
    try {
      await this.apiService.put('authUsers', { id: user.id, app_role: newRole });
      user.appRole = newRole as OrgUser['appRole'];
      this.successMsg = `${user.email}'s role updated to ${newRole}.`;
      setTimeout(() => { this.successMsg = ''; }, 3000);
    } catch {
      this.errorMsg = 'Failed to update role.';
    }
    this.roleUpdating = null;
  }

  async toggleActive(user: OrgUser) {
    if (user.id === this.currentUserId) {
      this.toastService.warning("You can't deactivate your own account");
      return;
    }
    const action = user.isActive ? 'deactivate' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.email}?`)) return;

    try {
      await this.apiService.put('authUsers', { id: user.id, is_active: !user.isActive });
      user.isActive = !user.isActive;
      this.successMsg = `${user.email} ${action}d.`;
      setTimeout(() => { this.successMsg = ''; }, 3000);
    } catch {
      this.errorMsg = `Failed to ${action} user.`;
    }
  }

  async resetPassword(user: OrgUser) {
    const newPass = prompt(`Set new password for ${user.email}:\n(minimum 8 characters)`);
    if (!newPass) return;
    if (newPass.length < 8) { this.toastService.warning('Password must be at least 8 characters'); return; }

    // Password reset requires bcrypt hashing — must go through the auth service, not PostgREST directly.
    this.toastService.info('Password reset not yet implemented — use the auth backend directly');
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  getRoleBadgeClass(role: string): string {
    return role === 'admin' ? 'badge-admin' : role === 'sales' ? 'badge-sales' : 'badge-viewer';
  }
}
