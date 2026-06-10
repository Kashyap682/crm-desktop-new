import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { ConfirmService } from '../../service/confirm.service';

type OrderStatus = 'offers' | 'ongoing' | 'completed';

interface OrderItem {
  productName: string;
  productId?: string | number;
  qty: number;
  rate?: number;
  amount?: number;
  hsn?: number;
  uom?: string;
}

interface Order {
  id?: string;
  orderNo: string;
  inquiryNo?: string;
  orderDate: string;
  deliveryDate?: string;
  customerId?: string | number;
  customerName: string;
  salesman?: string;
  items: OrderItem[];
  amount: number;
  gstPercent?: number;
  totalAmount: number;
  status: OrderStatus;
  remarks?: string;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {

  selectedFilter: OrderStatus | 'completed' = 'offers';
  orders: Order[] = [];

  // Modals
  showModal = false;
  isEditing = false;
  editingOrderId: string | null = null;
  orderForm: Order = this.getEmptyOrder();

  showDetailsModal = false;
  detailsOrder: Order | null = null;

  // Data Lists
  inquiriesList: any[] = [];
  inventoryList: any[] = [];

  constructor(private apiService: ApiService, private toastService: ToastService, private confirmService: ConfirmService) { }

  // Action Menu Helpers
  activeMenuId: any = null;

  toggleActionMenu(event: Event, id: any) {
    event.stopPropagation();
    this.activeMenuId = this.activeMenuId === id ? null : id;
  }

  closeActionMenu() {
    this.activeMenuId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.activeMenuId = null;
  }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(order: Order): any {
    const row: any = {
      order_ref:    order.orderNo       || null,
      order_date:   order.orderDate     || null,
      delivery_date: order.deliveryDate || null,
      customer_name: order.customerName || null,
      inquiry_ref:  order.inquiryNo     || null,
      salesman:     order.salesman      || null,
      items:        order.items         ?? [],
      amount:       order.amount        ?? 0,
      gst_percent:  order.gstPercent    ?? 18,
      grand_total:  order.totalAmount   ?? 0,
      status:       order.status        || 'offers',
      remarks:      order.remarks       || null,
    };
    if (order.id) row.id = order.id;
    return row;
  }

  private fromDbRow(row: any): Order {
    return {
      id:           row.id,
      orderNo:      row.order_ref    || '',
      orderDate:    row.order_date   || '',
      deliveryDate: row.delivery_date || '',
      customerName: row.customer_name || '',
      inquiryNo:    row.inquiry_ref  || '',
      salesman:     row.salesman     || '',
      items:        Array.isArray(row.items) ? row.items : [],
      amount:       row.amount       ?? 0,
      gstPercent:   row.gst_percent  ?? 18,
      totalAmount:  row.grand_total  ?? 0,
      status:       (row.status as OrderStatus) || 'offers',
      remarks:      row.remarks      || '',
    };
  }

  private mapInquiry(row: any): any {
    const refMatch = (row.inquiry_ref || '').match(/INQ-(\d+)/i);
    const seqId = refMatch ? parseInt(refMatch[1], 10) : null;
    return {
      id:          seqId ?? row.id,
      _uuid:       row.id,
      companyName: row.company_name  || '',
      inquiryNo:   row.inquiry_ref   || '',
      salesman:    row.salesman      || '',
      items:       Array.isArray(row.items) ? row.items : [],
    };
  }

  // ── Lifecycle ──────────────────────────────────────────

  async ngOnInit() {
    await Promise.all([
      this.loadOrders(),
      this.loadInquiriesFromDB(),
      this.loadInventoryFromDB(),
    ]);
  }

  /* -------- FILTERED ORDERS -------- */
  get filteredOrders() {
    return this.orders.filter(o => o.status === this.selectedFilter);
  }


  /* -------- LOAD DATA -------- */
  private async loadInquiriesFromDB() {
    try {
      const rows = await this.apiService.getAll('inquiries');
      this.inquiriesList = rows.map((r: any) => this.mapInquiry(r));
    } catch {
      this.inquiriesList = [];
    }
  }

  private async loadInventoryFromDB() {
    try {
      this.inventoryList = await this.apiService.getAll('inventory');
    } catch {
      this.inventoryList = [];
    }
  }

  /* -------- INQUIRY → ORDER LINKING -------- */
  onInquirySelect(event: any) {
    const val = event.target.value;
    if (!val) return;

    const selectedInquiry = this.inquiriesList.find(i => String(i.id) == String(val));
    if (!selectedInquiry) return;

    this.orderForm.inquiryNo = selectedInquiry.inquiryNo || String(selectedInquiry.id);
    this.orderForm.customerName = selectedInquiry.companyName || '';
    this.orderForm.salesman = selectedInquiry.salesman || '';

    if (selectedInquiry.items && Array.isArray(selectedInquiry.items)) {
      this.orderForm.items = selectedInquiry.items.map((it: any) => {
        const pName = it.productName || it.name || it.item || '';
        const product = this.inventoryList.find((p: any) => {
          const invName = (p.displayName || p.name || '').toLowerCase().trim();
          const targetName = pName.toLowerCase().trim();
          return invName === targetName;
        });
        const unitRate = product ? (Number(product.price) || Number(product.rate) || Number(product.sellingPrice) || 0) : 0;
        return {
          productName: pName,
          hsn: it.hsn,
          uom: it.uom,
          qty: Number(it.qty) || Number(it.quantity) || 1,
          rate: unitRate,
          amount: 0
        };
      });
    }

    this.recalculateFormAmounts();
  }

  private async markInquiryConverted(inquiryRef: string) {
    const inq = this.inquiriesList.find(i =>
      i.inquiryNo === inquiryRef || String(i.id) === inquiryRef
    );
    if (!inq?._uuid) return;
    try {
      await this.apiService.put('inquiries', { id: inq._uuid, status: 'converted' });
    } catch { /* non-critical */ }
  }

  /* -------- OPEN / CLOSE MODAL -------- */
  openAddModal() {
    this.isEditing = false;
    this.editingOrderId = null;
    this.orderForm = this.getEmptyOrder();
    this.orderForm.orderNo = this.generateOrderNo();
    this.showModal = true;
  }

  openEditModal(order: Order) {
    this.isEditing = true;
    this.editingOrderId = order.id ?? null;
    this.orderForm = JSON.parse(JSON.stringify(order));
    this.showModal = true;
  }

  openDetailsModal(order: Order) {
    this.detailsOrder = order;
    this.showDetailsModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.isEditing = false;
    this.editingOrderId = null;
  }

  /* -------- ITEM LIST FORM -------- */
  addItemLine() {
    this.orderForm.items.push({ productName: '', qty: 1, rate: 0, amount: 0 });
  }

  removeItemLine(index: number) {
    this.orderForm.items.splice(index, 1);
    this.recalculateFormAmounts();
  }

  /* -------- AMOUNT CALCULATION -------- */
  recalculateFormAmounts() {
    let amount = 0;
    this.orderForm.items.forEach(it => {
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      it.amount = qty * rate;
      amount += it.amount;
    });
    this.orderForm.amount = Number(amount.toFixed(2));
    const gstPercent = Number(this.orderForm.gstPercent) || 0;
    const gst = (this.orderForm.amount * gstPercent) / 100;
    this.orderForm.totalAmount = Number((this.orderForm.amount + gst).toFixed(2));
  }

  /* -------- SUBMIT FORM -------- */
  async submitForm() {
    if (!this.orderForm.customerName || this.orderForm.items.length === 0) {
      this.toastService.warning('Please enter customer and at least one item');
      return;
    }

    const payload: Order = JSON.parse(JSON.stringify(this.orderForm));
    payload.amount = Number(payload.amount) || 0;
    payload.gstPercent = Number(payload.gstPercent) || 0;

    let calcAmount = 0;
    payload.items.forEach(item => {
      item.qty = Number(item.qty) || 0;
      item.rate = Number(item.rate) || 0;
      item.amount = item.qty * item.rate;
      calcAmount += item.amount;
    });
    payload.amount = parseFloat(calcAmount.toFixed(2));
    const gstAmount = (payload.amount * payload.gstPercent) / 100;
    payload.totalAmount = parseFloat((payload.amount + gstAmount).toFixed(2));

    try {
      if (this.isEditing && this.editingOrderId != null) {
        payload.id = this.editingOrderId;
        await this.apiService.put('orders', this.toDbRow(payload));
      } else {
        delete payload.id;
        await this.apiService.add('orders', this.toDbRow(payload));
        await this.addReminder({
          type: 'order',
          name: payload.customerName || '',
          referenceNo: payload.orderNo || '',
          date: payload.deliveryDate || null,
          daysFromNow: 7,
          note: `Shipping follow up for order ${payload.orderNo}`,
        });
        if (payload.inquiryNo) {
          await this.markInquiryConverted(payload.inquiryNo);
        }
      }
      this.showModal = false;
      await this.loadOrders();
      this.toastService.success(this.isEditing ? 'Order updated' : 'Order saved');
    } catch (err) {
      console.error('❌ Failed to save order:', err);
      this.toastService.error('Failed to save order');
    }
  }

  /* -------- UPDATE STATUS -------- */
  async updateStatus(orderId: string | undefined, newStatus: OrderStatus) {
    if (orderId == null) return;
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;
    try {
      await this.apiService.put('orders', this.toDbRow(order));
      if (newStatus === 'completed') await this.reduceInventoryForOrder(order);
      await this.loadOrders();
    } catch (err) {
      console.error('❌ Failed to update status:', err);
    }
  }

  /* -------- DELETE ORDER -------- */
  async deleteOrder(orderId: string | undefined) {
    if (!await this.confirmService.confirm('Delete this order?', { danger: true })) return;
    if (orderId == null) return;
    try {
      await this.apiService.delete('orders', orderId);
      await this.loadOrders();
    } catch (err) {
      console.error('❌ Failed to delete order:', err);
    }
  }

  /* -------- HELPERS -------- */
  private generateOrderNo(): string {
    const year = new Date().getFullYear();
    const maxSeq = this.orders.reduce((max, ord) => {
      const parts = (ord.orderNo || '').split('/');
      const n = parseInt(parts[2] || '0', 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `ORD/${year}/${String(maxSeq + 1).padStart(4, '0')}`;
  }

  private async reduceInventoryForOrder(order: Order): Promise<void> {
    for (const it of order.items) {
      const item = this.inventoryList.find((p: any) =>
        (p.displayName || p.name || '') === it.productName
      );
      if (!item) continue;
      const newQty = Math.max(0, Number(item.quantity) - Number(it.qty));
      try {
        await this.apiService.put('inventory', { id: item.id, quantity: newQty });
      } catch { /* non-critical */ }
    }
  }

  private getEmptyOrder(): Order {
    const today = new Date().toISOString().slice(0, 10);
    return {
      orderNo: '',
      inquiryNo: '',
      orderDate: today,
      deliveryDate: today,
      customerId: '',
      customerName: '',
      salesman: '',
      items: [{ productName: '', qty: 1, rate: 0, amount: 0 }],
      amount: 0,
      gstPercent: 18,
      totalAmount: 0,
      status: 'offers',
      remarks: ''
    };
  }

  async loadOrders() {
    try {
      const rows = await this.apiService.getAll('orders');
      this.orders = rows.map((r: any) => this.fromDbRow(r));
    } catch (err) {
      console.error('❌ Failed to load orders:', err);
      this.orders = [];
    }
  }

  private async addReminder(opts: {
    type: string; name: string; referenceNo: string;
    date: string | null; daysFromNow: number; note: string;
  }): Promise<void> {
    try {
      let reminderDate = opts.date;
      if (!reminderDate) {
        const d = new Date();
        d.setDate(d.getDate() + opts.daysFromNow);
        reminderDate = d.toISOString().slice(0, 10);
      }
      await this.apiService.add('reminders', {
        date:         reminderDate,
        time:         '10:00',
        type:         opts.type,
        name:         opts.name,
        mobile:       '',
        reference_no: opts.referenceNo,
        note:         opts.note,
        source:       'system',
        status:       'pending',
      });
    } catch { /* reminder creation is non-critical */ }
  }
}
