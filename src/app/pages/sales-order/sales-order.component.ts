import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { ConfirmService } from '../../service/confirm.service';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-sales-order',
  standalone: true,
  templateUrl: './sales-order.component.html',
  styleUrls: ['./sales-order.component.css'],
  imports: [FormsModule, CommonModule]
})
export class SalesOrderComponent implements OnInit, AfterViewInit {

  // ===== FORM STATE =====
  salesOrderStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT';
  showForm = false;
  isEditing = false;
  editingOrder: any = null;
  newSale = true;
  state: any;
  inquiry: any;

  // ===== TABLE DATA =====
  draftOrders: any[] = [];
  submittedOrders: any[] = [];
  approvedOrders: any[] = [];

  // ===== PAYMENT TERMS =====
  pTerms = [
    { name: 'Advance', value: 'Advance' },
    { name: 'Credit', value: 'Credit' }
  ];

  /* ===============================
     OFFER SELECTION MODAL
  =============================== */
  showOfferModal = false;
  availableOffers: any[] = [];
  selectedCompanyForOffers = '';
  isLoadingOffers = false;

  // ===== BASIC DETAILS =====
  salesOrderNo = '';
  salesOrderDate = '';
  selectedCompanyName = '';
  customerName = '';
  customerId = '';
  inquiryId = '';
  billAddr = '';
  shipAddr = '';
  gstNo = '';
  billingAddressOptions: { label: string; value: string }[] = [];
  shippingAddressOptions: { label: string; value: string }[] = [];

  // ===== CONTACT =====
  contactPerson = '';
  contactNo = '';
  paymentTerms = 'Advance';
  creditDays: number | null = null;
  poNo = '';
  poDate = '';

  // ===== ITEMS =====
  itemsShow: any[] = [];

  // ===== SUMMARY =====
  freightCharges = 0;
  advanceReceived = 0;

  // ===== DELIVERY =====
  expectedDeliveryDate = '';
  deliveryTerms = '';
  transporterName = '';
  transportMode = '';
  gstType: 'cgst_sgst' | 'igst' = 'cgst_sgst';

  // ===== ATTACHMENTS =====
  files: File[] = [];
  isDragActive = false;

  // ===== DATA =====
  customers: any[] = [];
  allItems: any[] = [];

  constructor(
    private router: Router,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private confirmService: ConfirmService
  ) { }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(so: any): any {
    const row: any = {
      order_ref:              so.orderNo               || null,
      order_date:             so.orderDate             || null,
      customer_name:          so.customerName          || null,
      company_name:           so.companyName           || so.customerName || null,
      inquiry_ref:            so.inquiryId             || null,
      bill_addr:              so.billAddr              || null,
      ship_addr:              so.shipAddr              || null,
      gst_no:                 so.gstNo                 || null,
      contact_person:         so.contactPerson         || null,
      contact_no:             so.contactNo             || null,
      payment_terms:          so.paymentTerms          || null,
      credit_days:            so.creditDays            ?? null,
      po_no:                  so.poNo                  || null,
      po_date:                so.poDate                || null,
      items:                  so.items                 ?? [],
      freight_charges:        so.freightCharges        ?? 0,
      advance_received:       so.advanceReceived       ?? 0,
      grand_total:            so.grandTotal            ?? null,
      status:                 so.status                || 'DRAFT',
      expected_delivery_date: so.expectedDeliveryDate  || null,
      delivery_terms:         so.deliveryTerms         || null,
      transporter_name:       so.transporterName       || null,
      transport_mode:         so.transportMode         || null,
      gst_type:               so.gstType               || 'cgst_sgst',
    };
    if (so.id) row.id = so.id;
    return row;
  }

  private fromDbRow(row: any): any {
    return {
      id:                   row.id,
      orderNo:              row.order_ref             || '',
      orderDate:            row.order_date            || '',
      customerName:         row.customer_name         || '',
      companyName:          row.company_name          || row.customer_name || '',
      inquiryId:            row.inquiry_ref           || '',
      billAddr:             row.bill_addr             || '',
      shipAddr:             row.ship_addr             || '',
      gstNo:                row.gst_no               || '',
      contactPerson:        row.contact_person        || '',
      contactNo:            row.contact_no            || '',
      paymentTerms:         row.payment_terms         || 'Advance',
      creditDays:           row.credit_days           ?? null,
      poNo:                 row.po_no                || '',
      poDate:               row.po_date              || '',
      items:                Array.isArray(row.items)  ? row.items : [],
      freightCharges:       row.freight_charges       ?? 0,
      advanceReceived:      row.advance_received      ?? 0,
      grandTotal:           row.grand_total           ?? 0,
      status:               row.status               || 'DRAFT',
      expectedDeliveryDate: row.expected_delivery_date || '',
      deliveryTerms:        row.delivery_terms        || '',
      transporterName:      row.transporter_name      || '',
      transportMode:        row.transport_mode        || '',
      gstType:              row.gst_type             || 'cgst_sgst',
    };
  }

  private mapCustomer(row: any): any {
    return {
      id:              row.id,
      customerId:      row.customer_ref     || '',
      companyName:     row.company_name     || '',
      name:            row.name             || '',
      gstin:           row.gstin            || '',
      mobile:          row.mobile           || '',
      email:           row.email            || '',
      primaryContact:  row.primary_contact  || {},
      secondaryContact: row.secondary_contact || {},
      officeAddress:   row.office_address   || {},
      billing:         row.billing          || {},
      billing2:        row.billing2         || {},
      shipping:        row.shipping         || {},
      shippingAddresses: row.shipping_addresses || [],
    };
  }

  private mapOffer(row: any): any {
    return {
      id:              row.id,
      offerRef:        row.offer_ref      || '',
      offerStatus:     row.offer_status   || '',
      status:          row.status         || 'active',
      customerName:    row.customer_name  || '',
      customerSnapshot: row.customer_snapshot || null,
      inquiryNo:       row.inquiry_no     ?? null,
      items:           Array.isArray(row.items) ? row.items : [],
      paymentTerms:    row.payment_terms  || '',
      freightCharges:  row.freight_charges ?? 0,
      deliveryTerms:   row.delivery_terms || '',
      gstType:         row.gst_type       || 'cgst_sgst',
      date:            row.date           || '',
    };
  }

  private normalizeText(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private toInquiryId(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;
    const match = raw.match(/INQ-(\d+)/i);
    if (match) return parseInt(match[1], 10);
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  private toDisplayInquiryId(value: any): string {
    const id = this.toInquiryId(value);
    return id ? `INQ-${String(id).padStart(3, '0')}` : '';
  }

  // ===== LIFECYCLE HOOKS =====

  async ngOnInit(): Promise<void> {
    await this.initDBAndLoad();

    const nav = this.router.getCurrentNavigation();
    this.state = nav?.extras?.state ?? history.state;
    this.inquiry = this.state?.inquiry;
    const offerState = this.state?.offer;

    // ── Auto-fill from Offer (when coming from Offers page "Create Sales Order") ──
    if (offerState && !this.inquiry) {
      this.newSale = true;
      this.showForm = true;
      await this.generateSalesOrderNo();
      this.salesOrderDate = new Date().toISOString().slice(0, 10);
      this.selectedCompanyName = offerState.customerSnapshot?.companyName || offerState.customerName || '';
      this.customerName = offerState.customerName || '';

      const customer: any = await this.loadCustomerByName(this.customerName);
      if (customer) {
        this.customerId = customer.id || '';
        this.billAddr = this.formatAddress(customer.billing);
        this.shipAddr = this.formatAddress(customer.shipping);
        this.gstNo = customer.gstin || '';
      }

      this.paymentTerms = this.normalizePaymentTerms(offerState.paymentTerms);
      if (offerState.freightCharges) this.freightCharges = offerState.freightCharges;
      if (offerState.deliveryTerms) this.deliveryTerms = offerState.deliveryTerms;
      if (offerState.gstType) this.gstType = offerState.gstType;

      try {
        const allPOs = await this.apiService.getAll('purchaseOrders');
        const po = allPOs.find((p: any) => (p.offer_ref || p.offerRef) === offerState.offerRef);
        if (po) { this.fillFromPO(po); }
      } catch { /* ignore */ }

      (offerState.items || []).forEach((i: any) => {
        this.itemsShow.push({
          item: i.name,
          qty: i.qty,
          uom: i.uom || '',
          hsn: i.hsn || '',
          rate: i.rate ?? 0,
          disc: 0,
          discountType: '₹',
          gst: +i.gst || 18,
          total: 0
        });
        this.recalculateLine(this.itemsShow[this.itemsShow.length - 1]);
      });
      return;
    }

    if (!this.inquiry) {
      this.newSale = true;
      await this.generateSalesOrderNo();
      this.salesOrderDate = new Date().toISOString().slice(0, 10);
      this.addLine();
      return;
    }

    // Auto-fill from Inquiry + Offer
    this.newSale = true;
    this.showForm = true;
    await this.generateSalesOrderNo();
    this.inquiryId = `INQ-${String(this.inquiry.id || '').padStart(3, '0')}`;
    this.salesOrderDate = new Date().toISOString().slice(0, 10);

    this.selectedCompanyName = this.inquiry.companyName || '';
    const customer: any = this.customers.find((c: any) =>
      (c.companyName || '').toLowerCase().trim() === this.selectedCompanyName.toLowerCase().trim()
    );
    if (customer) {
      this.customerId = customer.id || '';
      this.customerName = customer.name || customer.companyName || '';
      this.contactPerson = this.formatContactName(customer.primaryContact) || '';
      this.contactNo = customer.primaryContact?.mobile || customer.mobile || '';
      this.gstNo = customer.gstin || customer.officeAddress?.gstin || '';
      this.billAddr = this.formatAddress(customer.officeAddress || customer.billing);
      this.shipAddr = this.formatAddress(customer.billing || customer.shipping);
    }

    if (offerState) {
      this.paymentTerms = this.normalizePaymentTerms(offerState.paymentTerms);
      if (offerState.freightCharges) this.freightCharges = offerState.freightCharges;
      if (offerState.deliveryTerms) this.deliveryTerms = offerState.deliveryTerms;
      if (offerState.validity) this.expectedDeliveryDate = offerState.validity;
      if (offerState.gstType) this.gstType = offerState.gstType;

      try {
        const allPOs = await this.apiService.getAll('purchaseOrders');
        const po = allPOs.find((p: any) =>
          (p.offer_ref || p.offerRef) === offerState.offerRef ||
          p.inquiry_ref === this.inquiryId
        );
        if (po) { this.fillFromPO(po); }
      } catch { /* ignore */ }

      this.itemsShow = [];
      (offerState.items || []).forEach((i: any, idx: number) => {
        const productName = i.name || i.productName || '';
        const inqItem = this.inquiry?.items?.[idx];
        const product = this.allItems.find((p: any) =>
          (p.displayName || p.name || '').toLowerCase() === productName.toLowerCase()
        );
        this.itemsShow.push({
          item: productName,
          qty: i.qty || 1,
          uom: i.uom || inqItem?.uom || product?.unit || '',
          hsn: i.hsn || inqItem?.hsn || product?.hsn || '',
          rate: i.rate ?? 0,
          disc: 0,
          discountType: '₹',
          gst: +i.gst || +product?.gst || 18,
          total: 0
        });
        this.recalculateLine(this.itemsShow[this.itemsShow.length - 1]);
      });
    } else {
      this.itemsShow = [];
      (this.inquiry.items || []).forEach((i: any) => {
        const productName = i.productName || i.name || '';
        const product = this.allItems.find((p: any) =>
          (p.displayName || p.name || '').toLowerCase() === productName.toLowerCase()
        );
        this.itemsShow.push({
          item: productName,
          qty: i.qty || 1,
          uom: i.uom || product?.unit || '',
          hsn: i.hsn || product?.hsn || '',
          rate: product?.price || product?.rate || 0,
          disc: 0,
          discountType: '₹',
          gst: +product?.gst || 18,
          total: 0
        });
        this.recalculateLine(this.itemsShow[this.itemsShow.length - 1]);
      });
      if (this.inquiry.freight || this.inquiry.freightCharges) {
        this.freightCharges = this.inquiry.freight || this.inquiry.freightCharges || 0;
      }
    }
  }

  async ngAfterViewInit() {
    await this.loadSalesOrders();
  }

  // ===== INITIALIZATION =====

  async initDBAndLoad() {
    try {
      this.allItems = await this.apiService.getAll('inventory');
    } catch {
      this.allItems = [];
    }

    try {
      const rows = await this.apiService.getAll('customers');
      this.customers = rows.map((r: any) => this.mapCustomer(r));
    } catch {
      this.customers = [];
    }
  }

  async generateSalesOrderNo() {
    try {
      const allOrders = await this.apiService.getAll('salesOrders');
      let nextNum = 1;
      if (allOrders.length > 0) {
        const maxNum = allOrders.reduce((max: number, row: any) => {
          const ref = row.order_ref || '';
          const parts = ref.split('/');
          const n = parseInt(parts[2] || '0');
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        nextNum = maxNum + 1;
      }
      const year = new Date().getFullYear();
      this.salesOrderNo = `SO/${year}/${String(nextNum).padStart(5, '0')}`;
    } catch {
      const year = new Date().getFullYear();
      this.salesOrderNo = `SO/${year}/00001`;
    }
  }

  async loadCustomerByName(name: string): Promise<any | null> {
    return this.customers.find(c =>
      c.companyName?.toLowerCase().trim() === name.toLowerCase().trim()
    ) || null;
  }

  async loadSalesOrders() {
    try {
      const rows = await this.apiService.getAll('salesOrders');
      const all = rows.map((r: any) => this.fromDbRow(r));
      this.draftOrders = all.filter((o: any) => o.status === 'DRAFT');
      this.submittedOrders = all.filter((o: any) => o.status === 'SUBMITTED');
      this.approvedOrders = all.filter((o: any) => o.status === 'APPROVED');
    } catch (error) {
      console.error('❌ Failed to load sales orders:', error);
    }
  }

  private getSalesOrderByNo(orderNo: string): any | null {
    const all = [...this.draftOrders, ...this.submittedOrders, ...this.approvedOrders];
    return all.find(o => o.orderNo === orderNo) || null;
  }

  // ===== CUSTOMER SELECTION =====

  async onCompanySelected(selectedCompanyName: string) {
    if (!selectedCompanyName) {
      this.resetCompanyFields();
      return;
    }

    try {
      const customer = this.customers.find(c =>
        c.companyName?.toLowerCase().trim() === selectedCompanyName.toLowerCase().trim()
      );

      if (customer) {
        this.customerId = customer.id || '';
        this.customerName = customer.name || customer.companyName || '';
        this.contactPerson = this.formatContactName(customer.primaryContact) || '';
        this.contactNo = customer.primaryContact?.mobile || customer.mobile || '';
        this.gstNo = customer.gstin || customer.officeAddress?.gstin || '';

        const addrSrc = customer.officeAddress || customer.billing;
        this.billAddr = this.formatAddress(addrSrc);

        this.billingAddressOptions = [];
        if (customer.officeAddress?.line1 || customer.officeAddress?.street) {
          this.billingAddressOptions.push({ label: 'Office Address', value: this.formatAddress(customer.officeAddress) });
        }
        if (customer.billing?.line1 || customer.billing?.street) {
          this.billingAddressOptions.push({ label: 'Billing Address', value: this.formatAddress(customer.billing) });
        }
        if (customer.billing2?.line1 || customer.billing2?.street) {
          this.billingAddressOptions.push({ label: 'Billing Address 2', value: this.formatAddress(customer.billing2) });
        }

        this.shippingAddressOptions = [];
        const shipAddrs: any[] = Array.isArray(customer.shippingAddresses) && customer.shippingAddresses.length
          ? customer.shippingAddresses
          : (customer.shipping ? [customer.shipping] : []);
        shipAddrs.forEach((addr: any, i: number) => {
          if (addr?.line1 || addr?.street) {
            this.shippingAddressOptions.push({ label: i === 0 ? 'Shipping Address' : `Shipping Address ${i + 1}`, value: this.formatAddress(addr) });
          }
        });

        this.shipAddr = this.shippingAddressOptions[0]?.value || '';
        this.selectedCompanyForOffers = selectedCompanyName;

        // Fetch last inquiry for this company → autofill inquiryId
        try {
          const inqRows = await this.apiService.getAll('inquiries');
          const custInquiries = inqRows.filter(
            (inq: any) =>
              this.normalizeText(inq.company_name) === this.normalizeText(selectedCompanyName) ||
              this.normalizeText(inq.customer_name) === this.normalizeText(customer.name)
          );
          if (custInquiries.length > 0) {
            const last = custInquiries[custInquiries.length - 1];
            const refMatch = (last.inquiry_ref || '').match(/INQ-(\d+)/i);
            const seqNum = refMatch ? parseInt(refMatch[1], 10) : null;
            this.inquiryId = seqNum ? `INQ-${String(seqNum).padStart(3, '0')}` : '';
          }
        } catch { this.inquiryId = ''; }

        // Autofill freight + items from previous sales order for this customer
        try {
          const all = [...this.draftOrders, ...this.submittedOrders, ...this.approvedOrders];
          const custOrders = all.filter(
            (o: any) => (o.companyName || o.customerName || '').toLowerCase() === selectedCompanyName.toLowerCase()
          );
          if (custOrders.length > 0) {
            const last: any = custOrders[custOrders.length - 1];
            if (last.freightCharges) this.freightCharges = last.freightCharges;
            if (last.deliveryTerms) this.deliveryTerms = last.deliveryTerms;
            if (last.paymentTerms) this.paymentTerms = this.normalizePaymentTerms(last.paymentTerms);
            if (last.items && last.items.length > 0 && this.itemsShow.length === 0) {
              this.itemsShow = last.items.map((i: any) => ({ ...i, total: 0 }));
              this.itemsShow.forEach(line => this.recalculateLine(line));
            }
          }
        } catch { /* ignore */ }

        await this.loadOffersForCompany(selectedCompanyName);

      } else {
        this.toastService.warning(`Customer "${selectedCompanyName}" not found in database`);
        this.resetCompanyFields();
      }
    } catch (error) {
      console.error('❌ Error in onCompanySelected:', error);
      this.resetCompanyFields();
    }
  }

  async loadOffersForCompany(companyName: string) {
    try {
      this.isLoadingOffers = true;
      this.showOfferModal = false;
      this.availableOffers = [];
      this.cdr.detectChanges();

      const rows = await this.apiService.getAll('offers');
      const offers = rows.map((r: any) => this.mapOffer(r));
      const selected = this.normalizeText(companyName);

      this.availableOffers = offers.filter((o: any) => {
        if (o.status === 'superseded') return false;
        const status = this.normalizeText(o.offerStatus);
        const isOrderReceived = status === 'order_received' || status === 'order received';
        if (!isOrderReceived) return false;

        const customerName = this.normalizeText(o.customerName);
        const snapshotCompany = this.normalizeText(o.customerSnapshot?.companyName);
        const snapshotName = this.normalizeText(o.customerSnapshot?.name);
        const candidates = [customerName, snapshotCompany, snapshotName].filter(Boolean);
        return candidates.some((name) =>
          name === selected || name.includes(selected) || selected.includes(name)
        );
      });

      if (this.availableOffers.length > 0) {
        this.showOfferModal = true;
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('❌ Error loading offers:', error);
    } finally {
      this.isLoadingOffers = false;
    }
  }

  async selectOffer(offer: any) {
    try {
      this.itemsShow = [];
      if (offer.items && Array.isArray(offer.items)) {
        offer.items.forEach((item: any) => {
          this.itemsShow.push({
            item: item.productName || item.item || item.name || '',
            qty: Number(item.qty) || 1,
            uom: item.uom || 'Kg',
            hsn: item.hsn || '',
            rate: Number(item.rate) || 0,
            disc: item.disc || 0,
            discountType: item.discountType || '₹',
            gst: Number(item.gst) || 18,
            total: 0
          });
        });
        this.itemsShow.forEach(line => this.recalculateLine(line));
      }

      if (offer.deliveryTerms) this.deliveryTerms = offer.deliveryTerms;
      if (offer.freightCharges) this.freightCharges = offer.freightCharges;
      this.paymentTerms = this.normalizePaymentTerms(offer.paymentTerms);
      if (offer.gstType) this.gstType = offer.gstType;
      this.inquiryId = this.toDisplayInquiryId(offer.inquiryNo ?? offer.inquiryId ?? this.inquiryId);

      try {
        const allPOs = await this.apiService.getAll('purchaseOrders');
        const po = allPOs.find((p: any) =>
          (p.offer_ref || p.offerRef) === offer.offerRef ||
          (this.inquiryId && (p.inquiry_ref || p.inquiryRef) === this.inquiryId)
        );
        if (po) { this.fillFromPO(po); }
      } catch { /* ignore */ }

      this.closeOfferModal();
    } catch (error) {
      console.error('❌ Error auto-filling:', error);
    }
  }

  closeOfferModal() {
    this.showOfferModal = false;
    this.availableOffers = [];
  }

  skipOfferSelection() {
    this.closeOfferModal();
    if (this.itemsShow.length === 0) this.addLine();
  }

  // ===== HELPER METHODS =====

  formatOfferDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return dateString; }
  }

  getOfferTotal(offer: any): number {
    if (offer.totalAmount) return Number(offer.totalAmount);
    if (!offer.items || !Array.isArray(offer.items)) return 0;
    return offer.items.reduce((total: number, item: any) => total + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0);
  }

  goBackToList() {
    this.showForm = false;
    this.resetForm();
  }

  generatePI() {
    const state: any = {
      fromSalesOrder: true,
      companyName: this.selectedCompanyName,
      billAddr: this.billAddr,
      shipAddr: this.shipAddr,
      gstNo: this.gstNo,
      paymentTerms: this.paymentTerms,
      inquiryId: this.inquiryId,
      gstType: this.gstType,
      items: this.itemsShow.map(line => ({
        description: line.item || '',
        hsn: line.hsn || '',
        qty: line.qty || 0,
        uom: line.uom || '',
        rate: line.rate || 0
      }))
    };
    this.router.navigate(['/proforma-invoice'], { state });
  }

  onPaymentTermsChange(value: string) {
    if (value !== 'Credit') this.creditDays = null;
  }

  // ===== FORM ACTIONS =====

  async createNewSalesOrder() {
    this.showForm = true;
    this.isEditing = false;
    this.editingOrder = null;
    this.resetForm();
    await this.generateSalesOrderNo();
    this.salesOrderDate = new Date().toISOString().slice(0, 10);
  }

  async onSave() {
    try {
      if (!this.salesOrderNo || !this.customerName) {
        this.toastService.warning('Order No and Customer Name are required');
        return;
      }
      if (this.itemsShow.length === 0) {
        this.toastService.warning('Add at least one line item');
        return;
      }

      const salesOrder = this.buildSalesOrderPayload();

      if (this.isEditing && this.editingOrder?.id) {
        await this.apiService.put('salesOrders', this.toDbRow({
          ...salesOrder,
          id: this.editingOrder.id,
          updatedAt: new Date().toISOString()
        }));
        this.toastService.success('Sales Order updated');
      } else {
        await this.apiService.add('salesOrders', this.toDbRow(salesOrder));
        this.toastService.success('Sales Order saved');
      }

      await this.addReminder({
        type: 'order',
        name: salesOrder.customerName || '',
        referenceNo: this.salesOrderNo,
        date: salesOrder.expectedDeliveryDate || null,
        daysFromNow: 7,
        note: `Follow up on sales order ${this.salesOrderNo}`,
      });

      this.showForm = false;
      this.resetForm();
      await this.loadSalesOrders();

    } catch (error) {
      console.error('❌ Failed to save Sales Order:', error);
      this.toastService.error('Failed to save Sales Order');
    }
  }

  onCancel() {
    this.showForm = false;
    this.resetForm();
  }

  resetForm() {
    this.salesOrderNo = '';
    this.salesOrderDate = new Date().toISOString().slice(0, 10);
    this.customerName = '';
    this.customerId = '';
    this.inquiryId = '';
    this.selectedCompanyName = '';
    this.billAddr = '';
    this.shipAddr = '';
    this.gstNo = '';
    this.contactPerson = '';
    this.contactNo = '';
    this.paymentTerms = 'Advance';
    this.creditDays = null;
    this.poNo = '';
    this.poDate = '';
    this.itemsShow = [];
    this.freightCharges = 0;
    this.advanceReceived = 0;
    this.expectedDeliveryDate = '';
    this.deliveryTerms = '';
    this.transporterName = '';
    this.transportMode = '';
    this.gstType = 'cgst_sgst';
    this.salesOrderStatus = 'DRAFT';
    this.isEditing = false;
    this.editingOrder = null;
    this.addLine();
  }

  // ===== WORKFLOW ACTIONS =====

  private async upsertSalesOrder(status: 'DRAFT' | 'SUBMITTED' | 'APPROVED') {
    this.salesOrderStatus = status;
    const existing = this.getSalesOrderByNo(this.salesOrderNo);
    const payload = { ...existing, ...this.buildSalesOrderPayload(), status };
    await this.apiService.put('salesOrders', this.toDbRow(payload));
    await this.loadSalesOrders();
  }

  async saveDraft() {
    try {
      await this.upsertSalesOrder('DRAFT');
      this.toastService.success('Sales Order saved as Draft');
    } catch (err) {
      console.error('❌ Failed to save draft:', err);
      this.toastService.error('Failed to save Draft');
    }
  }

  async submitOrder() {
    try {
      await this.upsertSalesOrder('SUBMITTED');
      this.toastService.success('Sales Order submitted');
    } catch (err) {
      console.error('❌ Failed to submit order:', err);
      this.toastService.error('Failed to submit Sales Order');
    }
  }

  async approveOrder() {
    try {
      await this.upsertSalesOrder('APPROVED');
      this.toastService.success('Sales Order approved');
    } catch (err) {
      console.error('❌ Failed to approve order:', err);
      this.toastService.error('Failed to approve Sales Order');
    }
  }

  // ===== TABLE ACTIONS =====

  editDraft(order: any) {
    this.showForm = true;
    this.isEditing = true;
    this.editingOrder = order;

    this.salesOrderNo = order.orderNo;
    this.salesOrderDate = order.orderDate;
    this.selectedCompanyName = order.companyName || '';
    this.customerName = order.customerName;
    this.customerId = order.customerId || '';
    this.inquiryId = order.inquiryId || '';
    this.billAddr = order.billAddr;
    this.shipAddr = order.shipAddr;
    this.gstNo = order.gstNo || '';
    this.contactPerson = order.contactPerson || '';
    this.contactNo = order.contactNo || '';
    this.paymentTerms = order.paymentTerms || 'Advance';
    this.creditDays = order.creditDays || null;
    this.poNo = order.poNo || '';
    this.poDate = order.poDate || '';
    this.itemsShow = JSON.parse(JSON.stringify(order.items));
    this.freightCharges = order.freightCharges || 0;
    this.advanceReceived = order.advanceReceived || 0;
    this.expectedDeliveryDate = order.expectedDeliveryDate || '';
    this.deliveryTerms = order.deliveryTerms || '';
    this.transporterName = order.transporterName || '';
    this.transportMode = order.transportMode || '';
    this.gstType = order.gstType || 'cgst_sgst';
    this.salesOrderStatus = order.status || 'DRAFT';
  }

  async approveFromTable(order: any) {
    try {
      await this.apiService.put('salesOrders', this.toDbRow({ ...order, status: 'APPROVED' }));
      await this.loadSalesOrders();
      this.toastService.success('Sales Order approved');
    } catch (error) {
      console.error('❌ Failed to approve Sales Order:', error);
      this.toastService.error('Failed to approve Sales Order');
    }
  }

  async deleteDraft(order: any) {
    if (!await this.confirmService.confirm(`Delete Sales Order ${order.orderNo}?`, { danger: true })) return;
    try {
      await this.apiService.delete('salesOrders', order.id);
      await this.loadSalesOrders();
      this.toastService.success('Sales Order deleted');
    } catch (error) {
      console.error('❌ Failed to delete Sales Order:', error);
      this.toastService.error('Failed to delete Sales Order');
    }
  }

  // ===== ITEM MANAGEMENT =====

  createEmptyLine() {
    return { item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 18, total: 0 };
  }

  addLine() { this.itemsShow.push(this.createEmptyLine()); }
  removeLine(index: number) { this.itemsShow.splice(index, 1); }

  recalculateLine(line: any) {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    let base = qty * rate;
    if (line.discountType === '%') {
      base -= base * (Number(line.disc) || 0) / 100;
    } else {
      base -= Number(line.disc) || 0;
    }
    const tax = base * (Number(line.gst) || 0) / 100;
    line.total = base + tax;
  }

  getSubtotal(): number {
    return this.itemsShow.reduce((s, i) => s + (i.qty * i.rate), 0);
  }

  getTaxTotal(): number {
    return this.itemsShow.reduce((s, i) => s + ((i.qty * i.rate) * ((+i.gst || 18) / 100)), 0);
  }

  getGrandTotal(): number {
    return this.getSubtotal() + this.getTaxTotal() + (this.freightCharges || 0);
  }

  private normalizePaymentTerms(val: string): string {
    if (!val) return 'Advance';
    return val.toLowerCase().includes('credit') ? 'Credit' : 'Advance';
  }

  private fillFromPO(po: any) {
    this.poNo = po.poNumber || po.po_ref || '';
    this.poDate = po.poDate || po.po_date || '';
    const edd = po.expectedDeliveryDate || po.expected_delivery_date;
    if (edd && !this.expectedDeliveryDate) this.expectedDeliveryDate = edd;
    const tn = po.transporterName || po.transporter_name;
    if (tn && !this.transporterName) this.transporterName = tn;
    const tm = po.transportMode || po.transport_mode;
    if (tm && !this.transportMode) this.transportMode = tm;
    const dt = po.deliveryTerms || po.delivery_terms;
    if (dt && !this.deliveryTerms) this.deliveryTerms = dt;
  }

  // ===== HELPERS =====

  getCompanyNames(): string[] {
    return this.customers
      .filter(c => c.companyName && c.companyName.trim())
      .map(c => c.companyName.trim())
      .filter((name, index, self) => self.indexOf(name) === index)
      .sort((a, b) => a.localeCompare(b));
  }

  resetCompanyFields(): void {
    this.customerId = '';
    this.customerName = '';
    this.inquiryId = '';
    this.contactPerson = '';
    this.contactNo = '';
    this.gstNo = '';
    this.billAddr = '';
    this.shipAddr = '';
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.addFilesFromFileList(input.files);
    input.value = '';
  }

  private addFilesFromFileList(list: FileList): void {
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i);
      if (!f) continue;
      const exists = this.files.some(existing => existing.name === f.name && existing.size === f.size);
      if (!exists) this.files.push(f);
    }
  }

  removeFile(index: number): void {
    if (index >= 0 && index < this.files.length) this.files.splice(index, 1);
  }

  clearAllFiles(): void { this.files = []; }

  async downloadSalesOrderPDF(order?: any) {
    const so = order ?? {
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      items: this.itemsShow,
      freightCharges: this.freightCharges
    };

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.text('SALES ORDER', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;
    doc.setFontSize(11);
    doc.text('Quantity & Rate Schedule', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;
    doc.setFontSize(12);

    const soDate = so.orderDate
      ? new Date(so.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN');

    doc.text(`ORDER REFERENCE : ${so.orderNo} Dt. ${soDate}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    const tableData = so.items.map((item: any, index: number) => {
      const specifications = item.specifications || (item.hsn ? `HSN: ${item.hsn}` : '-');
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      let base = qty * rate;
      if (item.discountType === '%') { base -= base * (Number(item.disc) || 0) / 100; }
      else { base -= Number(item.disc) || 0; }
      return [(index + 1).toString(), item.item || '-', item.hsn || '-', specifications,
              qty.toString(), item.uom || 'Kg', rate.toFixed(2), base.toFixed(2)];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Sr. No.', 'Material Description', 'HSN CODE', 'Specifications', 'Quantity', 'Uom', 'Rate/Uom', 'Amount (Rs.)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 35 }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25, halign: 'right' } },
      styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5, lineColor: [0, 0, 0] }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;

    const baseTotal = so.items.reduce((sum: number, i: any) => {
      const qty = Number(i.qty) || 0; const rate = Number(i.rate) || 0;
      let base = qty * rate;
      if (i.discountType === '%') base -= base * (Number(i.disc) || 0) / 100;
      else base -= Number(i.disc) || 0;
      return sum + base;
    }, 0);
    const gstTotal = so.items.reduce((sum: number, i: any) => {
      const qty = Number(i.qty) || 0; const rate = Number(i.rate) || 0;
      let base = qty * rate;
      if (i.discountType === '%') base -= base * (Number(i.disc) || 0) / 100;
      else base -= Number(i.disc) || 0;
      return sum + (base * (Number(i.gst) || 0) / 100);
    }, 0);

    const summaryStartX = 120;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Assessable Value :', summaryStartX, yPosition, { align: 'right' });
    doc.text(baseTotal.toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Packing & Forwarding', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text((so.freightCharges || 0).toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    const subTotal = baseTotal + (so.freightCharges || 0);
    doc.setFont('helvetica', 'normal');
    doc.text('Sub Total:', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(subTotal.toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    const taxRate = so.items.length > 0 && so.items[0].gst ? so.items[0].gst : 18;
    doc.setFont('helvetica', 'normal');
    doc.text(`IGST @ ${taxRate}%`, summaryStartX, yPosition, { align: 'right' });
    doc.text('N.A.', summaryStartX + 25, yPosition, { align: 'center' });
    doc.text(gstTotal.toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'bold');
    const grandTotalBeforeRound = subTotal + gstTotal;
    const roundedTotal = Math.round(grandTotalBeforeRound);
    const roundOff = roundedTotal - grandTotalBeforeRound;
    doc.text('Round off', summaryStartX, yPosition, { align: 'right' });
    doc.text(roundOff.toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    doc.text('Grand Total :', summaryStartX, yPosition, { align: 'right' });
    doc.text(roundedTotal.toFixed(2), summaryStartX + 50, yPosition); yPosition += 8;
    doc.text(`In Words - Rs. ${this.convertNumberToWords(roundedTotal)}`, 15, yPosition); yPosition += 10;
    doc.text('# Subject to the Terms stated in enclosed Commercial Terms & Conditions Annexure.', 15, yPosition); yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.setFontSize(11);
    doc.text('Signed', pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 3;
    try {
      const stampBase64 = await this.loadLogoAsBase64('assets/stamp.jpeg');
      doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22);
    } catch { /* stamp optional */ }
    yPosition += 30;
    doc.setFontSize(11);
    doc.text('Authorised Signatory', 15, yPosition);
    doc.text(`For ${so.companyName || 'Customer'}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 5;
    doc.text('Accepted as above', pageWidth - 15, yPosition, { align: 'right' });
    doc.save(`${so.orderNo}.pdf`);
  }

  private buildSalesOrderPayload() {
    return {
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      customerId: this.customerId,
      inquiryId: this.inquiryId,
      billAddr: this.billAddr,
      shipAddr: this.shipAddr,
      gstNo: this.gstNo,
      contactPerson: this.contactPerson,
      contactNo: this.contactNo,
      paymentTerms: this.paymentTerms,
      creditDays: this.creditDays,
      poNo: this.poNo,
      poDate: this.poDate,
      items: this.itemsShow,
      freightCharges: this.freightCharges,
      grandTotal: this.getGrandTotal(),
      status: this.salesOrderStatus,
      createdAt: new Date().toISOString(),
      expectedDeliveryDate: this.expectedDeliveryDate,
      deliveryTerms: this.deliveryTerms,
      transporterName: this.transporterName,
      transportMode: this.transportMode,
      companyName: this.selectedCompanyName,
      gstType: this.gstType,
    };
  }

  formatContactName(contact: any): string {
    if (!contact) return '';
    const title = contact.title ? contact.title.replace(/\.?$/, '.') : '';
    return [title, contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  }

  formatAddress(addr: any): string {
    if (!addr) return '';
    return [addr.line1 || addr.street, addr.line2 || addr.area, addr.city, addr.state, addr.pincode, addr.country]
      .filter(p => p && p.trim()).join(', ');
  }

  getYearRange(): string {
    const y = new Date().getFullYear();
    return `${y}-${(y + 1).toString().slice(-2)}`;
  }

  toThreeDigits(n: number): string { return n.toString().padStart(3, '0'); }

  formatBytes(bytes: number, decimals = 2): string {
    if (!bytes) return '0 B';
    const k = 1024; const dm = Math.max(0, decimals);
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  convertNumberToWords(amount: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const numToWords = (num: number): string => {
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numToWords(num % 100) : '');
      return num.toString();
    };
    return numToWords(amount);
  }

  showMIRModal = false;
  selectedSOForMIR: any = null;
  mirForm: any = {};

  formatDate(d: string) { return d ? new Date(d).toLocaleDateString('en-GB') : ''; }

  openMIRModal(order?: any) {
    const so = order ?? {
      orderNo: this.salesOrderNo, orderDate: this.salesOrderDate,
      customerName: this.customerName, items: this.itemsShow,
      poNo: this.poNo, poDate: this.poDate
    };
    this.selectedSOForMIR = so;
    this.mirForm = {
      items: (so.items || []).map((item: any) => ({
        materialDesc: [item.item || item.productName || '', item.uom ? `(${item.uom})` : ''].filter(Boolean).join(' '),
        qtyInvoice: item.qty || 0, batchNo: '', selected: true,
      })),
      customerName: so.customerName || '', reportNo: `MIR-${so.orderNo || ''}`,
      date: new Date().toISOString().split('T')[0],
      poNoDate: so.poNo ? `${so.poNo} / ${this.formatDate(so.poDate)}` : '',
      dispatchedOn: so.orderDate || '', challanNo: '', materialVerified: 'N/A',
      damageOk: 'N/A', mtcAvailable: 'N/A',
      transporter: so.transporterName || this.transporterName || '',
      lrNo: '', remarks: '', preparedBy: '', checkedBy: '', approvedBy: ''
    };
    this.showMIRModal = true;
  }

  closeMIRModal() { this.showMIRModal = false; }

  async generateMIR() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const safe = (v: any) => (v == null ? '' : String(v));
      const g = this.mirForm;
      let logoLoaded = false;
      try { const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png'); doc.addImage(logoBase64, 'PNG', (pageWidth - 150) / 2, 0, 150, 30); logoLoaded = true; } catch { }
      const startY = logoLoaded ? 50 : 20;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('MATERIALS INSPECTION REPORT (MIR)', pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      let y = startY + 10;
      doc.text(`Customer Name: ${safe(g.customerName)}`, margin, y); doc.text(`Report No: ${safe(g.reportNo)}`, pageWidth / 2, y); y += 7;
      doc.text(`PO No & Date: ${safe(g.poNoDate)}`, margin, y); doc.text(`Date: ${safe(g.date)}`, pageWidth / 2, y); y += 7;
      doc.text(`Challan No: ${safe(g.challanNo)}`, margin, y); doc.text(`Material Dispatched On: ${safe(g.dispatchedOn)}`, pageWidth / 2, y); y += 10;
      const selectedItems = (g.items || []).filter((it: any) => it.selected !== false);
      autoTable(doc, { startY: y, head: [['#', 'Material Description', 'Qty (Order)', 'Batch No']], body: selectedItems.map((it: any, idx: number) => [String(idx + 1), safe(it.materialDesc), String(it.qtyInvoice ?? ''), safe(it.batchNo)]), theme: 'grid', headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28 } }, margin: { left: margin, right: margin } });
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.text(`Material Verified as per order: ${safe(g.materialVerified)}`, margin, y); y += 7;
      doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, margin, y); y += 10;
      doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, margin, y); y += 7;
      doc.text(`Transporter: ${safe(g.transporter)}`, margin, y); y += 7;
      doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, margin, y); y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y); y += 20;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y); doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y); y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);
      doc.save(`MIR_${safe(g.reportNo) || 'Report'}.pdf`);
      this.closeMIRModal();
    } catch (error) { console.error('Error generating MIR:', error); this.toastService.error('Error generating MIR report'); }
  }

  private loadLogoAsBase64(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d')!.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); };
      img.onerror = reject; img.src = path;
    });
  }

  showEmailDropdown = false;
  emailPresets = [environment.emailDefaults.cc, environment.emailDefaults.bcc];

  sendSalesOrderEmail(recipient: string) {
    this.showEmailDropdown = false;
    const subject = `Sales Order ${this.salesOrderNo} – ${this.selectedCompanyName || this.customerName}`;
    const body = `Dear Sir/Ma'am,\n\nPlease find attached Sales Order ${this.salesOrderNo}.\n\nRegards,\nNavbharat Insulation & Engg Co`;
    window.open(`mailto:${recipient}?${new URLSearchParams({ subject, body }).toString()}`);
  }

  onDragOver(ev: DragEvent): void { ev.preventDefault(); this.isDragActive = true; }
  onDragLeave(ev: DragEvent): void { ev.preventDefault(); this.isDragActive = false; }
  onDrop(ev: DragEvent): void { ev.preventDefault(); this.isDragActive = false; const dt = ev.dataTransfer; if (dt && dt.files.length) this.addFilesFromFileList(dt.files); }

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
