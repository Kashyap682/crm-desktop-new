import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBService } from '../../service/db.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-create-offer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-offer.component.html',
  styleUrls: ['./create-offer.component.css']
})
export class CreateOfferComponent implements OnInit {

  customers: any[] = [];
  inquiries: any[] = [];
  selectedCustomer: any = null;
  selectedInquiry: any = null;
  inquiryItemRates: number[] = []; // Frozen snapshot of original rates — never mutated after set

  inquiryDecision: string = '';
  selectedInquiryItemIndices: number[] = []; // which inquiry items are checked

  showInquiryPopup = false;
  isEditMode = false;
  editingOfferId: number | null = null;
  originalOffer: any = null;

  businessVerticals = [
    'Projects',
    'Material Distribution Division',
    'Both'
  ];

  previewOfferId: string = '';

  offer: any = {
    customerId: null,
    customerName: '',
    customerSnapshot: null,
    inquiryNo: null,
    businessVertical: '',
    paymentTerms: '',
    validity: '',
    terms: '',
    items: [],
    freightCharges: 0,
    subtotal: 0,
    gst: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    gstType: 'cgst_sgst', // 'cgst_sgst' | 'igst'
    grandTotal: 0
  };

  constructor(private db: DBService, private router: Router) { }

  async ngOnInit() {
    console.log('🟢 CreateOfferComponent initialized');

    this.customers = await this.db.getAll('customers');
    console.log('🟢 Customers loaded:', this.customers);

    // Generate preview offer ID for new offers
    this.previewOfferId = await this.generatePreviewOfferId();

    const state = history.state;

    // Navigate from Offers page: inquiry clicked → create offer prefilled
    if (state && state.inquiry && !state.offer) {
      const inq = state.inquiry;
      await this.prefillFromInquiry(inq);
      return;
    }

    if (state && state.offer) {
      console.log('✏️ Edit mode detected:', state.offer);

      this.isEditMode = true;
      this.editingOfferId = state.offer.id;

      // ✅ Deep clone originalOffer so later mutations to offer.items never bleed into it
      this.originalOffer = {
        ...state.offer,
        items: (state.offer.items || []).map((item: any) => ({ ...item })),
        originalItemRates: state.offer.originalItemRates
          ? [...state.offer.originalItemRates]
          : null
      };

      // ✅ Deep clone offer.items so [(ngModel)] edits are isolated to this working copy
      this.offer = {
        ...state.offer,
        gstType: state.offer.gstType || 'cgst_sgst',
        freightCharges: state.offer.freightCharges ?? 0,
        items: (state.offer.items || []).map((item: any) => ({ ...item })),
        originalItemRates: state.offer.originalItemRates
          ? [...state.offer.originalItemRates]
          : null
      };

      // ✅ Pre-select the customer in the dropdown
      this.selectedCustomer = this.customers.find(
        (c: any) =>
          (c.id && c.id === this.offer.customerId) ||
          (c.name?.trim().toLowerCase() === this.offer.customerName?.trim().toLowerCase())
      ) || null;

      console.log('🟢 Pre-selected customer:', this.selectedCustomer);

      // ✅ Restore inquiry details
      if (this.offer.inquiryNo != null) {
        try {
          let inquiry: any = null;

          try {
            inquiry = await this.db.getById('inquiries', this.offer.inquiryNo);
          } catch (e) {
            inquiry = null;
          }

          if (!inquiry) {
            const allInquiries = await this.db.getAll('inquiries');
            // eslint-disable-next-line eqeqeq
            inquiry = allInquiries.find((i: any) => i.id == this.offer.inquiryNo) || null;
          }

          this.selectedInquiry = inquiry;

          // ✅ Restore frozen rate snapshot from persisted originalItemRates
          // These were locked in at first save and never change regardless of edits
          if (this.offer.originalItemRates?.length) {
            this.inquiryItemRates = [...this.offer.originalItemRates];
          } else {
            // Fallback for offers saved before originalItemRates existed
            this.inquiryItemRates = (this.offer.items || []).map((item: any) => item.rate ?? 0);
          }

          console.log('🟢 Restored inquiry:', this.selectedInquiry);
          console.log('🟢 Frozen rate snapshot:', this.inquiryItemRates);
        } catch (error) {
          console.error('❌ Failed to restore inquiry:', error);
        }
      }
    }
  }

  async onCustomerChange() {
    if (!this.selectedCustomer) {
      this.offer.businessVertical = '';
      return;
    }

    const customer = this.selectedCustomer;

    this.offer.customerId = customer.id;
    this.offer.customerName = customer.name;
    this.offer.customerSnapshot = { ...customer };
    this.offer.businessVertical = customer.businessVertical || '';

    const allInquiries = await this.db.getAll('inquiries');

    this.inquiries = allInquiries.filter(
      (i: any) =>
        i.customerName?.trim().toLowerCase() ===
        customer.name?.trim().toLowerCase()
    );

    this.showInquiryPopup = this.inquiries.length > 0;
  }

  isInquiryItemSelected(idx: number): boolean {
    return this.selectedInquiryItemIndices.includes(idx);
  }

  async onInquiryItemToggle(idx: number, checked: boolean) {
    if (checked) {
      if (!this.selectedInquiryItemIndices.includes(idx)) {
        this.selectedInquiryItemIndices.push(idx);
        this.selectedInquiryItemIndices.sort((a, b) => a - b);
      }
    } else {
      this.selectedInquiryItemIndices = this.selectedInquiryItemIndices.filter(i => i !== idx);
    }
    await this.rebuildOfferItemsFromSelection();
  }

  private async rebuildOfferItemsFromSelection() {
    if (!this.selectedInquiry?.items) return;
    const inventory = await this.db.getAll('inventory');
    const indices = this.selectedInquiryItemIndices.length > 0
      ? this.selectedInquiryItemIndices
      : this.selectedInquiry.items.map((_: any, i: number) => i);
    this.offer.items = indices.map((idx: number) => {
      const i = this.selectedInquiry.items[idx];
      const inquiryName = (i.productName || '').toLowerCase().trim();
      const inventoryItem = inventory.find((inv: any) =>
        (inv.displayName || '').toLowerCase().trim().startsWith(inquiryName)
      );
      const rate = inventoryItem?.price || 0;
      const qty = i.qty || 0;
      return { name: i.productName, hsn: i.hsn || '', uom: i.uom || inventoryItem?.unit || '', qty, rate, total: qty * rate };
    });
    this.offer.originalItemRates = this.offer.items.map((item: any) => item.rate);
    this.inquiryItemRates = [...this.offer.originalItemRates];
    this.calcTotals();
  }

  async selectInquiry(inquiry: any) {
    this.selectedInquiry = { ...inquiry };
    this.offer.inquiryNo = inquiry.id;
    // Default: all items selected
    this.selectedInquiryItemIndices = (inquiry.items || []).map((_: any, i: number) => i);

    const inventory = await this.db.getAll('inventory');

    this.offer.items = inquiry.items.map((i: any) => {
      const inquiryName = (i.productName || '').toLowerCase().trim();

      const inventoryItem = inventory.find((inv: any) => {
        const invName = (inv.displayName || '').toLowerCase().trim();
        return invName.startsWith(inquiryName);
      });

      const rate = inventoryItem?.price || 0;
      const qty = i.qty || 0;

      return {
        name: i.productName,
        hsn: i.hsn || '',
        uom: i.uom || inventoryItem?.unit || '',
        qty: qty,
        rate: rate,
        total: qty * rate
      };
    });

    // ✅ Lock in original inventory rates — persisted to DB, never overwritten
    this.offer.originalItemRates = this.offer.items.map((item: any) => item.rate);
    this.inquiryItemRates = [...this.offer.originalItemRates];

    if (!this.offer.gstType) this.offer.gstType = 'cgst_sgst';

    // Auto-fill terms from the latest offer made for this inquiry
    const allOffers = await this.db.getAll('offers');
    const inquiryOffers = allOffers.filter(
      (o: any) => o.inquiryNo == inquiry.id && o.status !== 'superseded'
    );
    if (inquiryOffers.length > 0) {
      const latest = inquiryOffers[inquiryOffers.length - 1];
      this.offer.freightCharges = latest.freightCharges || 0;
      this.offer.paymentTerms  = latest.paymentTerms  || '';
      this.offer.validity      = latest.validity      || '';
      this.offer.terms         = latest.terms         || '';
    } else {
      this.offer.freightCharges = 0;
    }

    this.calcTotals();
    this.showInquiryPopup = false;
  }

  async prefillFromInquiry(inq: any) {
    // Capture inquiry decision for auto-setting offerStatus on save
    const decisionMap: Record<string, string> = {
      'Under Negotiation': 'under_negotiation',
      'Order Received':    'order_received',
      'Order Lost':        'order_lost',
      'Rejected':          'rejected'
    };
    this.inquiryDecision = decisionMap[inq.decision || ''] || '';

    // Match customer by name
    const customer = this.customers.find(
      (c: any) => c.companyName?.trim().toLowerCase() === inq.companyName?.trim().toLowerCase() ||
                  c.name?.trim().toLowerCase() === inq.customerName?.trim().toLowerCase()
    ) || null;

    if (customer) {
      this.selectedCustomer = customer;
      this.offer.customerId = customer.id;
      this.offer.customerName = customer.companyName || customer.name || inq.customerName || '';
      this.offer.customerSnapshot = { ...customer };
      this.offer.businessVertical = customer.businessVertical || '';
    } else {
      this.offer.customerName = inq.companyName || inq.customerName || '';
    }

    await this.selectInquiry(inq);
  }

  calcTotals() {
    let subtotal = 0;
    this.offer.items.forEach((i: any) => {
      i.total = i.qty * i.rate;
      subtotal += i.total;
    });

    const freight = +(this.offer.freightCharges || 0);
    const taxableAmount = subtotal + freight;

    this.offer.subtotal = subtotal;
    this.offer.freightCharges = freight;
    this.offer.gst = +(taxableAmount * 0.18).toFixed(2);

    if (this.offer.gstType === 'igst') {
      this.offer.igst = this.offer.gst;
      this.offer.cgst = 0;
      this.offer.sgst = 0;
    } else {
      this.offer.cgst = +(taxableAmount * 0.09).toFixed(2);
      this.offer.sgst = +(taxableAmount * 0.09).toFixed(2);
      this.offer.igst = 0;
    }

    this.offer.grandTotal = +(taxableAmount + this.offer.gst).toFixed(2);
  }

  onGstTypeChange() {
    this.calcTotals();
  }

  /* ===============================
     Version suffix helpers
  =============================== */
  private nextVersionedRef(existingRef: string): string {
    const versionMatch = existingRef.match(/^(.*)-v(\d+)$/);

    if (versionMatch) {
      const base = versionMatch[1];
      const currentVersion = parseInt(versionMatch[2], 10);
      return `${base}-v${currentVersion + 1}`;
    }

    return `${existingRef}-v2`;
  }

  async generatePreviewOfferId(): Promise<string> {
    const allOffers = await this.db.getAll('offers');
    const activeOffers = allOffers.filter((o: any) => o.status !== 'superseded');
    const maxId = activeOffers.reduce((max: number, o: any) => Math.max(max, o.id || 0), 0);
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(maxId + 1).padStart(4, '0')}`;
  }

  generateOfferRef(id: number) {
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(id).padStart(4, '0')}`;
  }

  getFollowUpDate(days: number = 2): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async saveOffer() {
    console.log('═══════════════════════════════════════');
    console.log('💾 SAVING OFFER');
    console.log('═══════════════════════════════════════');

    if (this.isEditMode && this.editingOfferId && this.originalOffer) {

      // STEP 1: Mark original offer as superseded (using deep-cloned originalOffer — untouched)
      await this.db.put('offers', {
        ...this.originalOffer,
        status: 'superseded'
      });
      console.log('🗂️ Original offer marked as superseded:', this.editingOfferId);

      // STEP 2: Create new versioned offer entry with current (edited) state
      const previousRef = this.originalOffer.offerRef
        || this.generateOfferRef(this.editingOfferId);

      const newVersionedRef = this.nextVersionedRef(previousRef);

      // Strip id so IndexedDB assigns a new one
      const { id, ...offerWithoutId } = this.offer;

      const newOfferData = {
        ...offerWithoutId,
        offerRef: newVersionedRef,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        previousVersionId: this.editingOfferId
      };

      const newOfferId = await this.db.add('offers', newOfferData);
      console.log('✅ New versioned offer created:', newVersionedRef, '(ID:', newOfferId, ')');

    } else {

      // CREATE: Brand new offer
      const offerId = await this.db.add('offers', {
        ...this.offer,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        ...(this.inquiryDecision ? { offerStatus: this.inquiryDecision } : {})
      });

      const offerRef = this.generateOfferRef(offerId);
      this.offer.offerRef = offerRef;

      // Persist offerRef back to DB so other pages can read it
      await this.db.put('offers', {
        ...this.offer,
        id: offerId,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        ...(this.inquiryDecision ? { offerStatus: this.inquiryDecision } : {})
      });

      console.log('✅ New offer created with ID:', offerId, '| Ref:', offerRef);

      try {
        const customer = this.offer.customerSnapshot;
        const mobile = customer?.mobile || customer?.phone || '';

        await this.db.createAutoReminder({
          type: 'offer',
          name: this.offer.customerName,
          mobile: mobile,
          referenceNo: offerRef,
          followUpDays: 2,
          note: `Follow-up offer ${offerRef} - ${this.offer.customerName}`
        });

        console.log('✅ Reminder created for new offer');
      } catch (error) {
        console.error('❌ Reminder creation failed:', error);
      }
    }

    console.log('═══════════════════════════════════════');
    this.router.navigateByUrl('/offers');
  }

  goBackToList() {
    this.router.navigateByUrl('/offers');
  }

  /** Returns the frozen inventory-sourced rate — unaffected by any edits in the Items section */
  getInquiryItemRate(index: number): number {
    return this.inquiryItemRates[index] ?? 0;
  }

  getDisplayInquiryId(id?: number): string {
    if (!id) return '-';
    return `INQ-${String(id).padStart(4, '0')}`;
  }
}