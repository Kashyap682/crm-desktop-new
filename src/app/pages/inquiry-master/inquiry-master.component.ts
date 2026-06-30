import { Component, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MATERIAL_MASTER, MATERIAL_CATEGORIES,
  getMaterialById, getSpecFields,
  type MaterialDef, type FieldDef
} from '../../config/material-master';


/* =============================
   INTERFACES
============================= */

interface InquiryItem {
  productName?: string;
  material?: string;              // material id from MATERIAL_MASTER
  specs?: Record<string, string>; // dynamic spec values keyed by FieldDef.key
  make?: string;
  hsn?: string;
  form?: string;

  // Legacy flat spec fields — kept for backward compat with existing saved inquiries
  density?: string;
  thickness?: string;
  fsk?: string;
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

  _lockedFields?: string[];
  _shutFields?: string[];
  _disabledFields?: string[];
}


interface FollowUpEntry {
  date: string;
  note: string;
}

interface InquiryRecord {
  id?: number;
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

  // Material master — exposed to template
  readonly materialMaster = MATERIAL_MASTER;
  readonly materialCategories = MATERIAL_CATEGORIES;

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
    private dbService: DBService,
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

  /* -----------------------------
     SALES ORDER NAVIGATION ✅
  ----------------------------- */
  async openSalesOrder(inq: InquiryRecord) {
    const allOffers = await this.dbService.getAll('offers');
    const offer = allOffers.find((o: any) =>
      o.inquiryNo === inq.id && o.status !== 'superseded'
    ) || null;
    this.router.navigate(['/sales-order'], { state: { inquiry: inq, offer } });
  }

  async openpurchaseOrder(inq: InquiryRecord) {
    const allOffers = await this.dbService.getAll('offers');
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
    this.customers = await this.dbService.getAll('customers');
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
    this.inventory = await this.dbService.getAll('inventory');
  }

  /* -----------------------------
    PRODUCT SELECTION
  ----------------------------- */

  // onProductSelect(item: any) {
  //   if (!item.productName) return;

  //   // 🔍 Find inventory by NAME KEY (dropdown value)
  //   const product = this.inventory.find(
  //     p => p.name === item.productName
  //   );

  //   if (!product) return;

  //   // ✅ SAVE DISPLAY NAME (what user sees)
  //   item.productName = product.displayName;

  //   // ✅ Autofill rest (unchanged)
  //   item.make = product.productMake || '';
  //   item.uom = product.unit || 'Nos';

  //   if (product.size) {
  //     const parts = product.size.split(',');
  //     item.density = parts[0]?.trim() || '';
  //     item.thickness = parts[1]?.trim() || '';
  //   }

  //   item.form = product.category || '';
  //   item.fsk = product.specifications || '';
  // }

  private emptyItem(): InquiryItem {
    return {
      productName: '', material: '', specs: {},
      make: '', hsn: '', form: '',
      density: '', thickness: '', fsk: '',
      size: '', grade: '', alloy: '', temper: '', nb: '', maxTemp: '', color: '',
      qty: 1, uom: '', stock: '', leadTime: '',
      _lockedFields: [], _shutFields: [], _disabledFields: []
    };
  }

  // ── Material master helpers ───────────────────────────────────────────────

  /** Always returns it.specs as a defined object — initialises to {} if missing */
  specOf(it: InquiryItem): Record<string, string> {
    if (!it.specs) it.specs = {};
    return it.specs;
  }

  getMaterialsByCategory(cat: string): MaterialDef[] {
    return MATERIAL_MASTER.filter(m => m.category === cat);
  }

  getMaterialDef(it: InquiryItem): MaterialDef | undefined {
    return getMaterialById(it.material || '');
  }

  getFormOptions(it: InquiryItem): string[] {
    return getMaterialById(it.material || '')?.forms || [];
  }

  getMakeOptions(it: InquiryItem): string[] {
    return getMaterialById(it.material || '')?.makes || [];
  }

  /** Spec fields to display for the current material + form combination */
  getActiveSpecFields(it: InquiryItem): FieldDef[] {
    if (!it.material) return [];
    return getSpecFields(it.material, it.form || '');
  }

  onMaterialChange(it: InquiryItem): void {
    const mat = getMaterialById(it.material || '');
    it.specs = {};
    it.form = mat?.forms[0] || '';
    it.make = '';
    it.uom = mat?.defaultUom || '';
    // Pre-fill productName from material name if the field is still empty
    if (mat && !it.productName) it.productName = mat.name;
  }

  onFormChange(it: InquiryItem): void {
    // Drop any spec values that no longer belong to the new form's field set
    const activeKeys = new Set(getSpecFields(it.material || '', it.form || '').map(f => f.key));
    if (it.specs) {
      for (const key of Object.keys(it.specs)) {
        if (!activeKeys.has(key)) delete it.specs[key];
      }
    }
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
    // New format: specs object populated by material master
    if (it.material && it.specs && Object.keys(it.specs).length > 0) {
      const fields = getSpecFields(it.material, it.form || '');
      return fields
        .filter(f => it.specs[f.key] && it.specs[f.key] !== '')
        .map(f => ({ label: f.label, value: it.specs[f.key] }));
    }
    // Legacy format: read from flat fields (inquiries saved before material master)
    const legacy: Record<string, string> = {
      form: 'Form', density: 'Density', thickness: 'Thickness',
      fsk: 'FSK Facing', size: 'Size', grade: 'Grade', alloy: 'Alloy',
      temper: 'Temper', nb: 'NB', maxTemp: 'Max Temp', color: 'Color'
    };
    return Object.entries(legacy)
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

  private async getNextInquiryId(): Promise<number> {
    const all = await this.dbService.getAll('inquiries');
    if (all.length === 0) return 1;
    const maxId = Math.max(...all.map((r: any) => r.id || 0));
    return maxId + 1;
  }


  async loadInquiries() {
    this.customers = await this.dbService.getAll('customers');
    const data = await this.dbService.getAll('inquiries') as InquiryRecord[];
    // Ensure specs is always an object — handles records saved before material master
    for (const inq of data) {
      for (const item of inq.items || []) {
        if (!item.specs) item.specs = {};
      }
    }
    this.inquiries = data;
    this.filteredInquiries = data;
  }

  /* -----------------------------
     SEARCH
  ----------------------------- */

  searchInquiries() {
    const term = this.searchTerm?.toLowerCase().trim();

    if (!term) {
      // ✅ SAME OBJECTS, SAME IDs
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
    return inq.id;
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

  // async saveInquiry() {
  //   if (!this.currentInquiry) return;

  //   const payload = { ...this.currentInquiry };
  //   delete payload.id; // ✅ never poison again

  //   await this.dbService.add('inquiries', payload);
  //   await this.loadInquiries();

  //   this.showAddEditModal = false;
  //   this.currentInquiry = null;
  // }

  // async saveInquiry() {
  //   if (!this.currentInquiry) return;

  //   const db = await this.dbService.openDB();
  //   const tx = db.transaction('inquiries', 'readwrite');
  //   const store = tx.objectStore('inquiries');

  //   if (this.isEditing) {
  //     store.put(this.currentInquiry);   // update
  //   } else {
  //     store.add(this.currentInquiry);   // insert
  //   }

  //   tx.oncomplete = async () => {
  //     await this.loadInquiries();
  //     this.showAddEditModal = false;
  //     this.currentInquiry = null;
  //   };
  // }

  async saveInquiry() {
    if (!this.currentInquiry) return;

    if (this.isEditing) {
      await this.dbService.put('inquiries', this.currentInquiry);
      console.log('✏️ Editing existing inquiry - no reminder created');
    } else {
      const savedId = await this.dbService.add('inquiries', this.currentInquiry);
      console.log('✅ NEW INQUIRY SAVED, ID:', savedId, 'Display:', this.getDisplayInquiryId(savedId));
      try {
        await this.dbService.createAutoReminder({
          type: 'inquiry',
          name: this.currentInquiry.customerName,
          mobile: this.currentInquiry.customerPhone,
          referenceNo: this.getDisplayInquiryId(savedId),
          followUpDays: 1,
          note: `Follow-up inquiry ${this.getDisplayInquiryId(savedId)} - ${this.currentInquiry.customerName}`
        });
        console.log('✅ Reminder creation call completed');
      } catch (error) {
        console.error('❌ Reminder creation failed:', error);
      }
    }

    await this.loadInquiries();
    this.showAddEditModal = false;

    if (!this.isEditing) {
      const savedCompany = this.currentInquiry?.companyName;
      const customer = this.customers.find((c: any) => c.companyName === savedCompany);
      if (!customer) {
        // Completely new customer — not in database yet
        this.verificationPopupIsNewCustomer = true;
        this.showVerificationPopup = true;
      } else if (!customer.billing?.gstVerified) {
        // Existing customer but GST not verified
        this.verificationPopupIsNewCustomer = false;
        this.showVerificationPopup = true;
      }
    }

    this.currentInquiry = null;
  }

  /* -----------------------------
     DELETE
  ----------------------------- */
  // async deleteInquiry(id: number, event?: Event) {
  //   console.log('🗑️ DELETE CLICKED, ID =', id);
  //   event?.stopPropagation();

  //   const db = await this.dbService.openDB();
  //   const tx = db.transaction('inquiries', 'readwrite');
  //   const store = tx.objectStore('inquiries');

  //   const req = store.delete(id);

  //   req.onsuccess = () => console.log('✅ Deleted ID:', id);
  //   req.onerror = () => console.error('❌ Delete failed', req.error);

  //   tx.oncomplete = async () => {
  //     await this.loadInquiries();
  //   };
  // }

  async deleteInquiry(id?: number, event?: Event) {
    console.log('🗑️ DELETE CLICKED, ID =', id);
    event?.stopPropagation();

    if (id === undefined) {
      console.error('❌ Cannot delete: ID is undefined');
      return;
    }

    await this.dbService.delete('inquiries', id);
    console.log('✅ Deleted ID:', id);
    await this.loadInquiries();
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
    console.log('📌 openFollowUpModal called with:', inq);
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
    await this.dbService.put('inquiries', this.followUpTarget);
    this.closeFollowUpModal();
    await this.loadInquiries();
  }

  /* -----------------------------
     LOST INQUIRY
  ----------------------------- */
  // openLostModal(inq: InquiryRecord) {
  //   this.lostTarget = inq;
  //   this.lostReasonText = '';
  //   this.lostRemarksText = '';
  //   this.showLostModal = true;
  // }

  openLostModal(inq: InquiryRecord) {
    console.log('📌 openLostModal called with:', inq);
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

    await this.dbService.put('inquiries', this.lostTarget);
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

}
