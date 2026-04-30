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
import { DBService } from '../../service/db.service';
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
  editingId: number | null = null;
  selectedInvoiceItems: any[] = [];
  selectedItemIndex: number | null = null;
  billingAddressOptions: { label: string; value: string }[] = [];
  shippingAddressOptions: { label: string; value: string }[] = [];



  // Tax configuration (can be made dynamic later)
  taxRates: TaxRates = DEFAULT_TAX_RATES;

  invoiceForm: InvoiceModel = this.createEmptyInvoice();

  constructor(private db: DBService) { }

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

  closeActionMenu() {
    this.activeMenuId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.activeMenuId = null;
  }

  async ngOnInit() {
    this.customers  = await this.db.getAll('customers');
    this.invoices   = await this.db.getAll('invoices');
    this.inquiries  = await this.db.getAll('inquiries');
    this.proformas  = await this.db.getAll('proformas');
    this.salesOrders = await this.db.getAll('salesOrders');
    this.allOffers  = await this.db.getAll('offers');
    await this.loadInventoryItems();
  }


  /* ===============================
     INVENTORY LOADING (using DBService)
  =============================== */
  async loadInventoryItems() {
    try {
      this.inventoryItems = await this.db.getAll('inventory');
      console.log('📦 Loaded inventory items from unified DB:', this.inventoryItems.length);
    } catch (error) {
      console.error('❌ Failed to load inventory:', error);
      this.inventoryItems = [];
    }
  }

  async deductInventory(items: InvoiceItem[]) {
    console.log('📉 Starting inventory deduction for', items.length, 'items');

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
          console.warn(`⚠️ Insufficient stock for "${inventoryItem.displayName || inventoryItem.name}". Available: ${currentQty}, Required: ${deductQty}`);
          const proceed = confirm(
            `Warning: Insufficient stock for "${inventoryItem.displayName || inventoryItem.name}"\n\n` +
            `Available: ${currentQty}\n` +
            `Required: ${deductQty}\n\n` +
            `This will result in negative stock. Continue?`
          );

          if (!proceed) {
            throw new Error('User cancelled due to insufficient stock');
          }
        }

        try {
          await this.db.put('inventory', {
            ...inventoryItem,
            quantity: newQty
          });

          deductedCount++;
          deductionLog.push(`✓ ${inventoryItem.displayName || inventoryItem.name}: ${currentQty} → ${newQty} (-${deductQty})`);
          console.log(`📉 Deducted ${deductQty} from "${inventoryItem.displayName || inventoryItem.name}". New quantity: ${newQty}`);
        } catch (error) {
          console.error('❌ Failed to update inventory item:', error);
          throw error;
        }
      } else {
        notFoundCount++;
        deductionLog.push(`✗ "${item.particulars}" not found in inventory`);
        console.warn(`⚠️ Item "${item.particulars}" not found in inventory`);
      }
    }

    console.log('✅ Inventory deduction complete');
    console.log(`📊 Summary: ${deductedCount} items deducted, ${notFoundCount} items not found`);

    if (deductedCount > 0 || notFoundCount > 0) {
      const message =
        `Inventory Update Summary:\n\n` +
        `✓ Successfully deducted: ${deductedCount} items\n` +
        `✗ Not found in inventory: ${notFoundCount} items\n\n` +
        `Details:\n${deductionLog.join('\n')}`;

      alert(message);
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
    await this.db.put('inventory', { ...inv, quantity: (Number(inv.quantity) || 0) + delta });
    await this.loadInventoryItems();
  }

  /* ===============================
     RESTORE INVENTORY (for deletion)
  =============================== */
  async restoreInventory(items: InvoiceItem[]) {
    console.log('📈 Starting inventory restoration for', items.length, 'items');

    let restoredCount = 0;

    for (const item of items) {
      if (!item.particulars || item.qty <= 0) continue;

      const inventoryItem = this.inventoryItems.find(inv => {
        const invName = (inv.displayName || inv.name || '').toLowerCase().trim();
        const itemName = (item.particulars || '').toLowerCase().trim();
        return invName === itemName;
      });

      if (inventoryItem) {
        const currentQty = Number(inventoryItem.quantity) || 0;
        const restoreQty = Number(item.qty) || 0;
        const newQty = currentQty + restoreQty;

        try {
          await this.db.put('inventory', {
            ...inventoryItem,
            quantity: newQty
          });

          restoredCount++;
          console.log(`📈 Restored ${restoreQty} to "${inventoryItem.displayName || inventoryItem.name}". New quantity: ${newQty}`);
        } catch (error) {
          console.error('❌ Failed to restore inventory item:', error);
        }
      }
    }

    if (restoredCount > 0) {
      console.log(`✅ Restored ${restoredCount} items to inventory`);
      await this.loadInventoryItems();
    }
  }

  /* ===============================
     CREATE EMPTY INVOICE
  =============================== */
  createEmptyInvoice(): InvoiceModel {
    return {
      invoiceNo: this.generateInvoiceNo(),
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      orderRefNo: '',
      internalRefNo: '',
      ewayBillNo: '',
      supplyType: 'GST',
      supplyStateCode: '',
      placeOfSupply: '',

      billTo: createEmptyPartyDetails(),
      shipTo: createEmptyPartyDetails(),

      items: [createEmptyInvoiceItem(1)],

      subTotal1: 0,
      packingCharges: 0,
      freightCharges: 0,
      otherCharges: 0,

      cgst: 0,
      sgst: 0,
      igst: 0,

      subTotal2: 0,
      roundOff: 0,
      grandTotal: 0,
      amountInWords: '',

      transport: createEmptyTransportDetails(),

      paymentTerms: '',
      remarks: '',

      status: 'Pending',
      createdAt: new Date().toISOString()
    };
  }

  openAddInvoice() {
    this.invoiceForm = this.createEmptyInvoice();
    this.selectedCustomer = null;
    this.isEditing = false;
    this.showInvoiceModal = true;
  }

  closeModal() {
    this.showInvoiceModal = false;
  }

  onCompanyChange() {
    // Kept for company dropdown — fills billTo/shipTo from customer master only
    if (!this.selectedCompany) return;
    const customer = this.customers.find((c: any) => c.companyName === this.selectedCompany);
    if (!customer) return;
    this.fillCustomerDetails(customer);
  }

  /** Called when user picks a SO from the Order Ref No dropdown */
  async onSalesOrderRefSelect(soNo: string) {
    if (!soNo) return;
    const so = this.salesOrders.find((s: any) =>
      (s.orderNo || s.salesOrderNo) === soNo
    );
    if (!so) return;

    // ── 1. Customer details ──────────────────────────────────────────
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
    this.invoiceForm.shipTo = {
      ...this.invoiceForm.billTo,
      name: companyName,
      address: shipAddr
    };
    if (customer) this.buildAddressOptions(customer);

    // ── 2. Items from SO ─────────────────────────────────────────────
    const soItems: any[] = so.items || so.itemsShow || [];
    if (soItems.length) {
      this.invoiceForm.items = soItems.map((it: any, idx: number) => {
        const invItem = this.inventoryItems.find((p: any) => {
          const invName = (p.displayName || p.name || '').toLowerCase().trim();
          const soName  = (it.item || it.name || '').toLowerCase().trim();
          return invName === soName || invName.includes(soName) || soName.includes(invName);
        });
        const qty  = Number(it.qty)  || 0;
        const rate = Number(it.rate) || Number(invItem?.price) || 0;
        return {
          srNo: idx + 1,
          particulars: it.item || it.name || '',
          hsn: it.hsn || invItem?.hsn || '',
          uom: it.uom || '',
          qty, rate,
          amount: qty * rate
        };
      });
    }

    // ── 3. Charges & transport from SO ───────────────────────────────
    if (so.freightCharges)  this.invoiceForm.freightCharges = so.freightCharges;
    if (so.transportMode)   this.invoiceForm.transport.mode = so.transportMode;
    if (so.transporterName) this.invoiceForm.transport.name = so.transporterName;
    if (so.vehicleNo)       this.invoiceForm.transport.vehicleNo = so.vehicleNo;
    if (so.lrNo)            this.invoiceForm.transport.lrNo = so.lrNo;
    if (so.paymentTerms)    this.invoiceForm.paymentTerms   = so.paymentTerms;
    if (so.expectedDeliveryDate) this.invoiceForm.dueDate   = so.expectedDeliveryDate;
    if (so.poNo && !this.invoiceForm.internalRefNo) this.invoiceForm.internalRefNo = so.poNo;
    if (so.poDate && !this.invoiceForm.remarks) this.invoiceForm.remarks = `PO Date: ${so.poDate}`;

    const soSupplyType = String(so.gstType || '').toLowerCase();
    if (soSupplyType === 'igst') {
      this.invoiceForm.supplyType = 'IGST';
    } else if (soSupplyType === 'cgst_sgst') {
      this.invoiceForm.supplyType = 'GST';
    }

    if (!this.invoiceForm.supplyStateCode) {
      this.invoiceForm.supplyStateCode =
        this.invoiceForm.billTo.supplyStateCode || billingStateCode || '';
    }
    if (!this.invoiceForm.placeOfSupply) {
      this.invoiceForm.placeOfSupply =
        this.invoiceForm.billTo.placeOfSupply || customer?.billing?.city || customer?.officeAddress?.city || '';
    }

    // ── 4. Fallback: offer linked to this SO's inquiry ────────────────
    const inquiryRef: string = so.inquiryId || '';
    const inqMatch = inquiryRef.match(/INQ-(\d+)/i);
    const inqNumId = inqMatch ? parseInt(inqMatch[1], 10) : this.toInquiryId(inquiryRef);

    if (inqNumId) {
      const offer = this.allOffers.find((o: any) =>
        this.toInquiryId(o.inquiryNo) === inqNumId && o.status !== 'superseded'
      );
      if (offer) {
        if (!this.invoiceForm.paymentTerms && offer.paymentTerms)
          this.invoiceForm.paymentTerms = offer.paymentTerms;
        if (!this.invoiceForm.freightCharges && offer.freightCharges)
          this.invoiceForm.freightCharges = offer.freightCharges;
        // Fill any zero-rate items from offer
        this.invoiceForm.items.forEach((invItem: any, idx: number) => {
          if (!invItem.rate && offer.items?.[idx]?.rate) {
            invItem.rate = offer.items[idx].rate;
            invItem.amount = invItem.qty * invItem.rate;
          }
        });
      }

      // Fallback to inquiry for any still-missing item data
      const inquiry = this.inquiries.find((i: any) => this.toInquiryId(i.id) === inqNumId);
      if (inquiry && this.invoiceForm.items.length === 0 && inquiry.items?.length) {
        this.invoiceForm.items = inquiry.items.map((it: any, idx: number) => {
          const invIt = this.inventoryItems.find((p: any) =>
            (p.displayName || p.name || '').toLowerCase().trim() ===
            (it.productName || '').toLowerCase().trim()
          );
          const qty  = Number(it.qty)  || 0;
          const rate = Number(invIt?.price) || 0;
          return { srNo: idx + 1, particulars: it.productName || '', hsn: invIt?.hsn || '',
                   uom: it.uom || '', qty, rate, amount: qty * rate };
        });
      }
    }

    // ── 5. Payment terms fallback from proforma ───────────────────────
    if (!this.invoiceForm.paymentTerms) {
      const pf = this.proformas.find((p: any) =>
        (p.buyerName || '').toLowerCase() === companyName.toLowerCase()
      );
      if (pf?.paymentTerms) this.invoiceForm.paymentTerms = pf.paymentTerms;
    }

    this.recalculateTotals();
  }

  private buildAddressOptions(customer: any) {
    this.billingAddressOptions = [];
    if (customer.officeAddress?.line1 || customer.officeAddress?.street) {
      this.billingAddressOptions.push({ label: 'Office Address', value: this.buildAddress(customer.officeAddress) });
    }
    if (customer.billing?.line1 || customer.billing?.street) {
      this.billingAddressOptions.push({ label: 'Billing Address', value: this.buildAddress(customer.billing) });
    }
    if (customer.billing2?.line1 || customer.billing2?.street) {
      this.billingAddressOptions.push({ label: 'Billing Address 2', value: this.buildAddress(customer.billing2) });
    }
    this.shippingAddressOptions = [];
    const shipAddrs: any[] = Array.isArray(customer.shippingAddresses) && customer.shippingAddresses.length
      ? customer.shippingAddresses : (customer.shipping ? [customer.shipping] : []);
    shipAddrs.forEach((addr: any, i: number) => {
      if (addr?.line1 || addr?.street) {
        this.shippingAddressOptions.push({ label: i === 0 ? 'Shipping Address' : `Shipping Address ${i + 1}`, value: this.buildAddress(addr) });
      }
    });
  }

  private fillCustomerDetails(customer: any) {
    const billingState     = customer.billing?.state || '';
    const billingStateCode = this.getStateCode(billingState);
    this.invoiceForm.billTo = {
      name: customer.companyName,
      address: this.buildAddress(customer.billing),
      gstin: customer.gstin || '',
      pan: customer.pan || '',
      state: billingState,
      supplyStateCode: billingStateCode,
      placeOfSupply: customer.billing?.city || ''
    };
    this.invoiceForm.shipTo = { ...this.invoiceForm.billTo };
    this.buildAddressOptions(customer);
  }


  /* ===============================
     STATE CODE MAPPING
  =============================== */
  private getStateCode(stateName: string): string {
    const stateCodes: { [key: string]: string } = {
      'Andhra Pradesh': '37',
      'Arunachal Pradesh': '12',
      'Assam': '18',
      'Bihar': '10',
      'Chhattisgarh': '22',
      'Goa': '30',
      'Gujarat': '24',
      'Haryana': '06',
      'Himachal Pradesh': '02',
      'Jharkhand': '20',
      'Karnataka': '29',
      'Kerala': '32',
      'Madhya Pradesh': '23',
      'Maharashtra': '27',
      'Manipur': '14',
      'Meghalaya': '17',
      'Mizoram': '15',
      'Nagaland': '13',
      'Odisha': '21',
      'Punjab': '03',
      'Rajasthan': '08',
      'Sikkim': '11',
      'Tamil Nadu': '33',
      'Telangana': '36',
      'Tripura': '16',
      'Uttar Pradesh': '09',
      'Uttarakhand': '05',
      'West Bengal': '19',
      'Andaman and Nicobar Islands': '35',
      'Chandigarh': '04',
      'Dadra and Nagar Haveli and Daman and Diu': '26',
      'Delhi': '07',
      'Jammu and Kashmir': '01',
      'Ladakh': '38',
      'Lakshadweep': '31',
      'Puducherry': '34'
    };
    return stateCodes[stateName] || '';
  }

  /* ===============================
     BUILD ADDRESS FROM OBJECT
  =============================== */
  private buildAddress(addressObj: any): string {
    if (!addressObj) return '';
    const parts = [
      addressObj.street,
      addressObj.area,
      addressObj.city,
      addressObj.state,
      addressObj.pincode,
      addressObj.country
    ].filter(part => part && part.trim() !== '');
    return parts.join(', ');
  }

  /* ===============================
     NUMBER TO WORDS CONVERSION
  =============================== */
  numberToWordsIndian(amount: number): string {
    if (!amount || amount === 0) return 'Zero Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
      'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
      'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];

    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
      'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const num = Math.floor(amount);

    if (num < 20) return a[num] + ' Only';

    if (num < 100) {
      return b[Math.floor(num / 10)] + ' ' + a[num % 10] + ' Only';
    }

    if (num < 1000) {
      return a[Math.floor(num / 100)] + ' Hundred ' +
        (num % 100 !== 0 ? this.numberToWordsIndian(num % 100) : 'Only');
    }

    if (num < 100000) {
      return this.numberToWordsIndian(Math.floor(num / 1000)) +
        ' Thousand ' +
        (num % 1000 !== 0 ? this.numberToWordsIndian(num % 1000) : 'Only');
    }

    if (num < 10000000) {
      return this.numberToWordsIndian(Math.floor(num / 100000)) +
        ' Lakh ' +
        (num % 100000 !== 0 ? this.numberToWordsIndian(num % 100000) : 'Only');
    }

    return this.numberToWordsIndian(Math.floor(num / 10000000)) +
      ' Crore ' +
      (num % 10000000 !== 0 ? this.numberToWordsIndian(num % 10000000) : 'Only');
  }

  addInvoiceItem() {
    const newSrNo = this.invoiceForm.items.length + 1;
    this.invoiceForm.items.push(createEmptyInvoiceItem(newSrNo));
  }

  removeInvoiceItem(i: number) {
    this.invoiceForm.items.splice(i, 1);
    // Renumber items
    this.invoiceForm.items.forEach((item, index) => {
      item.srNo = index + 1;
    });
    this.recalculateTotals();
  }

  /* ===============================
     TAX CALCULATION (CORRECTED)
  =============================== */
  recalculateTotals() {
    // Calculate items subtotal
    let subtotal = 0;
    this.invoiceForm.items.forEach(item => {
      item.amount = item.qty * item.rate;
      subtotal += item.amount;
    });
    this.invoiceForm.subTotal1 = subtotal;

    // Add charges
    const charges =
      this.invoiceForm.packingCharges +
      this.invoiceForm.freightCharges +
      this.invoiceForm.otherCharges;

    const taxableAmount = subtotal + charges;

    // Determine tax type based on state codes
    const billStateCode = this.invoiceForm.billTo.supplyStateCode;
    const shipStateCode = this.invoiceForm.shipTo.supplyStateCode;

    const isIntraState = billStateCode && shipStateCode &&
      billStateCode === shipStateCode;

    console.log('🔍 Tax Jurisdiction Check:', {
      billStateCode,
      shipStateCode,
      isIntraState,
      supplyType: this.invoiceForm.supplyType
    });

    // Calculate taxes based on jurisdiction
    if (isIntraState) {
      // Intra-state: CGST + SGST
      this.invoiceForm.cgst = +(taxableAmount * (this.taxRates.cgst / 100)).toFixed(2);
      this.invoiceForm.sgst = +(taxableAmount * (this.taxRates.sgst / 100)).toFixed(2);
      this.invoiceForm.igst = 0;
      this.invoiceForm.supplyType = 'GST';
    } else {
      // Inter-state: IGST only
      this.invoiceForm.cgst = 0;
      this.invoiceForm.sgst = 0;
      this.invoiceForm.igst = +(taxableAmount * (this.taxRates.igst / 100)).toFixed(2);
      this.invoiceForm.supplyType = 'IGST';
    }

    const totalTax = this.invoiceForm.cgst + this.invoiceForm.sgst + this.invoiceForm.igst;

    // Calculate final totals
    this.invoiceForm.subTotal2 = taxableAmount + totalTax;

    this.invoiceForm.roundOff =
      +(Math.round(this.invoiceForm.subTotal2) - this.invoiceForm.subTotal2).toFixed(2);

    this.invoiceForm.grandTotal =
      +(this.invoiceForm.subTotal2 + this.invoiceForm.roundOff).toFixed(2);

    this.invoiceForm.amountInWords =
      this.numberToWordsIndian(this.invoiceForm.grandTotal);

    console.log('💰 Tax Calculation Summary:', {
      subtotal: this.invoiceForm.subTotal1,
      charges,
      taxableAmount,
      isIntraState,
      supplyType: this.invoiceForm.supplyType,
      cgst: this.invoiceForm.cgst,
      sgst: this.invoiceForm.sgst,
      igst: this.invoiceForm.igst,
      totalTax,
      subTotal2: this.invoiceForm.subTotal2,
      roundOff: this.invoiceForm.roundOff,
      grandTotal: this.invoiceForm.grandTotal
    });
  }

  /* ===============================
     SAVE INVOICE
  =============================== */
  async saveInvoice() {
    console.log('💾 Saving invoice:', this.invoiceForm);

    // Ensure all calculations are up to date
    this.recalculateTotals();

    const inv: InvoiceModel = { ...this.invoiceForm };


    // Save or update invoice
    if (this.isEditing && this.editingId !== null) {
      inv.id = this.editingId;
      await this.db.updateInvoice(inv);
      console.log('✏️ Invoice updated:', inv);
    } else {
      await this.db.addInvoice(inv);
      console.log('➕ Invoice added:', inv);
    }

    this.showInvoiceModal = false;
    this.isEditing = false;
    this.editingId = null;

    await this.loadInvoices();
    console.log('🔄 Invoice list refreshed');
  }

  /* ===============================
     LOAD INVOICES
  =============================== */
  async loadInvoices() {
    const raw = await this.db.getAllInvoices();
    console.log('📦 Raw invoices from DB:', raw);

    this.invoices = raw.map(inv => ({
      ...this.createEmptyInvoice(),
      ...inv,
      billTo: {
        ...createEmptyPartyDetails(),
        ...(inv.billTo || {})
      },
      shipTo: {
        ...createEmptyPartyDetails(),
        ...(inv.shipTo || {})
      },
      transport: {
        ...createEmptyTransportDetails(),
        ...(inv.transport || {})
      },
      items: inv.items?.length
        ? inv.items
        : [createEmptyInvoiceItem(1)]
    }));

    console.log('📋 Normalized invoices:', this.invoices);

    this.applyFilters?.();
  }

  applyFilters() {
    console.log('🔍 applyFilters() called');
    // Trigger change detection
    this.invoices = [...this.invoices];
    console.log('✅ applyFilters() completed. invoices.length =', this.invoices.length);
  }

  /* ===============================
     OUTSTANDING CALCULATION
  =============================== */
  getOutstanding(inv: InvoiceModel): number {
    const payments = this.payments
      .filter(p => p.invoiceNo === inv.invoiceNo && p.status === 'Success')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return inv.grandTotal - payments;
  }

  /* ===============================
     GENERATE INVOICE NUMBER
  =============================== */
  generateInvoiceNo(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(Math.random() * 9000 + 1000);
    return `INV/${year}/${seq}`;
  }

  /* ===============================
     EDIT INVOICE
  =============================== */
  editInvoice(inv: InvoiceModel) {
    console.log('✏️ Editing invoice:', inv);

    this.isEditing = true;
    this.editingId = inv.id ?? null;

    // Deep clone the invoice
    const safeInv: InvoiceModel = {
      ...this.createEmptyInvoice(),
      ...JSON.parse(JSON.stringify(inv)),

      billTo: {
        ...createEmptyPartyDetails(),
        ...(inv.billTo || {})
      },

      shipTo: {
        ...createEmptyPartyDetails(),
        ...(inv.shipTo || {})
      },

      transport: {
        ...createEmptyTransportDetails(),
        ...(inv.transport || {})
      },

      items: inv.items?.length
        ? inv.items
        : [createEmptyInvoiceItem(1)]
    };

    this.invoiceForm = safeInv;

    // Restore selected customer
    if (safeInv.billTo.customerId != null) {
      this.selectedCustomer =
        this.customers.find(c => c.id === safeInv.billTo.customerId) || null;
    } else {
      this.selectedCustomer = null;
    }

    console.log('👤 Selected customer after normalize:', this.selectedCustomer);

    this.showInvoiceModal = true;
  }

  /* ===============================
     DELETE INVOICE
  =============================== */
  async deleteInvoice(inv: InvoiceModel) {
    const label = inv.invoiceNo || inv.id || 'this invoice';

    const ok = confirm(`Delete ${label}?\n\nNote: Inventory quantities will be restored.`);
    if (!ok) return;

    if (!inv.id) {
      console.error('❌ Cannot delete invoice: ID missing', inv);
      alert('This invoice cannot be deleted (missing ID).');
      return;
    }

    console.log('🗑️ Deleting invoice:', inv);

    // Restore inventory
    if (inv.items && inv.items.length > 0) {
      await this.restoreInventory(inv.items);
    }

    await this.db.deleteInvoice(inv.id);

    console.log('✅ Invoice deleted and inventory restored');

    await this.loadInvoices();
  }

  /* ===============================
     STATUS CHANGE
  =============================== */
  async onStatusChange(inv: InvoiceModel) {
    console.log('🔄 Status change:', inv.id, inv.status);

    if (!inv.id) {
      console.error('❌ Cannot update status, ID missing', inv);
      return;
    }

    await this.db.updateInvoice(inv);

    console.log('✅ Status updated in DB');
  }

  /* ===============================
     UTILITY METHODS
  =============================== */
  amountInWords(amount: number): string {
    return `Rupees ${amount.toLocaleString('en-IN')} Only`;
  }

  private setFontSafe(doc: jsPDF, style: 'normal' | 'bold' = 'normal') {
    doc.setFont('helvetica', style);
  }

  private numberToWords(amount: number): string {
    const formatter = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0
    });
    return `Rupees ${formatter.format(amount)} Only`;
  }

  private findMatchingOrder(companyName: string, items: any[]) {
    const normalize = (v: any) =>
      (v || '').toString().toLowerCase().trim();

    const invoiceItemNames = items.map(i =>
      normalize(i.particulars || i.productName)
    );

    console.log('🔎 Trying transport auto-fill match for:', {
      companyName,
      invoiceItemNames
    });

  }
  /* ===============================
     LOAD LOGO AS BASE64 (HELPER)
  =============================== */
  private loadLogoAsBase64(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous'; // Enable CORS

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.95);
          resolve(base64);
        } catch (error) {
          console.error('❌ Error converting image to base64:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('❌ Error loading image:', error);
        reject(new Error(`Failed to load image: ${imagePath}`));
      };

      // Try multiple possible paths
      img.src = imagePath;
    });
  }

  /* ===============================
     TAX INVOICE PDF GENERATION (FIXED)
  =============================== */
  async openTaxInvoice(inv: InvoiceModel) {
    console.log('📄 Generating tax invoice PDF:', inv);

    this.invoiceForm = inv;
    this.recalculateTotals();
    this.selectedInvoiceForPrint = this.invoiceForm;

    try {
      // Wait a bit for Angular to render the component
      await new Promise(resolve => setTimeout(resolve, 500));

      const el = document.getElementById('tax-invoice-area');
      if (!el) {
        console.error('❌ Tax invoice print element not found');
        alert('Error: Invoice template not found. Please try again.');
        return;
      }

      console.log('📸 Capturing invoice as image...');

      // Capture the HTML element as canvas with high quality
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff'
      });

      console.log('✅ Canvas captured, creating PDF...');

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add the captured image to PDF
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );

      // Save the PDF
      const fileName = `${inv.invoiceNo || 'Invoice'}.pdf`;
      pdf.save(fileName);

      console.log('✅ PDF saved:', fileName);

    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Error generating PDF. Please check the console for details.');
    } finally {
      // Clean up
      this.selectedInvoiceForPrint = null;
    }
  }



  /* ===============================
     GRR (Goods Receipt Report)
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
        qtyInvoice: item.qty || 0,
        qtyReceived: item.qty || 0,
        selected: true,
      })),
      vendorName: inventoryItem?.vendorName || '',
      reportNo: `GRR-${inv.invoiceNo || ''}`,
      date: new Date().toISOString().split('T')[0],
      poNoDate: inv.orderRefNo || '',
      receivedOn: '',
      challanNo: inv.invoiceNo || '',
      weighingSlip: 'N/A',
      materialOk: 'N/A',
      damageOk: 'N/A',
      mtcAvailable: 'N/A',
      transporter: inv.transport?.name || '',
      lrNo: inv.transport?.lrNo || '',
      remarks: '',
      preparedBy: '',
      checkedBy: '',
      approvedBy: ''
    };

    this.showGRRModal = true;
  }


  closeGRRModal() {
    this.showGRRModal = false;
  }

  async generateGRR() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      const safe = (v: any) => (v == null ? '' : String(v));
      const g = this.grrForm;

      // Try to load logo
      let logoLoaded = false;
      try {
        const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png');
        const logoW = 150;
        const logoH = 30;
        const logoX = (pageWidth - logoW) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, 0, logoW, logoH);
        logoLoaded = true;
      } catch (error) {
        console.warn('⚠️ Could not load logo for GRR, continuing without it');
      }

      const startY = logoLoaded ? 50 : 20;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('GOODS RECEIPT REPORT (GRR)', pageWidth / 2, startY, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      let y = startY + 10;
      doc.text(`Vendor Name: ${safe(g.vendorName)}`, margin, y);
      doc.text(`Report No: ${safe(g.reportNo)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`PO No & Date: ${safe(g.poNoDate)}`, margin, y);
      doc.text(`Date: ${safe(g.date)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`Challan No: ${safe(g.challanNo)}`, margin, y);
      doc.text(`Received On: ${safe(g.receivedOn)}`, pageWidth / 2, y);
      y += 10;

      // Items table — only selected items
      const selectedGrrItems = (g.items || []).filter((it: any) => it.selected !== false);
      const itemRows = selectedGrrItems.map((it: any, idx: number) => [
        String(idx + 1),
        safe(it.materialDesc),
        String(it.qtyInvoice ?? ''),
        String(it.qtyReceived ?? ''),
      ]);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Material Description', 'Qty (Invoice)', 'Qty Received']],
        body: itemRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' } },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      doc.text(`Weighing Slip: ${safe(g.weighingSlip)}`, margin, y);
      doc.text(`Material Acceptable: ${safe(g.materialOk)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, margin, y);
      doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`Transporter: ${safe(g.transporter)}`, margin, y);
      doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, pageWidth / 2, y);
      y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y);
      y += 14;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y);
      doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y);
      y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);

      doc.save(`GRR_${safe(g.reportNo) || 'Report'}.pdf`);
      for (const item of selectedGrrItems) {
        await this.updateInventoryQty(item._itemParticulars, Number(item.qtyReceived) || 0);
      }
      this.closeGRRModal();
    } catch (error) {
      console.error('❌ Error generating GRR:', error);
      alert('Error generating GRR report');
    }
  }

  /* ===============================
     MIR (Material Inspection Report)
  =============================== */
  showMIRModal = false;
  selectedMIRItem: any = null;
  mirForm: any = {
    challanNo: '',
    customerName: '',
    quantity: '',
    materialDesc: '',
    poNo: '',
    dateOfMIR: '',
    dispatchDate: '',
    batchLotNo: '',
    specification: '',
    mtcReviewed: '',
    remarks: ''
  };

  openMIRModal(inv: any) {
    this.mirForm = {
      items: (inv.items || []).map((item: any) => ({
        _itemParticulars: item.particulars || '',
        materialDesc: [item.particulars, item.uom ? `(${item.uom})` : ''].filter(Boolean).join(' '),
        qtyInvoice: item.qty || 0,
        batchNo: '',
        selected: true,
      })),
      customerName: inv.billTo?.name || '',
      reportNo: `MIR-${inv.invoiceNo || ''}`,
      date: new Date().toISOString().split('T')[0],
      poNoDate: inv.orderRefNo || '',
      dispatchedOn: inv.invoiceDate || '',
      challanNo: inv.invoiceNo || '',
      materialVerified: 'N/A',
      damageOk: 'N/A',
      mtcAvailable: 'N/A',
      transporter: inv.transport?.name || '',
      lrNo: inv.transport?.lrNo || '',
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

      // Try to load logo
      let logoLoaded = false;
      try {
        const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png');
        const logoW = 150;
        const logoH = 30;
        const logoX = (pageWidth - logoW) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, 0, logoW, logoH);
        logoLoaded = true;
      } catch (error) {
        console.warn('⚠️ Could not load logo for MIR, continuing without it');
      }

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
      doc.text(`Challan / Invoice No: ${safe(g.challanNo)}`, margin, y);
      doc.text(`Dispatched On: ${safe(g.dispatchedOn)}`, pageWidth / 2, y);
      y += 10;

      // Items table — only selected items
      const selectedMirItems = (g.items || []).filter((it: any) => it.selected !== false);
      const mirItemRows = selectedMirItems.map((it: any, idx: number) => [
        String(idx + 1),
        safe(it.materialDesc),
        String(it.qtyInvoice ?? ''),
        safe(it.batchNo),
      ]);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Material Description', 'Qty (Invoice)', 'Batch No']],
        body: mirItemRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28 } },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      doc.text(`Material Verified as per Order: ${safe(g.materialVerified)}`, margin, y);
      doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, margin, y);
      doc.text(`Transporter: ${safe(g.transporter)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, margin, y);
      y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y);
      y += 14;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y);
      doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y);
      y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);

      doc.save(`MIR_${safe(g.reportNo) || 'Report'}.pdf`);
      for (const item of selectedMirItems) {
        await this.updateInventoryQty(item._itemParticulars, -(Number(item.qtyInvoice) || 0));
      }
      this.closeMIRModal();
    } catch (error) {
      console.error('❌ Error generating MIR:', error);
      alert('Error generating MIR report');
    }
  }
}
