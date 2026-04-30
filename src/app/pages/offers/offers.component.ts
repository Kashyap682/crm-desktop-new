import { Component, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { DBService } from '../../service/db.service';
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
  inquiries: any[] = [];
  showViewModal = false;
  selectedOffer: any = null;

  showPdfFormModal: boolean = false;
  selectedSubjectItem: any = null;

  // Status filter
  selectedStatus: string = '';
  statusOptions = [
    { value: '', label: 'All Offers' },
    { value: 'under_negotiation', label: 'Under Negotiation' },
    { value: 'order_received', label: 'Order Received' },
    { value: 'order_lost', label: 'Order Lost' },
    { value: 'rejected', label: 'Rejected' }
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

  constructor(private router: Router, private dbService: DBService) {
    this.loadOffers();
    this.loadInquiries();
  }

  async loadInquiries() {
    this.inquiries = await this.dbService.getAll('inquiries');
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
    const decisionMap: Record<string, string> = {
      'under_negotiation': 'Under Negotiation',
      'order_received':    'Order Received',
      'order_lost':        'Order Lost',
      'rejected':          'Rejected'
    };
    const decision = decisionMap[tabValue];
    if (!decision) return [];
    const offeredInquiryIds = new Set(
      this.offers
        .map((o: any) => this.toInquiryId(o.inquiryNo ?? o.inquiryId ?? o.inquiryRef))
        .filter((id: any) => id != null)
    );
    return this.inquiries.filter(
      (inq: any) => inq.decision === decision && !offeredInquiryIds.has(this.toInquiryId(inq.id))
    );
  }

  openCreateOfferFromInquiry(inq: any) {
    this.router.navigate(['/create-offer'], { state: { inquiry: inq } });
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

    const inventory = await this.dbService.getAll('inventory');

    const itemName = item.name.toLowerCase();

    const matches = inventory.filter((inv: any) => {
      const invName = (inv.displayName || inv.name || '').toLowerCase();
      return invName === itemName;
    });

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    return matches[0];
  }

  async onSubjectProductChange(item: any) {
    if (!item) return;

    this.selectedSubjectItem = item;

    this.offerLetter.subjectProduct = item.name || '';
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
    const data = await this.dbService.getAll('offers');
    data.forEach((row: any) => {
      if (!row.offerRef && row.id) row.offerRef = this.generateOfferRef(row.id);
    });
    this.offers = data.filter((o: any) => o.status !== 'superseded').reverse();
  }

  get filteredOffers(): any[] {
    if (!this.selectedStatus) return this.offers;
    return this.offers.filter((o: any) => o.offerStatus === this.selectedStatus);
  }

  getStatusCount(status: string): number {
    if (!status) return this.offers.length;
    return this.offers.filter((o: any) => o.offerStatus === status).length;
  }

  async updateOfferStatus(offer: any, status: string) {
    offer.offerStatus = status;
    await this.dbService.put('offers', offer);

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
        const allInquiries = await this.dbService.getAll('inquiries');
        const offerInquiryId = this.toInquiryId(offer.inquiryNo);
        const inq = allInquiries.find((i: any) => this.toInquiryId(i.id) === offerInquiryId);
        if (inq) {
          inq.decision = decision;
          await this.dbService.put('inquiries', inq);
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
    const allOffers: any[] = await this.dbService.getAll('offers');
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

  createSalesOrderFromOffer(offer: any) {
    this.router.navigate(['/sales-order'], { state: { offer } });
  }

  generateOfferRef(id: number) {
    const y = new Date().getFullYear();
    return `NIEC/MDD/${y}/${String(id).padStart(4, '0')}`;
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

  async deleteOffer(id: number) {
    await this.dbService.delete('offers', id);
    await this.loadOffers();
  }

  async openOfferLetterModal() {
    // ✅ Date formatted as dd/mm/yy
    this.offerLetter['date'] = this.formatTodayDDMMYY();

    if (this.selectedOffer) {
      let inquiryData: any = null;
      if (this.selectedOffer.inquiryNo) {
        try {
          inquiryData = await this.dbService.getById('inquiries', this.selectedOffer.inquiryNo);
        } catch (error) {
          console.log('⚠️ Could not load inquiry:', error);
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
        this.offerLetter['freight'] = `Rs. ${this.selectedOffer.freightCharges}`;
      }

      if (inquiryData && this.selectedOffer.items && this.selectedOffer.items.length > 0) {
        const firstItem = this.selectedOffer.items[0];

        if (!this.offerLetter['material'] && firstItem.name) {
          this.offerLetter['material'] = firstItem.name;
        }

        if (inquiryData.items && inquiryData.items.length > 0) {
          const inquiryItem = inquiryData.items[0];

          if (!this.offerLetter['density'] && inquiryItem.density) {
            this.offerLetter['density'] = inquiryItem.density;
          }

          if (!this.offerLetter['thickness'] && inquiryItem.thickness) {
            this.offerLetter['thickness'] = inquiryItem.thickness;
          }

          if (!this.offerLetter['size'] && inquiryItem.form) {
            this.offerLetter['size'] = inquiryItem.form;
          }
        }

        if (!this.offerLetter['quantity']) {
          const totalQty = this.selectedOffer.items.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
          const firstItemUOM = inquiryData?.items?.[0]?.uom || 'Units';
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

    if (this.selectedOffer?.items?.length && !this.selectedSubjectItem) {
      this.onSubjectProductChange(this.selectedOffer.items[0]);
    }

    this.showPdfFormModal = true;
  }

  closeOfferLetterModal() {
    this.showPdfFormModal = false;
  }

  async getCustomerByName(name: string) {
    return this.dbService.getCustomerByName(name);
  }

  async createOfferFollowUpReminder(offer: any) {
    try {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 3);
      followUpDate.setHours(0, 0, 0, 0);

      const reminder = {
        date: followUpDate.toISOString().slice(0, 10),
        time: '10:00',
        type: 'offer',
        source: 'system',
        status: 'pending',
        name: offer.customerName || '',
        mobile: '',
        referenceNo: offer.offerRef || this.generateOfferRef(offer.id),
        note: `Offer follow-up for ${offer.offerRef}`,
        createdAt: new Date().toISOString()
      };

      await this.dbService.add('reminders', reminder);
    } catch (e) {
      console.error('❌ Failed to create offer reminder', e);
    }
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
    if (val('size'))          rows.push(['Size',           val('size')]);
    if (val('quantity'))      rows.push(['Quantity',       val('quantity')]);

    // Rate — final rate incl. GST (grandTotal ÷ total qty)
    const grandTotal = offer.grandTotal;
    const totalQty = (offer.items || []).reduce((s: number, i: any) => s + (i.qty || 0), 0);
    if (grandTotal && totalQty > 0) {
      rows.push(['Rate', `Rs. ${(grandTotal / totalQty).toFixed(2)} per unit`]);
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

    // ── FOOTER (centered, fixed at page bottom) ───────────────────────────────
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
    this.closeOfferLetterModal();
  }

  async saveOfferLetterToOffer() {
    if (!this.selectedOffer) return;

    const isNewOffer = !this.selectedOffer.id;

    Object.assign(this.selectedOffer, {
      material: this.offerLetter['material'],
      density: this.offerLetter['density'],
      thickness: this.offerLetter['thickness'],
      size: this.offerLetter['size'],
      quantity: this.offerLetter['quantity'],
      rate: this.offerLetter['rate'],
      taxes: this.offerLetter['taxes'],
      freight: this.offerLetter['freight'],
      inspection: this.offerLetter['inspection'],
      packing: this.offerLetter['packing'],
      loading: this.offerLetter['loading'],
      deliveryTerms: this.offerLetter['deliveryTerms'],
      paymentTerms: this.offerLetter['paymentTerms'],
      validity: this.offerLetter['validity']
    });

    if (isNewOffer) {
      const newId = await this.dbService.add('offers', this.selectedOffer);
      this.selectedOffer.id = newId;
      this.selectedOffer.offerRef = this.generateOfferRef(newId);
      await this.createOfferReminder(this.selectedOffer);
    } else {
      await this.dbService.put('offers', this.selectedOffer);
    }
    await this.loadOffers();
  }

  async createOfferReminder(offer: any) {
    const reminder = {
      date: this.getFollowUpDate(2),
      time: '10:00',
      type: 'offer',
      name: offer.customerName || '',
      mobile: '',
      referenceNo: offer.offerRef || '',
      note: `Follow up for offer ${offer.offerRef}`,
      source: 'system',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await this.dbService.add('reminders', reminder);
  }

  getFollowUpDate(days: number = 2): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
