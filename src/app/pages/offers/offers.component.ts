import { Component, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ApiService } from '../../service/api.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OfferLetter {
  date: string;
  subject: string;
  subjectProduct?: string,
  address: string;
  introText: string;
  material: string;
  density: string;
  thickness: string;
  size: string;
  quantity: string;
  rate: string;
  taxes: string;
  freight: string;
  inspection: string;
  packing: string;
  loading: string;
  deliveryTerms: string;
  paymentTerms: string;
  validity: string;
  closingText: string;
}

@Component({
  selector: 'app-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offers.component.html',
  styleUrls: ['./offers.component.css']
})
export class OffersComponent {

  offers: any[] = [];
  proformas: any[] = [];
  inquiries: any[] = [];
  showViewModal = false;
  selectedOffer: any = null;

  showPdfFormModal: boolean = false;
  selectedSubjectItem: any = null;

  // Status filter
  selectedStatus: string = 'pending';
  statusOptions = [
    { value: '', label: 'All Offers' },
    { value: 'pending', label: 'Pending Inquiries' },
    { value: 'under_negotiation', label: 'Under Negotiation' },
    { value: 'order_received', label: 'Order Received' },
    { value: 'order_lost', label: 'Order Lost' },
    { value: 'rejected', label: 'Regret' }
  ];


  // History modal
  showHistoryModal = false;
  historyOffers: any[] = [];
  historyCurrentOffer: any = null;
  viewingHistoryOffer: any = null;

  offerLetter: OfferLetter = {
    date: '',
    subject: '',
    subjectProduct: '',
    address: '',
    introText: '',
    material: '',
    density: '',
    thickness: '',
    size: '',
    quantity: '',
    rate: '',
    taxes: 'Extra - GST as applicable',
    freight: '',
    inspection: '',
    packing: '',
    loading: '',
    deliveryTerms: '',
    paymentTerms: '',
    validity: '',
    closingText: ''
  };

  offerLetterKeys = Object.keys(this.offerLetter);

  constructor(private router: Router, private apiService: ApiService) {
    this.loadOffers();
    this.loadInquiries();
  }

  // ── Mapping helpers ──────────────────────────────────────

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

  /** Map a PostgREST inquiry row to the shape this component needs. */
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

  // ── Load data ────────────────────────────────────────────

  async loadInquiries() {
    const rows = await this.apiService.getAll('inquiries');
    this.inquiries = rows.map((r: any) => this.mapInquiry(r));
  }

  private toInquiryId(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;
    const m = raw.match(/INQ-(\d+)/i);
    if (m) return parseInt(m[1], 10);
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  getInquiriesForTab(tabValue: string): any[] {
    if (!tabValue) return [];
    const offeredInquiryIds = new Set(
      this.offers
        .map((o: any) => this.toInquiryId(o.inquiryNo ?? o.inquiryId ?? o.inquiryRef))
        .filter((id: any) => id != null)
    );
    if (tabValue === 'pending') {
      return this.inquiries.filter(
        (inq: any) => !inq.decision && !offeredInquiryIds.has(this.toInquiryId(inq.id))
      );
    }
    const decisionMap: Record<string, string> = {
      'under_negotiation': 'Under Negotiation',
      'order_received':    'Order Received',
      'order_lost':        'Order Lost',
      'rejected':          'Rejected'
    };
    const decision = decisionMap[tabValue];
    if (!decision) return [];
    return this.inquiries.filter(
      (inq: any) => inq.decision === decision && !offeredInquiryIds.has(this.toInquiryId(inq.id))
    );
  }

  openCreateOfferFromInquiry(inq: any) {
    this.router.navigate(['/create-offer'], { state: { inquiry: inq } });
  }

  async updateInquiryDecision(inq: any, decision: string) {
    if (!inq) return;
    inq.decision = decision || '';
    // Use the stored UUID (_uuid) as the row identifier for PostgREST
    await this.apiService.put('inquiries', { id: inq._uuid, decision: inq.decision });
    await this.loadInquiries();
  }

  /* ===============================
     Date formatting helpers
  =============================== */

  /** Format a date string (yyyy-mm-dd or any parseable) to dd/mm/yy for display */
  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // fallback: return as-is if unparseable
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  private formatTodayDDMMYY(): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  private async findInventoryItemForOfferItem(item: any): Promise<any> {
    if (!item?.name) return null;

    const inventory = await this.apiService.getAll('inventory');

    const itemName = item.name.toLowerCase();

    const matches = inventory.filter((inv: any) => {
      const invName = (inv.displayName || inv.name || '').toLowerCase();
      return invName === itemName;
    });

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    return matches[0];
  }

  /** Returns all item names from an offer joined with " & " */
  getOfferItemNames(offer: any): string {
    return (offer?.items || [])
      .map((it: any) => (it.name || '').trim())
      .filter(Boolean)
      .join(' & ');
  }

  async onSubjectProductChange(item: any) {
    if (!item) return;

    this.selectedSubjectItem = item;

    // Subject shows ALL items, not just the selected one
    this.offerLetter.subjectProduct = this.getOfferItemNames(this.selectedOffer);
    this.offerLetter.material = item.name || '';

    const qty = item.qty ?? '';
    const uom = item.uom ?? '';
    this.offerLetter.quantity = qty ? `${qty} ${uom}` : '';

    this.offerLetter.rate =
      item.rate !== undefined && item.rate !== null
        ? `₹${item.rate} per unit`
        : '';

    // Always keep taxes as fixed standard text — never use item.gst numeric value
    this.offerLetter.taxes = 'Extra - GST as applicable';

    const data = await this.findInventoryItemForOfferItem(item);

    if (data) {
      this.offerLetter.density = data.density || '';
      this.offerLetter.thickness = data.thickness || '';
      this.offerLetter.size = data.size || '';
    }
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

  async loadOffers() {
    const rows = await this.apiService.getAll('offers');
    const mapped = rows.map((r: any) => this.fromDbRow(r));
    this.offers = mapped.filter((o: any) => o.status !== 'superseded').reverse();

    try {
      this.proformas = await this.apiService.getAll('proformas');
    } catch {
      this.proformas = [];
    }

    // Auto-open email modal when redirected from "Save & Send Email"
    const state = history.state as any;
    if (state?.openEmailForRef) {
      const target = this.offers.find((o: any) => o.offerRef === state.openEmailForRef);
      if (target) {
        setTimeout(() => this.openEmailModal(target), 300);
      }
    }
  }

  getLinkedPIs(offerId: any): any[] {
    return this.proformas.filter((p: any) => p.linkedOfferId === offerId || p.linked_offer_id === offerId);
  }

  getTotalQty(items: any[]): number {
    return (items || []).reduce((s: number, i: any) => s + (i.qty || 0), 0);
  }

  get filteredOffers(): any[] {
    if (!this.selectedStatus) return this.offers;
    if (this.selectedStatus === 'pending') {
      // Offers with no status set are treated as pending
      return this.offers.filter((o: any) => !o.offerStatus || o.offerStatus === 'pending');
    }
    return this.offers.filter((o: any) => o.offerStatus === this.selectedStatus);
  }

  isTerminalStatus(status: string): boolean {
    return ['order_received', 'order_lost', 'rejected'].includes(status);
  }

  getStatusCount(status: string): number {
    if (!status) return this.offers.length;
    if (status === 'pending') {
      return this.getInquiriesForTab('pending').length +
             this.offers.filter((o: any) => !o.offerStatus || o.offerStatus === 'pending').length;
    }
    return this.offers.filter((o: any) => o.offerStatus === status).length;
  }

  async updateOfferStatus(offer: any, status: string) {
    offer.offerStatus = status;
    await this.apiService.put('offers', this.toDbRow(offer));

    // Sync decision back to linked inquiry
    if (offer.inquiryNo != null) {
      const decisionMap: Record<string, string> = {
        'under_negotiation': 'Under Negotiation',
        'order_received':    'Order Received',
        'order_lost':        'Order Lost',
        'rejected':          'Rejected'
      };
      const decision = decisionMap[status];
      if (decision) {
        const offerInquiryId = this.toInquiryId(offer.inquiryNo);
        const inq = this.inquiries.find((i: any) => this.toInquiryId(i.id) === offerInquiryId);
        if (inq) {
          inq.decision = decision;
          await this.apiService.put('inquiries', { id: inq._uuid, decision });
        }
      }
    }

    await this.loadOffers();
    await this.loadInquiries();
  }

  async openHistoryModal(offer: any) {
    this.historyCurrentOffer = offer;
    this.viewingHistoryOffer = null;
    // Collect all versions: walk back via previousVersionId
    const rows: any[] = await this.apiService.getAll('offers');
    const allOffers = rows.map((r: any) => this.fromDbRow(r));
    const chain: any[] = [];
    let current: any = offer;
    // Add current
    chain.unshift({ ...current, _versionLabel: 'Current' });
    // Walk back through previousVersionId chain
    let prevId = current.previousVersionId;
    let safetyLimit = 20;
    while (prevId && safetyLimit-- > 0) {
      const prev = allOffers.find((o: any) => o.id === prevId);
      if (!prev) break;
      chain.unshift({ ...prev, _versionLabel: prev.offerRef || `Version (ID ${prev.id})` });
      prevId = prev.previousVersionId;
    }
    this.historyOffers = chain;
    this.showHistoryModal = true;
  }

  closeHistoryModal() {
    this.showHistoryModal = false;
    this.historyOffers = [];
    this.historyCurrentOffer = null;
    this.viewingHistoryOffer = null;
  }

  viewHistoryVersion(offer: any) {
    this.viewingHistoryOffer = offer;
  }

  getChangedFields(offer: any): Set<string> {
    const idx = this.historyOffers.findIndex((o: any) => o.id === offer?.id);
    if (idx <= 0) return new Set();
    const prev = this.historyOffers[idx - 1];
    const changed = new Set<string>();
    const scalar = ['paymentTerms', 'validity', 'grandTotal', 'date', 'terms', 'gstType', 'freightCharges'];
    for (const f of scalar) {
      if (String(offer[f] ?? '') !== String(prev[f] ?? '')) changed.add(f);
    }
    const currItems: any[] = offer.items || [];
    const prevItems: any[] = prev.items || [];
    currItems.forEach((ci: any, i: number) => {
      const pi = prevItems[i];
      if (!pi || String(ci.rate) !== String(pi.rate)) changed.add(`rate_${i}`);
      if (!pi || String(ci.make ?? '') !== String(pi.make ?? '')) changed.add(`make_${i}`);
      if (!pi || String(ci.form ?? '') !== String(pi.form ?? '')) changed.add(`form_${i}`);
      if (!pi || String(ci.density ?? '') !== String(pi.density ?? '')) changed.add(`density_${i}`);
      if (!pi || String(ci.fsk ?? '') !== String(pi.fsk ?? '')) changed.add(`fsk_${i}`);
    });
    return changed;
  }

  createSalesOrderFromOffer(offer: any) {
    this.router.navigate(['/sales-order'], { state: { offer } });
  }

  generateOfferRef(id: number) {
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(id).padStart(4, '0')}`;
  }

  /** Count active offers to derive the next preview ref for standalone offer letters. */
  private async generatePreviewOfferId(): Promise<string> {
    const rows = await this.apiService.getAll('offers');
    const active = rows.filter((r: any) => r.status !== 'superseded');
    const maxNum = active.reduce((max: number, r: any) => {
      const m = (r.offer_ref || '').match(/\/(\d{4})(?:-v\d+)?$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(maxNum + 1).padStart(4, '0')}`;
  }

  createOffer() {
    this.router.navigate(['/create-offer']);
  }

  editOffer(offer: any) {
    this.router.navigate(['/create-offer'], { state: { offer } });
  }

  viewOffer(offer: any) {
    this.selectedOffer = offer;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedOffer = null;
  }

  async deleteOffer(id: any) {
    await this.apiService.delete('offers', id);
    await this.loadOffers();
  }

  async openOfferLetterModal() {
    // ✅ Date formatted as dd/mm/yy
    this.offerLetter['date'] = this.formatTodayDDMMYY();

    if (this.selectedOffer) {
      let inquiryData: any = null;
      if (this.selectedOffer.inquiryNo) {
        try {
          // Look up inquiry by its sequential number stored in inquiry_ref
          const rows = await this.apiService.getAll('inquiries');
          inquiryData = rows.find((r: any) => {
            const m = (r.inquiry_ref || '').match(/INQ-(\d+)/i);
            return m ? parseInt(m[1], 10) === this.selectedOffer.inquiryNo : false;
          }) || null;
        } catch (error) {
          console.error('Could not load inquiry:', error);
        }
      }

      Object.keys(this.offerLetter).forEach(key => {
        if (key !== 'date' && key !== 'taxes') {
          (this.offerLetter as any)[key] = this.selectedOffer[key] ?? '';
        }
      });
      // Always keep taxes as the standard fixed text
      this.offerLetter['taxes'] = 'Extra - GST as applicable';

      // ✅ Auto-fill freight from saved freightCharges on the offer
      if (this.selectedOffer.freightCharges != null && this.selectedOffer.freightCharges > 0) {
        this.offerLetter['freight'] = `₹${this.selectedOffer.freightCharges}`;
      }

      if (inquiryData && this.selectedOffer.items && this.selectedOffer.items.length > 0) {
        const firstItem = this.selectedOffer.items[0];
        const inquiryItems = Array.isArray(inquiryData.items) ? inquiryData.items : [];

        if (!this.offerLetter['material'] && firstItem.name) {
          this.offerLetter['material'] = firstItem.name;
        }

        if (inquiryItems.length > 0) {
          const inquiryItem = inquiryItems[0];

          if (!this.offerLetter['density'] && inquiryItem.density) {
            this.offerLetter['density'] = inquiryItem.density;
          }

          if (!this.offerLetter['thickness'] && inquiryItem.thickness) {
            this.offerLetter['thickness'] = inquiryItem.thickness;
          }

          if (!this.offerLetter['size'] && inquiryItem.size) {
            this.offerLetter['size'] = inquiryItem.size;
          }
        }

        if (!this.offerLetter['quantity']) {
          const totalQty = this.selectedOffer.items.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
          const firstItemUOM = inquiryItems[0]?.uom || 'Units';
          this.offerLetter['quantity'] = `${totalQty} ${firstItemUOM}`;
        }

        if (!this.offerLetter['rate'] && firstItem.rate) {
          this.offerLetter['rate'] = `₹${firstItem.rate} per unit`;
        }

        // Always set taxes to the standard text — never use old numeric value
        this.offerLetter['taxes'] = 'Extra - GST as applicable';
      }

      if (!this.offerLetter['deliveryTerms']) this.offerLetter['deliveryTerms'] = 'Ex-Works';
      if (!this.offerLetter['paymentTerms']) this.offerLetter['paymentTerms'] = '100% Advance';
      if (!this.offerLetter['validity']) this.offerLetter['validity'] = '30 days';
      if (!this.offerLetter['packing']) this.offerLetter['packing'] = 'Standard Industrial Packing';

    } else {
      Object.keys(this.offerLetter).forEach(key => {
        if (key !== 'date') {
          (this.offerLetter as any)[key] = '';
        }
      });
    }

    if (this.selectedOffer?.items?.length) {
      // Always pre-fill subject with ALL item names
      this.offerLetter.subjectProduct = this.getOfferItemNames(this.selectedOffer);
      if (!this.selectedSubjectItem) {
        this.selectedSubjectItem = this.selectedOffer.items[0];
        this.offerLetter.material = this.selectedOffer.items[0]?.name || '';
      }
    }

    this.showPdfFormModal = true;
  }

  closeOfferLetterModal() {
    this.showPdfFormModal = false;
  }

  async downloadOfferDirect() {
    await this.openOfferLetterModal();
    this.showPdfFormModal = false;
    await this.downloadOfferPDF();
  }

  /** Fetch customer by company name for PDF address rendering. */
  async getCustomerByName(name: string): Promise<any | null> {
    if (!name) return null;
    try {
      const rows = await this.apiService.filter('customers', { company_name: name });
      const row = rows?.[0];
      if (!row) return null;
      return {
        id:              row.id,
        companyName:     row.company_name     || '',
        name:            row.name             || '',
        email:           row.email            || '',
        mobile:          row.mobile           || '',
        primaryContact:  row.primary_contact  || {},
        secondaryContact: row.secondary_contact || {},
        officeAddress:   row.office_address   || {},
        billing:         row.billing          || {},
        shipping:        row.shipping         || {},
      };
    } catch {
      return null;
    }
  }

  async createOfferFollowUpReminder(offer: any) {
    await this.addReminder({
      type: 'offer-followup',
      name: offer.customerName || '',
      referenceNo: offer.offerRef || '',
      daysFromNow: 2,
      note: `Follow up on offer ${offer.offerRef}`,
    });
  }

  async downloadOfferPDF() {
    if (!this.selectedOffer) return;
    this.offerLetter.subject =
      `Your enquiry for supply of ${this.offerLetter.subjectProduct || ''}`.trim();

    const offer = this.selectedOffer;
    const customer = await this.getCustomerByName(offer.customerName || '');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    // Reserve space at bottom: footer (14) + regards block (22) + stamp (22) + closing (12) + buffer (4)
    const footerReserved = pageHeight - 14;
    const L = 20; // left margin
    let y = 5;

    // ── LOGO (centered, compact) ──────────────────────────────────────────────
    const img = new Image();
    img.src = 'assets/Navbharat logo.png';

    await new Promise<void>((resolve) => {
      img.onload = () => {
        doc.addImage(img, 'PNG', pageWidth / 2 - 50, y, 100, 28, undefined, 'FAST');
        resolve();
      };
      img.onerror = () => {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('NAVBHARAT INSULATION & ENGG CO', pageWidth / 2, y + 10, { align: 'center' });
        resolve();
      };
    });

    y += 32;

    const ref = (offer.offerRef || '').replace('/MDD', '');
    const dateStr = this.offerLetter['date'] || '';

    // ── REF / DATE (left & right) ─────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(`Ref: ${ref}`, L, y);
    doc.text(`Date: ${dateStr}`, pageWidth - L, y, { align: 'right' });
    y += 8;

    // ── TO / ADDRESS (left-aligned) ───────────────────────────────────────────
    doc.setFontSize(10);
    doc.text('To,', L, y); y += 5;

    const companyName = customer?.companyName || offer.customerName || 'Company Name';
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, L, y); y += 5;
    doc.setFont('helvetica', 'normal');

    if (customer?.shipping?.city || customer?.billing?.city) {
      const addr = customer?.shipping?.city ? customer.shipping : customer.billing;

      const line1Parts = [addr.street, addr.area].filter((p: string) => p && p.trim());
      const line1 = line1Parts.join(', ');
      if (line1) { doc.text(line1, L, y); y += 5; }

      const line2Parts = [addr.city, addr.state, addr.country, addr.pincode].filter((p: string) => p && p.trim());
      const line2 = line2Parts.join(', ');
      if (line2) { doc.text(line2, L, y); y += 5; }
    }
    y += 3;

    // ── SUBJECT (left-aligned, bold) ──────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const subject = this.offerLetter['subject'] || 'Your enquiry for supply of Product';
    const subjectLines = doc.splitTextToSize(`Subject: ${subject}`, 170);
    doc.text(subjectLines, L, y);
    y += (subjectLines.length * 5) + 3;

    // ── INTRO TEXT (left-aligned) ─────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const introText = `Thank you for your enquiry dated ${dateStr}. Please find the quotation as per your requirement. The pricing and specifications have been carefully considered based on your inquiry.`;
    const introLines = doc.splitTextToSize(introText, 170);
    doc.text(introLines, L, y);
    y += (introLines.length * 4.5) + 4;

    // ── SPECIFICATION TABLE ───────────────────────────────────────────────────
    const rows: any[] = [];
    const val = (key: keyof OfferLetter) =>
      (this.offerLetter[key] || '') ||
      (this.selectedOffer ? this.selectedOffer[key as any] || '' : '');

    if (val('material'))      rows.push(['Material',       val('material')]);
    if (val('density'))       rows.push(['Density',        val('density')]);
    if (val('thickness'))     rows.push(['Thickness',      val('thickness')]);
    // Use item's own fsk/specifications field — inventory default size was incorrect
    const firstItem = offer.items?.[0];
    const specVal = firstItem?.fsk || firstItem?.size || val('size') || '';
    if (specVal)              rows.push(['Specifications', specVal]);
    if (val('quantity'))      rows.push(['Quantity',       val('quantity')]);

    // Rate — final rate incl. GST (grandTotal ÷ total qty)
    const grandTotal = offer.grandTotal;
    const totalQty = (offer.items || []).reduce((s: number, i: any) => s + (i.qty || 0), 0);
    if (grandTotal && totalQty > 0) {
      rows.push(['Rate', `₹${(grandTotal / totalQty).toFixed(2)} per unit`]);
    } else if (val('rate')) {
      rows.push(['Rate', val('rate')]);
    }

    rows.push(['Taxes', 'Extra - GST as applicable']);

    if (val('freight'))       rows.push(['Freight',        val('freight')]);
    if (val('inspection'))    rows.push(['Inspection',     val('inspection')]);
    if (val('packing'))       rows.push(['Packing',        val('packing')]);
    if (val('loading'))       rows.push(['Loading',        val('loading')]);
    if (val('deliveryTerms')) rows.push(['Delivery Terms', val('deliveryTerms')]);
    if (val('paymentTerms'))  rows.push(['Payment Terms',  val('paymentTerms')]);
    if (val('validity'))      rows.push(['Offer Validity', val('validity')]);

    autoTable(doc, {
      startY: y,
      head: [['Specification', 'Details']],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        font: 'helvetica',
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        halign: 'center'   // table body cells: centered
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',  // table header: centered
        fontSize: 8.5
      },
      columnStyles: {
        0: { cellWidth: 40, halign: 'left' },   // spec label: left
        1: { cellWidth: 130, halign: 'center' } // detail value: centered
      },
      margin: { left: L, right: L }
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // ── CLOSING TEXT (left-aligned) ───────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const closingText = 'Kindly review the above quote. Feel free to reach out for clarification or to discuss further. Looking forward to your response.';
    const closingLines = doc.splitTextToSize(closingText, 170);
    doc.text(closingLines, L, y);
    y += (closingLines.length * 4.5) + 5;

    // ── STAMP (left-aligned) ─────────────────────────────────────────────────
    const stamp = new Image();
    stamp.src = 'assets/stamp.jpeg';

    await new Promise<void>((resolve) => {
      stamp.onload = () => {
        doc.addImage(stamp, 'PNG', L, y, 25, 25);
        resolve();
      };
      stamp.onerror = () => resolve();
    });

    y += 27;

    // ── REGARDS (left-aligned) ────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text('Regards,', L, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('For NAVBHARAT INSULATION & ENGG CO', L, y);

    // ── TERMS & CONDITIONS + ATTACHMENTS (new page) ──────────────────────────
    const termsText: string = (offer.terms || '').trim();
    const allAttachments: any[] = offer.attachments || [];
    // Split: images get embedded as pages; other files download separately
    const imageAtts = allAttachments.filter((a: any) => (a.type || '').startsWith('image/'));
    const otherAtts  = allAttachments.filter((a: any) => !(a.type || '').startsWith('image/'));

    if (termsText || allAttachments.length) {
      doc.addPage();
      let ty = 20;

      if (termsText) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text('Terms & Conditions', L, ty); ty += 7;
        doc.setLineWidth(0.3);
        doc.line(L, ty, pageWidth - L, ty); ty += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const termsLines = doc.splitTextToSize(termsText, pageWidth - 2 * L);
        doc.text(termsLines, L, ty);
        ty += termsLines.length * 4.5 + 8;
      }

      // ── ENCLOSED WITHIN list (plain text — no broken data: links) ─────────
      if (allAttachments.length) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text('Enclosed Within:', L, ty); ty += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        allAttachments.forEach((att: any, idx: number) => {
          doc.setTextColor(0);
          doc.text(`${idx + 1}. ${att.name}`, L + 4, ty);
          ty += 5;
        });
      }

      // Footer on T&C page
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80);
      doc.text(
        'A.N. HOUSE, TPS III, 31ST RD, LINKING RD, BANDRA, MUMBAI, MAHARASHTRA, INDIA 400050',
        pageWidth / 2, pageHeight - 10, { align: 'center' }
      );
      doc.text(
        'E MAIL: info@navbharatgroup.com   URL: www.navbharatgroup.com',
        pageWidth / 2, pageHeight - 5, { align: 'center' }
      );
    }

    // ── EMBED IMAGE ATTACHMENTS — each on its own page ────────────────────────
    for (const att of imageAtts) {
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = att.data;
        });
        const maxW = pageWidth - 2 * L;
        const ratio = img.naturalHeight / img.naturalWidth;
        const drawH = Math.min(maxW * ratio, pageHeight - 30);
        const drawW = drawH / ratio;
        const fmtMatch = (att.data as string).match(/^data:image\/([a-zA-Z]+)/);
        const fmt = fmtMatch ? fmtMatch[1].toUpperCase() : 'PNG';
        doc.addPage();
        doc.addImage(att.data, fmt, L + (maxW - drawW) / 2, 15, drawW, drawH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(80);
        doc.text(
          'A.N. HOUSE, TPS III, 31ST RD, LINKING RD, BANDRA, MUMBAI, MAHARASHTRA, INDIA 400050',
          pageWidth / 2, pageHeight - 10, { align: 'center' }
        );
        doc.text(
          'E MAIL: info@navbharatgroup.com   URL: www.navbharatgroup.com',
          pageWidth / 2, pageHeight - 5, { align: 'center' }
        );
        doc.setTextColor(0);
      } catch { /* skip image if loading fails */ }
    }

    // ── FOOTER on page 1 (centered, fixed at page bottom) ────────────────────
    doc.setPage(1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    doc.text(
      'A.N. HOUSE, TPS III, 31ST RD, LINKING RD, BANDRA, MUMBAI, MAHARASHTRA, INDIA 400050',
      pageWidth / 2, pageHeight - 10, { align: 'center' }
    );
    doc.text(
      'E MAIL: info@navbharatgroup.com   URL: www.navbharatgroup.com',
      pageWidth / 2, pageHeight - 5, { align: 'center' }
    );

    doc.save(`Offer_${ref}.pdf`);

    // ── DOWNLOAD NON-IMAGE ATTACHMENTS AS SEPARATE FILES ─────────────────────
    // (PDFs, Excel, Word etc. can't be embedded in jsPDF — download them individually)
    otherAtts.forEach((att: any, i: number) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = att.data;
        a.download = att.fileName || att.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, (i + 1) * 700); // stagger each by 700ms so browser doesn't block them
    });

    this.closeOfferLetterModal();
  }

  async saveOfferLetterToOffer() {
    if (!this.selectedOffer) return;

    const isNewOffer = !this.selectedOffer.id;

    Object.assign(this.selectedOffer, {
      material:      this.offerLetter['material'],
      density:       this.offerLetter['density'],
      thickness:     this.offerLetter['thickness'],
      size:          this.offerLetter['size'],
      quantity:      this.offerLetter['quantity'],
      rate:          this.offerLetter['rate'],
      taxes:         this.offerLetter['taxes'],
      freight:       this.offerLetter['freight'],
      inspection:    this.offerLetter['inspection'],
      packing:       this.offerLetter['packing'],
      loading:       this.offerLetter['loading'],
      deliveryTerms: this.offerLetter['deliveryTerms'],
      paymentTerms:  this.offerLetter['paymentTerms'],
      validity:      this.offerLetter['validity']
    });

    if (isNewOffer) {
      const previewRef = await this.generatePreviewOfferId();
      const newId = await this.apiService.add('offers', this.toDbRow({
        ...this.selectedOffer,
        offerRef: previewRef,
        date: new Date().toISOString().slice(0, 10),
        status: 'active'
      }));
      this.selectedOffer.id = newId;
      this.selectedOffer.offerRef = previewRef;
      await this.addReminder({
        type: 'offer',
        name: this.selectedOffer.customerName || '',
        referenceNo: previewRef,
        daysFromNow: 2,
        note: `Follow up on offer ${previewRef}`,
      });
    } else {
      await this.apiService.put('offers', this.toDbRow(this.selectedOffer));
    }
    await this.loadOffers();
  }

  getFollowUpDate(days: number = 2): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* ── Row expansion ─────────────────────────────────────── */
  expandedOfferId: string | null = null;

  toggleExpand(offerId: string) {
    this.expandedOfferId = this.expandedOfferId === offerId ? null : offerId;
  }

  /* ── C28: Follow-ups (Under Negotiation) ──────────────── */
  addFollowUp(offer: any) {
    if (!offer.followUps) offer.followUps = [];
    offer.followUps.push({
      date: new Date().toISOString().slice(0, 10),
      mode: '',
      contactPersonName: '',
      contactPersonNumber: '',
      remarks: '',
      nextFollowUpDate: ''
    });
  }

  async saveFollowUps(offer: any) {
    await this.apiService.put('offers', this.toDbRow(offer));
  }

  removeFollowUp(offer: any, idx: number) {
    offer.followUps.splice(idx, 1);
  }

  /* ── C29/C30: Order Received checkboxes & PI ─────────── */
  async updateOfferField(offer: any, field: string, value: any) {
    (offer as any)[field] = value;
    await this.apiService.put('offers', this.toDbRow(offer));
  }

  generatePIFromOffer(offer: any) {
    this.router.navigate(['/proforma-invoice'], { state: { fromOffer: offer } });
  }

  addPaymentDetail(offer: any) {
    if (!offer.paymentDetails) offer.paymentDetails = [];
    offer.paymentDetails.push({ mode: 'Online', amount: 0, date: new Date().toISOString().slice(0, 10) });
  }

  removePaymentDetail(offer: any, idx: number) {
    offer.paymentDetails.splice(idx, 1);
  }

  async savePaymentDetails(offer: any) {
    await this.apiService.put('offers', this.toDbRow(offer));
  }

  /* ── C36: Order Lost reasons table ───────────────────── */
  addLostDetail(offer: any) {
    if (!offer.lostDetails) offer.lostDetails = [];
    offer.lostDetails.push({ date: new Date().toISOString().slice(0, 10), reason: '', price: '', competitor: '' });
  }

  removeLostDetail(offer: any, idx: number) {
    offer.lostDetails.splice(idx, 1);
  }

  async saveLostDetails(offer: any) {
    await this.apiService.put('offers', this.toDbRow(offer));
  }

  /* ── C37: Regret remarks ──────────────────────────────── */
  async saveRegretRemarks(offer: any) {
    await this.apiService.put('offers', this.toDbRow(offer));
  }

  /* ── C15: Acknowledgement — Send to Customer ─────────── */
  sendAcknowledgement(offer: any) {
    const customer = offer.customerSnapshot;
    const primaryEmail  = customer?.primaryContact?.email || customer?.email || '';
    const secondaryEmail = customer?.secondaryContact?.email || '';
    const subject = encodeURIComponent(`Order Acknowledgement — ${offer.offerRef || ''}`);
    const body = encodeURIComponent(
      `Dear ${offer.customerName || 'Sir/Ma\'am'},\n\nWe acknowledge receipt of your order against our offer ${offer.offerRef || ''}.\n\nThank you for your business.\n\nRegards,\nNavbharat Insulation & Engg Co`
    );
    const cc = secondaryEmail ? `&cc=${encodeURIComponent(secondaryEmail)}` : '';
    window.open(`mailto:${primaryEmail}?subject=${subject}${cc}&body=${body}`);
  }

  /* ── C15: PO Copy Attachments ───────────────────────── */
  addPoCopyAttachment(offer: any, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    if (!offer.poCopyAttachments) offer.poCopyAttachments = [];
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      offer.poCopyAttachments.push({ name: file.name, type: file.type, data: e.target.result });
      await this.apiService.put('offers', this.toDbRow(offer));
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  async removePoCopyAttachment(offer: any, idx: number) {
    offer.poCopyAttachments.splice(idx, 1);
    await this.apiService.put('offers', this.toDbRow(offer));
  }

  /* ── C21: Send offer via email ────────────────────────── */
  showEmailModal = false;
  emailForm: any = { to: '', cc: '', bcc: '', subject: '', body: '' };

  async openEmailModal(offer: any) {
    this.selectedOffer = offer;
    const customer = offer.customerSnapshot;
    // Pull email from primary contact → secondary contact → direct email field
    const primaryEmail  = customer?.primaryContact?.email || '';
    const secondaryEmail = customer?.secondaryContact?.email || '';
    const directEmail   = customer?.email || '';
    const toEmail  = primaryEmail  || directEmail || '';
    const ccEmail  = secondaryEmail || 'ak@navbharatgroup.com';
    this.emailForm = {
      to: toEmail,
      cc: ccEmail,
      bcc: 'rs@navbharatgroup.com',
      subject: `Your enquiry for supply of ${this.getOfferItemNames(offer)}`,
      body: `Dear ${offer.customerName || 'Sir/Ma\'am'},\n\nPlease find attached our offer ${offer.offerRef || ''} for your kind consideration.\n\nRegards,\nNavbharat Insulation & Engg Co`
    };
    this.showEmailModal = true;
  }

  closeEmailModal() {
    this.showEmailModal = false;
  }

  async sendOfferEmail() {
    const { to, cc, bcc, subject, body } = this.emailForm;
    const params = new URLSearchParams();
    if (cc)  params.set('cc',  cc);
    if (bcc) params.set('bcc', bcc);
    params.set('subject', subject);
    params.set('body', body);
    window.open(`mailto:${to}?${params.toString()}`);

    if (this.selectedOffer) {
      this.selectedOffer.sentAt = new Date().toISOString();
      await this.apiService.put('offers', this.toDbRow(this.selectedOffer));
      await this.loadOffers();
    }
    this.closeEmailModal();
  }

  /* ── C14: Sent indicator in history ──────────────────── */
  isOfferSent(offer: any): boolean {
    return !!offer?.sentAt;
  }

  /* ── C34: Send Sales Order via email ─────────────────── */
  showSoEmailDropdown = false;
  soEmailPresets = ['ak@navbharatgroup.com', 'rs@navbharatgroup.com'];

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
