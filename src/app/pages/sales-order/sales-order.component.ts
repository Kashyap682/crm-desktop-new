import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
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
  selectedCompanyName = ''; // For dropdown binding
  customerName = '';
  customerId = '';
  inquiryId = '';   // auto-fetched from last inquiry for this customer
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
    private dbService: DBService,
    private cdr: ChangeDetectorRef
  ) { }

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
      await this.generateSalesOrderNo();
      this.salesOrderDate = new Date().toISOString().slice(0, 10);
      this.customerName = offerState.customerName || '';

      const customer: any = await this.loadCustomerByName(this.customerName);
      if (customer) {
        this.customerId = customer.customerId || customer.id || '';
        this.billAddr = this.formatAddress(customer.billing);
        this.shipAddr = this.formatAddress(customer.shipping);
        this.gstNo = customer.gstin || '';
      }

      this.paymentTerms = this.normalizePaymentTerms(offerState.paymentTerms);
      if (offerState.freightCharges) this.freightCharges = offerState.freightCharges;
      if (offerState.deliveryTerms) this.deliveryTerms = offerState.deliveryTerms;
      if (offerState.gstType) this.gstType = offerState.gstType;

      // Autofill PO fields if a PO already exists for this offer
      try {
        const allPOs = await this.dbService.getAllPurchaseOrders();
        const po = allPOs.find((p: any) => p.offerRef === offerState.offerRef);
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

    // Set company dropdown binding but fill fields directly —
    // do NOT call onCompanySelected (it triggers offer-selection modal + old-order prefill)
    this.selectedCompanyName = this.inquiry.companyName || '';
    const customer: any = this.customers.find((c: any) =>
      (c.companyName || '').toLowerCase().trim() === this.selectedCompanyName.toLowerCase().trim()
    );
    if (customer) {
      this.customerId = customer.customerId || customer.id || '';
      this.customerName = customer.name || customer.companyName || '';
      this.contactPerson = customer.primaryContact
        ? `${customer.primaryContact.firstName || ''} ${customer.primaryContact.lastName || ''}`.trim()
        : customer.contactPerson || '';
      this.contactNo = customer.primaryContact?.mobile || customer.mobile || '';
      this.gstNo = customer.gstin || customer.officeAddress?.gstin || '';
      this.billAddr = this.formatAddress(customer.officeAddress || customer.billing);
      this.shipAddr = this.formatAddress(customer.billing || customer.shipping);
    }

    // Offer terms override
    if (offerState) {
      this.paymentTerms = this.normalizePaymentTerms(offerState.paymentTerms);
      if (offerState.freightCharges) this.freightCharges = offerState.freightCharges;
      if (offerState.deliveryTerms) this.deliveryTerms = offerState.deliveryTerms;
      if (offerState.validity) this.expectedDeliveryDate = offerState.validity;

      if (offerState.gstType) this.gstType = offerState.gstType;

      // Autofill PO fields if a PO already exists for this inquiry/offer
      try {
        const allPOs = await this.dbService.getAllPurchaseOrders();
        const po = allPOs.find((p: any) =>
          p.offerRef === offerState.offerRef ||
          p.inquiryRef === this.inquiryId
        );
        if (po) { this.fillFromPO(po); }
      } catch { /* ignore */ }
      // Clear items added by onCompanySelected and use offer items
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
      this.inquiry.items.forEach((i: any) => {
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
    console.log('🟢 ngAfterViewInit → loading sales orders');
    await this.loadSalesOrders();
  }

  // ===== INITIALIZATION =====

  async initDBAndLoad() {
    try {
      this.allItems = await this.dbService.getAllProducts();
    } catch (error) {
      console.error('❌ Failed to load inventory:', error);
      this.allItems = [];
    }

    try {
      this.customers = await this.dbService.getAllCustomers();
    } catch (error) {
      console.error('❌ Failed to load customers:', error);
      this.customers = [];
    }
  }

  async generateSalesOrderNo() {
    try {
      const allOrders = await this.dbService.getSalesOrders();

      let nextNum = 1;
      if (allOrders.length > 0) {
        const lastOrder = allOrders.reduce((prev, current) => {
          const prevNum = parseInt(prev.orderNo.split('/')[2]) || 0;
          const currNum = parseInt(current.orderNo.split('/')[2]) || 0;
          return currNum > prevNum ? current : prev;
        });
        nextNum = parseInt(lastOrder.orderNo.split('/')[2]) + 1;
      }

      const year = new Date().getFullYear();
      this.salesOrderNo = `SO/${year}/${String(nextNum).padStart(5, '0')}`;
    } catch (error) {
      console.error('❌ Failed to generate order number:', error);
      const year = new Date().getFullYear();
      this.salesOrderNo = `SO/${year}/00001`;
    }
  }

  async loadCustomerByName(name: string) {
    return this.dbService.getCustomerByName(name);
  }

  async loadSalesOrders() {
    console.log('📥 Loading sales orders...');
    try {
      const allOrders = await this.dbService.getSalesOrders();
      this.draftOrders = allOrders.filter(o => o.status === 'DRAFT');
      this.submittedOrders = allOrders.filter(o => o.status === 'SUBMITTED');
      this.approvedOrders = allOrders.filter(o => o.status === 'APPROVED');
    } catch (error) {
      console.error('❌ Failed to load sales orders:', error);
    }
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
        this.customerId = customer.customerId || customer.id || '';
        this.customerName = customer.name || customer.companyName || '';
        this.contactPerson = customer.primaryContact?.firstName
          ? `${customer.primaryContact.firstName} ${customer.primaryContact.lastName || ''}`.trim()
          : (customer.contactPerson || '');
        this.contactNo = customer.primaryContact?.mobile || customer.mobile || '';
        this.gstNo = customer.gstin || customer.officeAddress?.gstin || '';

        // Use officeAddress as billing address (renamed to avoid confusion)
        const addrSrc = customer.officeAddress || customer.billing;
        this.billAddr = this.formatAddress(addrSrc);

        // Build address option lists for multi-address selection
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

        // Default shipAddr to first shipping address (not billing)
        this.shipAddr = this.shippingAddressOptions[0]?.value || '';

        this.selectedCompanyForOffers = selectedCompanyName;

        // Fetch last inquiry for this company → autofill inquiryId
        try {
          const allInquiries: any[] = await this.dbService.getAll('inquiries');
          const custInquiries = allInquiries.filter(
            (inq: any) =>
              this.normalizeText(inq.companyName) === this.normalizeText(selectedCompanyName) ||
              this.normalizeText(inq.customerName) === this.normalizeText(customer.name)
          );
          if (custInquiries.length > 0) {
            const last = custInquiries[custInquiries.length - 1];
            this.inquiryId = this.toDisplayInquiryId(last.id);
          }
        } catch { this.inquiryId = ''; }

        // Autofill freight + items from previous sales order for this customer
        try {
          const allOrders = await this.dbService.getSalesOrders();
          const custOrders = (allOrders as any[]).filter(
            (o: any) => (o.companyName || o.customerName || '').toLowerCase() === selectedCompanyName.toLowerCase()
          );
          if (custOrders.length > 0) {
            const last: any = custOrders[custOrders.length - 1];
            if (last.freightCharges) this.freightCharges = last.freightCharges;
            if (last.deliveryTerms) this.deliveryTerms = last.deliveryTerms;
            if (last.paymentTerms) this.paymentTerms = this.normalizePaymentTerms(last.paymentTerms);
            // Pre-fill items from last order
            if (last.items && last.items.length > 0 && this.itemsShow.length === 0) {
              this.itemsShow = last.items.map((i: any) => ({ ...i, total: 0 }));
              this.itemsShow.forEach(line => this.recalculateLine(line));
            }
          }
        } catch { /* ignore */ }

        await this.loadOffersForCompany(selectedCompanyName);

      } else {
        alert(`Customer "${selectedCompanyName}" not found in database`);
        this.resetCompanyFields();
      }
    } catch (error) {
      console.error('❌ Error in onCompanySelected:', error);
      alert('Error loading company details. Please try again.');
      this.resetCompanyFields();
    }
  }

  /**
   * ✅ FIXED: Allows partial name matching ("Polter" matches "Polter Inc")
   */
  async loadOffersForCompany(companyName: string) {
    try {
      this.isLoadingOffers = true;
      this.showOfferModal = false;
      this.availableOffers = [];
      this.cdr.detectChanges();

      const allOffers = await this.dbService.getAll('offers');
      const selected = this.normalizeText(companyName);

      this.availableOffers = allOffers.filter((o: any) => {
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

  /**
   * ✅ FIXED: Mappings
   */
  async selectOffer(offer: any) {
    console.log('✅ Selected offer:', offer);
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

      // Autofill PO fields if a PO already exists for this offer
      try {
        const allPOs = await this.dbService.getAllPurchaseOrders();
        const po = allPOs.find((p: any) =>
          p.offerRef === offer.offerRef ||
          (this.inquiryId && p.inquiryRef === this.inquiryId)
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
    if (this.itemsShow.length === 0) {
      this.addLine();
    }
  }

  // ===== HELPER METHODS =====

  formatOfferDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  getOfferTotal(offer: any): number {
    if (offer.totalAmount) return Number(offer.totalAmount);
    if (!offer.items || !Array.isArray(offer.items)) return 0;

    return offer.items.reduce((total: number, item: any) => {
      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      return total + (qty * rate);
    }, 0);
  }

  goBackToList() {
    this.showForm = false;
    this.resetForm();
  }

  generatePI() {
    // Navigate to proforma-invoice with current order details in state
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
    if (value !== 'Credit') {
      this.creditDays = null;
    }
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
        alert('❌ Order No and Customer Name are required');
        return;
      }

      if (this.itemsShow.length === 0) {
        alert('❌ Add at least one line item');
        return;
      }

      const salesOrder = this.buildSalesOrderPayload();

      if (this.isEditing && this.editingOrder?.id) {
        await this.dbService.put('salesOrders', {
          ...salesOrder,
          id: this.editingOrder.id,
          updatedAt: new Date().toISOString()
        });
        alert('✅ Sales Order updated successfully!');
      } else {
        await this.dbService.add('salesOrders', salesOrder);
        alert('✅ Sales Order saved successfully!');
      }

      await this.dbService.createAutoReminder({
        type: 'order',
        name: this.customerName,
        mobile: this.contactNo,
        referenceNo: this.salesOrderNo,
        followUpDays: 7,
        note: `Follow-up on Sales Order ${this.salesOrderNo}`
      });

      this.showForm = false;
      this.resetForm();
      await this.loadSalesOrders();

    } catch (error) {
      console.error('❌ Failed to save Sales Order:', error);
      alert('❌ Failed to save Sales Order.');
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
    const existing = await this.dbService.getSalesOrderByNo(this.salesOrderNo);
    const payload = {
      ...existing,
      ...this.buildSalesOrderPayload(),
      status
    };
    await this.dbService.addOrUpdateSalesOrder(payload);
    await this.loadSalesOrders();
  }

  async saveDraft() {
    await this.upsertSalesOrder('DRAFT');
    alert('Sales Order saved as Draft');
  }

  async submitOrder() {
    await this.upsertSalesOrder('SUBMITTED');
    alert('Sales Order submitted successfully');
  }

  async approveOrder() {
    await this.upsertSalesOrder('APPROVED');
    alert('Sales Order approved');
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
    this.customerId = order.customerId;
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
      const approvedOrder = {
        ...order,
        status: 'APPROVED',
        updatedAt: new Date().toISOString()
      };

      await this.dbService.put('salesOrders', approvedOrder);
      console.log('✅ Sales Order approved:', order.orderNo);
      alert('✅ Sales Order approved');
      await this.loadSalesOrders();
    } catch (error) {
      console.error('❌ Failed to approve Sales Order:', error);
      alert('❌ Failed to approve Sales Order');
    }
  }

  async deleteDraft(order: any) {
    if (!confirm(`Delete Sales Order ${order.orderNo}?`)) return;

    try {
      await this.dbService.delete('salesOrders', order.id);
      console.log('🗑️ Sales Order deleted:', order.orderNo);
      alert('✅ Sales Order deleted successfully');
      await this.loadSalesOrders();
    } catch (error) {
      console.error('❌ Failed to delete Sales Order:', error);
      alert('❌ Failed to delete Sales Order');
    }
  }

  // ===== ITEM MANAGEMENT =====

  createEmptyLine() {
    return { item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 18, total: 0 };
  }

  addLine() {
    this.itemsShow.push(this.createEmptyLine());
  }

  removeLine(index: number) {
    this.itemsShow.splice(index, 1);
  }

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
    this.poNo = po.poNumber || '';
    this.poDate = po.poDate || '';
    if (po.expectedDeliveryDate && !this.expectedDeliveryDate) this.expectedDeliveryDate = po.expectedDeliveryDate;
    if (po.transporterName && !this.transporterName) this.transporterName = po.transporterName;
    if (po.transportMode && !this.transportMode) this.transportMode = po.transportMode;
    if (po.deliveryTerms && !this.deliveryTerms) this.deliveryTerms = po.deliveryTerms;
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

  // File handling
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

  // PDF Generation
  // downloadSalesOrderPDF(order?: any) {
  //   const so = order ?? {
  //     orderNo: this.salesOrderNo,
  //     orderDate: this.salesOrderDate,
  //     customerName: this.customerName,
  //     billAddr: this.billAddr,
  //     shipAddr: this.shipAddr,
  //     items: this.itemsShow,
  //     freightCharges: this.freightCharges
  //   };

  //   const doc = new jsPDF('p', 'mm', 'a4');
  //   const pageWidth = doc.internal.pageSize.getWidth();
  //   let yPosition = 20;

  //   doc.setFontSize(16);
  //   doc.text('SALES ORDER', pageWidth / 2, yPosition, { align: 'center' });
  //   yPosition += 10;

  //   doc.setFontSize(12);
  //   doc.text(`Order No: ${so.orderNo}`, 15, yPosition);
  //   doc.text(`Date: ${so.orderDate}`, pageWidth - 60, yPosition);
  //   yPosition += 10;

  //   doc.text(`Customer: ${so.customerName}`, 15, yPosition);
  //   yPosition += 20;

  //   const tableData = so.items.map((item: any, index: number) => [
  //     (index + 1).toString(),
  //     item.item || '-',
  //     item.qty.toString(),
  //     item.uom || 'Kg',
  //     item.rate.toFixed(2),
  //     item.total.toFixed(2)
  //   ]);

  //   autoTable(doc, {
  //     startY: yPosition,
  //     head: [['Sr.', 'Item', 'Qty', 'UOM', 'Rate', 'Amount']],
  //     body: tableData,
  //   });

  //   doc.save(`${so.orderNo}.pdf`);
  // }

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

    // ===== HEADER =====
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
      ? new Date(so.orderDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      : new Date().toLocaleDateString('en-IN');

    doc.text(
      `ORDER REFERENCE : ${so.orderNo} Dt. ${soDate}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );

    yPosition += 10;

    // ===== ITEMS TABLE =====
    const tableData = so.items.map((item: any, index: number) => {
      const specifications =
        item.specifications || (item.hsn ? `HSN: ${item.hsn}` : '-');

      const qty = Number(item.qty) || 0;
      const rate = Number(item.rate) || 0;
      let base = qty * rate;

      if (item.discountType === '%') {
        base -= base * (Number(item.disc) || 0) / 100;
      } else {
        base -= Number(item.disc) || 0;
      }

      return [
        (index + 1).toString(),
        item.item || '-',
        item.hsn || '-',
        specifications,
        qty.toString(),
        item.uom || 'Kg',
        rate.toFixed(2),
        base.toFixed(2)
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [[
        'Sr. No.',
        'Material Description',
        'HSN CODE',
        'Specifications',
        'Quantity',
        'Uom',
        'Rate/Uom',
        'Amount (Rs.)'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 35 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
        7: { cellWidth: 25, halign: 'right' }
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;

    // ===== CORRECT CALCULATIONS =====
    const baseTotal = so.items.reduce((sum: number, i: any) => {
      const qty = Number(i.qty) || 0;
      const rate = Number(i.rate) || 0;
      let base = qty * rate;

      if (i.discountType === '%') {
        base -= base * (Number(i.disc) || 0) / 100;
      } else {
        base -= Number(i.disc) || 0;
      }

      return sum + base;
    }, 0);

    const gstTotal = so.items.reduce((sum: number, i: any) => {
      const qty = Number(i.qty) || 0;
      const rate = Number(i.rate) || 0;
      let base = qty * rate;

      if (i.discountType === '%') {
        base -= base * (Number(i.disc) || 0) / 100;
      } else {
        base -= Number(i.disc) || 0;
      }

      return sum + (base * (Number(i.gst) || 0) / 100);
    }, 0);

    // ===== FINANCIAL SUMMARY =====
    const summaryStartX = 120;
    doc.setFontSize(11);

    doc.setFont('helvetica', 'bold');
    doc.text('Assessable Value :', summaryStartX, yPosition, { align: 'right' });
    doc.text(baseTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.text('Packing & Forwarding', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text((so.freightCharges || 0).toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.text('Sub Total:', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    const subTotal = baseTotal + (so.freightCharges || 0);
    doc.text(subTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    const taxRate = so.items.length > 0 && so.items[0].gst ? so.items[0].gst : 18;
    doc.setFont('helvetica', 'normal');
    doc.text(`IGST @ ${taxRate}%`, summaryStartX, yPosition, { align: 'right' });
    doc.text('N.A.', summaryStartX + 25, yPosition, { align: 'center' });
    doc.text(gstTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Round off', summaryStartX, yPosition, { align: 'right' });
    const grandTotalBeforeRound = subTotal + gstTotal;
    const roundedTotal = Math.round(grandTotalBeforeRound);
    const roundOff = roundedTotal - grandTotalBeforeRound;
    doc.text(roundOff.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    doc.text('Grand Total :', summaryStartX, yPosition, { align: 'right' });
    doc.text(roundedTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(`In Words - Rs. ${this.convertNumberToWords(roundedTotal)}`, 15, yPosition);
    yPosition += 10;

    doc.text(
      '# Subject to the Terms stated in enclosed Commercial Terms & Conditions Annexure.',
      15,
      yPosition
    );
    yPosition += 10;

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

  // Format Helpers
  formatAddress(addr: any): string {
    if (!addr) return '';
    const parts = [
      addr.line1 || addr.street,
      addr.line2 || addr.area,
      addr.city,
      addr.state,
      addr.pincode,
      addr.country
    ].filter(p => p && p.trim());
    return parts.join(', ');
  }

  getYearRange(): string {
    const y = new Date().getFullYear();
    return `${y}-${(y + 1).toString().slice(-2)}`;
  }

  toThreeDigits(n: number): string {
    return n.toString().padStart(3, '0');
  }

  formatBytes(bytes: number, decimals = 2): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    return `${value} ${sizes[i]}`;
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

  /* ===============================
     MIR (Material Inspection Report)
  =============================== */
  showMIRModal = false;
  selectedSOForMIR: any = null;
  mirForm: any = {};

  formatDate(d: string) {
    return d ? new Date(d).toLocaleDateString('en-GB') : '';
  }

  openMIRModal(order?: any) {
    // if (order) this.loadEditForm(order);
    const so = order ?? {
      orderNo: this.salesOrderNo,
      orderDate: this.salesOrderDate,
      customerName: this.customerName,
      items: this.itemsShow,
      poNo: this.poNo,
      poDate: this.poDate
    };
    this.selectedSOForMIR = so;
    this.mirForm = {
      items: (so.items || []).map((item: any) => ({
        materialDesc: [item.item || item.productName || '', item.uom ? `(${item.uom})` : ''].filter(Boolean).join(' '),
        qtyInvoice: item.qty || 0,
        batchNo: '',
        selected: true,
      })),
      customerName: so.customerName || '',
      reportNo: `MIR-${so.orderNo || ''}`,
      date: new Date().toISOString().split('T')[0],
      poNoDate: so.poNo
        ? `${so.poNo} / ${this.formatDate(so.poDate)}`
        : '',
      dispatchedOn: so.orderDate || '',
      challanNo: '',
      materialVerified: 'N/A',
      damageOk: 'N/A',
      mtcAvailable: 'N/A',
      transporter: so.transporterName || this.transporterName || '',
      lrNo: '',
      remarks: '',
      preparedBy: '',
      checkedBy: '',
      approvedBy: ''
    };
    this.showMIRModal = true;
  }

  closeMIRModal() {
    this.showMIRModal = false;
  }

  async generateMIR() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const safe = (v: any) => (v == null ? '' : String(v));
      const g = this.mirForm;

      let logoLoaded = false;
      try {
        const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png');
        doc.addImage(logoBase64, 'PNG', (pageWidth - 150) / 2, 0, 150, 30);
        logoLoaded = true;
      } catch { console.warn('Logo not loaded'); }

      const startY = logoLoaded ? 50 : 20;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MATERIALS INSPECTION REPORT (MIR)', pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      let y = startY + 10;
      doc.text(`Customer Name: ${safe(g.customerName)}`, margin, y);
      doc.text(`Report No: ${safe(g.reportNo)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`PO No & Date: ${safe(g.poNoDate)}`, margin, y);
      doc.text(`Date: ${safe(g.date)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`Challan No: ${safe(g.challanNo)}`, margin, y);
      doc.text(`Material Dispatched On: ${safe(g.dispatchedOn)}`, pageWidth / 2, y);
      y += 10;

      // Items table — only selected items
      const selectedItems = (g.items || []).filter((it: any) => it.selected !== false);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Material Description', 'Qty (Order)', 'Batch No']],
        body: selectedItems.map((it: any, idx: number) => [String(idx + 1), safe(it.materialDesc), String(it.qtyInvoice ?? ''), safe(it.batchNo)]),
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28 } },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      doc.text(`Material Verified as per order: ${safe(g.materialVerified)}`, margin, y);
      y += 7; doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, margin, y);
      y += 10; doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, margin, y);
      y += 7; doc.text(`Transporter: ${safe(g.transporter)}`, margin, y);
      y += 7; doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, margin, y);
      y += 10; doc.text(`Remarks: ${safe(g.remarks)}`, margin, y);
      y += 20;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y);
      doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y);
      y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);
      doc.save(`MIR_${safe(g.reportNo) || 'Report'}.pdf`);
      this.closeMIRModal();
    } catch (error) {
      console.error('Error generating MIR:', error);
      alert('Error generating MIR report');
    }
  }

  private loadLogoAsBase64(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = path;
    });
  }

  // Drag & Drop
  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = true;
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    const dt = ev.dataTransfer;
    if (dt && dt.files.length) {
      this.addFilesFromFileList(dt.files);
    }
  }
}
