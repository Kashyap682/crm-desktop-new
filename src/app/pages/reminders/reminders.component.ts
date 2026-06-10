import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { ApiService } from '../../service/api.service';
import { Router } from '@angular/router';
import { ToastService } from '../../service/toast.service';

interface Reminder {
  name: string;
  mobile: string;
  time: string;
  type: 'offer' | 'call' | 'payment' | 'general';
  referenceNo?: string;
  note?: string;
}

const ACTION_REMINDER_TYPES = [
  'offer', 'offer-followup', 'call', 'general', 'inquiry', 'order'
];

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reminders.component.html',
  styleUrls: ['./reminders.component.css']
})
export class RemindersComponent implements OnInit, OnDestroy {

  selectedDate = new Date().toISOString().slice(0, 10);

  reminders: any[] = [];
  filteredReminders: any[] = [];
  customers: any[] = [];

  dueInvoices: any[] = [];
  selectedCustomerInvoices: any[] = [];

  showPaymentEmail = false;
  selectedCustomerName = '';
  emailBody = '';

  showAddModal = false;
  form: Reminder & { date: string } = {
    name: '', mobile: '', time: '', date: '', type: 'general', referenceNo: '', note: ''
  };

  private dbChangeHandler: any;

  constructor(private apiService: ApiService, private router: Router, private toastService: ToastService) { }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(reminder: any): any {
    const row: any = {
      date:          reminder.date         || null,
      time:          reminder.time         || null,
      type:          reminder.type         || 'general',
      name:          reminder.name         || null,
      mobile:        reminder.mobile       || null,
      reference_no:  reminder.referenceNo  || null,
      invoice_no:    reminder.invoiceNo    || null,
      invoice_date:  reminder.invoiceDate  || null,
      due_date:      reminder.dueDate      || null,
      credit_days:   reminder.creditDays   ?? null,
      amount:        reminder.amount       ?? null,
      overdue_days:  reminder.overdueDays  ?? null,
      note:          reminder.note         || null,
      source:        reminder.source       || 'manual',
      status:        reminder.status       || 'pending',
      completed_at:  reminder.completedAt  || null,
    };
    if (reminder.id) row.id = reminder.id;
    return row;
  }

  private fromDbRow(row: any): any {
    return {
      id:           row.id,
      date:         row.date          || '',
      time:         row.time          || '',
      type:         row.type          || 'general',
      name:         row.name          || '',
      mobile:       row.mobile        || '',
      referenceNo:  row.reference_no  || '',
      invoiceNo:    row.invoice_no    || '',
      invoiceDate:  row.invoice_date  || '',
      dueDate:      row.due_date      || '',
      creditDays:   row.credit_days   ?? null,
      amount:       row.amount        ?? 0,
      overdueDays:  row.overdue_days  ?? 0,
      note:         row.note          || '',
      source:       row.source        || 'manual',
      status:       row.status        || 'pending',
      completedAt:  row.completed_at  || null,
    };
  }

  private mapInvoice(row: any): any {
    return {
      id:           row.id,
      invoiceNo:    row.invoice_no    || row.invoice_ref || '',
      invoiceDate:  row.invoice_date  || '',
      dueDate:      row.due_date      || '',
      creditDays:   row.credit_days   ?? 30,
      grandTotal:   row.grand_total   ?? 0,
      amount:       row.grand_total   ?? 0,
      billTo:       row.bill_to       || {},
      customerName: row.bill_to?.name || row.customer_name || '',
      status:       row.status        || 'Pending',
    };
  }

  // ── Lifecycle ────────────────────────────────────────────

  async ngOnInit() {
    try {
      const rows = await this.apiService.getAll('customers');
      this.customers = rows.map((r: any) => ({
        id:             r.id,
        companyName:    r.company_name    || '',
        name:           r.name            || '',
        mobile:         r.mobile          || '',
        primaryContact: r.primary_contact || {},
      }));
    } catch { this.customers = []; }

    await this.syncPaymentReminders();
    await this.loadUserReminders();

    this.dbChangeHandler = async () => {
      await this.syncPaymentReminders();
      await this.loadUserReminders();
    };
    window.addEventListener('crm-db-changed', this.dbChangeHandler);
  }

  ngOnDestroy() {
    window.removeEventListener('crm-db-changed', this.dbChangeHandler);
  }

  // ── Load reminders ───────────────────────────────────────

  async loadUserReminders() {
    try {
      const rows = await this.apiService.getAll('reminders');
      const all = rows.map((r: any) => this.fromDbRow(r));

      this.filteredReminders = all.filter((r: any) => {
        if (r.type === 'payment') return false;
        if (r.status === 'done') return false;
        if (!ACTION_REMINDER_TYPES.includes(r.type)) return false;
        const dbDate = (r.date || '').slice(0, 10);
        return dbDate === this.selectedDate;
      });

      this.dueInvoices = all.filter((r: any) =>
        r.type === 'payment' && r.status === 'pending'
      );
    } catch {
      this.filteredReminders = [];
      this.dueInvoices = [];
    }
  }

  onDateChange() {
    this.loadUserReminders();
  }

  saveAllUserReminders() {
    localStorage.setItem('user-reminders', JSON.stringify(this.reminders));
  }

  filterReminders() {
    this.filteredReminders = this.reminders.filter(r => r.date === this.selectedDate);
  }

  onReminderCompanySelect(companyName: string) {
    const customer = this.customers.find((c: any) => c.companyName === companyName);
    if (!customer) return;
    this.form.name = companyName;
    this.form.mobile = customer.primaryContact?.mobile || customer.mobile || '';
  }

  openAddModal() {
    this.form = { name: '', mobile: '', time: '', date: this.selectedDate, type: 'general', referenceNo: '', note: '' };
    this.showAddModal = true;
  }

  closeAddModal() { this.showAddModal = false; }

  async saveReminder() {
    if (!this.form.name || !this.form.time || !this.form.type) {
      this.toastService.warning('Name, Time and Reminder Type are required');
      return;
    }
    const reminder = {
      ...this.form,
      date: this.selectedDate,
      source: 'manual',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    try {
      await this.apiService.add('reminders', this.toDbRow(reminder));
      await this.loadUserReminders();
      this.closeAddModal();
      this.toastService.success('Reminder saved');
    } catch (error) {
      console.error('❌ Failed to save reminder:', error);
      this.toastService.error('Failed to save reminder');
    }
  }

  generateUserReminderReport() {
    if (this.filteredReminders.length === 0) { this.toastService.info('No reminders for the selected date'); return; }
    const doc = new jsPDF();
    doc.text('Reminders Report', 105, 15, { align: 'center' });
    doc.text(`Date: ${this.selectedDate}`, 14, 30);
    let y = 50;
    this.filteredReminders.forEach((r, i) => { doc.text(`${i + 1}. ${r.name} | ${r.mobile} | ${r.time}`, 14, y); y += 8; });
    doc.save(`Reminders_${this.selectedDate}.pdf`);
  }

  emailUserReminders() {
    if (this.filteredReminders.length === 0) { this.toastService.info('No reminders to email for the selected date'); return; }
    let content = `Your reminders for ${this.selectedDate}:\n\n`;
    this.filteredReminders.forEach((r, i) => { content += `${i + 1}. ${r.name} at ${r.time}\n`; });
    const subject = encodeURIComponent(`Reminders for ${this.selectedDate}`);
    const body = encodeURIComponent(content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  navigateFromReminder(r: any) {
    if (!r.referenceNo) return;
    switch (r.type) {
      case 'offer': this.router.navigate(['/offers'], { queryParams: { ref: r.referenceNo } }); break;
      case 'payment': this.router.navigate(['/invoices'], { queryParams: { inv: r.referenceNo } }); break;
    }
  }

  openPaymentReminder(customerName: string) {
    this.selectedCustomerName = customerName;
    this.selectedCustomerInvoices = this.dueInvoices.filter(x => x.customerName === customerName || x.name === customerName);
    let lines = '';
    this.selectedCustomerInvoices.forEach((inv, i) => {
      lines += `${i + 1}. ${inv.invoiceNo || inv.referenceNo} | ${inv.invoiceDate} | ₹${inv.amount} | Due: ${inv.dueDate} | Overdue: ${inv.overdueDays} days\n`;
    });
    this.emailBody =
      `To,\n${customerName}\n\nSubject: Payment Reminder\n\nDear Sir,\n\nYour payment is pending for the following invoices:\n\n${lines}\nKindly arrange the payment at the earliest.\n\nWarm regards,\nNAVBHARAT`;
    this.showPaymentEmail = true;
  }

  closePaymentEmail() { this.showPaymentEmail = false; }

  sendPaymentEmail() {
    const subject = encodeURIComponent('Payment Reminder');
    const body = encodeURIComponent(this.emailBody);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    this.showPaymentEmail = false;
  }

  generateReminderPDF(customerName: string) {
    const doc = new jsPDF();
    doc.text('PAYMENT REMINDER', 105, 15, { align: 'center' });
    doc.text(`To: ${customerName}`, 14, 35);
    let y = 55;
    this.selectedCustomerInvoices.forEach((inv, i) => {
      doc.text(`${i + 1}. ${inv.invoiceNo || inv.referenceNo} | Amount: ₹${inv.amount} | Overdue: ${inv.overdueDays} days`, 14, y);
      y += 8;
    });
    doc.save(`PaymentReminder_${customerName}.pdf`);
  }

  parseDDMMYYYY(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split('/');
    if (parts.length !== 3) { const fb = new Date(dateStr); return isNaN(fb.getTime()) ? new Date() : fb; }
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  async markReminderDone(reminder: any) {
    try {
      const updated = { ...reminder, status: 'done', completedAt: new Date().toISOString() };
      await this.apiService.put('reminders', this.toDbRow(updated));
      await this.loadUserReminders();
    } catch (e) {
      console.error('❌ Failed to mark reminder done', e);
    }
  }

  async syncPaymentReminders() {
    try {
      const [invRows, remRows] = await Promise.all([
        this.apiService.getAll('invoices').catch(() => []),
        this.apiService.getAll('reminders').catch(() => []),
      ]);

      const invoices = invRows.map((r: any) => this.mapInvoice(r));
      const paymentReminders = remRows
        .map((r: any) => this.fromDbRow(r))
        .filter((r: any) => r.type === 'payment');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Map invoiceNo → reminder for O(1) lookups
      const reminderByInvoice = new Map<string, any>(
        paymentReminders.map((r: any) => [r.referenceNo, r])
      );

      // Build the set of invoiceNos that are currently pending
      const pendingInvoiceNos = new Set<string>();

      for (const inv of invoices) {
        if (inv.status !== 'Pending' || !inv.invoiceNo) continue;

        // Compute due date
        let dueDate: Date;
        if (inv.dueDate) {
          dueDate = new Date(inv.dueDate);
        } else if (inv.invoiceDate && inv.creditDays) {
          dueDate = new Date(inv.invoiceDate);
          dueDate.setDate(dueDate.getDate() + Number(inv.creditDays));
        } else {
          continue;
        }
        dueDate.setHours(0, 0, 0, 0);

        const overdueDays = Math.max(0,
          Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        pendingInvoiceNos.add(inv.invoiceNo);

        const existing = reminderByInvoice.get(inv.invoiceNo);

        if (!existing) {
          // Case 1: no reminder yet → create
          await this.apiService.add('reminders', this.toDbRow({
            date: dueDate.toISOString().slice(0, 10),
            time: '10:00',
            type: 'payment',
            name: inv.billTo?.name || inv.customerName || '',
            mobile: '',
            referenceNo: inv.invoiceNo,
            invoiceNo: inv.invoiceNo,
            invoiceDate: inv.invoiceDate,
            dueDate: dueDate.toISOString().slice(0, 10),
            creditDays: inv.creditDays ?? '',
            amount: inv.grandTotal ?? 0,
            overdueDays,
            note: `Payment follow-up for invoice ${inv.invoiceNo}`,
            source: 'system',
            status: 'pending',
          }));
        } else {
          // Case 2: reminder exists → keep overdueDays and amount current
          const changed =
            existing.overdueDays !== overdueDays ||
            existing.amount !== (inv.grandTotal ?? 0);

          if (changed) {
            await this.apiService.put('reminders', this.toDbRow({
              ...existing,
              overdueDays,
              amount: inv.grandTotal ?? 0,
              dueDate: dueDate.toISOString().slice(0, 10),
            }));
          }
        }
      }

      // Case 3: stale reminder — invoice is paid/gone → delete
      for (const rem of paymentReminders) {
        if (rem.referenceNo && !pendingInvoiceNos.has(rem.referenceNo)) {
          await this.apiService.delete('reminders', rem.id);
        }
      }
    } catch { /* non-critical — reminders are best-effort */ }
  }

}
