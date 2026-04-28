import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-purchase-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.css']
})
export class PurchaseOrderComponent {

  // private companyLogo = 'data:image/png;base64,UklGRkgCAABXRUJQVlA4WAoAAAAwAAAAQAAAEAAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZBTFBIHAAAAAEPMP8REUJt2zaM9f/PTh+zR/R/Ahw7aH8vTgBWUDggNgAAAFADAJ0BKkEAEQAuOSiUSiEjo6ODgDhLSAAFzrNvTVgoaLGAAP781E1//0G5O/eyS+pwAAAAAA==';

  showSubjectPopup = false;
  coverLetterSubject = '';

  vendors: any[] = [];
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

  /* ---------------- DATA ---------------- */
  customers: any[] = [];
  allItems: any[] = [];

  /* ================= UI HELPERS ================= */
  get draftOrders() {
    return this.draftPOs;
  }

  get submittedOrders() {
    return this.submittedPOs;
  }

  async ngOnInit() {
    await this.loadPurchaseOrders();
    await this.loadVendors();
    this.allInquiries = await this.dbService.getAll('inquiries');
    this.allOffers = await this.dbService.getAll('offers');
    this.allItems = await this.dbService.getAll('inventory');

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
        // Prefill from offer (has rates, terms, freight)
        this.offerRef = offer.offerRef || '';
        if (offer.paymentTerms) this.paymentTerms = offer.paymentTerms;
        if (offer.freightCharges) this.freightCharges = offer.freightCharges;
        if (offer.items && offer.items.length > 0) {
          this.items = offer.items.map((it: any, idx: number) => {
            const inqItem = inq.items?.[idx];
            const itemName = (it.name || it.productName || '').toLowerCase().trim();
            const invItem = this.allItems.find((p: any) => {
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

  constructor(
    private router: Router,
    private dbService: DBService
  ) { }


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
    console.log('⬅️ Navigating back to Purchase Order list');
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

      // Items table — only selected items
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

      doc.text(`Weighing Slip: ${safe(g.weighingSlip)}`, margin, y);
      y += 7;
      doc.text(`Material Acceptable: ${safe(g.materialOk)}`, margin, y);
      y += 7;
      doc.text(`Damage Acceptable: ${safe(g.damageOk)}`, margin, y);
      y += 10;
      doc.text(`MTC Available: ${safe(g.mtcAvailable)}`, margin, y);
      y += 7;
      doc.text(`Transporter: ${safe(g.transporter)}`, margin, y);
      y += 7;
      doc.text(`LR No / Vehicle No: ${safe(g.lrNo)}`, margin, y);
      y += 10;
      doc.text(`Remarks: ${safe(g.remarks)}`, margin, y);
      y += 20;
      doc.text(`Prepared By: ${safe(g.preparedBy)}`, margin, y);
      doc.text(`Checked By: ${safe(g.checkedBy)}`, pageWidth / 2, y);
      y += 10;
      doc.text(`Approved By: ${safe(g.approvedBy)}`, margin, y);

      doc.save(`GRR_${safe(g.reportNo) || 'Report'}.pdf`);
      this.closeGRRModal();
    } catch (error) {
      console.error('❌ Error generating GRR:', error);
      alert('Error generating GRR report');
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
    this.items = JSON.parse(JSON.stringify(po.items));
    this.freightCharges = po.freightCharges;
    this.purchaseOrderStatus = po.status;

    this.showForm = true;
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = true;
    const el = (ev.currentTarget as HTMLElement);
    el.classList.add('active');
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    const el = (ev.currentTarget as HTMLElement);
    el.classList.remove('active');
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragActive = false;
    const el = (ev.currentTarget as HTMLElement);
    el.classList.remove('active');

    const dt = ev.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) {
      this.addFilesFromFileList(dt.files);
    }
  }

  private buildPurchaseOrderPayload(existing?: any) {
    console.group('🧾 buildPurchaseOrderPayload');

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
      createdAt: existing?.createdAt ?? new Date().toISOString()
    };

    if (existing?.id != null) {
      payload.id = existing.id;
      console.log('✏️ Editing existing PO, id =', existing.id);
    } else {
      console.log('🆕 Creating NEW PO (no id yet)');
    }

    console.log('📦 Final payload:', payload);
    console.groupEnd();

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

  /**
   * ✅ FIXED: Now correctly finds vendor by database ID
   */
  // onVendorSelect(vendorId: number) {
  //   console.log('🔍 onVendorSelect called with ID:', vendorId);
  //   console.log('📋 Available vendors:', this.vendors);
  //   console.log('SELECTED VENDOR ID:', vendorId);

  //   // Find vendor by database ID (not vendorId field)
  //   const v = this.vendors.find(x => x.id === vendorId);

  //   console.log('✅ Found vendor:', v);

  //   if (!v) {
  //     console.warn('⚠️ Vendor not found with id:', vendorId);
  //     return;
  //   }

  //   this.vendorName = v.companyName || '';
  //   this.vendorId = v.vendorId || '';
  //   this.vendorGST = v.gst || '';
  //   this.contactPerson = v.contactPerson || '';
  //   this.contactInfo = `${v.mobile || ''} ${v.email || ''}`.trim();

  //   this.billingAddress = this.formatAddress(v.billing);
  //   this.deliveryAddress = this.formatAddress(v.shipping);

  //   console.log('✅ Auto-filled vendor details:', {
  //     vendorName: this.vendorName,
  //     vendorId: this.vendorId,
  //     vendorGST: this.vendorGST
  //   });
  // }

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

    // Find the inquiry by display id
    const match = inquiryDisplayId.match(/INQ-(\d+)/i);
    if (!match) return;
    const numId = parseInt(match[1]);
    const inq = this.allInquiries.find((i: any) => i.id === numId);
    if (!inq) return;

    // PO date from inquiry date
    if (inq.date) this.poDate = inq.date;

    // Autofill items from inquiry items
    if (inq.items && inq.items.length > 0) {
      this.items = inq.items.map((it: any) => {
        const productName = it.product || it.item || it.productName || '';
        // const invItem = this.allItems.find((p: any) =>
        //   (p.displayName || p.name || '').toLowerCase() === productName.toLowerCase()
        // );
        const invItem = this.allItems.find((p: any) => {
          const invName = (p.displayName || p.name || '').toLowerCase().trim();
          const inqName = productName.toLowerCase().trim();

          return invName.includes(inqName) || inqName.includes(invName);
        });
        console.log('🔍 Matching:', {
          inquiryItem: productName,
          matchedInventory: invItem
        });

        const line = {
          item: productName,
          qty: it.qty || 1,
          // uom: it.uom || invItem?.uom || invItem?.unit || '',
          uom: it.uom || invItem?.uom || invItem?.unit || 'Nos', // fallback
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

    // Autofill freight from inquiry
    const inqFreight = parseFloat(inq.freight || inq.freightCharges || 0);
    if (inqFreight > 0) this.freightCharges = inqFreight;

    // Find offer for this inquiry
    const relatedOffer = this.allOffers.find((o: any) =>
      o.inquiryNo === inq.id && o.status !== 'superseded'
    );

    if (relatedOffer) {
      const y = new Date().getFullYear();
      const generatedRef = relatedOffer.id
        ? `NIEC/MDD/${y}/${String(relatedOffer.id).padStart(4, '0')}`
        : '';
      this.offerRef = relatedOffer.offerRef || generatedRef || relatedOffer.offerNo || relatedOffer.offerNumber || '';
      if (relatedOffer.paymentTerms) this.paymentTerms = relatedOffer.paymentTerms;
      // Pull freight from offer if not already from inquiry
      if (!inqFreight) {
        const offerFreight = parseFloat(relatedOffer.freight || relatedOffer.freightCharges || 0);
        if (offerFreight > 0) this.freightCharges = offerFreight;
      }
      if (relatedOffer.items && relatedOffer.items.length > 0) {
        // Merge offer rates into existing inquiry items, or replace if items list was empty
        const hasItems = this.items.length > 0 && this.items.some(x => x.item);
        if (hasItems) {
          // Update rates from offer items where rate is 0
          this.items.forEach((line, idx) => {
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

    // GST: check top-level gst, then officeAddress.gstin
    this.vendorGST = v.gst || offAddr.gstin || '';

    // Contact person: primaryContact first/last, then officeAddress.contactPerson, then top-level
    const pcName = [pc.firstName, pc.lastName].filter(Boolean).join(' ').trim();
    this.contactPerson = pcName || offAddr.contactPerson || v.contactPerson || '';

    // Contact info: mobile + email from primaryContact, then officeAddress, then top-level
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

    // Payment terms come from the offer, not the vendor — do not overwrite here
  }

  // private formatVendorAddress(addr: any): string {
  //   if (!addr) return '';
  //   return [
  //     addr.line1 || addr.street,
  //     addr.line2 || addr.area,
  //     addr.city,
  //     addr.state,
  //     addr.pincode,
  //     addr.country
  //   ].filter(Boolean).join(', ');
  // }

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
    this.vendors = await this.dbService.getAll('vendors');
    console.log('📥 Loaded vendors:', this.vendors);
  }

  async loadPurchaseOrders() {
    console.group('📥 loadPurchaseOrders()');

    const all = await this.dbService.getAllPurchaseOrders();
    console.log('📄 Raw purchaseOrders from DB:', all);

    this.draftPOs = all.filter(o => o.status === 'DRAFT');
    this.submittedPOs = all.filter(o => o.status === 'SUBMITTED');
    this.approvedPOs = all.filter(o => o.status === 'APPROVED');

    console.log('🟦 Draft POs:', this.draftPOs);
    console.log('🟨 Submitted POs:', this.submittedPOs);
    console.log('🟩 Approved POs:', this.approvedPOs);

    console.groupEnd();
  }

  async saveDraft() {
    console.group('💾 saveDraft()');

    this.purchaseOrderStatus = 'DRAFT';
    console.log('📌 Status set to DRAFT');

    const payload = this.buildPurchaseOrderPayload(this.editingPO);

    console.log('➡️ Calling dbService.addOrUpdatePurchaseOrder');
    await this.dbService.addOrUpdatePurchaseOrder(payload);

    console.log('🔄 Reloading purchase orders from DB');
    await this.loadPurchaseOrders();

    this.editingPO = null;
    console.log('✅ Draft saved successfully');

    console.groupEnd();
    alert('Purchase Order saved as Draft');
  }


  async submitPO() {
    console.group('📤 submitPO()');

    this.purchaseOrderStatus = 'SUBMITTED';
    console.log('📌 Status set to SUBMITTED');

    const existing = this.editingPO
      ?? await this.dbService.getPurchaseOrderByNo(this.poNumber);

    const payload = this.buildPurchaseOrderPayload(existing);

    console.log('➡️ Calling dbService.addOrUpdatePurchaseOrder');
    await this.dbService.addOrUpdatePurchaseOrder(payload);

    console.log('🔄 Reloading purchase orders from DB');
    await this.loadPurchaseOrders();

    this.editingPO = null;
    console.log('✅ Purchase Order submitted');

    console.groupEnd();
    alert('Purchase Order submitted');
  }

  async approvePO() {
    console.group('✅ approvePO()');

    this.purchaseOrderStatus = 'APPROVED';
    console.log('📌 Status set to APPROVED');

    const existing = this.editingPO
      ?? await this.dbService.getPurchaseOrderByNo(this.poNumber);

    const payload = this.buildPurchaseOrderPayload(existing);

    console.log('➡️ Calling dbService.addOrUpdatePurchaseOrder');
    await this.dbService.addOrUpdatePurchaseOrder(payload);

    console.log('🔄 Reloading purchase orders from DB');
    await this.loadPurchaseOrders();

    this.editingPO = null;
    console.log('🎉 Purchase Order approved');

    console.groupEnd();
    alert('Purchase Order approved');
  }

  async approveFromTable(po: any) {
    console.group('✔️ approveFromTable()');

    console.log('📄 PO before approval:', po);
    po.status = 'APPROVED';

    console.log('➡️ Updating PO in DB');
    await this.dbService.addOrUpdatePurchaseOrder(po);

    console.log('🔄 Reloading purchase orders');
    await this.loadPurchaseOrders();

    console.groupEnd();
    alert('Purchase Order approved');
  }


  async saveFromTable(po: any) {
    po.status = 'SUBMITTED';
    await this.dbService.addOrUpdatePurchaseOrder(po);
    await this.loadPurchaseOrders();
    alert('Purchase Order saved');
  }

  openGRRModalForPO(po: any) {
    // Load PO into form fields then open GRR modal
    this.editDraft(po);
    this.openGRRModal();
  }

  async deleteDraft(po: any) {
    console.group('🗑️ deleteDraft()');

    console.log('📄 PO to delete:', po);

    const confirmed = confirm(`Delete Purchase Order ${po.poNumber}?`);
    if (!confirmed) {
      console.log('❌ Delete cancelled by user');
      console.groupEnd();
      return;
    }

    console.log('➡️ Deleting PO with id:', po.id);
    await this.dbService.deletePurchaseOrder(po.id);

    console.log('🔄 Reloading purchase orders');
    await this.loadPurchaseOrders();

    console.groupEnd();
  }

  /* ================= PDF GENERATION ================= */

  downloadPurchaseOrderPDF() {
    console.log("well well well")
    // Set default subject based on first item
    this.coverLetterSubject = this.items.length > 0 && this.items[0].item
      ? `Purchase Order for Supply of ${this.items[0].item}`
      : 'Purchase Order for Supply of Materials as per attached schedule';

    // Show the popup
    this.showSubjectPopup = true;
  }

  // NEW: Cancel subject input
  cancelSubjectInput() {
    this.showSubjectPopup = false;
    this.coverLetterSubject = '';
  }

  // NEW: Confirm subject and generate PDF
  async confirmSubjectAndGeneratePDF() {
    if (!this.coverLetterSubject.trim()) {
      return;
    }

    // Hide popup
    this.showSubjectPopup = false;

    // Generate PDF with subject
    const subject = this.coverLetterSubject.trim();

    let stampBase64: string | null = null;
    try {
      stampBase64 = await this.loadLogoAsBase64('assets/stamp.jpeg');
    } catch { /* stamp optional */ }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // PAGE 1: COVER LETTER (with user-provided subject)
    this.generateCoverLetterPage(doc, pageWidth, pageHeight, subject, stampBase64);

    // PAGE 2: TERMS & CONDITIONS
    doc.addPage();
    this.generateTermsAndConditionsPage(doc, pageWidth, pageHeight, stampBase64);

    // PAGE 3: QUANTITY, RATES & TECHNICAL SCHEDULE
    doc.addPage();
    this.generateQuantityRatesPage(doc, pageWidth, pageHeight, stampBase64);

    // Save PDF
    doc.save(`PO_${this.poNumber.replace(/\//g, '_')}.pdf`);

    // Clear subject for next time
    this.coverLetterSubject = '';
  }

  private generateCoverLetterPage(doc: any, pageWidth: number, pageHeight: number, subject: string, stampBase64: string | null = null) {
    let yPosition = 10;

    // ============ LOGO SECTION ============
    const logoPath = 'assets/LOGO.jpg';

    const logoWidth = 40;
    const logoHeight = 20;
    const logoX = (pageWidth - logoWidth) / 2;

    try {
      doc.addImage(logoPath, 'PNG', logoX, yPosition, logoWidth, logoHeight);
      yPosition += logoHeight + 5;
    } catch (error) {
      console.warn('Logo could not be loaded from:', logoPath, error);
    }

    yPosition += 5;

    // ============ COMPANY HEADER ============
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Office : A N House, 4th Floor, TPS-III, 31st Road, Bandra(W), MUMBAI - 400050',
      pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Tele Fax (022) 16441702, 26441740 : info@navbharatgroup.com',
      pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 15;

    // ============ PO NUMBER AND DATE ============
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(this.poNumber, 15, yPosition);

    const poDate = this.poDate ? new Date(this.poDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) : new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    doc.text(`Date: ${poDate}`, pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 15;

    // ============ VENDOR ADDRESS ============
    doc.setFont('helvetica', 'bold');
    doc.text('To,', 15, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    if (this.vendorName) {
      const vendorLines = doc.splitTextToSize(this.vendorName, 120);
      doc.text(vendorLines, 15, yPosition);
      yPosition += vendorLines.length * 5;
    }

    if (this.billingAddress) {
      const addressLines = doc.splitTextToSize(this.billingAddress, 120);
      doc.text(addressLines, 15, yPosition);
      yPosition += addressLines.length * 5;
    }

    yPosition += 10;

    // ============ SUBJECT (USER PROVIDED FROM POPUP) ============
    doc.setFont('helvetica', 'normal');
    doc.text(`Sub. : ${subject}`, 15, yPosition);

    yPosition += 10;

    // ============ LETTER BODY ============
    doc.text('Dear Sir,', 15, yPosition);

    yPosition += 10;

    const bodyText = `This refers to our requirement & reference to your final offer thru WA/email Dtd ${poDate}, we are pleased to place an order on you towards supply as mentioned in the subject above.`;
    const bodyLines = doc.splitTextToSize(bodyText, pageWidth - 30);
    doc.text(bodyLines, 15, yPosition);
    yPosition += bodyLines.length * 5 + 5;

    doc.setFontSize(11);
    doc.text('Schedule of Terms & Condition and Technical Data are enclosed.', 15, yPosition);

    yPosition += 15;

    // ============ CLOSING ============
    doc.setFontSize(12);
    doc.text('Thanking You,', 15, yPosition);
    yPosition += 8;
    doc.text('Truly Yours,', 15, yPosition);
    yPosition += 6;
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);

    yPosition += 4;
    if (stampBase64) { doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22); }
    yPosition += 26;

    doc.text('Authorised Signatory', 15, yPosition);
  }

  private generateTermsAndConditionsPage(doc: any, pageWidth: number, pageHeight: number, stampBase64: string | null = null) {
    let yPosition = 15;

    // ============ HEADER ============
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 8;
    doc.text('PURCHASE ORDER', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(11);
    doc.text('TERMS & CONDITIONS', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(12);
    const poDate = this.poDate ? new Date(this.poDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) : new Date().toLocaleDateString('en-IN');
    doc.text(`ORDER REFERENCE : ${this.poNumber} Dt. ${poDate}`,
      pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;

    // ============ TERMS IN TWO-COLUMN FORMAT ============
    const leftCol = 15;
    const colonCol = 58;
    const rightCol = 62;
    const maxTextWidth = pageWidth - rightCol - 15;

    doc.setFontSize(11);

    // Helper function to add a term with proper spacing
    const addTerm = (label: string, value: string, isBold: boolean = false) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label, leftCol, yPosition);
      doc.text(':', colonCol, yPosition, { align: 'center' });

      if (isBold) {
        doc.setFont('helvetica', 'bold');
      }

      const valueLines = doc.splitTextToSize(value, maxTextWidth);
      doc.text(valueLines, rightCol, yPosition);

      // Calculate proper spacing based on number of lines
      yPosition += valueLines.length * 5 + 1; // 5mm per line + 1mm gap
    };

    // 1. Unit Rate
    addTerm('Unit Rate', 'As per Quantity & Rate Schedule', true);

    // 2. Quantity
    addTerm('Quantity', 'As per Quantity & Rate Schedule', true);

    // 3. P & F Charges
    const pfCharges = this.freightCharges > 0 ? `₹${this.freightCharges.toFixed(2)}` : 'Included';
    addTerm('P & F Charges', pfCharges, false);

    // 4. Quantity Variation
    addTerm('Quantity Variation', 'Not Applicable', false);

    // 5. Taxes & Forms
    const taxRate = this.items.length > 0 && this.items[0].gst ? this.items[0].gst : 18;
    addTerm('Taxes & Forms', `IGST @ ${taxRate}% - Extra on Unit Rate`, false);

    // 6. Transportation
    const transportText = this.transportMode && this.transporterName
      ? `${this.transportMode} - ${this.transporterName}`
      : this.transportMode || 'Road - To be arranged';
    addTerm('Transportation', transportText, false);

    // 7. Transit Insurance
    addTerm('Transit Insurance', 'At your Cost', false);

    // 8. Packing
    addTerm('Packing', 'Standard Packing', false);

    // 9. Delivery Period
    const deliveryPeriod = this.expectedDeliveryDate
      ? new Date(this.expectedDeliveryDate).toLocaleDateString('en-IN')
      : 'Immediate';
    addTerm('Delivery Period', deliveryPeriod, true);

    // 10. Payment Terms
    addTerm('Payment Terms', this.paymentTerms || '100% Advance agst Proforma Invoice', false);

    // 11. Test Certificates
    addTerm('Test Certificates',
      'Manufacturers Test Certificate (in original) will be required Prior to despatch of material',
      false);

    // 12. Discrepancy in Supplies
    addTerm('Discrepancy in Supplies',
      'Short Supplies / Non Specified materials / Damaged Materials shall be replaced at no extra cost.',
      false);

    // 13. Communication Address
    const commAddr = `All original documents i.e. invoice, despatch documents shall be sent to our following address:\nNavbharat Insulation & Engg. Co.\nA N House, 4th Floor, TPS III, 31st Road, Opp. Shopper Stop, Linking Road, Bandra (W), Mumbai - 400 050`;
    addTerm('Communication Address', commAddr, false);

    // 14. Ship To / Delivery Address
    if (this.deliveryAddress) {
      addTerm('Ship To / Delivery Address', this.deliveryAddress, false);
    } else {
      addTerm('Ship To / Delivery Address',
        'Behind the Screaming Elevator, Somewhere Between Floors, Void, State, India',
        false);
    }

    // 15. Contact Person
    const contactText = this.contactPerson && this.contactInfo
      ? `${this.contactPerson}`
      : this.contactPerson || 'To be confirmed';
    addTerm('Contact Person', contactText, true);

    // 16. Bill To / Billing Address
    const billAddr = `Navbharat Insulation & Engg. Co.\nA N House, 4th Floor, TPS III, 31st Road, Opp. Shopper Stop, Linking Road, Bandra (W), Mumbai - 400 050`;
    addTerm('Bill To / Billing Address', billAddr, true);

    // 17. GSTIN
    const gstText = `Navbharat Insulation & Engg. Co.\n27AAHPK4195P1ZZ    State Name : Maharashtra, Code : 27`;
    addTerm('GSTIN', gstText, true);

    // 18. Road Permit / Way Bill
    addTerm('Road Permit / Way Bill', 'E-Way bill required.', false);

    // 19. Jurisdiction
    addTerm('Jurisdiction',
      'Any dispute arising in the said order shall subject to Mumbai Jurisdiction',
      false);

    // 20. Despatch Instructions
    const despatchText = `Documents to be sent with the lorry -\n1) Invoice, 2) Delivery Challan, 3) Packing List,\n4) Test Certificate(Original), 5) Lorry receipt\nNote - ONE Set of all the above documents to be sent at communication address.`;
    addTerm('Despatch Instructions', despatchText, false);

    // 21. Special Instructions
    doc.setFont('helvetica', 'normal');
    doc.text('Special Instructions', leftCol, yPosition);
    doc.text(':', colonCol, yPosition, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    const specialText = `1) Rates mentioned above will remain fixed & firm till the completion of supply against this order`;
    const specialLines = doc.splitTextToSize(specialText, maxTextWidth);
    doc.text(specialLines, rightCol, yPosition);
    yPosition += specialLines.length * 5 + 8;

    // ============ SIGNATURE BLOCKS ============
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.setFontSize(11);
    doc.text('Signed', pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 6;
    if (stampBase64) { doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22); }
    yPosition += 30;

    doc.setFontSize(11);
    doc.text('Authorised Signatory', 15, yPosition);
    doc.text(`For ${this.vendorName || 'Polter Inc.'}`, pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 5;
    doc.text('Accepted as above', pageWidth - 15, yPosition, { align: 'right' });
  }

  private generateQuantityRatesPage(doc: any, pageWidth: number, pageHeight: number, stampBase64: string | null = null) {
    let yPosition = 15;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Navbharat Insulation & Engg. Co.', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 8;
    doc.text('PURCHASE ORDER', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(11);
    doc.text('Quantity & Rate Schedule', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    doc.setFontSize(12);
    const poDate = this.poDate ? new Date(this.poDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) : new Date().toLocaleDateString('en-IN');
    doc.text(`ORDER REFERENCE : ${this.poNumber} Dt. ${poDate}`,
      pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;

    // Items Table
    const tableData = this.items.map((item: any, index: number) => {
      const specifications = item.specifications ||
        (item.hsn ? `HSN: ${item.hsn}` : '-');

      return [
        (index + 1).toString(),
        item.item || '-',
        item.hsn || '-',
        specifications,
        item.qty.toString(),
        item.uom || 'Kg',
        item.rate.toFixed(2),
        (item.qty * item.rate).toFixed(2)
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
        7: { cellWidth: 25, halign: 'left' }
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      bodyStyles: {
        textColor: [0, 0, 0]
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;

    // Financial Summary
    const summaryStartX = 120;
    doc.setFontSize(11);

    // Assessable Value
    doc.setFont('helvetica', 'bold');
    doc.text('Assessable Value :', summaryStartX, yPosition, { align: 'right' });
    doc.text(this.getSubtotal().toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    // Packing & Forwarding
    doc.setFont('helvetica', 'normal');
    doc.text('Packing & Forwarding', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(this.freightCharges ? this.freightCharges.toFixed(2) : '0',
      summaryStartX + 50, yPosition);
    yPosition += 6;

    // Sub Total
    doc.setFont('helvetica', 'normal');
    doc.text('Sub Total:', summaryStartX, yPosition, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    const subTotal = this.getSubtotal() + (this.freightCharges || 0);
    doc.text(subTotal.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    // IGST
    doc.setFont('helvetica', 'normal');
    const taxRate = this.items.length > 0 && this.items[0].gst ? this.items[0].gst : 18;
    doc.text(`IGST @ ${taxRate}%`, summaryStartX, yPosition, { align: 'right' });
    doc.text('N.A.', summaryStartX + 25, yPosition, { align: 'center' });
    const igstAmount = this.getTaxTotal();
    doc.text(igstAmount.toFixed(3), summaryStartX + 50, yPosition);
    yPosition += 6;

    // Round off
    doc.setFont('helvetica', 'bold');
    doc.text('Round off', summaryStartX, yPosition, { align: 'right' });
    const grandTotalBeforeRound = subTotal + igstAmount;
    const roundedTotal = Math.round(grandTotalBeforeRound);
    const roundOff = roundedTotal - grandTotalBeforeRound;
    doc.text(roundOff.toFixed(2), summaryStartX + 50, yPosition);
    yPosition += 6;

    // Grand Total
    doc.text('Grand Total :', summaryStartX, yPosition, { align: 'right' });
    doc.text(roundedTotal.toFixed(3), summaryStartX + 50, yPosition);
    yPosition += 8;

    // Amount in Words
    doc.setFont('helvetica', 'bold');
    const amountInWords = this.convertNumberToWords(roundedTotal);
    doc.text(`In Words - Rs. ${amountInWords}`, 15, yPosition);
    yPosition += 10;

    // Reference note
    doc.text('# Subject to the Terms stated in enclosed Commercial Terms & Conditions Annexure.',
      15, yPosition);
    yPosition += 10;

    // Signature blocks
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('For, Navbharat Insulation & Engg. Co.', 15, yPosition);
    doc.setFontSize(11);
    doc.text('Signed', pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 4;
    if (stampBase64) { doc.addImage(stampBase64, 'JPEG', 15, yPosition, 30, 22); }
    yPosition += 30;

    doc.setFontSize(11);
    doc.text('Authorised Signatory', 15, yPosition);
    doc.text(`For ${this.vendorName || 'Vendor'}`, pageWidth - 15, yPosition, { align: 'right' });

    yPosition += 5;
    doc.text('Accepted as above', pageWidth - 15, yPosition, { align: 'right' });
  }

  // Helper function to convert number to words
  private convertNumberToWords(amount: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
      'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (amount === 0) return 'Zero';

    const num = Math.floor(amount);

    function convertLessThanThousand(n: number): string {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    }

    if (num < 1000) return convertLessThanThousand(num) + ' Only';
    if (num < 100000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      return convertLessThanThousand(thousands) + ' Thousand' +
        (remainder !== 0 ? ' ' + convertLessThanThousand(remainder) : '') + ' Only';
    }
    if (num < 10000000) {
      const lakhs = Math.floor(num / 100000);
      const remainder = num % 100000;
      return convertLessThanThousand(lakhs) + ' Lac' +
        (remainder >= 1000 ? ' ' + this.convertNumberToWords(remainder).replace(' Only', '') : '') + ' Only';
    }

    const crores = Math.floor(num / 10000000);
    const remainder = num % 10000000;
    return convertLessThanThousand(crores) + ' Crore' +
      (remainder >= 100000 ? ' ' + this.convertNumberToWords(remainder).replace(' Only', '') : '') + ' Only';
  }
}