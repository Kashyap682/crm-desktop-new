import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { ConfirmService } from '../../service/confirm.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-purchase-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.css']
})
export class PurchaseOrderComponent implements OnInit {

  showSubjectPopup = false;
  coverLetterSubject = '';

  vendors: any[] = [];
  inventoryItems: any[] = [];
  selectedVendorId: string | null = null;

  /* ================= UI STATE ================= */
  showForm = false;

  /* ================= STATUS ================= */
  purchaseOrderStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT';

  /* ================= STORAGE ================= */
  draftPOs: any[] = [];
  submittedPOs: any[] = [];
  approvedPOs: any[] = [];
  editingPO: any = null;

  /* ================= FORM FIELDS ================= */
  poNumber = '';
  poDate = '';
  inquiryRef = '';
  vendorName = '';
  vendorId = '';
  offerRef = '';
  billingAddress = '';
  deliveryAddress = '';
  vendorGST = '';

  contactPerson = '';
  contactInfo = '';

  paymentTerms = 'Advance';
  creditDays: number | null = null;

  requirementRef = '';
  quotationRef = '';
  quotationDate = '';

  /* ================= DATA ================= */
  allInquiries: any[] = [];
  allOffers: any[] = [];

  /* ================= GRR ================= */
  showGRRModal = false;
  grrForm: any = {};

  freightCharges = 0;
  advanceReceived = 0;

  expectedDeliveryDate = '';
  deliveryTerms = 'FOB';
  transporterName = '';
  transportMode = 'Road';
  deliveryLocation = 'Warehouse';

  /* ================= ITEMS ================= */
  items: any[] = [
    { item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 18, total: 0 }
  ];

  /* ================= FILES ================= */
  files: File[] = [];
  isDragActive = false;

  /* ================= UI HELPERS ================= */
  get draftOrders() { return this.draftPOs; }
  get submittedOrders() { return this.submittedPOs; }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(po: any): any {
    const row: any = {
      po_ref:                 po.poNumber              || null,
      po_date:                po.poDate                || null,
      inquiry_ref:            po.inquiryRef            || null,
      vendor_name:            po.vendorName            || null,
      vendor_ref:             po.vendorId              || null,
      offer_ref:              po.offerRef              || null,
      billing_address:        po.billingAddress        || null,
      delivery_address:       po.deliveryAddress       || null,
      vendor_gst:             po.vendorGST             || null,
      contact_person:         po.contactPerson         || null,
      contact_info:           po.contactInfo           || null,
      payment_terms:          po.paymentTerms          || null,
      credit_days:            po.creditDays            ?? null,
      delivery_terms:         po.deliveryTerms         || null,
      expected_delivery_date: po.expectedDeliveryDate  || null,
      transporter_name:       po.transporterName       || null,
      transport_mode:         po.transportMode         || null,
      delivery_location:      po.deliveryLocation      || null,
      items:                  po.items                 ?? [],
      freight_charges:        po.freightCharges        ?? 0,
      grand_total:            po.grandTotal            ?? 0,
      status:                 po.status                || 'DRAFT',
    };
    if (po.id) row.id = po.id;
    return row;
  }

  private fromDbRow(row: any): any {
    return {
      id:                   row.id,
      poNumber:             row.po_ref               || '',
      poDate:               row.po_date              || '',
      inquiryRef:           row.inquiry_ref          || '',
      vendorName:           row.vendor_name          || '',
      vendorId:             row.vendor_ref           || '',
      offerRef:             row.offer_ref            || '',
      billingAddress:       row.billing_address      || '',
      deliveryAddress:      row.delivery_address     || '',
      vendorGST:            row.vendor_gst           || '',
      contactPerson:        row.contact_person       || '',
      contactInfo:          row.contact_info         || '',
      paymentTerms:         row.payment_terms        || 'Advance',
      creditDays:           row.credit_days          ?? null,
      deliveryTerms:        row.delivery_terms       || 'FOB',
      expectedDeliveryDate: row.expected_delivery_date || '',
      transporterName:      row.transporter_name     || '',
      transportMode:        row.transport_mode       || 'Road',
      deliveryLocation:     row.delivery_location    || 'Warehouse',
      items:                Array.isArray(row.items) ? row.items : [],
      freightCharges:       row.freight_charges      ?? 0,
      grandTotal:           row.grand_total          ?? 0,
      status:               row.status               || 'DRAFT',
    };
  }

  private mapVendor(row: any): any {
    return {
      id:              row.id,
      vendorId:        row.vendor_ref      || '',
      companyName:     row.company_name    || '',
      gst:             row.gst             || '',
      primaryContact:  row.primary_contact || {},
      officeAddress:   row.office_address  || {},
      billing:         row.billing         || {},
      billingAddress:  row.billing         || {},
      shipping:        row.shipping        || {},
      shippingAddress: row.shipping        || {},
      mobile:          row.mobile          || '',
      email:           row.email           || '',
    };
  }

  private mapInquiry(row: any): any {
    const refMatch = (row.inquiry_ref || '').match(/INQ-(\d+)/i);
    const seqId = refMatch ? parseInt(refMatch[1], 10) : (row.seq_no ?? null);
    return {
      _uuid:        row.id,
      id:           seqId,
      companyName:  row.company_name  || '',
      customerName: row.customer_name || '',
      date:         row.date          || '',
      items:        Array.isArray(row.items) ? row.items : [],
      freight:      row.freight       ?? 0,
      freightCharges: row.freight_charges ?? 0,
      inquiryRef:   row.inquiry_ref   || '',
    };
  }

  private mapOffer(row: any): any {
    return {
      id:              row.id,
      offerRef:        row.offer_ref       || '',
      offerStatus:     row.offer_status    || '',
      status:          row.status          || 'active',
      inquiryNo:       row.inquiry_no      ?? null,
      customerName:    row.customer_name   || '',
      items:           Array.isArray(row.items) ? row.items : [],
      paymentTerms:    row.payment_terms   || '',
      freightCharges:  row.freight_charges ?? 0,
      deliveryTerms:   row.delivery_terms  || '',
      gstType:         row.gst_type        || 'cgst_sgst',
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

  constructor(
    private router: Router,
    private apiService: ApiService,
    private toastService: ToastService,
    private confirmService: ConfirmService
  ) { }

  async ngOnInit() {
    await this.loadPurchaseOrders();
    await this.loadVendors();

    const [inqRows, offerRows, invRows] = await Promise.all([
      this.apiService.getAll('inquiries').catch(() => []),
      this.apiService.getAll('offers').catch(() => []),
      this.apiService.getAll('inventory').catch(() => []),
    ]);
    this.allInquiries = inqRows.map((r: any) => this.mapInquiry(r));
    this.allOffers = offerRows.map((r: any) => this.mapOffer(r));

    this.inventoryItems = invRows;

    // Auto-fill from inquiry + offer navigation state
    const navState = (history.state || {}) as any;
    if (navState?.inquiry) {
      const inq = navState.inquiry;
      const offer = navState.offer || null;
      this.generatePoNumber();
      this.resetForm();
      this.showForm = true;

      const displayId = this.getDisplayInquiryId(inq.id);
      this.inquiryRef = displayId;

      if (offer) {
        this.offerRef = offer.offerRef || '';
        if (offer.paymentTerms) this.paymentTerms = offer.paymentTerms;
        if (offer.freightCharges) this.freightCharges = offer.freightCharges;
        if (offer.items && offer.items.length > 0) {
          const allItems: any[] = this.inventoryItems;
          this.items = offer.items.map((it: any, idx: number) => {
            const inqItem = inq.items?.[idx];
            const itemName = (it.name || it.productName || '').toLowerCase().trim();
            const invItem = allItems.find((p: any) => {
              const invName = (p.displayName || p.name || '').toLowerCase().trim();
              return invName.includes(itemName) || itemName.includes(invName);
            });
            const line = {
              item: it.name || it.productName || '',
              qty: it.qty || 1,
              uom: it.uom || inqItem?.uom || invItem?.unit || '',
              hsn: it.hsn || '',
              rate: it.rate ?? 0,
              disc: 0,
              discountType: '₹',
              gst: it.gst ?? 18,
              total: 0
            };
            this.recalculateLine(line);
            return line;
          });
        }
      } else {
        this.onInquiryRefSelect(displayId);
      }
    }
  }

  private getDisplayInquiryId(id?: number): string {
    if (!id) return '';
    return `INQ-${String(id).padStart(3, '0')}`;
  }

  /* ================= BASIC ACTIONS ================= */

  createNewPO() {
    this.generatePoNumber();
    this.resetForm();
    this.showForm = true;
  }

  private generatePoNumber() {
    const all = [...this.draftPOs, ...this.submittedPOs, ...this.approvedPOs];
    let maxNum = 0;
    all.forEach(po => {
      const match = (po.poNumber || '').match(/^PO-(\d{1,4})$/i);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
    });
    this.poNumber = `PO-${String(maxNum + 1).padStart(3, '0')}`;
  }

  resetForm() {
    if (!this.poNumber) this.poNumber = 'PO-001';
    this.purchaseOrderStatus = 'DRAFT';
    this.items = [
      { item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 18, total: 0 }
    ];
    this.selectedVendorId = null;
    this.vendorName = '';
    this.vendorId = '';
    this.vendorGST = '';
    this.billingAddress = '';
    this.deliveryAddress = '';
    this.contactPerson = '';
    this.contactInfo = '';
    this.inquiryRef = '';
    this.offerRef = '';
    this.files = [];
  }

  goBackToList() {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/purchase-order']);
    });
  }

  /* ================= ITEM LOGIC ================= */

  addLine() {
    this.items.push({ item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 18, total: 0 });
  }

  removeLine(i: number) {
    this.items.splice(i, 1);
  }

  recalculateLine(line: any) {
    let base = line.qty * line.rate;
    let discount = line.discountType === '%' ? base * (line.disc / 100) : line.disc;
    let taxable = base - discount;
    let tax = taxable * (line.gst / 100);
    line.total = taxable + tax;
  }

  getSubtotal() {
    return this.items.reduce((a, b) => a + (b.qty * b.rate), 0);
  }

  getTaxTotal() {
    return this.items.reduce((a, b) => a + ((b.qty * b.rate - b.disc) * (b.gst / 100)), 0);
  }

  getGrandTotal() {
    return this.items.reduce((a, b) => a + b.total, 0) + (this.freightCharges || 0);
  }

  onPaymentTermsChange(val: string) {
    if (val !== 'Credit') this.creditDays = null;
  }

  /* ================= FILE HANDLING ================= */

  onFilesSelected(event: any) {
    this.files.push(...event.target.files);
  }

  removeFile(i: number) {
    this.files.splice(i, 1);
  }

  clearAllFiles() {
    this.files = [];
  }

  formatBytes(bytes: number) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  /* ================= GRR ================= */

  openGRRModal() {
    this.grrForm = {
      items: this.items.map((item: any) => ({
        materialDesc: [item.item, item.uom ? `(${item.uom})` : ''].filter(Boolean).join(' '),
        qtyInvoice: item.qty || 0,
        qtyReceived: item.qty || 0,
        selected: true,
      })),
      vendorName: this.vendorName,
      reportNo: `GRR-${this.poNumber}`,
      date: new Date().toISOString().split('T')[0],
      poNoDate: `${this.poNumber} / ${this.poDate}`,
      receivedOn: '',
      challanNo: '',
      weighingSlip: 'N/A',
      materialOk: 'N/A',
      damageOk: 'N/A',
      mtcAvailable: 'N/A',
      transporter: this.transporterName || '',
      lrNo: '',
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

      let logoLoaded = false;
      try {
        const logoBase64 = await this.loadLogoAsBase64('assets/Navbharat logo.png');
        doc.addImage(logoBase64, 'PNG', (pageWidth - 150) / 2, 0, 150, 30);
        logoLoaded = true;
      } catch { }

      const startY = logoLoaded ? 50 : 20;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('GOODS RECEIPT REPORT (GRR)', pageWidth / 2, startY, { align: 'center' });

      let y = startY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      doc.text(`Vendor Name: ${safe(g.vendorName)}`, margin, y);
      doc.text(`Report No: ${safe(g.reportNo)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`PO No & Date: ${safe(g.poNoDate)}`, margin, y);
      doc.text(`Date: ${safe(g.date)}`, pageWidth / 2, y);
      y += 7;
      doc.text(`Challan No: ${safe(g.challanNo)}`, margin, y);
      doc.text(`Material Received On: ${safe(g.receivedOn)}`, pageWidth / 2, y);
      y += 10;

      const selectedItems = (g.items || []).filter((it: any) => it.selected !== false);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Material Description', 'Qty (Invoice)', 'Qty Received']],
        body: selectedItems.map((it: any, idx: number) => [String(idx + 1), safe(it.materialDesc), String(it.qtyInvoice ?? ''), String(it.qtyReceived ?? '')]),
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' } },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      doc.text(`Weighing Slip: ${safe(g.weighingSlip)}`, margin, y); y += 7;
      doc.text(`Material Acceptable: ${safe(g.materialOk)}`, margin, y); y += 7;
      doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, margin, y); y += 10;
      doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, margin, y); y += 7;
      doc.text(`Transporter: ${safe(g.transporter)}`, margin, y); y += 7;
      doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, margin, y); y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y); y += 20;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y);
      doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y); y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);

      doc.save(`GRR_${safe(g.reportNo) || 'Report'}.pdf`);
      this.closeGRRModal();
    } catch (error) {
      console.error('❌ Error generating GRR:', error);
      this.toastService.error('Error generating GRR report');
    }
  }

  private loadLogoAsBase64(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error(`Failed to load: ${imagePath}`));
      img.src = imagePath;
    });
  }

  /* ================= WORKFLOW ================= */

  getCurrentPO() {
    return {
      poNumber: this.poNumber,
      poDate: this.poDate,
      inquiryRef: this.inquiryRef,
      vendorName: this.vendorName,
      vendorId: this.vendorId,
      offerRef: this.offerRef,
      billingAddress: this.billingAddress,
      deliveryAddress: this.deliveryAddress,
      vendorGST: this.vendorGST,
      contactPerson: this.contactPerson,
      contactInfo: this.contactInfo,
      paymentTerms: this.paymentTerms,
      creditDays: this.creditDays,
      deliveryTerms: this.deliveryTerms,
      expectedDeliveryDate: this.expectedDeliveryDate,
      transporterName: this.transporterName,
      transportMode: this.transportMode,
      deliveryLocation: this.deliveryLocation,
      grandTotal: this.getGrandTotal(),
      items: JSON.parse(JSON.stringify(this.items)),
      freightCharges: this.freightCharges,
      status: this.purchaseOrderStatus
    };
  }

  editDraft(po: any) {
    this.editingPO = po;
    this.poNumber = po.poNumber;
    this.poDate = po.poDate;
    this.inquiryRef = po.inquiryRef || '';
    this.vendorName = po.vendorName;
    this.vendorId = po.vendorId;
    this.offerRef = po.offerRef || '';
    this.billingAddress = po.billingAddress;
    this.deliveryAddress = po.deliveryAddress;
    this.vendorGST = po.vendorGST || '';
    this.contactPerson = po.contactPerson || '';
    this.contactInfo = po.contactInfo || '';
    this.expectedDeliveryDate = po.expectedDeliveryDate || '';
    this.deliveryTerms = po.deliveryTerms || 'FOB';
    this.transporterName = po.transporterName || '';
    this.transportMode = po.transportMode || 'Road';
    this.deliveryLocation = po.deliveryLocation || 'Warehouse';
    this.items = JSON.parse(JSON.stringify(po.items || []));
    if (!this.items.length) this.items = [{ item: '', qty: 1, uom: '', hsn: '', rate: 0, disc: 0, discountType: '₹', gst: 18, total: 0 }];
    this.freightCharges = po.freightCharges || 0;
    this.purchaseOrderStatus = po.status || 'DRAFT';
    this.showForm = true;
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = true;
    (ev.currentTarget as HTMLElement).classList.add('active');
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    (ev.currentTarget as HTMLElement).classList.remove('active');
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    (ev.currentTarget as HTMLElement).classList.remove('active');
    const dt = ev.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) this.addFilesFromFileList(dt.files);
  }

  private buildPurchaseOrderPayload(existing?: any) {
    const payload: any = {
      poNumber: this.poNumber,
      poDate: this.poDate,
      inquiryRef: this.inquiryRef,
      vendorName: this.vendorName,
      vendorId: this.vendorId,
      offerRef: this.offerRef,
      billingAddress: this.billingAddress,
      deliveryAddress: this.deliveryAddress,
      vendorGST: this.vendorGST,
      contactPerson: this.contactPerson,
      contactInfo: this.contactInfo,
      paymentTerms: this.paymentTerms,
      creditDays: this.creditDays,
      deliveryTerms: this.deliveryTerms,
      expectedDeliveryDate: this.expectedDeliveryDate,
      transporterName: this.transporterName,
      transportMode: this.transportMode,
      deliveryLocation: this.deliveryLocation,
      items: this.items,
      freightCharges: this.freightCharges,
      grandTotal: this.getGrandTotal(),
      status: this.purchaseOrderStatus,
    };
    if (existing?.id != null) payload.id = existing.id;
    return payload;
  }

  private addFilesFromFileList(list: FileList): void {
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i);
      if (!f) continue;
      const exists = this.files.some(existing => existing.name === f.name && existing.size === f.size);
      if (!exists) this.files.push(f);
    }
  }

  get inquiryOptions(): { label: string; value: string }[] {
    return this.allInquiries.map((inq: any) => {
      const num = String(inq.id || '').padStart(3, '0');
      const id = `INQ-${num}`;
      const company = inq.companyName || '';
      return { label: `${id} | ${company}`, value: id };
    });
  }

  onInquiryRefSelect(inquiryDisplayId: string) {
    if (!inquiryDisplayId) return;

    const match = inquiryDisplayId.match(/INQ-(\d+)/i);
    if (!match) return;
    const numId = parseInt(match[1], 10);
    const inq = this.allInquiries.find((i: any) => this.toInquiryId(i.id) === numId);
    if (!inq) return;

    const allItems: any[] = this.inventoryItems;

    if (inq.date) this.poDate = inq.date;

    if (inq.items && inq.items.length > 0) {
      this.items = inq.items.map((it: any) => {
        const productName = it.product || it.item || it.productName || '';
        const invItem = allItems.find((p: any) => {
          const invName = (p.displayName || p.name || '').toLowerCase().trim();
          const inqName = productName.toLowerCase().trim();
          return invName.includes(inqName) || inqName.includes(invName);
        });
        const line = {
          item: productName,
          qty: it.qty || 1,
          uom: it.uom || invItem?.uom || invItem?.unit || 'Nos',
          hsn: it.hsn || invItem?.hsn || '',
          rate: it.rate || invItem?.price || invItem?.rate || 0,
          disc: 0,
          discountType: '₹',
          gst: it.gst || 18,
          total: 0
        };
        this.recalculateLine(line);
        return line;
      });
    }

    const inqFreight = parseFloat(inq.freight || inq.freightCharges || 0);
    if (inqFreight > 0) this.freightCharges = inqFreight;

    const inqId = this.toInquiryId(inq.id);
    const relatedOffer = this.allOffers.find((o: any) =>
      this.toInquiryId(o.inquiryNo) === inqId && o.status !== 'superseded'
    );

    if (relatedOffer) {
      this.offerRef = relatedOffer.offerRef || '';
      if (relatedOffer.paymentTerms) this.paymentTerms = relatedOffer.paymentTerms;
      if (!inqFreight) {
        const offerFreight = parseFloat(relatedOffer.freightCharges || 0);
        if (offerFreight > 0) this.freightCharges = offerFreight;
      }
      if (relatedOffer.items && relatedOffer.items.length > 0) {
        const hasItems = this.items.length > 0 && this.items.some((x: any) => x.item);
        if (hasItems) {
          this.items.forEach((line: any, idx: number) => {
            if (!line.rate && relatedOffer.items[idx]) {
              line.rate = relatedOffer.items[idx].rate || 0;
              this.recalculateLine(line);
            }
          });
        } else {
          this.items = relatedOffer.items.map((it: any) => {
            const line = {
              item: it.name || it.item || it.productName || '',
              qty: it.qty || 1,
              uom: it.uom || '',
              hsn: it.hsn || '',
              rate: it.rate || 0,
              disc: it.disc || 0,
              discountType: it.discountType || '₹',
              gst: it.gst || 18,
              total: it.total || 0
            };
            this.recalculateLine(line);
            return line;
          });
        }
      }
    } else {
      this.offerRef = '';
    }
  }

  onVendorSelect(vendorId: string | null) {
    if (!vendorId) return;

    const v: any = this.vendors.find((x: any) => x.vendorId === vendorId);
    if (!v) return;

    const pc = v.primaryContact || {};
    const offAddr = v.officeAddress || {};

    this.vendorName = v.companyName || '';
    this.vendorId = v.vendorId || '';
    this.vendorGST = v.gst || offAddr.gstin || '';

    const pcTitle = pc.title ? pc.title.replace(/\.?$/, '.') : '';
    const pcName = [pcTitle, pc.firstName, pc.lastName].filter(Boolean).join(' ').trim();
    this.contactPerson = pcName || offAddr.contactPerson || '';

    const mobile = pc.mobile || offAddr.mobile || v.mobile || '';
    const email = pc.email || offAddr.email || v.email || '';
    this.contactInfo = [mobile, email].filter(Boolean).join(' / ');

    const billing = v.billingAddress || v.billing || v.officeAddress || {};
    const shippingRaw = v.shippingAddress || v.shipping || {};
    const hasShipping = !!(shippingRaw.line1 || shippingRaw.street || shippingRaw.address ||
      shippingRaw.line2 || shippingRaw.area || shippingRaw.city);

    this.billingAddress = this.formatVendorAddress(billing);
    this.deliveryAddress = hasShipping
      ? this.formatVendorAddress(shippingRaw)
      : this.formatVendorAddress(v.officeAddress || billing);
  }

  private formatVendorAddress(addr: any): string {
    if (!addr) return '';
    return [
      addr.line1 || addr.street || addr.address,
      addr.line2 || addr.area,
      addr.city || addr.cityName,
      addr.state,
      addr.pincode || addr.pinCode,
      addr.country
    ].filter(Boolean).join(', ');
  }

  async loadVendors() {
    try {
      const rows = await this.apiService.getAll('vendors');
      this.vendors = rows.map((r: any) => this.mapVendor(r));
    } catch (error) {
      console.error('❌ Failed to load vendors:', error);
      this.vendors = [];
    }
  }

  async loadPurchaseOrders() {
    try {
      const rows = await this.apiService.getAll('purchaseOrders');
      const all = rows.map((r: any) => this.fromDbRow(r));
      this.draftPOs = all.filter((o: any) => o.status === 'DRAFT');
      this.submittedPOs = all.filter((o: any) => o.status === 'SUBMITTED');
      this.approvedPOs = all.filter((o: any) => o.status === 'APPROVED');
    } catch (error) {
      console.error('❌ Failed to load purchase orders:', error);
    }
  }

  private getPurchaseOrderByNo(poNumber: string): any | null {
    const all = [...this.draftPOs, ...this.submittedPOs, ...this.approvedPOs];
    return all.find(o => o.poNumber === poNumber) || null;
  }

  async saveDraft() {
    this.purchaseOrderStatus = 'DRAFT';
    const payload = this.buildPurchaseOrderPayload(this.editingPO);
    try {
      await this.apiService.put('purchaseOrders', this.toDbRow(payload));
      await this.loadPurchaseOrders();
      this.editingPO = null;
      this.toastService.success('Purchase Order saved as Draft');
    } catch (error) {
      console.error('❌ Failed to save draft:', error);
      this.toastService.error('Failed to save Purchase Order');
    }
  }

  async submitPO() {
    this.purchaseOrderStatus = 'SUBMITTED';
    const existing = this.editingPO ?? this.getPurchaseOrderByNo(this.poNumber);
    const payload = this.buildPurchaseOrderPayload(existing);
    try {
      await this.apiService.put('purchaseOrders', this.toDbRow(payload));
      await this.loadPurchaseOrders();
      this.editingPO = null;
      this.toastService.success('Purchase Order submitted');
    } catch (error) {
      console.error('❌ Failed to submit PO:', error);
      this.toastService.error('Failed to submit Purchase Order');
    }
  }

  async approvePO() {
    this.purchaseOrderStatus = 'APPROVED';
    const existing = this.editingPO ?? this.getPurchaseOrderByNo(this.poNumber);
    const payload = this.buildPurchaseOrderPayload(existing);
    try {
      await this.apiService.put('purchaseOrders', this.toDbRow(payload));
      await this.loadPurchaseOrders();
      this.editingPO = null;
      this.toastService.success('Purchase Order approved');
    } catch (error) {
      console.error('❌ Failed to approve PO:', error);
      this.toastService.error('Failed to approve Purchase Order');
    }
  }

  async approveFromTable(po: any) {
    try {
      await this.apiService.put('purchaseOrders', this.toDbRow({ ...po, status: 'APPROVED' }));
      await this.loadPurchaseOrders();
      this.toastService.success('Purchase Order approved');
    } catch (error) {
      console.error('❌ Failed to approve PO:', error);
      this.toastService.error('Failed to approve Purchase Order');
    }
  }

  async saveFromTable(po: any) {
    try {
      await this.apiService.put('purchaseOrders', this.toDbRow({ ...po, status: 'SUBMITTED' }));
      await this.loadPurchaseOrders();
      this.toastService.success('Purchase Order saved');
    } catch (error) {
      console.error('❌ Failed to save PO:', error);
      this.toastService.error('Failed to save Purchase Order');
    }
  }

  openGRRModalForPO(po: any) {
    this.editDraft(po);
    this.openGRRModal();
  }

  async deleteDraft(po: any) {
    if (!await this.confirmService.confirm(`Delete Purchase Order ${po.poNumber}?`, { danger: true })) return;
    try {
      await this.apiService.delete('purchaseOrders', po.id);
      await this.loadPurchaseOrders();
      this.toastService.success('Purchase Order deleted');
    } catch (error) {
      console.error('❌ Failed to delete PO:', error);
      this.toastService.error('Failed to delete Purchase Order');
    }
  }

  /* ================= PDF GENERATION ================= */

  downloadPurchaseOrderPDF() {
    this.coverLetterSubject = this.items.length > 0 && this.items[0].item
      ? `Purchase Order for Supply of ${this.items[0].item}`
      : 'Purchase Order for Supply of Materials as per attached schedule';
    this.showSubjectPopup = true;
  }

  cancelSubjectInput() {
    this.showSubjectPopup = false;
    this.coverLetterSubject = '';
  }

  async confirmSubjectAndGeneratePDF() {
    if (!this.coverLetterSubject.trim()) return;
    this.showSubjectPopup = false;
    const subject = this.coverLetterSubject.trim();

    let stampBase64: string | null = null;
    try { stampBase64 = await this.loadLogoAsBase64('assets/stamp.jpeg'); } catch { }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    this.generateCoverLetterPage(doc, pageWidth, pageHeight, subject, stampBase64);
    doc.addPage();
    this.generateTermsAndConditionsPage(doc, pageWidth, pageHeight, stampBase64);
    doc.addPage();
    this.generateQuantityRatesPage(doc, pageWidth, pageHeight, stampBase64);

    doc.save(`PO_${this.poNumber.replace(/\//g, '_')}.pdf`);
    this.coverLetterSubject = '';
  }

  private generateCoverLetterPage(doc: any, pageWidth: number, pageHeight: number, subject: string, stampBase64: string | null = null) {
    let yPosition = 10;
    const logoPath = 'assets/LOGO.jpg';
    const logoWidth = 40; const logoHeight = 20;
    try { doc.addImage(logoPath, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight); yPosition += logoHeight + 5; } catch { }
    yPosition += 5;

    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Office : A N House, 4th Floor, TPS-III, 31st Road, Bandra(W), MUMBAI - 400050', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Tele Fax (022) 16441702, 26441740 : info@navbharatgroup.com', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 15;

    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(this.poNumber, 15, yPosition);
    const poDate = this.poDate ? new Date(this.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Date: ${poDate}`, pageWidth - 15, yPosition, { align: 'right' }); yPosition += 15;

    doc.setFont('helvetica', 'bold'); doc.text('To,', 15, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'normal');
    if (this.vendorName) { const vl = doc.splitTextToSize(this.vendorName, 120); doc.text(vl, 15, yPosition); yPosition += vl.length * 5; }
    if (this.billingAddress) { const al = doc.splitTextToSize(this.billingAddress, 120); doc.text(al, 15, yPosition); yPosition += al.length * 5; }
    yPosition += 10;

    doc.setFont('helvetica', 'normal'); doc.text(`Sub. : ${subject}`, 15, yPosition); yPosition += 10;
    doc.text('Dear Sir,', 15, yPosition); yPosition += 10;
    const bodyText = `This refers to our requirement & reference to your final offer thru WA/email Dtd ${poDate}, we are pleased to place an order on you towards supply as mentioned in the subject above.`;
    const bodyLines = doc.splitTextToSize(bodyText, pageWidth - 30);
    doc.text(bodyLines, 15, yPosition); yPosition += bodyLines.length * 5 + 5;
    doc.setFontSize(11); doc.text('Schedule of Terms & Condition and Technical Data are enclosed.', 15, yPosition); yPosition += 15;
    doc.setFontSize(12); doc.text('Thanking You,', 15, yPosition); yPosition += 8;
    doc.text('Truly Yours,', 15, yPosition); yPosition += 6;
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition); yPosition += 4;
    if (stampBase64) { doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22); }
    yPosition += 26; doc.text('Authorised Signatory', 15, yPosition);
  }

  private generateTermsAndConditionsPage(doc: any, pageWidth: number, pageHeight: number, stampBase64: string | null = null) {
    let yPosition = 15;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 8;
    doc.text('PURCHASE ORDER', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 7;
    doc.setFontSize(11); doc.text('TERMS & CONDITIONS', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 7;
    doc.setFontSize(12);
    const poDate = this.poDate ? new Date(this.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');
    doc.text(`ORDER REFERENCE : ${this.poNumber} Dt. ${poDate}`, pageWidth / 2, yPosition, { align: 'center' }); yPosition += 10;

    const leftCol = 15, colonCol = 58, rightCol = 62, maxTextWidth = pageWidth - rightCol - 15;
    doc.setFontSize(11);
    const addTerm = (label: string, value: string, isBold: boolean = false) => {
      doc.setFont('helvetica', 'normal'); doc.text(label, leftCol, yPosition); doc.text(':', colonCol, yPosition, { align: 'center' });
      if (isBold) doc.setFont('helvetica', 'bold');
      const valueLines = doc.splitTextToSize(value, maxTextWidth);
      doc.text(valueLines, rightCol, yPosition);
      yPosition += valueLines.length * 5 + 1;
    };

    addTerm('Unit Rate', 'As per Quantity & Rate Schedule', true);
    addTerm('Quantity', 'As per Quantity & Rate Schedule', true);
    addTerm('P & F Charges', this.freightCharges > 0 ? `₹${this.freightCharges.toFixed(2)}` : 'Included', false);
    addTerm('Quantity Variation', 'Not Applicable', false);
    const taxRate = this.items.length > 0 && this.items[0].gst ? this.items[0].gst : 18;
    addTerm('Taxes & Forms', `IGST @ ${taxRate}% - Extra on Unit Rate`, false);
    const transportText = this.transportMode && this.transporterName ? `${this.transportMode} - ${this.transporterName}` : this.transportMode || 'Road - To be arranged';
    addTerm('Transportation', transportText, false);
    addTerm('Transit Insurance', 'At your Cost', false);
    addTerm('Packing', 'Standard Packing', false);
    addTerm('Delivery Period', this.expectedDeliveryDate ? new Date(this.expectedDeliveryDate).toLocaleDateString('en-IN') : 'Immediate', true);
    addTerm('Payment Terms', this.paymentTerms || '100% Advance agst Proforma Invoice', false);
    addTerm('Test Certificates', 'Manufacturers Test Certificate (in original) will be required Prior to despatch of material', false);
    addTerm('Discrepancy in Supplies', 'Short Supplies / Non Specified materials / Damaged Materials shall be replaced at no extra cost.', false);
    addTerm('Communication Address', `All original documents i.e. invoice, despatch documents shall be sent to our following address:\nNavbharat Insulation & Engg. Co.\nA N House, 4th Floor, TPS III, 31st Road, Opp. Shopper Stop, Linking Road, Bandra (W), Mumbai - 400 050`, false);
    addTerm('Ship To / Delivery Address', this.deliveryAddress || 'To be confirmed', false);
    addTerm('Contact Person', this.contactPerson || 'To be confirmed', true);
    addTerm('Bill To / Billing Address', `Navbharat Insulation & Engg. Co.\nA N House, 4th Floor, TPS III, 31st Road, Opp. Shopper Stop, Linking Road, Bandra (W), Mumbai - 400 050`, true);
    addTerm('GSTIN', `Navbharat Insulation & Engg. Co.\n27AAHPK4195P1ZZ    State Name : Maharashtra, Code : 27`, true);
    addTerm('Road Permit / Way Bill', 'E-Way bill required.', false);
    addTerm('Jurisdiction', 'Any dispute arising in the said order shall subject to Mumbai Jurisdiction', false);
    addTerm('Despatch Instructions', `Documents to be sent with the lorry -\n1) Invoice, 2) Delivery Challan, 3) Packing List,\n4) Test Certificate(Original), 5) Lorry receipt\nNote - ONE Set of all the above documents to be sent at communication address.`, false);

    doc.setFont('helvetica', 'normal'); doc.text('Special Instructions', leftCol, yPosition); doc.text(':', colonCol, yPosition, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    const specialLines = doc.splitTextToSize(`1) Rates mentioned above will remain fixed & firm till the completion of supply against this order`, maxTextWidth);
    doc.text(specialLines, rightCol, yPosition); yPosition += specialLines.length * 5 + 8;

    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.setFontSize(11); doc.text('Signed', pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 6;
    if (stampBase64) { doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22); }
    yPosition += 30;
    doc.setFontSize(11); doc.text('Authorised Signatory', 15, yPosition);
    doc.text(`For ${this.vendorName || 'Vendor'}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 5; doc.text('Accepted as above', pageWidth - 15, yPosition, { align: 'right' });
  }

  private generateQuantityRatesPage(doc: any, pageWidth: number, pageHeight: number, stampBase64: string | null = null) {
    let yPosition = 15;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 8;
    doc.text('PURCHASE ORDER', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 7;
    doc.setFontSize(11); doc.text('Quantity & Rate Schedule', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 7;
    doc.setFontSize(12);
    const poDate = this.poDate ? new Date(this.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');
    doc.text(`ORDER REFERENCE : ${this.poNumber} Dt. ${poDate}`, pageWidth / 2, yPosition, { align: 'center' }); yPosition += 10;

    const tableData = this.items.map((item: any, index: number) => [
      (index + 1).toString(), item.item || '-', item.hsn || '-',
      item.specifications || (item.hsn ? `HSN: ${item.hsn}` : '-'),
      item.qty.toString(), item.uom || 'Kg', item.rate.toFixed(2), (item.qty * item.rate).toFixed(2)
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Sr. No.', 'Material Description', 'HSN CODE', 'Specifications', 'Quantity', 'Uom', 'Rate/Uom', 'Amount (Rs.)']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', lineWidth: 0.5, lineColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 35 }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25, halign: 'left' } },
      styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5, lineColor: [0, 0, 0] },
      bodyStyles: { textColor: [0, 0, 0] }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;
    const summaryStartX = 120;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Assessable Value :', summaryStartX, yPosition, { align: 'right' });
    doc.text(this.getSubtotal().toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Packing & Forwarding', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(this.freightCharges ? this.freightCharges.toFixed(2) : '0', summaryStartX + 50, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Sub Total:', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    const subTotal = this.getSubtotal() + (this.freightCharges || 0);
    doc.text(subTotal.toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'normal');
    const taxRate = this.items.length > 0 && this.items[0].gst ? this.items[0].gst : 18;
    doc.text(`IGST @ ${taxRate}%`, summaryStartX, yPosition, { align: 'right' });
    doc.text('N.A.', summaryStartX + 25, yPosition, { align: 'center' });
    const igstAmount = this.getTaxTotal();
    doc.text(igstAmount.toFixed(3), summaryStartX + 50, yPosition); yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Round off', summaryStartX, yPosition, { align: 'right' });
    const grandTotalBeforeRound = subTotal + igstAmount;
    const roundedTotal = Math.round(grandTotalBeforeRound);
    const roundOff = roundedTotal - grandTotalBeforeRound;
    doc.text(roundOff.toFixed(2), summaryStartX + 50, yPosition); yPosition += 6;
    doc.text('Grand Total :', summaryStartX, yPosition, { align: 'right' });
    doc.text(roundedTotal.toFixed(3), summaryStartX + 50, yPosition); yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`In Words - Rs. ${this.convertNumberToWords(roundedTotal)}`, 15, yPosition); yPosition += 10;
    doc.text('# Subject to the Terms stated in enclosed Commercial Terms & Conditions Annexure.', 15, yPosition); yPosition += 10;
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.setFontSize(11); doc.text('Signed', pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 4;
    if (stampBase64) { doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22); }
    yPosition += 30;
    doc.setFontSize(11); doc.text('Authorised Signatory', 15, yPosition);
    doc.text(`For ${this.vendorName || 'Vendor'}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 5; doc.text('Accepted as above', pageWidth - 15, yPosition, { align: 'right' });
  }

  private convertNumberToWords(amount: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (amount === 0) return 'Zero';
    const num = Math.floor(amount);
    function clt(n: number): string {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + clt(n % 100) : '');
    }
    if (num < 1000) return clt(num) + ' Only';
    if (num < 100000) { const t = Math.floor(num / 1000); const r = num % 1000; return clt(t) + ' Thousand' + (r !== 0 ? ' ' + clt(r) : '') + ' Only'; }
    if (num < 10000000) { const l = Math.floor(num / 100000); const r = num % 100000; return clt(l) + ' Lac' + (r >= 1000 ? ' ' + this.convertNumberToWords(r).replace(' Only', '') : '') + ' Only'; }
    const c = Math.floor(num / 10000000); const r = num % 10000000;
    return clt(c) + ' Crore' + (r >= 100000 ? ' ' + this.convertNumberToWords(r).replace(' Only', '') : '') + ' Only';
  }
}
