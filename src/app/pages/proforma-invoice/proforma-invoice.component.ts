import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-proforma-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proforma-invoice.component.html',
  styleUrls: ['./proforma-invoice.component.css']
})
export class ProformaInvoiceComponent implements OnInit {

  customers: any[] = [];
  inquiries: any[] = [];
  proformas: any[] = [];
  purchaseOrders: any[] = [];
  isPrintMode = false;
  showInquiryPopup = false;
  buyerInquiries: any[] = [];
  selectedBuyerId: string | null = null;
  inventory: any[] = [];
  companies: string[] = [];
  selectedCompany = '';
  filteredInquiries: any[] = [];
  isEditing = false;
  editingId: string | null = null;

  /* Ship-to fields */
  shipToName = '';
  shipToAddress = '';
  shipToGST = '';
  shipToPAN = '';
  billingAddressOptions: { label: string; value: string }[] = [];
  shippingAddressOptions: { label: string; value: string }[] = [];

  bankOptions = [
    { key: 'HDFC', name: 'Navbharat Insulation & Engg. Co.', bank: 'HDFC Bank Ltd', branch: 'Bandra West, Mumbai - 400050', ifsc: 'HDFC0001316', account: '50200028502545' },
    { key: 'UNION', name: 'Navbharat Insulation & Engg. Co.', bank: 'Union Bank of India', branch: 'Khar West Mumbai', ifsc: 'UBIN0531766', account: '366001010024087' }
  ];

  form: any = {
    buyerId: '',
    buyerName: '',
    buyerAddress: '',
    buyerGST: '',
    buyerPAN: '',
    proformaNumber: '',
    inquiryId: '',
    refNo: '',
    items: [],
    paymentTerms: '',
    gstType: 'cgst_sgst',
    date: new Date().toISOString().slice(0, 10),
    selectedBankKey: 'HDFC',
    bankDetails: {}
  };
  loading: boolean | undefined;

  constructor(private apiService: ApiService, private router: Router, private toastService: ToastService) { }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(form: any): any {
    const row: any = {
      proforma_number:  form.proformaNumber   || null,
      date:             form.date             || null,
      buyer_name:       form.buyerName        || null,
      buyer_address:    form.buyerAddress     || null,
      buyer_gst:        form.buyerGST         || null,
      buyer_pan:        form.buyerPAN         || null,
      buyer_id:         form.buyerId          || null,
      ship_to_name:     form.shipToName       || null,
      ship_to_address:  form.shipToAddress    || null,
      ship_to_gst:      form.shipToGST        || null,
      ship_to_pan:      form.shipToPAN        || null,
      inquiry_ref:      form.inquiryId        || null,
      ref_no:           form.refNo            || null,
      items:            form.items            ?? [],
      sub_total:        form.subTotal         ?? null,
      cgst:             form.cgst             ?? null,
      sgst:             form.sgst             ?? null,
      igst:             form.igst             ?? null,
      grand_total:      form.total            ?? null,
      round_off:        form.roundOff         ?? null,
      total_receivable: form.totalReceivable  ?? null,
      advance:          form.advance          ?? null,
      other_charges:    form.otherCharges     ?? 0,
      payment_terms:    form.paymentTerms     || null,
      gst_type:         form.gstType          || 'cgst_sgst',
      bank_key:         form.selectedBankKey  || 'HDFC',
      bank_details:     form.bankDetails      || null,
      prepared_by:      form.preparedBy       || null,
    };
    if (form.id) row.id = form.id;
    return row;
  }

  private fromDbRow(row: any): any {
    return {
      id:              row.id,
      proformaNumber:  row.proforma_number  || '',
      date:            row.date             || '',
      buyerName:       row.buyer_name       || '',
      buyerAddress:    row.buyer_address    || '',
      buyerGST:        row.buyer_gst        || '',
      buyerPAN:        row.buyer_pan        || '',
      buyerId:         row.buyer_id         || '',
      shipToName:      row.ship_to_name     || '',
      shipToAddress:   row.ship_to_address  || '',
      shipToGST:       row.ship_to_gst      || '',
      shipToPAN:       row.ship_to_pan      || '',
      inquiryId:       row.inquiry_ref      || '',
      refNo:           row.ref_no           || '',
      items:           Array.isArray(row.items) ? row.items : [],
      subTotal:        row.sub_total        ?? 0,
      cgst:            row.cgst             ?? 0,
      sgst:            row.sgst             ?? 0,
      igst:            row.igst             ?? 0,
      total:           row.grand_total      ?? 0,
      roundOff:        row.round_off        ?? 0,
      totalReceivable: row.total_receivable ?? 0,
      advance:         row.advance          ?? 0,
      otherCharges:    row.other_charges    ?? 0,
      paymentTerms:    row.payment_terms    || '',
      gstType:         row.gst_type         || 'cgst_sgst',
      selectedBankKey: row.bank_key         || 'HDFC',
      bankDetails:     row.bank_details     || {},
      preparedBy:      row.prepared_by      || '',
    };
  }

  private mapCustomer(row: any): any {
    return {
      id:               row.id,
      companyName:      row.company_name     || '',
      name:             row.name             || '',
      gstin:            row.gstin            || '',
      pan:              row.pan              || '',
      mobile:           row.mobile           || '',
      email:            row.email            || '',
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
      id:           seqId ?? row.id,
      _uuid:        row.id,
      companyName:  row.company_name  || '',
      customerName: row.customer_name || '',
      items:        Array.isArray(row.items) ? row.items : [],
      inquiryRef:   row.inquiry_ref   || '',
    };
  }

  private mapPurchaseOrder(row: any): any {
    return {
      id:          row.id,
      poNumber:    row.po_ref        || '',
      poDate:      row.po_date       || '',
      inquiryRef:  row.inquiry_ref   || '',
      vendorName:  row.vendor_name   || '',
      companyName: row.company_name  || '',
    };
  }

  // ── Lifecycle ────────────────────────────────────────────

  async ngOnInit() {
    const [custRows, inqRows, proformaRows, invRows, poRows] = await Promise.all([
      this.apiService.getAll('customers').catch(() => []),
      this.apiService.getAll('inquiries').catch(() => []),
      this.apiService.getAll('proformas').catch(() => []),
      this.apiService.getAll('inventory').catch(() => []),
      this.apiService.getAll('purchaseOrders').catch(() => []),
    ]);

    this.customers = custRows.map((r: any) => this.mapCustomer(r));
    this.inquiries = inqRows.map((r: any) => this.mapInquiry(r));
    this.proformas = proformaRows.map((r: any) => this.fromDbRow(r));
    this.inventory = invRows;
    this.purchaseOrders = poRows.map((r: any) => this.mapPurchaseOrder(r));

    this.onBankChange();
    this.form.proformaNumber = this.generatePFNo();

    this.companies = [...new Set(this.customers.map((c: any) => c.companyName).filter(Boolean))] as string[];

    // Handle navigation from Sales Order or Offer
    const state = history.state;

    if (state?.fromOffer) {
      const offer = state.fromOffer;
      const companyName = offer.customerSnapshot?.companyName || offer.customerName || '';
      this.selectedCompany = companyName;
      this.applyCompanyToForm(companyName);
      this.form.linkedOfferId = offer.id;
      if (offer.items?.length) {
        this.form.items = offer.items.map((i: any) => ({
          description: i.name || '',
          hsn: i.hsn || '',
          qty: i.qty || 0,
          uom: i.uom || '',
          rate: i.rate || 0
        }));
      }
      if (offer.paymentTerms) this.form.paymentTerms = offer.paymentTerms;
      if (offer.gstType) this.form.gstType = offer.gstType;
      this.calculateTotals();
    }

    if (state?.fromSalesOrder) {
      this.selectedCompany = state.companyName || '';
      this.applyCompanyToForm(state.companyName);
      if (state.items?.length) this.form.items = state.items;
      if (state.paymentTerms) this.form.paymentTerms = state.paymentTerms;
      if (state.inquiryId) this.form.inquiryId = state.inquiryId;
      if (state.gstType) this.form.gstType = state.gstType;
      if (state.inquiryId) await this.fillPoFromInquiryId(state.inquiryId);
      this.calculateTotals();
    }
  }

  private async fillPoFromInquiryId(inquiryDisplayId: string) {
    try {
      const po = this.purchaseOrders.find((p: any) => p.inquiryRef === inquiryDisplayId);
      if (po) {
        this.form.refNo = po.poNumber || '';
        this.form.orderDate = po.poDate || '';
      }
    } catch { /* ignore */ }
  }

  private applyCompanyToForm(companyName: string) {
    const customer = this.customers.find((c: any) =>
      c.companyName?.trim().toLowerCase() === companyName?.trim().toLowerCase()
    );
    if (!customer) return;

    this.form.buyerName = customer.companyName || '';
    this.form.buyerGST = customer.gstin || customer.officeAddress?.gstin || '';
    this.form.buyerPAN = customer.pan || '';
    const billing = customer.billing || customer.officeAddress || {};
    this.form.buyerAddress = [billing.line1 || billing.street, billing.line2 || billing.area, billing.city, billing.state, billing.pincode, billing.country].filter(Boolean).join(', ');

    this.shipToName = customer.companyName || '';
    this.shipToGST = this.form.buyerGST;
    this.shipToPAN = this.form.buyerPAN;
    const firstShipping = (Array.isArray(customer.shippingAddresses) && customer.shippingAddresses.length)
      ? customer.shippingAddresses[0]
      : (customer.shipping || null);
    const shippingForDefault = firstShipping || customer.billing || customer.officeAddress || {};
    this.shipToAddress = [shippingForDefault.line1 || shippingForDefault.street, shippingForDefault.line2 || shippingForDefault.area, shippingForDefault.city, shippingForDefault.state, shippingForDefault.pincode, shippingForDefault.country].filter(Boolean).join(', ');

    const addrFmt = (a: any) => a ? [a.line1 || a.street, a.line2 || a.area, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ') : '';
    this.billingAddressOptions = [];
    if (customer.officeAddress?.line1 || customer.officeAddress?.street) this.billingAddressOptions.push({ label: 'Office Address', value: addrFmt(customer.officeAddress) });
    if (customer.billing?.line1 || customer.billing?.street) this.billingAddressOptions.push({ label: 'Billing Address', value: addrFmt(customer.billing) });
    if (customer.billing2?.line1 || customer.billing2?.street) this.billingAddressOptions.push({ label: 'Billing Address 2', value: addrFmt(customer.billing2) });

    this.shippingAddressOptions = [];
    const shipAddrs: any[] = Array.isArray(customer.shippingAddresses) && customer.shippingAddresses.length ? customer.shippingAddresses : (customer.shipping ? [customer.shipping] : []);
    shipAddrs.forEach((addr: any, i: number) => {
      if (addr?.line1 || addr?.street) this.shippingAddressOptions.push({ label: i === 0 ? 'Shipping Address' : `Shipping Address ${i + 1}`, value: addrFmt(addr) });
    });

    const relatedPO = this.purchaseOrders.find((po: any) =>
      (po.vendorName || '').toLowerCase() === companyName.toLowerCase() ||
      (po.companyName || '').toLowerCase() === companyName.toLowerCase()
    );
    if (relatedPO) this.form.refNo = relatedPO.poNumber || '';
  }

  onBankChange() {
    const bank = this.bankOptions.find(b => b.key === this.form.selectedBankKey);
    if (bank) this.form.bankDetails = { ...bank };
  }

  onCustomerSelect() {
    const buyerId = this.form.buyerId;
    if (!buyerId) return;

    const customer = this.customers.find(c => String(c.id) === String(buyerId));
    if (customer) {
      this.form.buyerName = customer.name || '';
      this.form.buyerGST = customer.gstin || '';
      this.form.buyerPAN = customer.pan || '';
      const b = customer.billing || {};
      this.form.buyerAddress = [b.line1 || b.street, b.line2 || b.area, b.city, b.state, b.country].filter(Boolean).join(', ');
    }

    this.buyerInquiries = this.inquiries.filter((inq: any) =>
      inq.customerName?.trim().toLowerCase() === this.form.buyerName.trim().toLowerCase() &&
      inq.companyName?.trim().toLowerCase() === (customer?.companyName || '').trim().toLowerCase()
    );

    if (this.buyerInquiries.length) this.showInquiryPopup = true;
  }

  async onCompanySelect() {
    if (!this.selectedCompany) return;

    this.applyCompanyToForm(this.selectedCompany);

    // Auto-fill paymentTerms from latest offer for this company
    try {
      const rows = await this.apiService.getAll('offers');
      const companyOffers = rows.filter((o: any) =>
        (o.customer_name || '').trim().toLowerCase() === this.selectedCompany.trim().toLowerCase()
        && o.status !== 'superseded'
      );
      if (companyOffers.length > 0) {
        const latest = companyOffers[companyOffers.length - 1];
        if (!this.form.paymentTerms) this.form.paymentTerms = latest.payment_terms || '';
      }
    } catch { /* ignore */ }

    this.filteredInquiries = this.inquiries.filter((inq: any) =>
      inq.companyName?.trim().toLowerCase() === this.selectedCompany.trim().toLowerCase()
    );

    if (this.filteredInquiries.length) this.showInquiryPopup = true;
  }

  loadFromInquiry(inq: any) {
    if (!inq || !inq.items?.length) return;
    this.form.items = inq.items.map((it: any) => {
      const inv = this.inventory.find(p => (p.displayName || p.name || '').trim() === (it.productName || '').trim());
      return {
        description: it.productName || '',
        hsn: inv?.hsn || '',
        rate: inv?.price || 0,
        qty: it.qty || 0,
        uom: it.uom || ''
      };
    });
    this.calculateTotals();
  }

  async selectInquiry(inq: any) {
    this.loadFromInquiry(inq);
    this.showInquiryPopup = false;
    const displayId = `INQ-${String(inq.id || '').padStart(3, '0')}`;
    await this.fillPoFromInquiryId(displayId);
  }

  getDisplayInquiryId(id?: number): string {
    if (!id) return '-';
    return `INQ-${String(id).padStart(4, '0')}`;
  }

  addItem() {
    this.form.items.push({});
  }

  calculateTotals() {
    let sub = 0;
    this.form.items.forEach((i: any) => {
      sub += (+i.qty || 0) * (+i.rate || 0);
    });
    const taxable = sub + (+this.form.otherCharges || 0);
    this.form.subTotal = sub;

    if (this.form.gstType === 'igst') {
      this.form.cgst = 0; this.form.sgst = 0;
      this.form.igst = +(taxable * 0.18).toFixed(2);
      this.form.total = +(taxable + this.form.igst).toFixed(2);
    } else {
      this.form.cgst = +(taxable * 0.09).toFixed(2);
      this.form.sgst = +(taxable * 0.09).toFixed(2);
      this.form.igst = 0;
      this.form.total = +(taxable + this.form.cgst + this.form.sgst).toFixed(2);
    }

    this.form.roundOff = +(Math.round(this.form.total) - this.form.total).toFixed(2);
    this.form.total = +(this.form.total + this.form.roundOff).toFixed(2);
    this.form.totalReceivable = +(this.form.total - (+this.form.advance || 0)).toFixed(2);
  }

  async save() {
    this.calculateTotals();

    const proformaToSave: any = {
      ...this.form,
      shipToName: this.shipToName,
      shipToAddress: this.shipToAddress,
      shipToGST: this.shipToGST,
      shipToPAN: this.shipToPAN,
      proformaNumber: this.form.proformaNumber || this.generatePFNo(),
      date: this.form.date || new Date().toISOString().slice(0, 10),
      subTotal: this.form.subTotal || 0,
      cgst: this.form.cgst || 0,
      sgst: this.form.sgst || 0,
      igst: this.form.igst || 0,
      total: this.form.total || 0,
      totalReceivable: this.form.totalReceivable || 0,
      otherCharges: this.form.otherCharges || 0,
      advance: this.form.advance || 0,
      roundOff: this.form.roundOff || 0,
      selectedBankKey: this.form.selectedBankKey || 'HDFC',
      bankDetails: this.form.bankDetails || {},
      paymentTerms: this.form.paymentTerms || '',
      preparedBy: this.form.preparedBy || ''
    };

    try {
      if (this.isEditing && this.editingId != null) {
        proformaToSave.id = this.editingId;
        await this.apiService.put('proformas', this.toDbRow(proformaToSave));
      } else {
        await this.apiService.add('proformas', this.toDbRow(proformaToSave));
      }

      this.isEditing = false;
      this.editingId = null;
      const rows = await this.apiService.getAll('proformas');
      this.proformas = rows.map((r: any) => this.fromDbRow(r));
      this.form = {
        buyerId: '', buyerName: '', buyerAddress: '', buyerGST: '', buyerPAN: '',
        proformaNumber: this.generatePFNo(), inquiryId: '', refNo: '', items: [],
        paymentTerms: '', date: new Date().toISOString().slice(0, 10),
        selectedBankKey: 'HDFC', bankDetails: {}, gstType: 'cgst_sgst'
      };
      this.shipToName = ''; this.shipToAddress = ''; this.shipToGST = ''; this.shipToPAN = '';
      this.selectedCompany = '';
      this.onBankChange();
      this.toastService.success('Proforma saved');
    } catch (error) {
      console.error('❌ Failed to save proforma:', error);
      this.toastService.error('Failed to save Proforma Invoice');
    }
  }

  async downloadPDF(p?: any) {
    if (p) {
      this.form = { ...p };
    }

    if (this.form.buyerId) {
      const customer = this.customers.find(c => String(c.id) === String(this.form.buyerId));
      if (customer) {
        this.form.buyerName = customer.name || '';
        this.form.buyerGST = customer.gstin || '';
        this.form.buyerPAN = customer.pan || '';
        const b = customer.billing || {};
        this.form.buyerAddress = [b.line1 || b.street, b.line2 || b.area, b.city, b.state, b.country].filter(Boolean).join(', ');
      }
    }

    if (!this.form.items || !this.form.items.length) this.form.items = [];
    this.onBankChange();
    this.calculateTotals();

    // Set print mode and give Angular one tick to re-render the invoice template
    // before html2canvas captures it, then await the full PDF generation.
    this.isPrintMode = true;
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.generatePDF();
  }

  edit(p: any) {
    this.isEditing = true;
    this.editingId = p.id;
    this.form = JSON.parse(JSON.stringify(p));
    this.selectedCompany = this.form.buyerName;
    this.shipToName = p.shipToName || '';
    this.shipToAddress = p.shipToAddress || '';
    this.shipToGST = p.shipToGST || '';
    this.shipToPAN = p.shipToPAN || '';
    this.calculateTotals();
  }

  async deleteProforma(p: any) {
    try {
      await this.apiService.delete('proformas', p.id);
      this.proformas = this.proformas.filter(x => x.id !== p.id);
      this.toastService.success('Proforma deleted');
    } catch (error) {
      console.error('❌ Failed to delete proforma:', error);
      this.toastService.error('Failed to delete Proforma');
    }
  }

  generatePFNo(): string {
    const year = new Date().getFullYear();
    let maxNum = 0;
    this.proformas.forEach((p: any) => {
      const match = (p.proformaNumber || '').match(/PF\/\d+\/(\d+)/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
    });
    return `PF/${year}/${String(maxNum + 1).padStart(3, '0')}`;
  }

  async convertToInvoice(p: any) {
    if (!confirm(`Convert ${p.proformaNumber} to a Tax Invoice?`)) return;

    try {
      // Compute next sequential invoice number
      const existingRows = await this.apiService.getAll('invoices').catch(() => []);
      const year = new Date().getFullYear();
      const maxSeq = existingRows.reduce((max: number, row: any) => {
        const parts = (row.invoice_no || '').split('/');
        const n = parseInt(parts[2] || '0', 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const invoiceNo = `INV/${year}/${String(maxSeq + 1).padStart(5, '0')}`;

      const today = new Date().toISOString().slice(0, 10);
      const supplyType = p.gstType === 'igst' ? 'IGST' : 'GST';

      const subTotal1 = Number(p.subTotal) || 0;
      const cgst = supplyType === 'GST' ? Number(p.cgst) || 0 : 0;
      const sgst = supplyType === 'GST' ? Number(p.sgst) || 0 : 0;
      const igst = supplyType === 'IGST' ? Number(p.igst) || 0 : 0;
      const otherCharges = Number(p.otherCharges) || 0;
      const roundOff = Number(p.roundOff) || 0;
      const grandTotal = Number(p.total) || 0;
      const subTotal2 = subTotal1 + cgst + sgst + igst + otherCharges;

      const items = (p.items || []).map((it: any, idx: number) => ({
        srNo:        idx + 1,
        particulars: it.name || it.productName || '',
        hsn:         it.hsn  || '',
        uom:         it.uom  || '',
        qty:         Number(it.qty)    || 1,
        rate:        Number(it.rate)   || 0,
        amount:      Number(it.amount) || 0,
      }));

      const emptyParty = { name: '', address: '', gstin: '', pan: '', state: '', supplyStateCode: '', placeOfSupply: '' };

      await this.apiService.add('invoices', {
        invoice_no:        invoiceNo,
        invoice_date:      today,
        due_date:          today,
        order_ref_no:      p.refNo            || '',
        internal_ref_no:   p.proformaNumber   || '',
        eway_bill_no:      '',
        supply_type:       supplyType,
        supply_state_code: '',
        place_of_supply:   '',
        bill_to: {
          ...emptyParty,
          name:    p.buyerName    || '',
          address: p.buyerAddress || '',
          gstin:   p.buyerGST    || '',
          pan:     p.buyerPAN    || '',
        },
        ship_to: {
          ...emptyParty,
          name:    p.shipToName    || p.buyerName    || '',
          address: p.shipToAddress || p.buyerAddress || '',
          gstin:   p.shipToGST    || p.buyerGST    || '',
          pan:     p.shipToPAN    || p.buyerPAN    || '',
        },
        items,
        sub_total_1:     subTotal1,
        packing_charges: 0,
        freight_charges: 0,
        other_charges:   otherCharges,
        cgst,
        sgst,
        igst,
        sub_total_2:    subTotal2,
        round_off:      roundOff,
        grand_total:    grandTotal,
        amount_in_words: '',
        transport:      { mode: '', name: '', vehicleNo: '', lrNo: '', remarks: '' },
        payment_terms:  p.paymentTerms || '',
        remarks:        '',
        status:         'Pending',
      });

      this.toastService.success('Invoice created — redirecting');
      this.router.navigate(['/invoices']);
    } catch (err) {
      console.error('Failed to convert proforma to invoice:', err);
      this.toastService.error('Failed to create invoice — please try again');
    }
  }

  async generatePDF() {
    this.calculateTotals();
    this.loading = true;
    this.isPrintMode = true;

    try {
      (document.activeElement as HTMLElement)?.blur();
      await new Promise(r => setTimeout(r, 200));

      const DATA = document.querySelector('#invoice-area') as HTMLElement;
      if (!DATA) { this.toastService.error('Invoice area not found'); return; }

      const canvas = await html2canvas(DATA, {
        scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
        logging: false, windowWidth: DATA.scrollWidth + 10, windowHeight: DATA.scrollHeight + 10,
        scrollX: 0, scrollY: 0, removeContainer: true, imageTimeout: 0,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('#invoice-area') as HTMLElement;
          if (el) { el.style.border = '2px solid #000'; el.style.boxSizing = 'border-box'; }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidthMM = 210; const pageHeightMM = 297;
      const marginMM = 5;
      const availableWidth = pageWidthMM - (2 * marginMM);
      const availableHeight = pageHeightMM - (2 * marginMM);
      let imgWidthMM = availableWidth;
      let imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
      if (imgHeightMM > availableHeight) { const scale = availableHeight / imgHeightMM; imgWidthMM *= scale; imgHeightMM *= scale; }
      const x = (pageWidthMM - imgWidthMM) / 2;
      const y = marginMM;
      pdf.addImage(imgData, 'PNG', x, y, imgWidthMM, imgHeightMM);
      pdf.save(`${this.form.proformaNumber || 'Proforma'}.pdf`);
    } catch (err) {
      console.error('PDF Error', err);
      this.toastService.error('Failed to generate PDF');
    } finally {
      this.loading = false;
      this.isPrintMode = false;
    }
  }

  /* ── Reminder for PI ─────────────────────────────────── */
  showReminderModal = false;
  reminderPI: any = null;
  reminderEmail = '';

  async createReminderForPI(p: any) {
    const customer = this.customers.find((c: any) =>
      (c.companyName || '').trim().toLowerCase() === (p.buyerName || '').trim().toLowerCase()
    );
    this.reminderEmail = customer?.primaryContact?.email || customer?.email || '';
    this.reminderPI = p;
    this.showReminderModal = true;

    await this.addReminder({
      type: 'general',
      name: p.buyerName || '',
      referenceNo: p.proformaNumber || '',
      daysFromNow: 3,
      note: `Follow up on proforma invoice ${p.proformaNumber}`,
    });
  }

  sendPIEmail() {
    if (!this.reminderPI) return;
    const subject = encodeURIComponent(`Proforma Invoice ${this.reminderPI.proformaNumber} – ${this.reminderPI.buyerName}`);
    const body = encodeURIComponent(`Dear ${this.reminderPI.buyerName},\n\nPlease find attached our Proforma Invoice ${this.reminderPI.proformaNumber} for your kind reference.\n\nTotal Amount: ₹${this.reminderPI.total}\n\nPayment Terms: ${this.reminderPI.paymentTerms || 'As discussed'}\n\nKindly arrange payment at the earliest.\n\nRegards,\nNavbharat Insulation & Engg Co`);
    window.open(`mailto:${this.reminderEmail}?subject=${subject}&body=${body}`);
    this.showReminderModal = false;
  }

  closeReminderModal() {
    this.showReminderModal = false;
    this.reminderPI = null;
    this.reminderEmail = '';
  }

  /* ── Preview PI ─────────────────────────────────────── */
  showPreviewModal = false;
  previewProforma: any = null;

  openPreview(p: any) { this.previewProforma = p; this.showPreviewModal = true; }
  closePreview() { this.showPreviewModal = false; this.previewProforma = null; }

  amountInWords(num: any) {
    if (!num) return 'Zero Rupees Only';
    num = Math.floor(Number(num));
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function inWords(n: number): string {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
    }
    return inWords(num) + ' Rupees Only';
  }

  private async addReminder(opts: {
    type: string; name: string; referenceNo: string; daysFromNow: number; note: string;
  }): Promise<void> {
    try {
      const date = new Date();
      date.setDate(date.getDate() + opts.daysFromNow);
      await this.apiService.add('reminders', {
        date:         date.toISOString().slice(0, 10),
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
