import { Component, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { ConfirmService } from '../../service/confirm.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


/* =============================
   INTERFACES
============================= */

interface InquiryItem {
  productName?: string;
  make?: string;
  hsn?: string;

  form?: string;
  density?: string;
  thickness?: string;
  fsk?: string;

  // new spec fields
  size?: string;
  grade?: string;
  alloy?: string;
  temper?: string;
  nb?: string;
  maxTemp?: string;
  color?: string;

  // order fields
  qty?: number;
  uom?: string;
  stock?: string;
  leadTime?: string;

  // locked = has inventory value (readonly); shut = no inventory value (disabled)
  _lockedFields?: string[];
  _shutFields?: string[];
  // kept for backward compat
  _disabledFields?: string[];
}


interface FollowUpEntry {
  date: string;
  note: string;
}

interface InquiryRecord {
  _uuid?: string;       // Postgres UUID — used for all DB operations
  id?: number;          // Sequential number extracted from inquiry_ref — used for display
  inquiryRef?: string;  // e.g. "INQ-001" — stored in inquiry_ref column
  date: string;

  companyName?: string;
  customerName: string;
  customerPhone?: string;
  customerPhoneCode?: string;
  customerPhoneCodeIso?: string;
  email?: string;
  mobile?: string;

  officeAddress?: string;   // autofilled formatted string from customer

  billing?: {
    street?: string; area?: string; city?: string;
    state?: string; pincode?: string; country?: string;
  };
  shipping?: {
    street?: string; area?: string; city?: string;
    state?: string; pincode?: string; country?: string;
  };

  items: InquiryItem[];
  notes?: string;
  followUps: FollowUpEntry[];

  inquiryType?: string;
  inquiryTypeCustom?: string;
  decision?: 'Under Negotiation' | 'Order Received' | 'Order Lost' | 'Rejected';
  rejectionReason?: string;

  lost?: {
    reason: string;
    remarks: string;
    date: string;
  };

  status?: string;
}


@Component({
  selector: 'app-inquiry-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inquiry-master.component.html',
  styleUrls: ['./inquiry-master.component.css']
})
export class InquiryMasterComponent {

  /* -----------------------------
     CORE VARIABLES
  ----------------------------- */

  inquiries: InquiryRecord[] = [];
  filteredInquiries: InquiryRecord[] = [];
  searchTerm: string = '';

  showAddEditModal = false;
  showViewModal = false;
  showFollowUpModal = false;
  showLostModal = false;
  showVerificationPopup = false;
  verificationPopupIsNewCustomer = false; // true = brand-new, false = existing but GST unverified

  isEditing = false;
  currentInquiry: InquiryRecord | null = null;
  previewInquiryId: string = '';
  viewInquiryRecord: InquiryRecord | null = null;
  followUpTarget: InquiryRecord | null = null;

  newFollowUpNote: string = '';
  lostTarget: InquiryRecord | null = null;
  lostReasonText: string = '';
  lostRemarksText: string = '';
  customers: any[] = [];
  inventory: any[] = [];
  contactOptions: Array<{ key: 'primary' | 'secondary'; label: string }> = [];
  selectedContactRole: 'primary' | 'secondary' = 'primary';
  companyNameSuggestions: string[] = [];

  /* ── Dial codes — same list as customers module ── */
  countryDialCodes = [
    { code: '+91',  iso: 'in', name: 'India' },
    { code: '+880', iso: 'bd', name: 'Bangladesh' },
    { code: '+977', iso: 'np', name: 'Nepal' },
    { code: '+92',  iso: 'pk', name: 'Pakistan' },
    { code: '+94',  iso: 'lk', name: 'Sri Lanka' },
    { code: '+1',   iso: 'us', name: 'United States' },
    { code: '+1',   iso: 'ca', name: 'Canada' },
    { code: '+44',  iso: 'gb', name: 'United Kingdom' },
    { code: '+971', iso: 'ae', name: 'UAE' },
    { code: '+966', iso: 'sa', name: 'Saudi Arabia' },
    { code: '+974', iso: 'qa', name: 'Qatar' },
    { code: '+968', iso: 'om', name: 'Oman' },
    { code: '+965', iso: 'kw', name: 'Kuwait' },
    { code: '+65',  iso: 'sg', name: 'Singapore' },
    { code: '+60',  iso: 'my', name: 'Malaysia' },
    { code: '+62',  iso: 'id', name: 'Indonesia' },
    { code: '+66',  iso: 'th', name: 'Thailand' },
    { code: '+61',  iso: 'au', name: 'Australia' },
    { code: '+86',  iso: 'cn', name: 'China' },
    { code: '+81',  iso: 'jp', name: 'Japan' },
    { code: '+49',  iso: 'de', name: 'Germany' },
    { code: '+33',  iso: 'fr', name: 'France' },
    { code: '+55',  iso: 'br', name: 'Brazil' },
    { code: '+27',  iso: 'za', name: 'South Africa' },
  ];

  openDialDropdown: string | null = null;

  @HostListener('document:click')
  closeAllDials(): void { this.openDialDropdown = null; }

  toggleInqDial(): void {
    this.openDialDropdown = this.openDialDropdown === 'inq' ? null : 'inq';
  }

  pickInqDial(code: string, iso: string): void {
    if (!this.currentInquiry) return;
    this.currentInquiry.customerPhoneCode    = code;
    this.currentInquiry.customerPhoneCodeIso = iso;
    this.openDialDropdown = null;
  }

  getInqPhoneIso(): string {
    if (!this.currentInquiry) return 'in';
    return this.currentInquiry.customerPhoneCodeIso
      || this.countryDialCodes.find(c => c.code === (this.currentInquiry!.customerPhoneCode ?? '+91'))?.iso
      || 'in';
  }

  indianStates: string[] = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  constructor(
    private apiService: ApiService,
    private toastService: ToastService,
    private confirmService: ConfirmService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.loadInquiries();
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

  // ── snake_case ↔ camelCase mapping ──────────────────────────

  /** Serialize camelCase InquiryRecord to snake_case PostgREST row */
  private toDbRow(inq: any): any {
    return {
      ...(inq._uuid ? { id: inq._uuid } : {}),
      date:                     inq.date                  || new Date().toISOString().slice(0, 10),
      company_name:             inq.companyName           ?? null,
      customer_name:            inq.customerName          ?? null,
      customer_phone:           inq.customerPhone         ?? null,
      customer_phone_code:      inq.customerPhoneCode     ?? null,
      customer_phone_code_iso:  inq.customerPhoneCodeIso  ?? null,
      email:                    inq.email                 ?? null,
      mobile:                   inq.mobile                ?? null,
      inquiry_type:             inq.inquiryType           ?? null,
      inquiry_type_custom:      inq.inquiryTypeCustom     ?? null,
      notes:                    inq.notes                 ?? null,
      status:                   inq.status                ?? 'open',
      decision:                 inq.decision              ?? null,
      rejection_reason:         inq.rejectionReason       ?? null,
      lost_reason:              inq.lost?.reason          ?? null,
      lost_remarks:             inq.lost?.remarks         ?? null,
      lost_date:                inq.lost?.date            ?? null,
      office_address:           inq.officeAddress         ?? null,
      billing:                  inq.billing               ?? null,
      shipping:                 inq.shipping              ?? null,
      items:                    inq.items                 ?? [],
      follow_ups:               inq.followUps             ?? [],
    };
  }

  /**
   * Deserialize snake_case PostgREST row back to camelCase InquiryRecord.
   * The sequential `id` is extracted from inquiry_ref (e.g. "INQ-003" → 3)
   * so all existing display code / cross-references continue to work.
   */
  private fromDbRow(row: any): InquiryRecord {
    const refMatch = (row.inquiry_ref || '').match(/INQ-(\d+)/i);
    const seqId = refMatch ? parseInt(refMatch[1], 10) : undefined;
    return {
      _uuid:                row.id,
      id:                   seqId,
      inquiryRef:           row.inquiry_ref             || '',
      date:                 row.date                    || '',
      companyName:          row.company_name            || '',
      customerName:         row.customer_name           || '',
      customerPhone:        row.customer_phone          || '',
      customerPhoneCode:    row.customer_phone_code     || '+91',
      customerPhoneCodeIso: row.customer_phone_code_iso || 'in',
      email:                row.email                   || '',
      mobile:               row.mobile                  || '',
      officeAddress:        row.office_address          || '',
      billing:              row.billing                 || {},
      shipping:             row.shipping                || {},
      inquiryType:          row.inquiry_type            || '',
      inquiryTypeCustom:    row.inquiry_type_custom     || '',
      notes:                row.notes                   || '',
      status:               row.status                  || 'open',
      decision:             row.decision                || undefined,
      rejectionReason:      row.rejection_reason        || '',
      lost: (row.lost_reason || row.lost_remarks || row.lost_date) ? {
        reason:  row.lost_reason  || '',
        remarks: row.lost_remarks || '',
        date:    row.lost_date    || '',
      } : undefined,
      items:    Array.isArray(row.items)      ? row.items      : [],
      followUps:Array.isArray(row.follow_ups) ? row.follow_ups : [],
    };
  }

  /* -----------------------------
     SALES ORDER NAVIGATION
  ----------------------------- */
  async openSalesOrder(inq: InquiryRecord) {
    const allOffers = await this.apiService.getAll('offers');
    const offer = allOffers.find((o: any) =>
      o.inquiryNo === inq.id && o.status !== 'superseded'
    ) || null;
    this.router.navigate(['/sales-order'], { state: { inquiry: inq, offer } });
  }

  async openpurchaseOrder(inq: InquiryRecord) {
    const allOffers = await this.apiService.getAll('offers');
    const offer = allOffers.find((o: any) =>
      o.inquiryNo === inq.id && o.status !== 'superseded'
    ) || null;
    this.router.navigate(['/purchase-order'], { state: { inquiry: inq, offer } });
  }

  goToRFQ(item?: any) {
    const inq = this.currentInquiry;
    // Look up vendor from inventory so RFQ can auto-fill vendor details
    const invItem = this.inventory.find((inv: any) => {
      const invName = (inv.displayName || inv.name || '').toLowerCase().trim();
      const selName = (item?.productName || '').toLowerCase().trim();
      return selName && invName === selName;
    });
    const vendorName = invItem?.vendorName || '';

    // For saved inquiries use the real ID; for new (unsaved) use the preview ID shown in the form
    const resolvedInquiryId = inq?.id
      ? this.getDisplayInquiryId(inq.id)
      : (this.previewInquiryId || '');

    this.router.navigate(['/rfq'], {
      state: {
        fromInquiry: true,
        inquiryId: resolvedInquiryId,
        inquiryNumericId: inq?.id ?? null,
        companyName: inq?.companyName || '',
        vendorName,
        item
      }
    });
  }

  ngOnInit() {
    this.loadInquiries();
    this.loadCustomers();
    this.loadInventory();
  }

  /* -----------------------------
     LOAD CUSTOMERS
  ----------------------------- */

  async loadCustomers() {
    const rows = await this.apiService.getAll('customers');
    // Map snake_case PostgREST columns to camelCase shape expected by this component
    this.customers = rows.map((r: any) => ({
      id:               r.id,
      companyName:      r.company_name    || '',
      name:             r.name            || '',
      email:            r.email           || '',
      mobile:           r.mobile          || '',
      primaryContact:   r.primary_contact   || {},
      secondaryContact: r.secondary_contact || {},
      officeAddress:    r.office_address    || {},
      billing:          r.billing           || {},
      shipping:         r.shipping          || {},
      customerPhoneCode: r.primary_contact?.mobileCode || '+91',
    }));
  }

  /* -----------------------------
     COMPANY SELECTION
  ----------------------------- */
  private buildFullName(contact: any): string {
    if (!contact) return '';
    const title = contact.title ? contact.title.replace(/\.?$/, '.') : '';
    return [title, contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  }

  private populateContactOptions(companyName?: string): void {
    if (!companyName) { this.contactOptions = []; return; }
    const customer = this.customers.find(c => c.companyName === companyName);
    if (!customer) { this.contactOptions = []; return; }
    const options: Array<{ key: 'primary' | 'secondary'; label: string }> = [];
    const p = this.buildFullName(customer.primaryContact) || customer.name || customer.companyName || 'N/A';
    const s = this.buildFullName(customer.secondaryContact) || customer.name || customer.companyName || 'N/A';
    options.push({ key: 'primary', label: `Primary Contact - ${p}` });
    if (customer.secondaryContact?.firstName || customer.secondaryContact?.lastName) {
      options.push({ key: 'secondary', label: `Secondary Contact - ${s}` });
    }
    this.contactOptions = options;
  }

  onCompanySelect() {
    if (!this.currentInquiry) return;

    const customer = this.customers.find(
      c => c.companyName === this.currentInquiry!.companyName
    );

    if (!customer) { this.contactOptions = []; return; }

    // Build contact name dropdown options
    this.populateContactOptions(customer.companyName);
    const pc = customer.primaryContact;
    this.selectedContactRole = 'primary';
    this.applySelectedContactDetails();

    // Phone / email — check primaryContact first, then top-level
    this.currentInquiry.customerPhoneCode = pc?.mobileCode || customer.customerPhoneCode || '+91';

    // Build office address string — try officeAddress, then billing as fallback
    const buildAddr = (obj: any): string => {
      if (!obj) return '';
      const parts = [
        obj.line1 || obj.street,
        obj.line2 || obj.area,
        obj.city, obj.state, obj.pincode, obj.country
      ].filter(Boolean);
      return parts.join(', ');
    };

    this.currentInquiry.officeAddress =
      buildAddr(customer.officeAddress) || buildAddr(customer.billing) || '';

    this.currentInquiry.billing  = customer.billing  ? { ...customer.billing  } : {};
    this.currentInquiry.shipping = customer.shipping ? { ...customer.shipping } : {};
  }

  /** Returns true when the typed company name is NOT in the customer database */
  isNewCustomer(): boolean {
    const name = this.currentInquiry?.companyName?.trim();
    if (!name) return false;
    return !this.customers.find((c: any) => c.companyName === name);
  }

  /** Filter company name suggestions as the user types */
  onCompanyNameInput(): void {
    if (!this.currentInquiry) return;
    const term = (this.currentInquiry.companyName || '').toLowerCase().trim();
    if (!term) {
      this.companyNameSuggestions = [];
      this.contactOptions = [];
      return;
    }
    this.companyNameSuggestions = this.customers
      .map((c: any) => c.companyName as string)
      .filter(name => name && name.toLowerCase().includes(term))
      .slice(0, 8);
  }

  /** Pick a company from the autocomplete suggestion list */
  pickCompany(name: string): void {
    if (!this.currentInquiry) return;
    this.currentInquiry.companyName = name;
    this.companyNameSuggestions = [];
    this.onCompanySelect(); // auto-fill contact, address, etc.
  }

  /** On blur — if exact match in DB, auto-populate; always hide suggestions */
  onCompanyBlur(): void {
    setTimeout(() => {
      this.companyNameSuggestions = [];
      this.onCompanySelect(); // safe no-op when no match
    }, 200);
  }

  /* -----------------------------
   LOAD INVENTORY
----------------------------- */
  async loadInventory() {
    this.inventory = await this.apiService.getAll('inventory');
  }

  /* -----------------------------
    PRODUCT SELECTION
  ----------------------------- */

  private emptyItem(): InquiryItem {
    return {
      productName: '', make: '', hsn: '', form: '',
      density: '', thickness: '', fsk: '',
      size: '', grade: '', alloy: '', temper: '', nb: '', maxTemp: '', color: '',
      qty: 1, uom: '', stock: '', leadTime: '',
      _lockedFields: [], _shutFields: [], _disabledFields: []
    };
  }

  // Field has inventory value — show as readonly
  isFieldLocked(it: InquiryItem, field: string): boolean {
    return (it._lockedFields || []).includes(field);
  }

  // Field has no inventory value — fully disabled (no entry)
  isFieldShut(it: InquiryItem, field: string): boolean {
    return (it._shutFields || []).includes(field);
  }

  // kept for backward compat — still works the same
  isFieldDisabled(it: InquiryItem, field: string): boolean {
    return this.isFieldLocked(it, field) || this.isFieldShut(it, field);
  }

  onProductSelect(it: any) {
    // If product cleared, reset all locks
    if (!it.productName) {
      it._lockedFields = [];
      it._shutFields = [];
      it._disabledFields = [];
      return;
    }

    const selected = this.inventory.find((p: any) => {
      const invName = (p.displayName || p.name || '').toLowerCase().trim();
      const selName = (it.productName || '').toLowerCase().trim();
      return invName === selName;
    });

    if (!selected) {
      it._lockedFields = [];
      it._shutFields = [];
      it._disabledFields = [];
      return;
    }

    // Map of field → inventory value
    const specFields: Record<string, string> = {
      make:      selected.productMake || '',
      hsn:       selected.hsn || '',
      form:      selected.category || '',
      density:   selected.density || '',
      thickness: selected.thickness || '',
      fsk:       selected.fsk || '',
      size:      selected.size || '',
      grade:     selected.grade || '',
      alloy:     selected.alloy || '',
      temper:    selected.temper || '',
      nb:        selected.nb || '',
      maxTemp:   selected.maxTemp || '',
      color:     selected.color || ''
    };

    const locked: string[] = [];
    const shut: string[] = [];

    for (const [field, value] of Object.entries(specFields)) {
      if (value) {
        // Has inventory data — autofill and lock
        it[field] = value;
        locked.push(field);
      } else {
        // No inventory data — shut (no entry allowed)
        it[field] = '';
        shut.push(field);
      }
    }

    // UOM & Stock: autofill from inventory, leave editable
    if (selected.unit) it.uom = selected.unit;
    const stockVal = selected.stock ?? '';
    it.stock = stockVal !== '' ? String(stockVal) : '';

    it._lockedFields = locked;
    it._shutFields = shut;
    it._disabledFields = [...locked, ...shut];
  }

  /* -----------------------------
     LOAD INQUIRIES
  ----------------------------- */

  getDisplayInquiryId(id?: number): string {
    if (id === null || id === undefined) return '-';
    const raw = String(id).trim();
    if (!raw) return '-';
    const match = raw.match(/INQ-(\d+)/i);
    const num = match ? parseInt(match[1], 10) : Number(raw);
    if (!Number.isFinite(num) || num <= 0) return raw;
    return `INQ-${String(num).padStart(3, '0')}`;
  }

  getSpecEntries(it: any): { label: string; value: string }[] {
    const map: Record<string, string> = {
      form: 'Form', make: 'Make', density: 'Density', thickness: 'Thickness',
      fsk: 'FSK', size: 'Size', grade: 'Grade', alloy: 'Alloy',
      temper: 'Temper', nb: 'NB', maxTemp: 'Max Temp', color: 'Color'
    };
    return Object.entries(map)
      .filter(([k]) => it[k] && it[k] !== '')
      .map(([k, label]) => ({ label, value: it[k] }));
  }

  onCustomerContactChange() {
    this.applySelectedContactDetails();
  }

  private applySelectedContactDetails() {
    if (!this.currentInquiry?.companyName) return;
    const customer = this.customers.find(c => c.companyName === this.currentInquiry!.companyName);
    if (!customer) return;
    const selected = this.selectedContactRole === 'secondary'
      ? (customer.secondaryContact || customer.primaryContact)
      : customer.primaryContact;
    this.currentInquiry.customerName = this.buildFullName(selected) || customer.name || '';
    this.currentInquiry.customerPhone = selected?.mobile || customer.mobile || '';
    this.currentInquiry.customerPhoneCode = selected?.mobileCode || '+91';
    this.currentInquiry.email = selected?.email || customer.email || '';
  }

  async lookupPincode(addr: any, pincode?: string): Promise<void> {
    if (!addr || !pincode || pincode.length !== 6) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length) {
        const po = data[0].PostOffice[0];
        if (po.State) addr.state = po.State;
        if (po.District) addr.city = po.District;
      }
    } catch (_) { /* ignore lookup errors */ }
  }

  /**
   * Compute the next sequential inquiry number by scanning existing inquiry_refs.
   */
  private async getNextInquiryId(): Promise<number> {
    const all = await this.apiService.getAll('inquiries');
    if (all.length === 0) return 1;
    const max = Math.max(0, ...all.map((r: any) => {
      const m = (r.inquiry_ref || '').match(/INQ-(\d+)/i);
      return m ? parseInt(m[1], 10) : 0;
    }));
    return max + 1;
  }

  async loadInquiries() {
    const rows = await this.apiService.getAll('inquiries');
    this.inquiries = rows.map((r: any) => this.fromDbRow(r));
    this.filteredInquiries = [...this.inquiries];
  }

  /* -----------------------------
     SEARCH
  ----------------------------- */

  searchInquiries() {
    const term = this.searchTerm?.toLowerCase().trim();

    if (!term) {
      this.filteredInquiries = this.inquiries;
      return;
    }

    this.filteredInquiries = this.inquiries.filter(inq =>
      inq.customerName?.toLowerCase().includes(term) ||
      inq.companyName?.toLowerCase().includes(term)
    );
  }


  clearFilter() {
    this.searchTerm = '';
    this.filteredInquiries = [...this.inquiries];
  }

  trackByInquiryId(index: number, inq: InquiryRecord) {
    return inq._uuid || inq.id;
  }


  /* -----------------------------
     ADD / EDIT INQUIRY
  ----------------------------- */
  async openAddModal() {
    this.isEditing = false;
    const nextId = await this.getNextInquiryId();
    this.previewInquiryId = this.getDisplayInquiryId(nextId);
    this.showAddEditModal = true;
    this.contactOptions = [];
    this.currentInquiry = {
      date: new Date().toISOString().slice(0, 10),
      companyName: '',
      customerName: '',
      customerPhone: '',
      customerPhoneCode: '+91',
      customerPhoneCodeIso: 'in',
      email: '',
      officeAddress: '',
      inquiryTypeCustom: '',
      billing: {},
      shipping: {},
      items: [this.emptyItem()],
      notes: '',
      followUps: []
    };
  }


  openEditModal(inq: InquiryRecord) {
    this.isEditing = true;
    this.currentInquiry = JSON.parse(JSON.stringify(inq));

    if (this.currentInquiry && !this.currentInquiry.date) {
      this.currentInquiry.date = new Date().toISOString().slice(0, 10);
    }

    this.populateContactOptions(inq.companyName);
    this.showAddEditModal = true;
  }

  addItemRow() {
    if (!this.currentInquiry) return;
    this.currentInquiry.items.push(this.emptyItem());
  }

  removeItemRow(i: number) {
    if (!this.currentInquiry) return;
    this.currentInquiry.items.splice(i, 1);
  }

  async saveInquiry() {
    if (!this.currentInquiry) return;
    const isNew = !this.isEditing;
    try {
      if (this.isEditing) {
        await this.apiService.put('inquiries', this.toDbRow(this.currentInquiry));
      } else {
        // Use the preview ID (computed in openAddModal) as the human-readable ref
        const row = { ...this.toDbRow(this.currentInquiry), inquiry_ref: this.previewInquiryId };
        const newUuid = await this.apiService.add('inquiries', row);
        this.currentInquiry._uuid = newUuid;

        await this.addReminder({
          type: 'inquiry',
          name: this.currentInquiry.companyName || '',
          referenceNo: this.previewInquiryId || '',
          daysFromNow: 2,
          note: `Follow up on inquiry ${this.previewInquiryId}`,
        });
      }

      await this.loadInquiries();
      this.showAddEditModal = false;
      this.toastService.success(isNew ? `Inquiry ${this.previewInquiryId} created` : 'Inquiry updated');

      if (isNew) {
        const savedCompany = this.currentInquiry?.companyName;
        const customer = this.customers.find((c: any) => c.companyName === savedCompany);
        if (!customer) {
          this.verificationPopupIsNewCustomer = true;
          this.showVerificationPopup = true;
        } else if (!customer.billing?.gstVerified) {
          this.verificationPopupIsNewCustomer = false;
          this.showVerificationPopup = true;
        }
      }

      this.currentInquiry = null;
    } catch {
      this.toastService.error('Failed to save inquiry');
    }
  }

  /* -----------------------------
     DELETE
  ----------------------------- */

  async deleteInquiry(seqId?: number, event?: Event) {
    event?.stopPropagation();

    if (seqId === undefined) {
      console.error('❌ Cannot delete: ID is undefined');
      return;
    }

    // Resolve the Postgres UUID from the loaded inquiries list
    const inq = this.inquiries.find(i => i.id === seqId);
    const uuid = inq?._uuid;
    if (!uuid) {
      console.error('❌ Cannot delete: UUID not found for id', seqId);
      return;
    }

    if (!await this.confirmService.confirm(`Delete inquiry ${inq.inquiryRef || seqId}?`, { danger: true })) return;
    try {
      await this.apiService.delete('inquiries', uuid);
      await this.loadInquiries();
      this.toastService.success('Inquiry deleted');
    } catch {
      this.toastService.error('Failed to delete inquiry');
    }
  }



  /* -----------------------------
     VIEW MODAL
  ----------------------------- */
  openViewModal(inq: InquiryRecord) {
    this.viewInquiryRecord = inq;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.viewInquiryRecord = null;
  }

  /* -----------------------------
     FOLLOW-UP MODAL
  ----------------------------- */

  openFollowUpModal(inq: InquiryRecord) {
    this.followUpTarget = inq;
    this.newFollowUpNote = '';
    this.showFollowUpModal = true;
  }


  closeFollowUpModal() {
    this.showFollowUpModal = false;
    this.followUpTarget = null;
  }

  async addFollowUp() {
    if (!this.followUpTarget || !this.newFollowUpNote.trim()) return;

    const entry: FollowUpEntry = {
      date: new Date().toLocaleDateString(),
      note: this.newFollowUpNote
    };

    this.followUpTarget.followUps.push(entry);
    try {
      await this.apiService.put('inquiries', this.toDbRow(this.followUpTarget));
      this.toastService.success('Follow-up added');
    } catch {
      this.toastService.error('Failed to save follow-up');
    }
    this.closeFollowUpModal();
    await this.loadInquiries();
  }

  /* -----------------------------
     LOST INQUIRY
  ----------------------------- */

  openLostModal(inq: InquiryRecord) {
    this.lostTarget = inq;
    this.showLostModal = true;
  }

  closeLostModal() {
    this.showLostModal = false;
    this.lostTarget = null;
  }

  async markLost() {
    if (!this.lostTarget) return;

    this.lostTarget.lost = {
      reason: this.lostReasonText,
      remarks: this.lostRemarksText,
      date: new Date().toLocaleDateString()
    };

    try {
      await this.apiService.put('inquiries', this.toDbRow(this.lostTarget));
      this.toastService.success('Inquiry marked as lost');
    } catch {
      this.toastService.error('Failed to update inquiry');
    }
    this.closeLostModal();
    await this.loadInquiries();
  }

  /* -----------------------------
     CREATE OFFER NAVIGATION
  ----------------------------- */
  goToCreateOffer(inquiryId: number) {
    this.router.navigate(['/create-offer'], { state: { inquiryId } });
  }

  /* -----------------------------
     SEND ITEM TO INVENTORY
  ----------------------------- */
  sendItemToInventory(item: InquiryItem) {
    this.router.navigate(['/inventory'], { state: { inquiryItem: item } });
  }

  downloadInquiryPdf(inq: InquiryRecord) {
    if (!inq) return;

    const doc = new jsPDF('p', 'mm', 'a4');

    // ===== HEADER =====
    doc.setFontSize(16);
    doc.text('Inquiry Details', 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Inquiry ID: ${this.getDisplayInquiryId(inq.id)}`, 14, 25);
    doc.text(`Date: ${inq.date || '-'}`, 14, 32);

    doc.text(`Company: ${inq.companyName || '-'}`, 14, 39);
    doc.text(`Customer: ${inq.customerName || '-'}`, 14, 46);
    doc.text(`Phone: ${inq.customerPhone || '-'}`, 14, 53);

    doc.text(`Inquiry Type: ${inq.inquiryType || '-'}`, 14, 60);
    doc.text(`Decision: ${inq.decision || 'Pending'}`, 14, 67);

    if (inq.decision === 'Rejected') {
      doc.text(`Reason: ${inq.rejectionReason || '-'}`, 14, 74);
    }

    // ===== ITEMS TABLE =====
    autoTable(doc, {
      startY: inq.decision === 'Rejected' ? 82 : 74,
      head: [[
        'Product',
        'Make',
        'HSN',
        'Specs',
        'Qty',
        'UOM'
      ]],
      body: inq.items.map(it => [
        it.productName || '',
        it.make || '',
        it.hsn || '',
        `${it.form || ''} ${it.density || ''} ${it.thickness || ''} ${it.fsk || ''}`.trim(),
        it.qty ?? '',
        it.uom || ''
      ]),
      styles: {
        fontSize: 9
      },
      headStyles: {
        fillColor: [13, 42, 77] // navy blue
      }
    });

    // ===== NOTES =====
    let y = (doc as any).lastAutoTable.finalY + 10;

    if (inq.notes) {
      doc.setFontSize(10);
      doc.text('Notes:', 14, y);
      doc.setFontSize(9);
      doc.text(inq.notes, 14, y + 6, { maxWidth: 180 });
      y += 20;
    }

    // ===== FOLLOW UPS =====
    if (inq.followUps && inq.followUps.length > 0) {
      doc.setFontSize(10);
      doc.text('Follow-Ups:', 14, y);

      autoTable(doc, {
        startY: y + 6,
        head: [['Date', 'Note']],
        body: inq.followUps.map(f => [f.date, f.note]),
        styles: { fontSize: 9 },
        headStyles: {
          fillColor: [100, 100, 100]
        }
      });
    }

    // ===== SAVE =====
    const fileName = `${this.getDisplayInquiryId(inq.id)}.pdf`;
    doc.save(fileName);
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
