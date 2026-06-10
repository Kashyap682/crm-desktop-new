import { Component, OnInit, HostListener, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { jsPDF } from 'jspdf';

interface Payment {
  id?: string;
  paymentId: string;
  customerName: string;
  customerId?: string;
  companyName: string;
  mobile: string;
  email: string;
  gstin: string;
  pan: string;
  invoiceNo: string;
  invoiceAmount: number;
  amount: number;
  outstandingBefore: number;
  outstandingAfter: number;
  date: string;
  status: 'Pending' | 'Success' | 'Failed';
}

interface Customer {
  id: string;
  name: string;
  companyName?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  primaryContact?: any;
  officeAddress?: any;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css']
})
export class PaymentsComponent implements OnInit, DoCheck {

  payments: Payment[] = [];
  customers: Customer[] = [];
  filteredInvoices: any[] = [];

  showForm = false;
  isEditing = false;
  editIndex: number | null = null;
  sortAsc = false;
  invoices: any[] = [];

  newPayment: Payment = this.getEmptyPayment();

  constructor(private apiService: ApiService, private toastService: ToastService) { }

  activeMenuId: any = null;

  toggleActionMenu(event: Event, id: any) {
    event.stopPropagation();
    this.activeMenuId = this.activeMenuId === id ? null : id;
  }

  closeActionMenu() { this.activeMenuId = null; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) { this.activeMenuId = null; }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(p: Payment): any {
    const row: any = {
      payment_id:        p.paymentId        || null,
      payment_ref:       p.paymentId        || null,
      customer_name:     p.customerName     || null,
      company_name:      p.companyName      || null,
      mobile:            p.mobile           || null,
      email:             p.email            || null,
      gstin:             p.gstin            || null,
      pan:               p.pan              || null,
      invoice_no:        p.invoiceNo        || null,
      invoice_amount:    p.invoiceAmount    ?? 0,
      amount:            p.amount           ?? 0,
      outstanding_before: p.outstandingBefore ?? 0,
      outstanding_after:  p.outstandingAfter  ?? 0,
      date:              p.date             || null,
      status:            p.status           || 'Pending',
    };
    if (p.id) row.id = p.id;
    return row;
  }

  private fromDbRow(row: any): Payment {
    return {
      id:               row.id,
      paymentId:        row.payment_id       || row.payment_ref || '',
      customerName:     row.customer_name    || '',
      customerId:       row.customer_id      || '',
      companyName:      row.company_name     || '',
      mobile:           row.mobile           || '',
      email:            row.email            || '',
      gstin:            row.gstin            || '',
      pan:              row.pan              || '',
      invoiceNo:        row.invoice_no       || '',
      invoiceAmount:    row.invoice_amount   ?? 0,
      amount:           row.amount           ?? 0,
      outstandingBefore: row.outstanding_before ?? 0,
      outstandingAfter:  row.outstanding_after  ?? 0,
      date:             row.date             || '',
      status:           (row.status as any)  || 'Pending',
    };
  }

  private mapCustomer(row: any): Customer {
    return {
      id:             row.id,
      companyName:    row.company_name    || '',
      name:           row.name            || '',
      gstin:          row.gstin           || '',
      pan:            row.pan             || '',
      mobile:         row.mobile          || '',
      email:          row.email           || '',
      primaryContact: row.primary_contact || {},
      officeAddress:  row.office_address  || {},
    };
  }

  private mapInvoice(row: any): any {
    return {
      id:           row.id,
      invoiceNo:    row.invoice_ref || row.invoice_no || '',
      grandTotal:   row.grand_total ?? 0,
      billTo:       row.bill_to     || {},
      companyName:  row.company_name || row.bill_to?.name || '',
      items:        Array.isArray(row.items) ? row.items : [],
      status:       row.status      || 'Pending',
    };
  }

  // ── Lifecycle ────────────────────────────────────────────

  async ngOnInit() {
    await Promise.all([
      this.loadCustomers(),
      this.loadInvoices(),
      this.loadPayments(),
    ]);
  }

  async loadInvoices() {
    try {
      const rows = await this.apiService.getAll('invoices');
      this.invoices = rows.map((r: any) => this.mapInvoice(r));
    } catch { this.invoices = []; }
  }

  async loadPayments() {
    try {
      const rows = await this.apiService.getAll('payments');
      this.payments = rows.map((r: any) => this.fromDbRow(r));
      this.sortPayments();
    } catch { this.payments = []; }
  }

  async loadCustomers() {
    try {
      const rows = await this.apiService.getAll('customers');
      this.customers = rows.map((r: any) => this.mapCustomer(r));
    } catch { this.customers = []; }
  }

  /* =============================
     FORM HELPERS
  ============================= */
  getEmptyPayment(): Payment {
    return {
      customerName: '', customerId: undefined, companyName: '',
      mobile: '', email: '', gstin: '', pan: '',
      paymentId: '', invoiceNo: '', invoiceAmount: 0,
      amount: 0, outstandingBefore: 0, outstandingAfter: 0,
      date: new Date().toISOString().slice(0, 10), status: 'Pending'
    };
  }

  toggleForm(edit = false, index?: number) {
    this.showForm = !this.showForm;
    if (!this.showForm) { this.resetForm(); return; }

    if (edit && index !== undefined) {
      this.isEditing = true;
      this.editIndex = index;
      this.newPayment = { ...this.payments[index] };
    } else {
      this.resetForm();
      this.newPayment.paymentId = this.generatePaymentId();
    }
  }

  resetForm() {
    this.isEditing = false;
    this.editIndex = null;
    this.newPayment = this.getEmptyPayment();
  }

  /* =============================
     CUSTOMER AUTO-FILL
  ============================= */
  onCustomerSelected(companyName: string) {
    const customer = this.customers.find(c => c.companyName === companyName);
    if (!customer) return;

    this.newPayment.companyName = customer.companyName || '';
    this.newPayment.customerName = customer.name || '';
    this.newPayment.customerId = customer.id;
    const c: any = customer;
    this.newPayment.mobile = customer.mobile || c.primaryContact?.mobile || '';
    this.newPayment.email = customer.email || c.primaryContact?.email || '';
    this.newPayment.gstin = customer.gstin || c.officeAddress?.gstin || '';
    this.newPayment.pan = customer.pan || '';

    this.newPayment.invoiceNo = '';
    this.newPayment.invoiceAmount = 0;
    this.newPayment.outstandingBefore = 0;
    this.newPayment.outstandingAfter = 0;

    this.filteredInvoices = this.invoices.filter(inv =>
      (inv.billTo?.name === companyName || inv.billTo?.name === customer.name || inv.companyName === companyName) &&
      this.getInvoiceOutstanding(inv.invoiceNo) > 0
    );
  }

  getInvoiceLabel(inv: any): string {
    const firstItem = inv.items?.[0]?.particulars || '';
    return firstItem ? `${inv.invoiceNo} | ${firstItem}` : inv.invoiceNo;
  }

  generatePaymentId(): string {
    const year = new Date().getFullYear();
    const yearPayments = this.payments.filter(p => p.paymentId?.startsWith(`PAY/${year}`));
    const nextNumber = yearPayments.length + 1;
    return `PAY/${year}/${nextNumber.toString().padStart(4, '0')}`;
  }

  /* =============================
     SAVE PAYMENT
  ============================= */
  async savePayment() {
    if (this.newPayment.amount > this.newPayment.outstandingBefore) {
      this.toastService.warning('Payment cannot exceed outstanding amount');
      return;
    }

    if (!this.isEditing) {
      this.newPayment.paymentId = this.generatePaymentId();
    }

    try {
      await this.apiService.put('payments', this.toDbRow(this.newPayment));

      // Update invoice status — only confirmed (Success) payments reduce outstanding
      const invoice = this.invoices.find(i => i.invoiceNo === this.newPayment.invoiceNo);
      if (invoice) {
        const newStatus = this.deriveInvoiceStatus(this.newPayment.invoiceNo);
        if (newStatus !== invoice.status) {
          invoice.status = newStatus;
          try {
            await this.apiService.put('invoices', { id: invoice.id, status: newStatus });
          } catch { /* non-critical */ }
        }
      }

      this.toggleForm();
      await this.loadPayments();
      this.toastService.success('Payment saved');
    } catch (error) {
      console.error('❌ Failed to save payment:', error);
      this.toastService.error('Failed to save payment');
    }
  }

  /* =============================
     SORT
  ============================= */
  get sortedPayments() {
    return [...this.payments].sort((a, b) => {
      const d1 = new Date(a.date).getTime();
      const d2 = new Date(b.date).getTime();
      return this.sortAsc ? d1 - d2 : d2 - d1;
    });
  }

  sortPayments() {
    this.payments = this.sortedPayments;
  }

  getInvoiceOutstanding(invoiceNo: string): number {
    const invoice = this.invoices.find(i => i.invoiceNo === invoiceNo);
    if (!invoice) return 0;
    const totalPaid = this.payments
      .filter(p => p.invoiceNo === invoiceNo && p.status === 'Success')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return Number(invoice.grandTotal) - totalPaid;
  }

  /**
   * Derive the correct invoice status from confirmed (Success) payments only.
   * Pending payments don't count — they haven't cleared yet.
   */
  deriveInvoiceStatus(invoiceNo: string): 'Paid' | 'Partially Paid' | 'Pending' {
    const invoice = this.invoices.find(i => i.invoiceNo === invoiceNo);
    if (!invoice) return 'Pending';
    const totalPaid = this.payments
      .filter(p => p.invoiceNo === invoiceNo && p.status === 'Success')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (totalPaid <= 0) return 'Pending';
    return totalPaid >= Number(invoice.grandTotal) ? 'Paid' : 'Partially Paid';
  }

  onInvoiceSelected() {
    const invoice = this.filteredInvoices.find(i => i.invoiceNo === this.newPayment.invoiceNo);
    if (!invoice) return;
    const outstanding = this.getInvoiceOutstanding(invoice.invoiceNo);
    this.newPayment.invoiceAmount = invoice.grandTotal;
    this.newPayment.outstandingBefore = outstanding;
    this.newPayment.amount = outstanding;
    this.newPayment.outstandingAfter = 0;
  }

  ngDoCheck() {
    if (this.newPayment.outstandingBefore != null && this.newPayment.amount != null) {
      this.newPayment.outstandingAfter = this.newPayment.outstandingBefore - this.newPayment.amount;
    }
  }

  async deletePayment(payment: Payment, index: number) {
    if (payment.status === 'Success') {
      this.toastService.warning('Successful payments cannot be deleted');
      return;
    }
    if (!confirm(`Are you sure you want to delete payment ${payment.paymentId}?`)) return;

    this.payments.splice(index, 1);
    if (payment.id) {
      try {
        await this.apiService.delete('payments', payment.id);
      } catch (error) {
        console.error('❌ Failed to delete payment:', error);
      }
    }
    this.sortPayments();
  }

  downloadReceipt(payment: Payment) {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('PAYMENT RECEIPT', 70, 20);
    doc.setFontSize(10);
    doc.text(`Payment ID: ${payment.paymentId}`, 20, 40);
    doc.text(`Invoice No: ${payment.invoiceNo}`, 20, 50);
    doc.text(`Customer: ${payment.customerName}`, 20, 60);
    doc.text(`Amount Paid: ₹${payment.amount}`, 20, 70);
    doc.text(`Outstanding After: ₹${payment.outstandingAfter}`, 20, 80);
    doc.text(`Date: ${payment.date}`, 20, 90);
    doc.save(`${payment.paymentId}.pdf`);
  }
}
