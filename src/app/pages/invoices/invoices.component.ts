import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaxInvoiceComponent } from '../tax-invoice/tax-invoice.component';
import {
  InvoiceModel,
  InvoiceItem,
  PartyDetails,
  TransportDetails,
  TaxRates,
  DEFAULT_TAX_RATES,
  createEmptyPartyDetails,
  createEmptyTransportDetails,
  createEmptyInvoiceItem
} from '../../models/invoice.model';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { ConfirmService } from '../../service/confirm.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';


@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, TaxInvoiceComponent],
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css']
})
export class InvoicesComponent implements OnInit {

  invoices: InvoiceModel[] = [];
  invoice!: InvoiceModel;
  customers: any[] = [];
  selectedCustomer: any = null;
  selectedInvoiceForPrint: InvoiceModel | null = null;
  payments: any[] = [];
  inventoryItems: any[] = [];
  selectedCompany: string | null = null;
  salesOrders: any[] = [];
  allOffers: any[] = [];
  inquiries: any[] = [];
  proformas: any[] = [];
  showInvoiceModal = false;
  isEditing = false;
  editingId: string | null = null;
  selectedInvoiceItems: any[] = [];
  selectedItemIndex: number | null = null;
  billingAddressOptions: { label: string; value: string }[] = [];
  shippingAddressOptions: { label: string; value: string }[] = [];

  taxRates: TaxRates = DEFAULT_TAX_RATES;
  invoiceForm: InvoiceModel = this.createEmptyInvoice();

  constructor(private apiService: ApiService, private toastService: ToastService, private confirmService: ConfirmService) { }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(inv: InvoiceModel): any {
    const row: any = {
      invoice_no:       inv.invoiceNo       || null,
      invoice_date:     inv.invoiceDate     || null,
      due_date:         inv.dueDate         || null,
      order_ref_no:     inv.orderRefNo      || null,
      internal_ref_no:  inv.internalRefNo   || null,
      eway_bill_no:     inv.ewayBillNo      || null,
      supply_type:      inv.supplyType      || 'GST',
      supply_state_code: inv.supplyStateCode || null,
      place_of_supply:  inv.placeOfSupply   || null,
      bill_to:          inv.billTo          || null,
      ship_to:          inv.shipTo          || null,
      items:            inv.items           ?? [],
      sub_total_1:      inv.subTotal1       ?? 0,
      packing_charges:  inv.packingCharges  ?? 0,
      freight_charges:  inv.freightCharges  ?? 0,
      other_charges:    inv.otherCharges    ?? 0,
      cgst:             inv.cgst            ?? 0,
      sgst:             inv.sgst            ?? 0,
      igst:             inv.igst            ?? 0,
      sub_total_2:      inv.subTotal2       ?? 0,
      round_off:        inv.roundOff        ?? 0,
      grand_total:      inv.grandTotal      ?? 0,
      amount_in_words:  inv.amountInWords   || null,
      transport:        inv.transport       || null,
      payment_terms:    inv.paymentTerms    || null,
      remarks:          inv.remarks         || null,
      status:           inv.status          || 'Pending',
    };
    if (inv.id) row.id = inv.id;
    return row;
  }

  private fromDbRow(row: any): InvoiceModel {
    return {
      id:              row.id,
      invoiceNo:       row.invoice_no      || '',
      invoiceDate:     row.invoice_date    || '',
      dueDate:         row.due_date        || '',
      orderRefNo:      row.order_ref_no    || '',
      internalRefNo:   row.internal_ref_no || '',
      ewayBillNo:      row.eway_bill_no    || '',
      supplyType:      (row.supply_type as 'GST' | 'IGST') || 'GST',
      supplyStateCode: row.supply_state_code || '',
      placeOfSupply:   row.place_of_supply   || '',
      billTo:          { ...createEmptyPartyDetails(), ...(row.bill_to || {}) },
      shipTo:          { ...createEmptyPartyDetails(), ...(row.ship_to || {}) },
      items:           Array.isArray(row.items) && row.items.length ? row.items : [createEmptyInvoiceItem(1)],
      subTotal1:       row.sub_total_1     ?? 0,
      packingCharges:  row.packing_charges ?? 0,
      freightCharges:  row.freight_charges ?? 0,
      otherCharges:    row.other_charges   ?? 0,
      cgst:            row.cgst            ?? 0,
      sgst:            row.sgst            ?? 0,
      igst:            row.igst            ?? 0,
      subTotal2:       row.sub_total_2     ?? 0,
      roundOff:        row.round_off       ?? 0,
      grandTotal:      row.grand_total     ?? 0,
      amountInWords:   row.amount_in_words || '',
      transport:       { ...createEmptyTransportDetails(), ...(row.transport || {}) },
      paymentTerms:    row.payment_terms   || '',
      remarks:         row.remarks         || '',
      status:          (row.status as 'Pending' | 'Paid') || 'Pending',
      createdAt:       row.created_at      || '',
    };
  }

  private mapCustomer(row: any): any {
    return {
      id:               row.id,
      companyName:      row.company_name     || '',
      name:             row.name             || '',
      gstin:            row.gstin            || '',
      pan:              row.pan              || '',
      primaryContact:   row.primary_contact  || {},
      officeAddress:    row.office_address   || {},
      billing:          row.billing          || {},
      billing2:         row.billing2         || {},
      shipping:         row.shipping         || {},
      shippingAddresses: row.shipping_addresses || [],
    };
  }

  private mapInquiry(row: any): any {
    const refMatch = (row.inquiry_ref || '').match(/INQ-(\d+)/i);
    const seqId = refMatch ? parseInt(refMatch[1], 10) : null;
    return {
      id:    seqId ?? row.id,
      _uuid: row.id,
      items: Array.isArray(row.items) ? row.items : [],
    };
  }

  private mapSalesOrder(row: any): any {
    return {
      id:                   row.id,
      orderNo:              row.order_ref              || '',
      salesOrderNo:         row.order_ref              || '',
      orderDate:            row.order_date             || '',
      customerName:         row.customer_name          || '',
      companyName:          row.company_name           || row.customer_name || '',
      inquiryId:            row.inquiry_ref            || '',
      billAddr:             row.bill_addr              || '',
      shipAddr:             row.ship_addr              || '',
      gstNo:                row.gst_no                || '',
      poNo:                 row.po_no                 || '',
      poDate:               row.po_date               || '',
      items:                Array.isArray(row.items)  ? row.items : [],
      freightCharges:       row.freight_charges        ?? 0,
      paymentTerms:         row.payment_terms          || '',
      expectedDeliveryDate: row.expected_delivery_date || '',
      deliveryTerms:        row.delivery_terms         || '',
      transporterName:      row.transporter_name       || '',
      transportMode:        row.transport_mode         || '',
      gstType:              row.gst_type              || 'cgst_sgst',
    };
  }

  private mapOffer(row: any): any {
    return {
      id:             row.id,
      offerRef:       row.offer_ref      || '',
      status:         row.status         || 'active',
      inquiryNo:      row.inquiry_no     ?? null,
      items:          Array.isArray(row.items) ? row.items : [],
      paymentTerms:   row.payment_terms  || '',
      freightCharges: row.freight_charges ?? 0,
    };
  }

  private mapProforma(row: any): any {
    return {
      id:           row.id,
      buyerName:    row.buyer_name   || '',
      paymentTerms: row.payment_terms || '',
    };
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

  activeMenuId: any = null;

  toggleActionMenu(event: Event, id: any) {
    event.stopPropagation();
    this.activeMenuId = this.activeMenuId === id ? null : id;
  }

  closeActionMenu() { this.activeMenuId = null; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) { this.activeMenuId = null; }

  async ngOnInit() {
    const [custRows, invRows, inqRows, proformaRows, soRows, offerRows, invItemRows] = await Promise.all([
      this.apiService.getAll('customers').catch(() => []),
      this.apiService.getAll('invoices').catch(() => []),
      this.apiService.getAll('inquiries').catch(() => []),
      this.apiService.getAll('proformas').catch(() => []),
      this.apiService.getAll('salesOrders').catch(() => []),
      this.apiService.getAll('offers').catch(() => []),
      this.apiService.getAll('inventory').catch(() => []),
    ]);

    this.customers     = custRows.map((r: any)     => this.mapCustomer(r));
    this.invoices      = invRows.map((r: any)       => this.fromDbRow(r));
    this.inquiries     = inqRows.map((r: any)       => this.mapInquiry(r));
    this.proformas     = proformaRows.map((r: any)  => this.mapProforma(r));
    this.salesOrders   = soRows.map((r: any)        => this.mapSalesOrder(r));
    this.allOffers     = offerRows.map((r: any)     => this.mapOffer(r));
    this.inventoryItems = invItemRows;
  }

  async loadInventoryItems() {
    try {
      this.inventoryItems = await this.apiService.getAll('inventory');
    } catch {
      this.inventoryItems = [];
    }
  }

  async deductInventory(items: InvoiceItem[]) {
    let deductedCount = 0;
    let notFoundCount = 0;
    const deductionLog: string[] = [];

    for (const item of items) {
      if (!item.particulars || item.qty <= 0) continue;

      const inventoryItem = this.inventoryItems.find(inv => {
        const invName = (inv.displayName || inv.name || '').toLowerCase().trim();
        const itemName = (item.particulars || '').toLowerCase().trim();
        return invName === itemName;
      });

      if (inventoryItem) {
        const currentQty = Number(inventoryItem.quantity) || 0;
        const deductQty = Number(item.qty) || 0;
        const newQty = currentQty - deductQty;

        if (newQty < 0) {
          const proceed = await this.confirmService.confirm(
            `Insufficient stock for "${inventoryItem.displayName || inventoryItem.name}". Available: ${currentQty}, required: ${deductQty}. This will result in negative stock.`,
            { title: 'Insufficient Stock', confirmLabel: 'Continue anyway', danger: true }
          );
          if (!proceed) throw new Error('User cancelled due to insufficient stock');
        }

        try {
          await this.apiService.put('inventory', { id: inventoryItem.id, quantity: newQty });
          deductedCount++;
          deductionLog.push(`✓ ${inventoryItem.displayName || inventoryItem.name}: ${currentQty} → ${newQty} (-${deductQty})`);
        } catch (error) {
          console.error('❌ Failed to update inventory item:', error);
          throw error;
        }
      } else {
        notFoundCount++;
        deductionLog.push(`✗ "${item.particulars}" not found in inventory`);
      }
    }

    if (deductedCount > 0 || notFoundCount > 0) {
      const msg = `Inventory deducted: ${deductedCount} item(s)` + (notFoundCount > 0 ? `, ${notFoundCount} not found` : '');
      notFoundCount > 0 ? this.toastService.warning(msg) : this.toastService.success(msg);
    }
    await this.loadInventoryItems();
  }

  private async updateInventoryQty(itemName: string, delta: number) {
    if (!itemName || delta === 0) return;
    const inv = this.inventoryItems.find((p: any) => {
      const n = (p.displayName || p.name || '').toLowerCase().trim();
      const q = itemName.toLowerCase().trim();
      return n === q || n.includes(q) || q.includes(n);
    });
    if (!inv) return;
    await this.apiService.put('inventory', { id: inv.id, quantity: (Number(inv.quantity) || 0) + delta });
    await this.loadInventoryItems();
  }

  async restoreInventory(items: InvoiceItem[]) {
    let restoredCount = 0;
    for (const item of items) {
      if (!item.particulars || item.qty <= 0) continue;
      const inventoryItem = this.inventoryItems.find(inv => {
        const invName = (inv.displayName || inv.name || '').toLowerCase().trim();
        return invName === (item.particulars || '').toLowerCase().trim();
      });
      if (inventoryItem) {
        const newQty = (Number(inventoryItem.quantity) || 0) + (Number(item.qty) || 0);
        try {
          await this.apiService.put('inventory', { id: inventoryItem.id, quantity: newQty });
          restoredCount++;
        } catch { /* non-critical */ }
      }
    }
    if (restoredCount > 0) await this.loadInventoryItems();
  }

  /* ===============================
     CREATE EMPTY INVOICE
  =============================== */
  createEmptyInvoice(): InvoiceModel {
    return {
      invoiceNo: this.generateInvoiceNo(),
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '', orderRefNo: '', internalRefNo: '', ewayBillNo: '',
      supplyType: 'GST', supplyStateCode: '', placeOfSupply: '',
      billTo: createEmptyPartyDetails(), shipTo: createEmptyPartyDetails(),
      items: [createEmptyInvoiceItem(1)],
      subTotal1: 0, packingCharges: 0, freightCharges: 0, otherCharges: 0,
      cgst: 0, sgst: 0, igst: 0, subTotal2: 0, roundOff: 0, grandTotal: 0, amountInWords: '',
      transport: createEmptyTransportDetails(), paymentTerms: '', remarks: '',
      status: 'Pending', createdAt: new Date().toISOString()
    };
  }

  openAddInvoice() {
    this.invoiceForm = this.createEmptyInvoice();
    this.selectedCustomer = null;
    this.isEditing = false;
    this.showInvoiceModal = true;
  }

  closeModal() { this.showInvoiceModal = false; }

  onCompanyChange() {
    if (!this.selectedCompany) return;
    const customer = this.customers.find((c: any) => c.companyName === this.selectedCompany);
    if (!customer) return;
    this.fillCustomerDetails(customer);
  }

  async onSalesOrderRefSelect(soNo: string) {
    if (!soNo) return;
    const so = this.salesOrders.find((s: any) => (s.orderNo || s.salesOrderNo) === soNo);
    if (!so) return;

    const companyName = so.companyName || so.customerName || '';
    this.selectedCompany = companyName;
    const customer: any = this.customers.find((c: any) =>
      (c.companyName || '').toLowerCase() === companyName.toLowerCase()
    );

    const billingState = customer?.billing?.state || customer?.officeAddress?.state || '';
    const billingStateCode = this.getStateCode(billingState);

    this.invoiceForm.billTo = {
      name: companyName,
      address: so.billAddr || this.buildAddress(customer?.billing || customer?.officeAddress),
      gstin: so.gstNo || customer?.gstin || customer?.officeAddress?.gstin || '',
      pan: customer?.pan || '',
      state: billingState,
      supplyStateCode: billingStateCode,
      placeOfSupply: customer?.billing?.city || customer?.officeAddress?.city || ''
    };

    const shipAddr = so.shipAddr || this.buildAddress(customer?.billing || customer?.officeAddress);
    this.invoiceForm.shipTo = { ...this.invoiceForm.billTo, name: companyName, address: shipAddr };
    if (customer) this.buildAddressOptions(customer);

    const soItems: any[] = so.items || [];
    if (soItems.length) {
      this.invoiceForm.items = soItems.map((it: any, idx: number) => {
        const invItem = this.inventoryItems.find((p: any) => {
          const invName = (p.displayName || p.name || '').toLowerCase().trim();
          const soName = (it.item || it.name || '').toLowerCase().trim();
          return invName === soName || invName.includes(soName) || soName.includes(invName);
        });
        const qty = Number(it.qty) || 0;
        const rate = Number(it.rate) || Number(invItem?.price) || 0;
        return { srNo: idx + 1, particulars: it.item || it.name || '', hsn: it.hsn || invItem?.hsn || '', uom: it.uom || '', qty, rate, amount: qty * rate };
      });
    }

    if (so.freightCharges)  this.invoiceForm.freightCharges = so.freightCharges;
    if (so.transportMode)   this.invoiceForm.transport.mode = so.transportMode;
    if (so.transporterName) this.invoiceForm.transport.name = so.transporterName;
    if (so.paymentTerms)    this.invoiceForm.paymentTerms = so.paymentTerms;
    if (so.expectedDeliveryDate) this.invoiceForm.dueDate = so.expectedDeliveryDate;
    if (so.poNo && !this.invoiceForm.internalRefNo) this.invoiceForm.internalRefNo = so.poNo;

    const soSupplyType = String(so.gstType || '').toLowerCase();
    if (soSupplyType === 'igst') this.invoiceForm.supplyType = 'IGST';
    else if (soSupplyType === 'cgst_sgst') this.invoiceForm.supplyType = 'GST';

    if (!this.invoiceForm.supplyStateCode) this.invoiceForm.supplyStateCode = this.invoiceForm.billTo.supplyStateCode || billingStateCode || '';
    if (!this.invoiceForm.placeOfSupply) this.invoiceForm.placeOfSupply = this.invoiceForm.billTo.placeOfSupply || customer?.billing?.city || customer?.officeAddress?.city || '';

    const inquiryRef: string = so.inquiryId || '';
    const inqMatch = inquiryRef.match(/INQ-(\d+)/i);
    const inqNumId = inqMatch ? parseInt(inqMatch[1], 10) : this.toInquiryId(inquiryRef);

    if (inqNumId) {
      const offer = this.allOffers.find((o: any) =>
        this.toInquiryId(o.inquiryNo) === inqNumId && o.status !== 'superseded'
      );
      if (offer) {
        if (!this.invoiceForm.paymentTerms && offer.paymentTerms) this.invoiceForm.paymentTerms = offer.paymentTerms;
        if (!this.invoiceForm.freightCharges && offer.freightCharges) this.invoiceForm.freightCharges = offer.freightCharges;
        this.invoiceForm.items.forEach((invItem: any, idx: number) => {
          if (!invItem.rate && offer.items?.[idx]?.rate) { invItem.rate = offer.items[idx].rate; invItem.amount = invItem.qty * invItem.rate; }
        });
      }

      const inquiry = this.inquiries.find((i: any) => this.toInquiryId(i.id) === inqNumId);
      if (inquiry && this.invoiceForm.items.length === 0 && inquiry.items?.length) {
        this.invoiceForm.items = inquiry.items.map((it: any, idx: number) => {
          const invIt = this.inventoryItems.find((p: any) => (p.displayName || p.name || '').toLowerCase().trim() === (it.productName || '').toLowerCase().trim());
          const qty = Number(it.qty) || 0;
          const rate = Number(invIt?.price) || 0;
          return { srNo: idx + 1, particulars: it.productName || '', hsn: invIt?.hsn || '', uom: it.uom || '', qty, rate, amount: qty * rate };
        });
      }
    }

    if (!this.invoiceForm.paymentTerms) {
      const pf = this.proformas.find((p: any) => (p.buyerName || '').toLowerCase() === companyName.toLowerCase());
      if (pf?.paymentTerms) this.invoiceForm.paymentTerms = pf.paymentTerms;
    }

    this.recalculateTotals();
  }

  private buildAddressOptions(customer: any) {
    this.billingAddressOptions = [];
    if (customer.officeAddress?.line1 || customer.officeAddress?.street) this.billingAddressOptions.push({ label: 'Office Address', value: this.buildAddress(customer.officeAddress) });
    if (customer.billing?.line1 || customer.billing?.street) this.billingAddressOptions.push({ label: 'Billing Address', value: this.buildAddress(customer.billing) });
    if (customer.billing2?.line1 || customer.billing2?.street) this.billingAddressOptions.push({ label: 'Billing Address 2', value: this.buildAddress(customer.billing2) });
    this.shippingAddressOptions = [];
    const shipAddrs: any[] = Array.isArray(customer.shippingAddresses) && customer.shippingAddresses.length ? customer.shippingAddresses : (customer.shipping ? [customer.shipping] : []);
    shipAddrs.forEach((addr: any, i: number) => {
      if (addr?.line1 || addr?.street) this.shippingAddressOptions.push({ label: i === 0 ? 'Shipping Address' : `Shipping Address ${i + 1}`, value: this.buildAddress(addr) });
    });
  }

  private fillCustomerDetails(customer: any) {
    const billingState = customer.billing?.state || '';
    const billingStateCode = this.getStateCode(billingState);
    this.invoiceForm.billTo = {
      name: customer.companyName, address: this.buildAddress(customer.billing),
      gstin: customer.gstin || '', pan: customer.pan || '', state: billingState,
      supplyStateCode: billingStateCode, placeOfSupply: customer.billing?.city || ''
    };
    this.invoiceForm.shipTo = { ...this.invoiceForm.billTo };
    this.buildAddressOptions(customer);
  }

  private getStateCode(stateName: string): string {
    const stateCodes: { [key: string]: string } = {
      'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10',
      'Chhattisgarh': '22', 'Goa': '30', 'Gujarat': '24', 'Haryana': '06',
      'Himachal Pradesh': '02', 'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32',
      'Madhya Pradesh': '23', 'Maharashtra': '27', 'Manipur': '14', 'Meghalaya': '17',
      'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21', 'Punjab': '03',
      'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36',
      'Tripura': '16', 'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
      'Andaman and Nicobar Islands': '35', 'Chandigarh': '04',
      'Dadra and Nagar Haveli and Daman and Diu': '26', 'Delhi': '07',
      'Jammu and Kashmir': '01', 'Ladakh': '38', 'Lakshadweep': '31', 'Puducherry': '34'
    };
    return stateCodes[stateName] || '';
  }

  private buildAddress(addressObj: any): string {
    if (!addressObj) return '';
    return [addressObj.street, addressObj.area, addressObj.city, addressObj.state, addressObj.pincode, addressObj.country]
      .filter(part => part && part.trim() !== '').join(', ');
  }

  numberToWordsIndian(amount: number): string {
    if (!amount || amount === 0) return 'Zero Only';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const num = Math.floor(amount);
    if (num < 20) return a[num] + ' Only';
    if (num < 100) return b[Math.floor(num / 10)] + ' ' + a[num % 10] + ' Only';
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred ' + (num % 100 !== 0 ? this.numberToWordsIndian(num % 100) : 'Only');
    if (num < 100000) return this.numberToWordsIndian(Math.floor(num / 1000)) + ' Thousand ' + (num % 1000 !== 0 ? this.numberToWordsIndian(num % 1000) : 'Only');
    if (num < 10000000) return this.numberToWordsIndian(Math.floor(num / 100000)) + ' Lakh ' + (num % 100000 !== 0 ? this.numberToWordsIndian(num % 100000) : 'Only');
    return this.numberToWordsIndian(Math.floor(num / 10000000)) + ' Crore ' + (num % 10000000 !== 0 ? this.numberToWordsIndian(num % 10000000) : 'Only');
  }

  addInvoiceItem() {
    const newSrNo = this.invoiceForm.items.length + 1;
    this.invoiceForm.items.push(createEmptyInvoiceItem(newSrNo));
  }

  removeInvoiceItem(i: number) {
    this.invoiceForm.items.splice(i, 1);
    this.invoiceForm.items.forEach((item, index) => { item.srNo = index + 1; });
    this.recalculateTotals();
  }

  recalculateTotals() {
    let subtotal = 0;
    this.invoiceForm.items.forEach(item => { item.amount = item.qty * item.rate; subtotal += item.amount; });
    this.invoiceForm.subTotal1 = subtotal;

    const charges = this.invoiceForm.packingCharges + this.invoiceForm.freightCharges + this.invoiceForm.otherCharges;
    const taxableAmount = subtotal + charges;

    const billStateCode = this.invoiceForm.billTo.supplyStateCode;
    const shipStateCode = this.invoiceForm.shipTo.supplyStateCode;
    const isIntraState = billStateCode && shipStateCode && billStateCode === shipStateCode;

    if (isIntraState) {
      this.invoiceForm.cgst = +(taxableAmount * (this.taxRates.cgst / 100)).toFixed(2);
      this.invoiceForm.sgst = +(taxableAmount * (this.taxRates.sgst / 100)).toFixed(2);
      this.invoiceForm.igst = 0; this.invoiceForm.supplyType = 'GST';
    } else {
      this.invoiceForm.cgst = 0; this.invoiceForm.sgst = 0;
      this.invoiceForm.igst = +(taxableAmount * (this.taxRates.igst / 100)).toFixed(2);
      this.invoiceForm.supplyType = 'IGST';
    }

    const totalTax = this.invoiceForm.cgst + this.invoiceForm.sgst + this.invoiceForm.igst;
    this.invoiceForm.subTotal2 = taxableAmount + totalTax;
    this.invoiceForm.roundOff = +(Math.round(this.invoiceForm.subTotal2) - this.invoiceForm.subTotal2).toFixed(2);
    this.invoiceForm.grandTotal = +(this.invoiceForm.subTotal2 + this.invoiceForm.roundOff).toFixed(2);
    this.invoiceForm.amountInWords = this.numberToWordsIndian(this.invoiceForm.grandTotal);
  }

  /* ===============================
     SAVE INVOICE
  =============================== */
  async saveInvoice() {
    this.recalculateTotals();
    const inv: InvoiceModel = { ...this.invoiceForm };

    try {
      if (this.isEditing && this.editingId !== null) {
        inv.id = this.editingId;
        await this.apiService.put('invoices', this.toDbRow(inv));
      } else {
        await this.apiService.add('invoices', this.toDbRow(inv));
      }

      const wasEditing = this.isEditing;
      this.showInvoiceModal = false;
      this.isEditing = false;
      this.editingId = null;
      await this.loadInvoices();
      this.toastService.success(wasEditing ? 'Invoice updated' : 'Invoice saved');
    } catch (error) {
      console.error('❌ Failed to save invoice:', error);
      this.toastService.error('Failed to save invoice');
    }
  }

  async loadInvoices() {
    try {
      const rows = await this.apiService.getAll('invoices');
      this.invoices = rows.map((r: any) => this.fromDbRow(r));
    } catch {
      this.invoices = [];
    }
  }

  getOutstanding(inv: InvoiceModel): number {
    const paid = this.payments
      .filter((p: any) => p.invoiceNo === inv.invoiceNo && p.status === 'Success')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    return inv.grandTotal - paid;
  }

  generateInvoiceNo(): string {
    const year = new Date().getFullYear();
    const maxSeq = this.invoices.reduce((max, inv) => {
      // Handle formats like "INV/2026/00042" or "INV/2026/4712"
      const parts = (inv.invoiceNo || '').split('/');
      const n = parseInt(parts[2] || '0', 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `INV/${year}/${String(maxSeq + 1).padStart(5, '0')}`;
  }

  editInvoice(inv: InvoiceModel) {
    this.isEditing = true;
    this.editingId = inv.id ?? null;
    const safeInv: InvoiceModel = {
      ...this.createEmptyInvoice(), ...JSON.parse(JSON.stringify(inv)),
      billTo: { ...createEmptyPartyDetails(), ...(inv.billTo || {}) },
      shipTo: { ...createEmptyPartyDetails(), ...(inv.shipTo || {}) },
      transport: { ...createEmptyTransportDetails(), ...(inv.transport || {}) },
      items: inv.items?.length ? inv.items : [createEmptyInvoiceItem(1)]
    };
    this.invoiceForm = safeInv;
    this.selectedCustomer = safeInv.billTo.customerId != null
      ? this.customers.find(c => c.id === safeInv.billTo.customerId) || null
      : null;
    this.showInvoiceModal = true;
  }

  async deleteInvoice(inv: InvoiceModel) {
    const label = inv.invoiceNo || inv.id || 'this invoice';
    if (!await this.confirmService.confirm(`Delete ${label}? Inventory quantities will be restored.`, { danger: true })) return;
    if (!inv.id) { this.toastService.error('Cannot delete invoice — missing ID'); return; }

    if (inv.items && inv.items.length > 0) await this.restoreInventory(inv.items);
    try {
      await this.apiService.delete('invoices', inv.id);
      await this.loadInvoices();
      this.toastService.success('Invoice deleted');
    } catch (error) {
      console.error('❌ Failed to delete invoice:', error);
      this.toastService.error('Failed to delete invoice');
    }
  }

  async onStatusChange(inv: InvoiceModel) {
    if (!inv.id) return;
    try {
      await this.apiService.put('invoices', this.toDbRow(inv));
    } catch (error) {
      console.error('❌ Failed to update status:', error);
    }
  }

  amountInWords(amount: number): string {
    return `Rupees ${amount.toLocaleString('en-IN')} Only`;
  }

  private loadLogoAsBase64(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Could not get canvas context')); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch (error) { reject(error); }
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${imagePath}`));
      img.src = imagePath;
    });
  }

  async openTaxInvoice(inv: InvoiceModel) {
    this.invoiceForm = inv;
    this.recalculateTotals();
    this.selectedInvoiceForPrint = this.invoiceForm;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const el = document.getElementById('tax-invoice-area');
      if (!el) { this.toastService.error('Invoice template not found — please try again'); return; }

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: false, logging: false, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save(`${inv.invoiceNo || 'Invoice'}.pdf`);
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      this.toastService.error('Error generating PDF');
    } finally {
      this.selectedInvoiceForPrint = null;
    }
  }

  /* ===============================
     GRR
  =============================== */
  showGRRModal = false;
  grrForm: any = {};

  openGRRModal(inv: any) {
    const firstItem = inv.items?.[0];
    const inventoryItem = this.inventoryItems.find((p: any) => {
      const invName = (p.displayName || p.name || '').toLowerCase().trim();
      return invName === (firstItem?.particulars || '').toLowerCase().trim();
    });

    this.grrForm = {
      items: (inv.items || []).map((item: any) => ({
        _itemParticulars: item.particulars || '',
        materialDesc: [item.particulars, item.uom ? `(${item.uom})` : ''].filter(Boolean).join(' '),
        qtyInvoice: item.qty || 0, qtyReceived: item.qty || 0, selected: true,
      })),
      vendorName: inventoryItem?.vendorName || '',
      reportNo: `GRR-${inv.invoiceNo || ''}`,
      date: new Date().toISOString().split('T')[0],
      poNoDate: inv.orderRefNo || '', receivedOn: '', challanNo: inv.invoiceNo || '',
      weighingSlip: 'N/A', materialOk: 'N/A', damageOk: 'N/A', mtcAvailable: 'N/A',
      transporter: inv.transport?.name || '', lrNo: inv.transport?.lrNo || '',
      remarks: '', preparedBy: '', checkedBy: '', approvedBy: ''
    };
    this.showGRRModal = true;
  }

  closeGRRModal() { this.showGRRModal = false; }

  async generateGRR() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const safe = (v: any) => (v == null ? '' : String(v));
      const g = this.grrForm;

      let logoLoaded = false;
      try {
        const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png');
        doc.addImage(logoBase64, 'PNG', (pageWidth - 150) / 2, 0, 150, 30);
        logoLoaded = true;
      } catch { }

      const startY = logoLoaded ? 50 : 20;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('GOODS RECEIPT REPORT (GRR)', pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      let y = startY + 10;
      doc.text(`Vendor Name: ${safe(g.vendorName)}`, margin, y); doc.text(`Report No: ${safe(g.reportNo)}`, pageWidth / 2, y); y += 7;
      doc.text(`PO No & Date: ${safe(g.poNoDate)}`, margin, y); doc.text(`Date: ${safe(g.date)}`, pageWidth / 2, y); y += 7;
      doc.text(`Challan No: ${safe(g.challanNo)}`, margin, y); doc.text(`Received On: ${safe(g.receivedOn)}`, pageWidth / 2, y); y += 10;

      const selectedGrrItems = (g.items || []).filter((it: any) => it.selected !== false);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Material Description', 'Qty (Invoice)', 'Qty Received']],
        body: selectedGrrItems.map((it: any, idx: number) => [String(idx + 1), safe(it.materialDesc), String(it.qtyInvoice ?? ''), String(it.qtyReceived ?? '')]),
        theme: 'grid', headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' } },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.text(`Weighing Slip: ${safe(g.weighingSlip)}`, margin, y); doc.text(`Material Acceptable: ${safe(g.materialOk)}`, pageWidth / 2, y); y += 7;
      doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, margin, y); doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, pageWidth / 2, y); y += 7;
      doc.text(`Transporter: ${safe(g.transporter)}`, margin, y); doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, pageWidth / 2, y); y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y); y += 14;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y); doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y); y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);
      doc.save(`GRR_${safe(g.reportNo) || 'Report'}.pdf`);
      for (const item of selectedGrrItems) await this.updateInventoryQty(item._itemParticulars, Number(item.qtyReceived) || 0);
      this.closeGRRModal();
    } catch (error) {
      console.error('❌ Error generating GRR:', error);
      this.toastService.error('Error generating GRR report');
    }
  }

  /* ===============================
     MIR
  =============================== */
  showMIRModal = false;
  mirForm: any = {};

  openMIRModal(inv: any) {
    this.mirForm = {
      items: (inv.items || []).map((item: any) => ({
        _itemParticulars: item.particulars || '',
        materialDesc: [item.particulars, item.uom ? `(${item.uom})` : ''].filter(Boolean).join(' '),
        qtyInvoice: item.qty || 0, batchNo: '', selected: true,
      })),
      customerName: inv.billTo?.name || '', reportNo: `MIR-${inv.invoiceNo || ''}`,
      date: new Date().toISOString().split('T')[0], poNoDate: inv.orderRefNo || '',
      dispatchedOn: inv.invoiceDate || '', challanNo: inv.invoiceNo || '',
      materialVerified: 'N/A', damageOk: 'N/A', mtcAvailable: 'N/A',
      transporter: inv.transport?.name || '', lrNo: inv.transport?.lrNo || '',
      remarks: '', preparedBy: '', checkedBy: '', approvedBy: ''
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
      try {
        const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png');
        doc.addImage(logoBase64, 'PNG', (pageWidth - 150) / 2, 0, 150, 30);
        logoLoaded = true;
      } catch { }

      const startY = logoLoaded ? 50 : 20;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('MATERIALS INSPECTION REPORT (MIR)', pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      let y = startY + 10;
      doc.text(`Customer Name: ${safe(g.customerName)}`, margin, y); doc.text(`Report No: ${safe(g.reportNo)}`, pageWidth / 2, y); y += 7;
      doc.text(`PO No & Date: ${safe(g.poNoDate)}`, margin, y); doc.text(`Date: ${safe(g.date)}`, pageWidth / 2, y); y += 7;
      doc.text(`Challan / Invoice No: ${safe(g.challanNo)}`, margin, y); doc.text(`Dispatched On: ${safe(g.dispatchedOn)}`, pageWidth / 2, y); y += 10;

      const selectedMirItems = (g.items || []).filter((it: any) => it.selected !== false);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Material Description', 'Qty (Invoice)', 'Batch No']],
        body: selectedMirItems.map((it: any, idx: number) => [String(idx + 1), safe(it.materialDesc), String(it.qtyInvoice ?? ''), safe(it.batchNo)]),
        theme: 'grid', headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 }, bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28 } },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.text(`Material Verified as per Order: ${safe(g.materialVerified)}`, margin, y); doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, pageWidth / 2, y); y += 7;
      doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, margin, y); doc.text(`Transporter: ${safe(g.transporter)}`, pageWidth / 2, y); y += 7;
      doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, margin, y); y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y); y += 14;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y); doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y); y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);
      doc.save(`MIR_${safe(g.reportNo) || 'Report'}.pdf`);
      for (const item of selectedMirItems) await this.updateInventoryQty(item._itemParticulars, -(Number(item.qtyInvoice) || 0));
      this.closeMIRModal();
    } catch (error) {
      console.error('❌ Error generating MIR:', error);
      this.toastService.error('Error generating MIR report');
    }
  }
}
