import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../service/api.service';
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
  showLibraryPicker = false;
  libraryDocuments: any[] = [];
  libraryFilterTerm = '';
  libraryFilterCategory = '';
  libraryCategories = ['Datasheet', 'MSDS', 'Test Certificate', 'Drawing', 'Brochure', 'Other'];

  isEditMode = false;
  editingOfferId: string | null = null;
  originalOffer: any = null;

  businessVerticals = [
    'Projects',
    'Material Distribution Division',
    'Both'
  ];

  previewOfferId: string = '';

  offerStatusOptions = [
    { value: 'order_received',    label: 'Order Received' },
    { value: 'pending',           label: 'Pending' },
    { value: 'under_negotiation', label: 'Under Negotiation' },
    { value: 'order_lost',        label: 'Order Lost' },
    { value: 'rejected',          label: 'Regret' }
  ];

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
    grandTotal: 0,
    offerStatus: 'order_received'   // default for directly-added offers
  };

  constructor(private apiService: ApiService, private router: Router) { }

  private normalizeText(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  // ── Mapping helpers ──────────────────────────────────────

  /** Map camelCase offer to PostgREST snake_case row. */
  private toDbRow(offer: any): any {
    const row: any = {
      offer_ref:           offer.offerRef            ?? null,
      inquiry_no:          offer.inquiryNo            ?? null,
      customer_name:       offer.customerName         ?? null,
      customer_snapshot:   offer.customerSnapshot     ?? null,
      business_vertical:   offer.businessVertical     ?? null,
      payment_terms:       offer.paymentTerms         ?? null,
      validity:            offer.validity             ?? null,
      terms:               offer.terms               ?? null,
      freight_charges:     offer.freightCharges       ?? null,
      subtotal:            offer.subtotal             ?? null,
      gst:                 offer.gst                 ?? null,
      cgst:                offer.cgst                ?? null,
      sgst:                offer.sgst                ?? null,
      igst:                offer.igst                ?? null,
      gst_type:            offer.gstType             ?? null,
      grand_total:         offer.grandTotal           ?? null,
      offer_status:        offer.offerStatus          ?? null,
      status:              offer.status              ?? 'active',
      previous_version_id: offer.previousVersionId   ?? null,
      original_item_rates: offer.originalItemRates   ?? null,
      items:               offer.items               ?? [],
      follow_ups:          offer.followUps            ?? null,
      payment_details:     offer.paymentDetails       ?? null,
      lost_details:        offer.lostDetails          ?? null,
      regret_remarks:      offer.regretRemarks        ?? null,
      sent_at:             offer.sentAt              ?? null,
      attachments:         offer.attachments          ?? null,
      po_copy_attachments: offer.poCopyAttachments   ?? null,
      material:            offer.material            ?? null,
      density:             offer.density             ?? null,
      thickness:           offer.thickness           ?? null,
      size:                offer.size                ?? null,
      quantity:            offer.quantity            ?? null,
      rate:                offer.rate                ?? null,
      date:                offer.date                ?? new Date().toISOString().slice(0, 10),
    };
    if (offer.id) row.id = offer.id;
    return row;
  }

  /** Map PostgREST snake_case row to camelCase offer. */
  private fromDbRow(row: any): any {
    return {
      id:               row.id,
      offerRef:         row.offer_ref             || '',
      inquiryNo:        row.inquiry_no            ?? null,
      customerName:     row.customer_name         || '',
      customerSnapshot: row.customer_snapshot     || null,
      businessVertical: row.business_vertical     || '',
      paymentTerms:     row.payment_terms         || '',
      validity:         row.validity              || '',
      terms:            row.terms                 || '',
      freightCharges:   row.freight_charges       ?? 0,
      subtotal:         row.subtotal              ?? 0,
      gst:              row.gst                   ?? 0,
      cgst:             row.cgst                  ?? 0,
      sgst:             row.sgst                  ?? 0,
      igst:             row.igst                  ?? 0,
      gstType:          row.gst_type              || 'cgst_sgst',
      grandTotal:       row.grand_total           ?? 0,
      offerStatus:      row.offer_status          || '',
      status:           row.status               || 'active',
      previousVersionId: row.previous_version_id  ?? null,
      originalItemRates: row.original_item_rates  ?? null,
      items:            Array.isArray(row.items)  ? row.items : [],
      followUps:        row.follow_ups            || [],
      paymentDetails:   row.payment_details       || [],
      lostDetails:      row.lost_details          || [],
      regretRemarks:    row.regret_remarks        || '',
      sentAt:           row.sent_at              || null,
      attachments:      row.attachments           || [],
      poCopyAttachments: row.po_copy_attachments  || [],
      material:         row.material             || '',
      density:          row.density              || '',
      thickness:        row.thickness            || '',
      size:             row.size                 || '',
      quantity:         row.quantity             || '',
      rate:             row.rate                 || '',
      date:             row.date                 || '',
    };
  }

  /** Map a PostgREST customer row to camelCase for this component. */
  private mapCustomer(row: any): any {
    return {
      id:              row.id,
      companyName:     row.company_name      || '',
      name:            row.name              || '',
      email:           row.email             || '',
      mobile:          row.mobile            || '',
      businessVertical: row.business_vertical || '',
      primaryContact:  row.primary_contact   || {},
      secondaryContact: row.secondary_contact || {},
      officeAddress:   row.office_address    || {},
      billing:         row.billing           || {},
      shipping:        row.shipping          || {},
    };
  }

  /** Map a PostgREST inquiry row to camelCase for matching. */
  private mapInquiry(row: any): any {
    const refMatch = (row.inquiry_ref || '').match(/INQ-(\d+)/i);
    return {
      _uuid:        row.id,
      id:           refMatch ? parseInt(refMatch[1], 10) : null,
      companyName:  row.company_name   || '',
      customerName: row.customer_name  || '',
      decision:     row.decision       || '',
      items:        Array.isArray(row.items) ? row.items : [],
      inquiryRef:   row.inquiry_ref    || '',
    };
  }

  async ngOnInit() {
    console.log('🟢 CreateOfferComponent initialized');

    const customerRows = await this.apiService.getAll('customers');
    this.customers = customerRows.map((r: any) => this.mapCustomer(r));
    console.log('🟢 Customers loaded:', this.customers.length);

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
      this.editingOfferId = state.offer.id;  // UUID string

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
          (c.companyName?.trim().toLowerCase() === this.offer.customerName?.trim().toLowerCase()) ||
          (c.name?.trim().toLowerCase() === this.offer.customerName?.trim().toLowerCase())
      ) || null;

      console.log('🟢 Pre-selected customer:', this.selectedCustomer);

      // ✅ Restore inquiry details
      if (this.offer.inquiryNo != null) {
        try {
          // Load all inquiries and find by sequential number
          const inquiryRows = await this.apiService.getAll('inquiries');
          const allMapped = inquiryRows.map((r: any) => this.mapInquiry(r));
          const inquiry = allMapped.find(
            (i: any) => i.id === this.offer.inquiryNo
          ) || null;

          this.selectedInquiry = inquiry;

          // ✅ Restore frozen rate snapshot from persisted originalItemRates
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
    this.offer.customerName = customer.companyName || customer.name;
    this.offer.customerSnapshot = { ...customer };
    this.offer.businessVertical = customer.businessVertical || '';

    // Load inquiries for this customer
    const inquiryRows = await this.apiService.getAll('inquiries');
    const allInquiries = inquiryRows.map((r: any) => this.mapInquiry(r));

    const customerName = this.normalizeText(customer.name);
    const companyName  = this.normalizeText(customer.companyName || customer.name);
    this.inquiries = allInquiries.filter((i: any) => {
      const inqCustomerName = this.normalizeText(i.customerName);
      const inqCompanyName  = this.normalizeText(i.companyName);
      return inqCustomerName === customerName || inqCompanyName === companyName;
    });

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
    const inventory = await this.apiService.getAll('inventory');
    const indices = this.selectedInquiryItemIndices.length > 0
      ? this.selectedInquiryItemIndices
      : this.selectedInquiry.items.map((_: any, i: number) => i);
    this.offer.items = indices.map((idx: number) => {
      const i = this.selectedInquiry.items[idx];
      const inquiryName = (i.productName || '').toLowerCase().trim();
      const inventoryItem = inventory.find((inv: any) =>
        (inv.displayName || inv.name || '').toLowerCase().trim().startsWith(inquiryName)
      );
      const rate = inventoryItem?.price || 0;
      const qty = i.qty || 0;
      return { name: i.productName, hsn: i.hsn || '', uom: i.uom || inventoryItem?.unit || '',
               make: i.make || '', form: i.form || '', density: i.density || '',
               thickness: i.thickness || '', fsk: i.fsk || '', size: i.size || '',
               qty, rate, total: qty * rate };
    });
    this.offer.originalItemRates = this.offer.items.map((item: any) => item.rate);
    this.inquiryItemRates = [...this.offer.originalItemRates];
    this.calcTotals();
  }

  async selectInquiry(inquiry: any) {
    this.selectedInquiry = { ...inquiry };
    this.offer.inquiryNo = inquiry.id; // sequential number
    // Default: all items selected
    this.selectedInquiryItemIndices = (inquiry.items || []).map((_: any, i: number) => i);

    const inventory = await this.apiService.getAll('inventory');

    this.offer.items = (inquiry.items || []).map((i: any) => {
      const inquiryName = (i.productName || '').toLowerCase().trim();

      const inventoryItem = inventory.find((inv: any) => {
        const invName = (inv.displayName || inv.name || '').toLowerCase().trim();
        return invName.startsWith(inquiryName);
      });

      const rate = inventoryItem?.price || 0;
      const qty = i.qty || 0;

      return {
        name: i.productName,
        hsn: i.hsn || '',
        uom: i.uom || inventoryItem?.unit || '',
        make: i.make || '',
        form: i.form || '',
        density: i.density || '',
        thickness: i.thickness || '',
        fsk: i.fsk || '',
        size: i.size || '',
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
    const offerRows = await this.apiService.getAll('offers');
    const inquiryOffers = offerRows
      .filter((r: any) => r.inquiry_no == inquiry.id && r.status !== 'superseded')
      .map((r: any) => this.fromDbRow(r));
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
    // Mirror inquiry decision into offerStatus so the offer lands in the right tab
    if (this.inquiryDecision) {
      this.offer.offerStatus = this.inquiryDecision;
    }

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

  /** Count active offer refs to determine the next sequential offer number. */
  async generatePreviewOfferId(): Promise<string> {
    const rows = await this.apiService.getAll('offers');
    const active = rows.filter((r: any) => r.status !== 'superseded');
    const maxNum = active.reduce((max: number, r: any) => {
      // Parse the 4-digit counter from offer_ref: NIEC/MDD/YYYY/NNNN[-vX]
      const m = (r.offer_ref || '').match(/\/(\d{4})(?:-v\d+)?$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(maxNum + 1).padStart(4, '0')}`;
  }

  getFollowUpDate(days: number = 2): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async saveOffer(sendEmail = false) {
    console.log('═══════════════════════════════════════');
    console.log('💾 SAVING OFFER');
    console.log('═══════════════════════════════════════');

    if (this.isEditMode && this.editingOfferId && this.originalOffer) {

      // STEP 1: Mark original offer as superseded (using deep-cloned originalOffer)
      await this.apiService.put('offers', this.toDbRow({
        ...this.originalOffer,
        id: this.editingOfferId,
        status: 'superseded'
      }));
      console.log('🗂️ Original offer marked as superseded:', this.editingOfferId);

      // STEP 2: Create new versioned offer entry with current (edited) state
      const previousRef = this.originalOffer.offerRef || this.previewOfferId;
      const newVersionedRef = this.nextVersionedRef(previousRef);

      // Strip id so Postgres assigns a new UUID
      const { id, ...offerWithoutId } = this.offer;

      const newOfferRow = this.toDbRow({
        ...offerWithoutId,
        offerRef: newVersionedRef,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        previousVersionId: this.editingOfferId
      });

      const newOfferId = await this.apiService.add('offers', newOfferRow);
      console.log('✅ New versioned offer created:', newVersionedRef, '(UUID:', newOfferId, ')');

    } else {

      // CREATE: Brand new offer — let Postgres generate UUID, then patch with offerRef
      const offerRow = this.toDbRow({
        ...this.offer,
        offerRef: this.previewOfferId,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        offerStatus: this.offer.offerStatus || 'order_received'
      });

      const offerId = await this.apiService.add('offers', offerRow);
      this.offer.id = offerId;
      this.offer.offerRef = this.previewOfferId;

      console.log('✅ New offer created (UUID:', offerId, '| Ref:', this.previewOfferId, ')');

      await this.addReminder({
        type: 'offer',
        name: this.offer.customerName || '',
        referenceNo: this.previewOfferId || '',
        daysFromNow: 2,
        note: `Follow up on offer ${this.previewOfferId}`,
      });
    }

    console.log('═══════════════════════════════════════');
    if (sendEmail) {
      // Navigate back and signal offers list to open email modal for this offer
      this.router.navigate(['/offers'], { state: { openEmailForRef: this.offer.offerRef } });
    } else {
      this.router.navigateByUrl('/offers');
    }
  }

  async saveAndSendEmail() {
    await this.saveOffer(true);
  }

  goBackToList() {
    this.router.navigateByUrl('/offers');
  }

  addAttachment(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (!this.offer.attachments) this.offer.attachments = [];
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.offer.attachments.push({ name: file.name, type: file.type, data: e.target.result });
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removeAttachment(i: number) {
    this.offer.attachments?.splice(i, 1);
  }

  async openLibraryPicker() {
    try {
      this.libraryDocuments = await this.apiService.getAll('documents');
    } catch {
      this.libraryDocuments = [];
    }
    this.libraryFilterTerm = '';
    this.libraryFilterCategory = '';
    this.showLibraryPicker = true;
  }

  get filteredLibraryDocs(): any[] {
    const term = this.libraryFilterTerm.toLowerCase().trim();
    return this.libraryDocuments.filter(d => {
      const matchTerm = !term ||
        (d.name || '').toLowerCase().includes(term) ||
        (d.material || '').toLowerCase().includes(term) ||
        (d.tags || '').toLowerCase().includes(term);
      const matchCat = !this.libraryFilterCategory || d.category === this.libraryFilterCategory;
      return matchTerm && matchCat;
    });
  }

  pickFromLibrary(doc: any) {
    if (!this.offer.attachments) this.offer.attachments = [];
    const alreadyAdded = this.offer.attachments.some((a: any) => a.name === doc.name && a.libraryId === doc.id);
    if (!alreadyAdded) {
      this.offer.attachments.push({
        name: doc.name,
        type: doc.fileType || doc.file_type,
        data: doc.fileData || doc.file_data,
        libraryId: doc.id
      });
    }
    this.showLibraryPicker = false;
  }

  /** Returns the frozen inventory-sourced rate — unaffected by any edits in the Items section */
  getInquiryItemRate(index: number): number {
    return this.inquiryItemRates[index] ?? 0;
  }

  getDisplayInquiryId(id?: number): string {
    if (id === null || id === undefined) return '-';
    const raw = String(id).trim();
    if (!raw) return '-';
    const match = raw.match(/INQ-(\d+)/i);
    const num = match ? parseInt(match[1], 10) : Number(raw);
    if (!Number.isFinite(num) || num <= 0) return raw;
    return `INQ-${String(num).padStart(3, '0')}`;
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
