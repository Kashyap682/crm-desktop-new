import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../service/api.service';
import { ConfirmService } from '../../service/confirm.service';
import { saveAs } from 'file-saver';

interface RfqItem {
  product: string;
  form: string;
  make: string;
  density: string;
  thickness: string;
  size: string;
  fsk: string;
  grade: string;
  alloy: string;
  temper: string;
  nb: string;
  maxTemp: string;
  color: string;
  qty: number | null;
  uom: string;
  fromInquiry?: boolean;
}

interface RfqAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface RfqRecord {
  id?: string;           // UUID
  rfqId: string;
  rfqDate: string;
  inquiryId: string;     // display string e.g. "INQ-001"
  vendorName: string;
  vendorAddress?: string;
  contactTitle?: string;
  contactFirstName: string;
  contactLastName: string;
  mobile: string;
  email: string;
  items: RfqItem[];
  shippingAddress: RfqAddress;
  notes: string;
  otherTerms: string;
  attachments: { name: string; data: string }[];
  status: 'DRAFT' | 'SENT';
  createdAt: string;
}

@Component({
  selector: 'app-rfq',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rfq.component.html',
  styleUrls: ['./rfq.component.css']
})
export class RfqComponent implements OnInit {

  showForm = false;
  rfqList: RfqRecord[] = [];
  editingRfq: RfqRecord | null = null;

  /* ===== FORM FIELDS ===== */
  rfqId = '';
  rfqDate = '';
  inquiryId = '';
  vendorName = '';
  contactTitle = '';
  contactFirstName = '';
  contactLastName = '';
  vendorAddress = '';
  mobile = '';
  email = '';

  items: RfqItem[] = [];

  shippingAddress: RfqAddress = this.emptyAddr();

  notes = '';
  otherTerms = '';
  attachments: { name: string; data: string }[] = [];

  /* ===== DATA ===== */
  inquiries: any[] = [];
  vendors: any[] = [];

  constructor(private apiService: ApiService, private confirmService: ConfirmService) { }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(rfq: RfqRecord): any {
    const row: any = {
      rfq_ref:           rfq.rfqId          || null,
      rfq_date:          rfq.rfqDate         || null,
      inquiry_ref:       rfq.inquiryId       || null,
      vendor_name:       rfq.vendorName      || null,
      vendor_address:    rfq.vendorAddress   || null,
      contact_title:     rfq.contactTitle    || null,
      contact_first_name: rfq.contactFirstName || null,
      contact_last_name:  rfq.contactLastName  || null,
      mobile:            rfq.mobile          || null,
      email:             rfq.email           || null,
      shipping_line1:    rfq.shippingAddress?.line1    || null,
      shipping_line2:    rfq.shippingAddress?.line2    || null,
      shipping_city:     rfq.shippingAddress?.city     || null,
      shipping_state:    rfq.shippingAddress?.state    || null,
      shipping_pincode:  rfq.shippingAddress?.pincode  || null,
      shipping_country:  rfq.shippingAddress?.country  || null,
      notes:             rfq.notes           || null,
      other_terms:       rfq.otherTerms      || null,
      items:             rfq.items           ?? [],
      attachments:       rfq.attachments     ?? [],
      status:            rfq.status          || 'DRAFT',
    };
    if (rfq.id) row.id = rfq.id;
    return row;
  }

  private fromDbRow(row: any): RfqRecord {
    return {
      id:               row.id,
      rfqId:            row.rfq_ref             || '',
      rfqDate:          row.rfq_date            || '',
      inquiryId:        row.inquiry_ref         || '',
      vendorName:       row.vendor_name         || '',
      vendorAddress:    row.vendor_address      || '',
      contactTitle:     row.contact_title       || '',
      contactFirstName: row.contact_first_name  || '',
      contactLastName:  row.contact_last_name   || '',
      mobile:           row.mobile              || '',
      email:            row.email               || '',
      shippingAddress: {
        line1:    row.shipping_line1   || '',
        line2:    row.shipping_line2   || '',
        city:     row.shipping_city    || '',
        state:    row.shipping_state   || '',
        pincode:  row.shipping_pincode || '',
        country:  row.shipping_country || '',
      },
      notes:       row.notes       || '',
      otherTerms:  row.other_terms || '',
      items:       Array.isArray(row.items)       ? row.items       : [],
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      status:      (row.status || 'DRAFT') as 'DRAFT' | 'SENT',
      createdAt:   row.created_at || new Date().toISOString(),
    };
  }

  private mapInquiry(row: any): any {
    const refMatch = (row.inquiry_ref || '').match(/INQ-(\d+)/i);
    return {
      _uuid:       row.id,
      id:          refMatch ? parseInt(refMatch[1], 10) : null,
      companyName: row.company_name || '',
      inquiryRef:  row.inquiry_ref  || '',
      items:       Array.isArray(row.items) ? row.items : [],
      date:        row.date         || '',
    };
  }

  private mapVendor(row: any): any {
    return {
      id:             row.id,
      companyName:    row.company_name    || '',
      primaryContact: row.primary_contact || {},
      officeAddress:  row.office_address  || {},
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

  async ngOnInit() {
    await this.loadInquiries();
    await this.loadVendors();
    await this.loadRfqs();

    // Pre-fill form when navigated from inquiry "Raise RFQ" button
    const state = history.state as any;
    if (state?.fromInquiry && state?.item) {
      this.resetForm();

      if (state.inquiryId) {
        this.inquiryId = state.inquiryId;
      }

      const it = state.item;
      this.items = [{
        product:   it.productName || it.product || '',
        form:      it.form      || '',
        make:      it.make      || '',
        density:   it.density   || '',
        thickness: it.thickness || '',
        size:      it.size      || '',
        fsk:       it.fsk       || '',
        grade:     it.grade     || '',
        alloy:     it.alloy     || '',
        temper:    it.temper    || '',
        nb:        it.nb        || '',
        maxTemp:   it.maxTemp   || '',
        color:     it.color     || '',
        qty:       it.qty       ?? null,
        uom:       it.uom       || '',
        fromInquiry: true
      }];

      if (state.vendorName) {
        this.vendorName = state.vendorName;
        this.onVendorSelect(state.vendorName);
      }

      this.showForm = true;
    }
  }

  private emptyAddr(): RfqAddress {
    return { line1: '', line2: '', city: '', state: '', pincode: '', country: '' };
  }

  private emptyItem(): RfqItem {
    return {
      product: '', form: '', make: '', density: '', thickness: '',
      size: '', fsk: '', grade: '', alloy: '', temper: '',
      nb: '', maxTemp: '', color: '', qty: null, uom: ''
    };
  }

  async loadInquiries() {
    const rows = await this.apiService.getAll('inquiries');
    this.inquiries = rows.map((r: any) => this.mapInquiry(r));
  }

  async loadVendors() {
    const rows = await this.apiService.getAll('vendors');
    this.vendors = rows.map((r: any) => this.mapVendor(r));
  }

  async loadRfqs() {
    const rows = await this.apiService.getAll('rfqs');
    this.rfqList = rows
      .map((r: any) => this.fromDbRow(r))
      .sort((a: RfqRecord, b: RfqRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  createNewRfq() {
    this.resetForm();
    this.showForm = true;
  }

  resetForm() {
    this.editingRfq = null;
    this.rfqId = this.generateRfqId();
    this.rfqDate = new Date().toISOString().split('T')[0];
    this.inquiryId = '';
    this.vendorName = '';
    this.vendorAddress = '';
    this.contactTitle = '';
    this.contactFirstName = '';
    this.contactLastName = '';
    this.mobile = '';
    this.email = '';
    this.items = [this.emptyItem()];
    this.shippingAddress = {
      line1: 'A. N. House, 4th Floor, 31st Road, Linking Road, Bandra (West)',
      line2: 'Warehouse: Agarwal Industrial Estate, Plot No. 6, Unit No. 1, Sativali Road, Vasai Road (E)',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400 050',
      country: 'India'
    };
    this.notes = '';
    this.otherTerms = '';
    this.attachments = [];
  }

  goBackToList() {
    this.showForm = false;
  }

  onInquirySelect(displayId: string) {
    if (!displayId) return;
    const match = displayId.match(/INQ-(\d+)/i);
    const seqNum = match ? parseInt(match[1], 10) : null;
    const inq = seqNum != null
      ? this.inquiries.find((i: any) => i.id === seqNum)
      : this.inquiries.find((i: any) => i.inquiryRef === displayId);
    if (!inq) return;

    this.rfqDate = inq.date || this.rfqDate;

    if (inq.items && inq.items.length > 0) {
      this.items = inq.items.map((it: any) => ({
        product:   it.product || it.item || it.productName || '',
        form:      it.form      || '',
        make:      it.productMake || it.make || '',
        density:   it.density   || '',
        thickness: it.thickness || '',
        size:      it.size      || '',
        fsk:       it.fsk       || '',
        grade:     it.grade     || '',
        alloy:     it.alloy     || '',
        temper:    it.temper    || '',
        nb:        it.nb        || '',
        maxTemp:   it.maxTemp   || '',
        color:     it.color     || '',
        qty:       it.qty       || null,
        uom:       it.uom       || '',
        fromInquiry: true
      }));
    }
  }

  onVendorSelect(companyName?: string) {
    const name = companyName ?? this.vendorName;
    const v = this.vendors.find((x: any) => x.companyName === name);
    if (!v) return;
    const pc = v.primaryContact || {};
    this.contactTitle     = pc.title     || '';
    this.contactFirstName = pc.firstName || '';
    this.contactLastName  = pc.lastName  || '';
    this.mobile           = pc.mobile    || '';
    this.email            = pc.email     || '';
    const oa = v.officeAddress || {};
    this.vendorAddress = [oa.line1, oa.line2, oa.city, oa.state, oa.pincode, oa.country]
      .filter(Boolean).join(', ');
  }

  addItem() {
    this.items.push(this.emptyItem());
  }

  removeItem(i: number) {
    this.items.splice(i, 1);
  }

  onAttachmentSelect(event: any) {
    const files: FileList = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.attachments.push({ name: f.name, data: e.target.result });
      };
      reader.readAsDataURL(f);
    }
  }

  removeAttachment(i: number) {
    this.attachments.splice(i, 1);
  }

  buildPayload(status: 'DRAFT' | 'SENT'): RfqRecord {
    return {
      ...(this.editingRfq?.id ? { id: this.editingRfq.id } : {}),
      rfqId: this.rfqId,
      rfqDate: this.rfqDate,
      inquiryId: this.inquiryId,
      vendorName: this.vendorName,
      vendorAddress: this.vendorAddress,
      contactTitle: this.contactTitle,
      contactFirstName: this.contactFirstName,
      contactLastName: this.contactLastName,
      mobile: this.mobile,
      email: this.email,
      items: JSON.parse(JSON.stringify(this.items)),
      shippingAddress: { ...this.shippingAddress },
      notes: this.notes,
      otherTerms: this.otherTerms,
      attachments: this.attachments,
      status,
      createdAt: this.editingRfq?.createdAt ?? new Date().toISOString()
    };
  }

  async saveRfq() {
    const payload = this.buildPayload('DRAFT');
    await this.apiService.put('rfqs', this.toDbRow(payload));
    await this.loadRfqs();
    this.showForm = false;
  }

  async cancelForm() {
    this.showForm = false;
  }

  editRfq(rfq: RfqRecord) {
    this.editingRfq = rfq;
    this.rfqId           = rfq.rfqId;
    this.rfqDate         = rfq.rfqDate;
    this.inquiryId       = rfq.inquiryId;
    this.vendorName      = rfq.vendorName;
    this.vendorAddress   = rfq.vendorAddress || '';
    this.contactTitle    = rfq.contactTitle || '';
    this.contactFirstName = rfq.contactFirstName;
    this.contactLastName  = rfq.contactLastName;
    this.mobile          = rfq.mobile;
    this.email           = rfq.email;
    this.items           = JSON.parse(JSON.stringify(rfq.items));
    this.shippingAddress = { ...rfq.shippingAddress };
    this.notes           = rfq.notes;
    this.otherTerms      = rfq.otherTerms;
    this.attachments     = rfq.attachments || [];
    this.showForm        = true;
  }

  async deleteRfq(rfq: RfqRecord) {
    if (!await this.confirmService.confirm(`Delete ${rfq.rfqId}?`, { danger: true })) return;
    await this.apiService.delete('rfqs', rfq.id!);
    await this.loadRfqs();
  }

  /** Export from list table (uses saved record directly) */
  exportRfqToExcel(rfq: RfqRecord) {
    this.exportRfqData(rfq).catch(console.error);
  }

  /** Export from form (builds record from current field values) */
  exportToExcel() {
    this.exportRfqData(this.buildPayload(this.editingRfq?.status ?? 'DRAFT')).catch(console.error);
  }

  private async exportRfqData(rfq: RfqRecord): Promise<void> {
    const safe = (v: any) => (v == null ? '' : String(v).trim());

    type ProductKey = keyof Omit<RfqItem, 'fromInquiry'>;
    const allProductFields: [string, ProductKey][] = [
      ['Product', 'product'], ['Form', 'form'], ['Make', 'make'],
      ['Density', 'density'], ['Thickness', 'thickness'], ['Size', 'size'],
      ['FSK Facing', 'fsk'], ['Grade', 'grade'], ['Alloy', 'alloy'],
      ['Temper', 'temper'], ['NB', 'nb'], ['Max Temp (°C)', 'maxTemp'],
      ['Color', 'color'], ['Qty', 'qty'], ['UOM', 'uom'],
    ];
    const usedFields = allProductFields.filter(([, key]) =>
      rfq.items.some(it => safe(it[key] as any) !== '')
    );

    const totalCols = Math.max(10, usedFields.length + 1);

    const ExcelJSMod = (await import('exceljs')) as any;
    const ExcelJS = ExcelJSMod.default || ExcelJSMod;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Navbharat Insulation & Engg Co';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('RFQ', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
    });

    const colWidths: number[] = [20, 28, 4, 20, 28];
    for (let i = 5; i < totalCols; i++) colWidths.push(16);
    ws.columns = colWidths.map((w: number) => ({ width: w }));

    const NAVY = 'FF1E3A5F';
    const NAVY2 = 'FF2E5FA3';
    const WHITE = 'FFFFFFFF';
    const DARK = 'FF1A1A2E';
    const LABEL_BG = 'FFE8EDF5';
    const ROW_ALT = 'FFEFF5FF';
    const BORDER = 'FFB0BFDA';
    const NAVY_TEXT = 'FFCCE0FF';
    const LBL_TEXT = 'FF3B4F7C';
    const SUBTEXT = 'FF888888';

    const fill = (cell: any, argb: string) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    };
    const border = (cell: any, c = BORDER) => {
      const s = { style: 'thin', color: { argb: c } };
      cell.border = { top: s, bottom: s, left: s, right: s };
    };
    const mc = (r1: number, c1: number, r2: number, c2: number) => {
      if (c2 > c1) ws.mergeCells(r1, c1, r2, c2);
    };

    let r = 0;

    r++;
    ws.getRow(r).height = 30;
    {
      const c = ws.getCell(r, 1);
      c.value = 'NAVBHARAT INSULATION & ENGG CO';
      c.font = { bold: true, size: 16, color: { argb: WHITE }, name: 'Calibri' };
      fill(c, NAVY);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      mc(r, 1, r, totalCols);
    }

    r++;
    ws.getRow(r).height = 16;
    {
      const c = ws.getCell(r, 1);
      c.value = 'A. N. House, 4th Floor, 31st Road, Linking Road, Bandra (W), Mumbai - 400 050';
      c.font = { size: 8, color: { argb: NAVY_TEXT }, name: 'Calibri' };
      fill(c, NAVY);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      mc(r, 1, r, totalCols);
    }

    r++;
    ws.getRow(r).height = 6;

    r++;
    ws.getRow(r).height = 32;
    {
      const c = ws.getCell(r, 1);
      c.value = 'REQUEST FOR QUOTATION';
      c.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Calibri' };
      fill(c, NAVY2);
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      mc(r, 1, r, totalCols);
    }

    r++;
    ws.getRow(r).height = 8;

    const titleStr = rfq.contactTitle ? rfq.contactTitle.replace(/\.?$/, '.') + ' ' : '';
    const contactName = `${titleStr}${safe(rfq.contactFirstName)} ${safe(rfq.contactLastName)}`.trim();
    const leftInfo: [string, string][] = ([
      ['RFQ Number',          safe(rfq.rfqId)],
      ['RFQ Date',            safe(rfq.rfqDate)],
      ['Inquiry Reference',   safe(rfq.inquiryId)],
      ['Document Status',     safe(rfq.status)],
    ] as [string, string][]).filter(([, v]) => v !== '');

    const rightInfo: [string, string][] = ([
      ['Vendor Name',    safe(rfq.vendorName)],
      ['Vendor Address', safe(rfq.vendorAddress)],
      ['Contact Person', contactName],
      ['Mobile',         safe(rfq.mobile)],
      ['Email',          safe(rfq.email)],
    ] as [string, string][]).filter(([, v]) => v !== '');

    const styleLabel = (c: any) => {
      c.font = { bold: true, size: 9, color: { argb: LBL_TEXT }, name: 'Calibri' };
      fill(c, LABEL_BG);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      border(c);
    };
    const styleValue = (c: any) => {
      c.font = { size: 9, color: { argb: DARK }, name: 'Calibri' };
      fill(c, WHITE);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      border(c);
    };

    const maxInfo = Math.max(leftInfo.length, rightInfo.length);
    for (let i = 0; i < maxInfo; i++) {
      r++;
      ws.getRow(r).height = 18;
      if (leftInfo[i]) {
        const l = ws.getCell(r, 1); l.value = leftInfo[i][0]; styleLabel(l);
        const v = ws.getCell(r, 2); v.value = leftInfo[i][1]; styleValue(v);
      }
      if (rightInfo[i]) {
        const l = ws.getCell(r, 4); l.value = rightInfo[i][0]; styleLabel(l);
        const v = ws.getCell(r, 5); v.value = rightInfo[i][1]; styleValue(v);
      }
    }

    r++;
    ws.getRow(r).height = 8;
    r++;
    ws.getRow(r).height = 20;
    {
      const c = ws.getCell(r, 1);
      c.value = 'DELIVERY ADDRESS';
      c.font = { bold: true, size: 9, color: { argb: WHITE }, name: 'Calibri' };
      fill(c, NAVY);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      mc(r, 1, r, totalCols);
    }

    const addr = rfq.shippingAddress;
    const addrLines = [
      [safe(addr.line1), safe(addr.line2)].filter(Boolean).join(', '),
      [safe(addr.city), safe(addr.state), safe(addr.pincode), safe(addr.country)].filter(Boolean).join(', '),
    ].filter(Boolean);
    for (const line of addrLines) {
      r++;
      ws.getRow(r).height = 16;
      const c = ws.getCell(r, 1);
      c.value = line;
      c.font = { size: 9, name: 'Calibri', color: { argb: DARK } };
      fill(c, 'FFF5F7FF');
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 2, wrapText: true };
      mc(r, 1, r, totalCols);
    }

    r++;
    ws.getRow(r).height = 8;
    r++;
    ws.getRow(r).height = 20;
    {
      const c = ws.getCell(r, 1);
      c.value = 'PRODUCT REQUIREMENTS';
      c.font = { bold: true, size: 9, color: { argb: WHITE }, name: 'Calibri' };
      fill(c, NAVY);
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      mc(r, 1, r, totalCols);
    }

    r++;
    ws.getRow(r).height = 22;
    const tableHeaders = ['#', ...usedFields.map(([label]: [string, ProductKey]) => label)];
    tableHeaders.forEach((h: string, ci: number) => {
      const c = ws.getCell(r, ci + 1);
      c.value = h;
      c.font = { bold: true, size: 9, color: { argb: WHITE }, name: 'Calibri' };
      fill(c, NAVY2);
      c.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'center' : 'left', indent: ci > 0 ? 1 : 0 };
      border(c, 'FF8FA8D0');
    });

    rfq.items.forEach((it: RfqItem, idx: number) => {
      r++;
      ws.getRow(r).height = 18;
      const rowBg = idx % 2 === 1 ? ROW_ALT : WHITE;
      const rowData: any[] = [
        String(idx + 1),
        ...usedFields.map(([, key]: [string, ProductKey]) => {
          const v = it[key];
          if (v == null || safe(v as any) === '') return '';
          return key === 'qty' ? Number(v) : safe(v as any);
        })
      ];
      rowData.forEach((val: any, ci: number) => {
        const c = ws.getCell(r, ci + 1);
        c.value = val;
        c.font = { size: 9, name: 'Calibri', color: { argb: DARK } };
        fill(c, rowBg);
        c.alignment = { vertical: 'middle', horizontal: ci === 0 ? 'center' : 'left', indent: ci > 0 ? 1 : 0 };
        border(c);
      });
    });

    r++;
    ws.getRow(r).height = 8;
    r++;
    ws.getRow(r).height = 18;
    const footerSplit = Math.max(5, totalCols - 4);
    {
      const c = ws.getCell(r, 1);
      c.value = 'This is a system-generated document. Please quote your best prices at the earliest.';
      c.font = { size: 8, italic: true, color: { argb: SUBTEXT }, name: 'Calibri' };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      mc(r, 1, r, footerSplit);
    }

    r++;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${rfq.rfqId || 'RFQ'}.xlsx`
    );
  }

  get inquiryOptions(): any[] {
    return this.inquiries.map((i: any) => {
      const id = i.inquiryRef || `INQ-${String(i.id || 0).padStart(3, '0')}`;
      const company = i.companyName || '';
      return { label: `${id} | ${company}`, value: id };
    });
  }

  private generateRfqId(): string {
    const maxNum = this.rfqList.reduce((max: number, r: RfqRecord) => {
      const match = (r.rfqId || '').match(/^RFQ-(\d{1,4})$/i);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    return `RFQ-${String(maxNum + 1).padStart(3, '0')}`;
  }
}
