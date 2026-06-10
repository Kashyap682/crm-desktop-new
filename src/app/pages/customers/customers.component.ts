import { Component, HostListener } from '@angular/core';
import { read, writeFileXLSX } from 'xlsx';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { utils, writeFile } from 'xlsx';
import { ApiService } from '../../service/api.service';
import { ConfirmService } from '../../service/confirm.service';
import { ToastService } from '../../service/toast.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})
export class CustomersComponent {
  customers: any[] = [];
  searchTerm = '';
  showModal = false;
  isEditing = false;
  editingIndex: number | null = null;
  newCustomer: any = this.getEmptyCustomer();
  sameAsBilling = false;
  showBilling2 = false;
  showBillingChoiceModal = false;
  billingChoiceShippingIndex = 0;
  inventory: any[] = [];
  materialSuggestions: string[] = [];
  activeMaterialIndex: number | null = null;

  customerTypes = ['Contractor', 'End User', 'Manufacturer', 'Trader'];

  indianStates: string[] = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  countryDialCodes = [
    // South Asia
    { code: '+91',  iso: 'in', name: 'India' },
    { code: '+880', iso: 'bd', name: 'Bangladesh' },
    { code: '+975', iso: 'bt', name: 'Bhutan' },
    { code: '+960', iso: 'mv', name: 'Maldives' },
    { code: '+95',  iso: 'mm', name: 'Myanmar' },
    { code: '+977', iso: 'np', name: 'Nepal' },
    { code: '+92',  iso: 'pk', name: 'Pakistan' },
    { code: '+94',  iso: 'lk', name: 'Sri Lanka' },
    { code: '+93',  iso: 'af', name: 'Afghanistan' },
    // East & South-East Asia
    { code: '+86',  iso: 'cn', name: 'China' },
    { code: '+852', iso: 'hk', name: 'Hong Kong' },
    { code: '+62',  iso: 'id', name: 'Indonesia' },
    { code: '+81',  iso: 'jp', name: 'Japan' },
    { code: '+82',  iso: 'kr', name: 'South Korea' },
    { code: '+60',  iso: 'my', name: 'Malaysia' },
    { code: '+63',  iso: 'ph', name: 'Philippines' },
    { code: '+65',  iso: 'sg', name: 'Singapore' },
    { code: '+66',  iso: 'th', name: 'Thailand' },
    { code: '+84',  iso: 'vn', name: 'Vietnam' },
    // Middle East
    { code: '+973', iso: 'bh', name: 'Bahrain' },
    { code: '+20',  iso: 'eg', name: 'Egypt' },
    { code: '+965', iso: 'kw', name: 'Kuwait' },
    { code: '+968', iso: 'om', name: 'Oman' },
    { code: '+974', iso: 'qa', name: 'Qatar' },
    { code: '+966', iso: 'sa', name: 'Saudi Arabia' },
    { code: '+90',  iso: 'tr', name: 'Turkey' },
    { code: '+971', iso: 'ae', name: 'UAE' },
    // Europe
    { code: '+44',  iso: 'gb', name: 'United Kingdom' },
    { code: '+49',  iso: 'de', name: 'Germany' },
    { code: '+33',  iso: 'fr', name: 'France' },
    { code: '+39',  iso: 'it', name: 'Italy' },
    { code: '+31',  iso: 'nl', name: 'Netherlands' },
    { code: '+7',   iso: 'ru', name: 'Russia' },
    // Oceania
    { code: '+61',  iso: 'au', name: 'Australia' },
    { code: '+64',  iso: 'nz', name: 'New Zealand' },
    // North America
    { code: '+1',   iso: 'us', name: 'USA' },
    { code: '+1',   iso: 'ca', name: 'Canada' },
    { code: '+52',  iso: 'mx', name: 'Mexico' },
    // South America
    { code: '+54',  iso: 'ar', name: 'Argentina' },
    { code: '+55',  iso: 'br', name: 'Brazil' },
    // Africa
    { code: '+254', iso: 'ke', name: 'Kenya' },
    { code: '+234', iso: 'ng', name: 'Nigeria' },
    { code: '+27',  iso: 'za', name: 'South Africa' },
  ];

  openDialDropdown: string | null = null;

  getIso(code: string): string {
    return this.countryDialCodes.find(c => c.code === code)?.iso || 'in';
  }

  @HostListener('document:click')
  closeAllDials(): void { this.openDialDropdown = null; }

  toggleDial(key: string): void {
    this.openDialDropdown = this.openDialDropdown === key ? null : key;
  }

  pickDial(contact: any, code: string, iso: string): void {
    contact.mobileCode = code;
    contact.mobileCodeIso = iso;
    this.openDialDropdown = null;
  }

  contactIso(contact: any): string {
    return contact?.mobileCodeIso || this.getIso(contact?.mobileCode ?? '+91');
  }

  countries: string[] = [
    'India',
    'Afghanistan', 'Australia', 'Bahrain', 'Bangladesh', 'Belgium', 'Bhutan',
    'Brazil', 'Canada', 'China', 'France', 'Germany', 'Hong Kong', 'Indonesia',
    'Iran', 'Iraq', 'Italy', 'Japan', 'Kenya', 'Kuwait', 'Malaysia', 'Maldives',
    'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Oman',
    'Pakistan', 'Philippines', 'Qatar', 'Russia', 'Saudi Arabia', 'Singapore',
    'South Africa', 'South Korea', 'Sri Lanka', 'Switzerland', 'Thailand',
    'United Arab Emirates', 'United Kingdom', 'United States of America'
  ];

  /** Auto-verify GST as the user types — validates format in real time */
  autoVerifyGST(addr: any): void {
    const gstin = (addr.gstin || '').trim().toUpperCase();
    addr.gstin = gstin; // normalise to uppercase while typing
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (gstin.length === 0) {
      addr.gstVerified = false;
      addr.gstInvalidFormat = false;
    } else if (gstin.length >= 15) {
      addr.gstVerified = gstRegex.test(gstin);
      addr.gstInvalidFormat = !gstRegex.test(gstin);
    } else {
      // Still typing — don't flag as invalid yet
      addr.gstVerified = false;
      addr.gstInvalidFormat = false;
    }
  }

  async lookupPincode(addr: any, pincode: string): Promise<void> {
    if (!pincode || pincode.length !== 6) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length) {
        const po = data[0].PostOffice[0];
        if (po.State) addr.state = po.State;
        if (po.District) addr.city = po.District;
      }
    } catch (_) { /* offline or API error */ }
  }

  /* ─── Empty material entry ─── */
  emptyMaterial() {
    return { material: '', form1: '', form2: '', form3: '' };
  }

  addProductMaterial() {
    this.newCustomer.productMaterials.push(this.emptyMaterial());
    this.materialSuggestions = [];
  }

  removeProductMaterial(i: number) {
    if (this.newCustomer.productMaterials.length > 1) {
      this.newCustomer.productMaterials.splice(i, 1);
    }
    this.materialSuggestions = [];
    this.activeMaterialIndex = null;
  }

  onMaterialInput(term: string, idx: number) {
    this.activeMaterialIndex = idx;
    if (!term?.trim()) { this.materialSuggestions = []; return; }
    const lower = term.toLowerCase();
    this.materialSuggestions = this.inventory
      .map((inv: any) => inv.displayName || inv.name || '')
      .filter(name => name && name.toLowerCase().includes(lower))
      .slice(0, 8);
  }

  pickMaterial(name: string, idx: number) {
    this.newCustomer.productMaterials[idx].material = name;
    this.materialSuggestions = [];
    this.activeMaterialIndex = null;
  }

  clearMaterialSuggestions() {
    setTimeout(() => {
      this.materialSuggestions = [];
      this.activeMaterialIndex = null;
    }, 200);
  }

  /* ─── Empty address contact ─── */
  private emptyAddrContact() {
    return { contactPerson: '', title: '', firstName: '', lastName: '', department: '', email: '', mobile: '', mobileCode: '+91' };
  }

  /** Display name for an address contact — uses title/first/last if set, falls back to legacy contactPerson */
  formatAddrContactName(cp: any): string {
    if (!cp) return '';
    const name = [cp.title, cp.firstName, cp.lastName].filter(Boolean).join(' ').trim();
    return name || cp.contactPerson || '';
  }

  addAddrContact(addr: any) {
    if (!addr.contacts) addr.contacts = [];
    addr.contacts.push(this.emptyAddrContact());
  }

  removeAddrContact(addr: any, i: number) {
    if (addr.contacts?.length > 1) addr.contacts.splice(i, 1);
  }

  /* ─── Empty address object ─── */
  private emptyAddr() {
    return {
      street: '', area: '', line1: '', line2: '',
      pincode: '', city: '', state: '', country: '',
      gstin: '', gstFile: undefined as any,
      contactPerson: '', email: '', mobile: '', department: '',
      contacts: [this.emptyAddrContact()]
    };
  }

  getEmptyCustomer() {
    return {
      id: undefined,
      customerId: '',
      customerType: '',
      name: '',
      companyName: '',
      logo: undefined as any,
      website: '',
      mobile: '',
      email: '',
      pan: '',
      panFile: undefined,
      msme: '',
      msmeFile: undefined,
      officeAddress: this.emptyAddr(),
      billing:  this.emptyAddr(),
      billing2: null as any,
      shippingAddresses: [this.emptyAddr()] as any[],
      primaryContact:   { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '' },
      secondaryContact: { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '' },
      productMaterials: [this.emptyMaterial()]
    };
  }

  /* ─── Second billing address ─── */
  addBilling2() {
    this.showBilling2 = true;
    this.newCustomer.billing2 = this.emptyAddr();
  }

  removeBilling2() {
    this.showBilling2 = false;
    this.newCustomer.billing2 = null;
  }

  /* ─── Shipping addresses ─── */
  addShippingAddress() {
    if (!this.newCustomer.shippingAddresses) this.newCustomer.shippingAddresses = [];
    this.newCustomer.shippingAddresses.push(this.emptyAddr());
  }

  removeShippingAddress(i: number) {
    if (this.newCustomer.shippingAddresses.length > 1) {
      this.newCustomer.shippingAddresses.splice(i, 1);
    }
  }

  /* ─── Same-as helpers ─── */
  copyOfficeToBilling() {
    this.newCustomer.billing = { ...this.newCustomer.officeAddress };
  }

  copyOfficeToShipping(i: number) {
    this.newCustomer.shippingAddresses[i] = { ...this.newCustomer.officeAddress };
  }

  copyBillingToShipping(i: number) {
    this.newCustomer.shippingAddresses[i] = { ...this.newCustomer.billing };
  }

  copyBillingToShippingDirect(shippingIndex: number, which: 1 | 2) {
    const src = which === 2 ? this.newCustomer.billing2 : this.newCustomer.billing;
    this.newCustomer.shippingAddresses[shippingIndex] = { ...src };
  }

  /* ─── File handler for address GST document ─── */
  readFileToAddr(event: any, addr: any, key: string) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.MAX_FILE_MB * 1024 * 1024) {
      this.toastService.warning(`File too large — maximum ${this.MAX_FILE_MB} MB allowed`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { addr[key] = { name: file.name, type: file.type, data: reader.result as string }; };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  /* ─── File handlers ─── */
  onPanFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.MAX_FILE_MB * 1024 * 1024) {
      this.toastService.warning(`File too large — maximum ${this.MAX_FILE_MB} MB allowed`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.panFile = { name: file.name, type: file.type, data: reader.result as string };
    };
    reader.readAsDataURL(file);
  }

  async onPanFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.MAX_FILE_MB * 1024 * 1024) {
      this.toastService.warning(`File too large — maximum ${this.MAX_FILE_MB} MB allowed`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      customer.panFile = { name: file.name, type: file.type, data: reader.result as string };
      await this.apiService.put('customers', this.toDbRow(customer));
    };
    reader.readAsDataURL(file);
  }

  onLogoSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.MAX_FILE_MB * 1024 * 1024) {
      this.toastService.warning(`File too large — maximum ${this.MAX_FILE_MB} MB allowed`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.logo = { name: file.name, type: file.type, data: reader.result as string };
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  onMsmeFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.MAX_FILE_MB * 1024 * 1024) {
      this.toastService.warning(`File too large — maximum ${this.MAX_FILE_MB} MB allowed`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.msmeFile = { name: file.name, type: file.type, data: reader.result as string };
    };
    reader.readAsDataURL(file);
  }

  async onMsmeFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.MAX_FILE_MB * 1024 * 1024) {
      this.toastService.warning(`File too large — maximum ${this.MAX_FILE_MB} MB allowed`);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      customer.msmeFile = { name: file.name, type: file.type, data: reader.result as string };
      await this.apiService.put('customers', this.toDbRow(customer));
    };
    reader.readAsDataURL(file);
  }

  async removePanFile(customer: any) {
    if (!await this.confirmService.confirm('Remove PAN document?')) return;
    customer.panFile = undefined;
    await this.apiService.put('customers', this.toDbRow(customer));
  }

  async removeMSMEFile(customer: any) {
    if (!await this.confirmService.confirm('Remove MSME document?')) return;
    customer.msmeFile = undefined;
    customer.msme = '';
    await this.apiService.put('customers', this.toDbRow(customer));
  }

  async removeAddrGstFile(customer: any, addr: any) {
    addr.gstFile = undefined;
    await this.apiService.put('customers', this.toDbRow(customer));
  }

  async onAddrGstFileSelect(event: any, customer: any, addr: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      addr.gstFile = { name: file.name, type: file.type, data: reader.result as string };
      await this.apiService.put('customers', this.toDbRow(customer));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  private readonly MAX_FILE_MB = 5;

  constructor(private router: Router, private apiService: ApiService, private toastService: ToastService, private confirmService: ConfirmService) {
    this.loadItems();
    this.apiService.getAll('inventory').then(inv => this.inventory = inv);
  }

  // ── snake_case ↔ camelCase mapping ──────────────────────────

  /**
   * Serialize the component's camelCase customer object to a
   * snake_case DB row for PostgREST PATCH / POST.
   */
  private toDbRow(c: any): any {
    return {
      ...(c.id ? { id: c.id } : {}),
      customer_ref:        c.customerId        ?? null,
      customer_type:       c.customerType      ?? null,
      company_name:        c.companyName       ?? '',
      name:                c.name              ?? null,
      website:             c.website           ?? null,
      email:               c.email             ?? null,
      mobile:              c.mobile            ?? null,
      pan:                 c.pan               ?? null,
      msme:                c.msme              ?? null,
      logo:                c.logo              ?? null,
      pan_file:            c.panFile           ?? null,
      msme_file:           c.msmeFile          ?? null,
      office_address:      c.officeAddress     ?? null,
      billing:             c.billing           ?? null,
      billing2:            c.billing2          ?? null,
      shipping_addresses:  c.shippingAddresses ?? null,
      primary_contact:     c.primaryContact    ?? null,
      secondary_contact:   c.secondaryContact  ?? null,
      product_materials:   c.productMaterials  ?? null,
    };
  }

  /**
   * Deserialize a snake_case PostgREST row back into the
   * component's camelCase customer shape.
   */
  private fromDbRow(row: any): any {
    const pc = row.primary_contact || {};
    const productMaterials =
      Array.isArray(row.product_materials) && row.product_materials.length
        ? row.product_materials
        : [this.emptyMaterial()];
    return {
      id:               row.id,
      customerId:       row.customer_ref   || '',
      customerType:     row.customer_type  || '',
      companyName:      row.company_name   || '',
      name:             row.name           || '',
      website:          row.website        || '',
      email:            row.email          || '',
      mobile:           row.mobile         || pc.mobile || '',
      pan:              row.pan            || '',
      msme:             row.msme           || '',
      logo:             row.logo           || undefined,
      panFile:          row.pan_file       || undefined,
      msmeFile:         row.msme_file      || undefined,
      officeAddress:    this.normalizeAddr(row.office_address),
      billing:          this.normalizeAddr(row.billing),
      billing2:         row.billing2 ? this.normalizeAddr(row.billing2) : null,
      shippingAddresses: Array.isArray(row.shipping_addresses) && row.shipping_addresses.length
        ? row.shipping_addresses.map((a: any) => this.normalizeAddr(a))
        : [this.normalizeAddr(null)],
      primaryContact:   { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '', ...pc },
      secondaryContact: { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '', ...(row.secondary_contact || {}) },
      productMaterials,
    };
  }

  /* ─── Migrate old productPrefs → productMaterials array ─── */
  private migrateProductMaterials(c: any): any[] {
    if (Array.isArray(c.productMaterials) && c.productMaterials.length) {
      return c.productMaterials;
    }
    if (c.productPrefs?.material) {
      return [{ ...c.productPrefs }];
    }
    return [this.emptyMaterial()];
  }

  /* ─── ID Generation ─── */
  generateCustomerId(customers: any[]): string {
    let maxNumber = 0;
    customers.forEach(c => {
      if (c.customerId && c.customerId.startsWith('CUS-')) {
        const num = parseInt(c.customerId.replace('CUS-', ''), 10);
        if (!isNaN(num) && num > maxNumber) maxNumber = num;
      }
    });
    return `CUS-${(maxNumber + 1).toString().padStart(3, '0')}`;
  }

  getLastCustomerNumber(customers: any[]): number {
    let max = 0;
    customers.forEach(c => {
      if (c.customerId?.startsWith('CUS-')) {
        const n = parseInt(c.customerId.replace('CUS-', ''), 10);
        if (!isNaN(n)) max = Math.max(max, n);
      }
    });
    return max;
  }

  /* ─── Normalize address from old or new schema ─── */
  private normalizeAddr(addr: any) {
    if (!addr) return this.emptyAddr();
    const contacts = Array.isArray(addr.contacts) && addr.contacts.length
      ? addr.contacts.map((cp: any) => ({
          contactPerson: cp.contactPerson || '',
          title: cp.title || '',
          firstName: cp.firstName || '',
          lastName: cp.lastName || '',
          department: cp.department || '',
          email: cp.email || '',
          mobile: cp.mobile || '',
          mobileCode: cp.mobileCode || '+91',
          mobileCodeIso: cp.mobileCodeIso || undefined
        }))
      : [{ contactPerson: addr.contactPerson || '', title: '', firstName: '', lastName: '',
           department: addr.department || '',
           email: addr.email || '', mobile: addr.mobile || '',
           mobileCode: addr.mobileCode || '+91' }];
    return {
      street: addr.street || '',
      area: addr.area || '',
      line1: addr.line1 || addr.street || '',
      line2: addr.line2 || addr.area || '',
      pincode: addr.pincode || '',
      city: addr.city || '',
      state: addr.state || '',
      country: addr.country || '',
      gstin: addr.gstin || '',
      gstFile: addr.gstFile || undefined,
      contactPerson: addr.contactPerson || '',
      email: addr.email || '',
      mobile: addr.mobile || '',
      department: addr.department || '',
      contacts
    };
  }

  /* ─── Load ─── */
  async loadItems() {
    const rows = await this.apiService.getAll('customers');
    this.customers = rows.map((row: any) => this.fromDbRow(row));
  }

  filteredCustomers() {
    return this.customers.filter(c =>
      JSON.stringify(c).toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  /* ─── Modal ─── */
  openAddModal() {
    this.isEditing = false;
    this.showModal = true;
    this.showBilling2 = false;
    this.newCustomer = this.getEmptyCustomer();
    this.sameAsBilling = false;
    // Use already-loaded list to derive next ID — avoids an extra round-trip
    this.newCustomer.customerId = this.generateCustomerId(this.customers);
  }

  openEditModal(customer: any) {
    const index = this.customers.findIndex(c => c.id === customer.id);
    if (index === -1) return;
    const c = JSON.parse(JSON.stringify(this.customers[index]));
    c.officeAddress = this.normalizeAddr(c.officeAddress);
    c.billing  = this.normalizeAddr(c.billing);
    c.billing2 = c.billing2 ? this.normalizeAddr(c.billing2) : null;
    if (Array.isArray(c.shippingAddresses) && c.shippingAddresses.length > 0) {
      c.shippingAddresses = c.shippingAddresses.map((a: any) => this.normalizeAddr(a));
    } else {
      c.shippingAddresses = [this.normalizeAddr(c.shipping)];
    }
    c.primaryContact   = { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '', ...(c.primaryContact   || {}) };
    c.secondaryContact = { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '', ...(c.secondaryContact || {}) };
    c.productMaterials = this.migrateProductMaterials(c);
    this.newCustomer = c;
    this.showBilling2 = !!c.billing2;
    this.isEditing = true;
    this.editingIndex = index;
    this.sameAsBilling = false;
    this.showModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.showBilling2 = false;
    this.newCustomer = this.getEmptyCustomer();
    this.sameAsBilling = false;
  }

  async submitForm() {
    if (!this.newCustomer.companyName?.trim()) return;
    // Derive name from primary contact or company name
    const pc = this.newCustomer.primaryContact;
    this.newCustomer.name = [pc?.firstName, pc?.lastName].filter(Boolean).join(' ').trim()
      || this.newCustomer.companyName;

    if (this.isEditing && this.editingIndex !== null) {
      const realIndex = this.customers.findIndex(c => c.id === this.newCustomer.id);
      const storeIndex = realIndex !== -1 ? realIndex : this.editingIndex;
      await this.apiService.put('customers', this.toDbRow(this.newCustomer));
      if (storeIndex !== null && storeIndex !== -1) {
        this.customers[storeIndex] = JSON.parse(JSON.stringify(this.newCustomer));
      }
    } else {
      const newId = await this.apiService.add('customers', this.toDbRow(this.newCustomer));
      this.newCustomer.id = newId;
      this.customers.push(JSON.parse(JSON.stringify(this.newCustomer)));
    }

    this.cancelModal();
  }

  /* ─── Delete / Reset ─── */
  async deleteCustomer(customer: any) {
    const index = this.customers.findIndex(c => c.id === customer.id);
    if (index === -1) return;
    await this.apiService.delete('customers', customer.id);
    this.customers.splice(index, 1);
  }

  async resetCustomers() {
    if (!await this.confirmService.confirm('Delete ALL customers? This cannot be undone.', { title: 'Delete All Customers', confirmLabel: 'Delete All', danger: true })) return;
    await this.apiService.deleteWhere('customers', { org_id: this.apiService.getOrgId() });
    this.customers = [];
  }

  /* ─── Excel Import ─── */
  onFileChange(evt: any) {
    const target: DataTransfer = evt.target;
    if (target.files.length !== 1) return;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const wb = read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json(ws);

      // Use already-loaded customers list for ID generation
      let lastNumber = this.getLastCustomerNumber(this.customers);

      const normalizeId = (raw: any): string => {
        if (!raw && raw !== 0) return '';
        const s = String(raw).trim();
        const m = s.match(/^(?:CUS-?)?(\d+)$/i);
        return m ? `CUS-${parseInt(m[1]).toString().padStart(3, '0')}` : s;
      };

      const formatted = data.map((row: any) => {
        lastNumber++;
        const addr = (prefix: string) => {
          const cp = {
            contactPerson: row[`${prefix} Contact`] || '',
            department: row[`${prefix} Department`] || '',
            email: row[`${prefix} Email`] || '',
            mobile: row[`${prefix} Mobile`] || '',
            mobileCode: '+91'
          };
          return {
            line1: row[`${prefix} Line1`] || '',
            line2: row[`${prefix} Line2`] || '',
            city: row[`${prefix} City`] || '',
            state: row[`${prefix} State`] || '',
            pincode: row[`${prefix} Pincode`] || '',
            country: row[`${prefix} Country`] || 'India',
            gstin: row[`${prefix} GSTIN`] || '',
            contactPerson: cp.contactPerson,
            email: cp.email,
            mobile: cp.mobile,
            department: cp.department,
            contacts: [cp]
          };
        };
        const addrOrNull = (prefix: string) => {
          const hasData = row[`${prefix} Line1`] || row[`${prefix} City`] || row[`${prefix} State`];
          return hasData ? addr(prefix) : null;
        };
        const contact = (prefix: string) => ({
          title: row[`${prefix} Title`] || '',
          firstName: row[`${prefix} First Name`] || '',
          lastName: row[`${prefix} Last Name`] || '',
          mobile: row[`${prefix} Mobile`] || '',
          mobileCode: '+91',
          email: row[`${prefix} Email`] || '',
          remarks: row[`${prefix} Remarks`] || ''
        });
        const productMaterials = [];
        for (let i = 1; i <= 3; i++) {
          const material = row[`Material ${i}`] || '';
          if (material) productMaterials.push({
            material,
            form1: row[`Material ${i} Form 1`] || '',
            form2: row[`Material ${i} Form 2`] || '',
            form3: row[`Material ${i} Form 3`] || ''
          });
        }
        if (!productMaterials.length) productMaterials.push({ material: '', form1: '', form2: '', form3: '' });
        return {
          customerId: normalizeId(row['Customer ID']) || `CUS-${lastNumber.toString().padStart(3, '0')}`,
          customerType: row['Customer Type'] || '',
          companyName: row['Company Name'] || '',
          email: row['Email'] || '',
          website: row['Website'] || '',
          pan: row['PAN'] || '',
          msme: row['MSME'] || '',
          officeAddress: addr('Office'),
          billing: addr('Billing'),
          billing2: addrOrNull('Billing 2'),
          shippingAddresses: [addr('Shipping')],
          primaryContact: contact('Primary Contact'),
          secondaryContact: contact('Secondary Contact'),
          productMaterials
        };
      });

      for (const c of formatted) {
        const newId = await this.apiService.add('customers', this.toDbRow(c));
        (c as any).id = newId;
        this.customers.push(c);
      }
    };

    reader.readAsBinaryString(target.files[0]);
  }

  /* ─── Excel Export ─── */
  private customerRow(c: any) {
    const addrCols = (a: any, prefix: string) => {
      const cp = Array.isArray(a?.contacts) && a.contacts.length ? a.contacts[0] : {};
      return {
        [`${prefix} Line1`]: a?.line1 || a?.street || '',
        [`${prefix} Line2`]: a?.line2 || a?.area || '',
        [`${prefix} State`]: a?.state || '',
        [`${prefix} City`]: a?.city || '',
        [`${prefix} Pincode`]: a?.pincode || '',
        [`${prefix} Country`]: a?.country || '',
        [`${prefix} GSTIN`]: a?.gstin || '',
        [`${prefix} Contact`]: this.formatAddrContactName(cp) || a?.contactPerson || '',
        [`${prefix} Department`]: cp?.department || a?.department || '',
        [`${prefix} Email`]: cp?.email || a?.email || '',
        [`${prefix} Mobile`]: cp?.mobile || a?.mobile || '',
      };
    };
    const mats = c.productMaterials?.length ? c.productMaterials
      : (c.productPrefs?.material ? [c.productPrefs] : [{}]);
    const matCols: any = {};
    for (let i = 0; i < 3; i++) {
      const m = mats[i] || {};
      matCols[`Material ${i + 1}`] = m.material || '';
      matCols[`Material ${i + 1} Form 1`] = m.form1 || '';
      matCols[`Material ${i + 1} Form 2`] = m.form2 || '';
      matCols[`Material ${i + 1} Form 3`] = m.form3 || '';
    }
    return {
      'Customer ID': c.customerId || '',
      'Customer Type': c.customerType || '',
      'Company Name': c.companyName || '',
      'Email': c.email || '',
      'Website': c.website || '',
      'PAN': c.pan || '',
      'MSME': c.msme || '',
      ...addrCols(c.officeAddress, 'Office'),
      'Primary Contact Title': c.primaryContact?.title || '',
      'Primary Contact First Name': c.primaryContact?.firstName || '',
      'Primary Contact Last Name': c.primaryContact?.lastName || '',
      'Primary Contact Mobile': c.primaryContact?.mobile || '',
      'Primary Contact Email': c.primaryContact?.email || '',
      'Primary Contact Remarks': c.primaryContact?.remarks || '',
      'Secondary Contact Title': c.secondaryContact?.title || '',
      'Secondary Contact First Name': c.secondaryContact?.firstName || '',
      'Secondary Contact Last Name': c.secondaryContact?.lastName || '',
      'Secondary Contact Mobile': c.secondaryContact?.mobile || '',
      'Secondary Contact Email': c.secondaryContact?.email || '',
      'Secondary Contact Remarks': c.secondaryContact?.remarks || '',
      ...addrCols(c.billing, 'Billing'),
      ...addrCols(c.billing2 ?? null, 'Billing 2'),
      ...addrCols(c.shippingAddresses?.[0], 'Shipping'),
      ...matCols
    };
  }

  downloadExcel() {
    // Use the already-loaded list — no extra round-trip needed
    const ws = utils.json_to_sheet(this.customers.map(c => this.customerRow(c)));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Customers');
    writeFile(wb, 'Customers.xlsx');
  }

  downloadCustomerTemplate() {
    const ws = utils.json_to_sheet([this.customerRow({})]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Customers');
    writeFile(wb, 'Customer-Template.xlsx');
  }

  downloadAllCustomersPDF() {
    const doc = new jsPDF('p', 'mm', 'a4');
    const rows = this.filteredCustomers();
    const headers = [['Customer ID', 'Company', 'Primary Contact', 'Mobile', 'Email', 'City', 'State']];
    const body = rows.map((c: any) => [
      c.customerId || '-',
      c.companyName || '-',
      this.formatContactName(c.primaryContact),
      c.primaryContact?.mobile || c.mobile || '-',
      c.email || '-',
      c.officeAddress?.city || '-',
      c.officeAddress?.state || '-'
    ]);

    doc.setFontSize(14);
    doc.text('Customers Summary', 14, 15);
    (autoTable as any)(doc, {
      head: headers,
      body,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 31, 63] }
    });
    doc.save('Customers-Summary.pdf');
  }

  goToInquiries(customer: any) {
    this.router.navigate(['/items'], { state: { customer } });
  }

  /* ─── Preview modal ─── */
  showPreviewModal = false;
  previewCustomer: any = null;

  openPreviewModal(customer: any) {
    this.previewCustomer = customer;
    this.showPreviewModal = true;
  }

  closePreviewModal() {
    this.showPreviewModal = false;
    this.previewCustomer = null;
  }

  formatMaterialForms(mat: any): string {
    return [mat.form1, mat.form2, mat.form3].filter(Boolean).join(' / ');
  }

  formatContactName(contact: any): string {
    if (!contact) return '-';
    const title = contact.title ? contact.title.replace(/\.?$/, '.') : '';  // ensure "Ms."
    return [title, contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || '-';
  }

  /* ─── PDF export ─── */
  downloadCustomerPDF(c: any) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pW = doc.internal.pageSize.getWidth();
    const L = 14;
    let y = 15;

    const section = (title: string) => {
      y += 4;
      doc.setFillColor(0, 31, 63);
      doc.rect(L, y, pW - L * 2, 7, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(title, L + 3, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    };

    const row = (label: string, value: string, x2 = 80) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label, L, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(value || '-', pW - x2 - L);
      doc.text(lines, x2, y);
      y += lines.length * 5 + 1;
    };

    const addrText = (addr: any): string => {
      if (!addr) return '-';
      return [addr.line1, addr.line2, addr.state, addr.city, addr.pincode, addr.country]
        .filter(Boolean).join(', ') || '-';
    };

    const addrContacts = (addr: any) => {
      const contacts: any[] = Array.isArray(addr?.contacts) && addr.contacts.length
        ? addr.contacts
        : (addr?.contactPerson ? [{ contactPerson: addr.contactPerson, department: addr.department, mobile: addr.mobile, mobileCode: addr.mobileCode, email: addr.email }] : []);
      contacts.forEach((cp: any, ci: number) => {
        const label = contacts.length > 1 ? `Contact ${ci + 1}:` : 'Contact:';
        const name = this.formatAddrContactName(cp);
        if (name) row(label, name + (cp.department ? `  (${cp.department})` : ''));
        if (cp.mobile) row('  Mobile:', (cp.mobileCode || '+91') + ' ' + cp.mobile);
        if (cp.email) row('  Email:', cp.email);
      });
    };

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Profile', pW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${c.companyName || c.name || ''}  |  ID: ${c.customerId || '-'}`, pW / 2, y, { align: 'center' });
    y += 6;

    // Basic Info
    section('Basic Information');
    row('Company Name:', c.companyName || '-');
    row('Customer ID:', c.customerId || '-');
    row('Customer Type:', c.customerType || '-');
    row('Email:', c.email || '-');
    row('Website:', c.website || '-');

    // Primary Contact
    section('Primary Contact');
    row('Name:', this.formatContactName(c.primaryContact));
    row('Mobile:', ((c.primaryContact?.mobileCode || '+91') + ' ' + (c.primaryContact?.mobile || '')).trim() || '-');
    row('Email:', c.primaryContact?.email || '-');
    if (c.primaryContact?.remarks) row('Remarks:', c.primaryContact.remarks);

    // Secondary Contact
    if (c.secondaryContact?.firstName) {
      section('Secondary Contact');
      row('Name:', this.formatContactName(c.secondaryContact));
      row('Mobile:', ((c.secondaryContact?.mobileCode || '+91') + ' ' + (c.secondaryContact?.mobile || '')).trim() || '-');
      row('Email:', c.secondaryContact?.email || '-');
      if (c.secondaryContact?.remarks) row('Remarks:', c.secondaryContact.remarks);
    }

    // Office Address
    section('Office Address');
    row('Address:', addrText(c.officeAddress));
    addrContacts(c.officeAddress);

    // Tax Documents
    section('Tax Documents');
    row('PAN:', c.pan || '-');
    row('MSME:', c.msme || '-');

    // Billing Address
    section('Billing Address 1');
    row('Address:', addrText(c.billing));
    if (c.billing?.gstin) row('GSTIN:', c.billing.gstin);
    addrContacts(c.billing);

    if (c.billing2) {
      section('Billing Address 2');
      row('Address:', addrText(c.billing2));
      if (c.billing2?.gstin) row('GSTIN:', c.billing2.gstin);
      addrContacts(c.billing2);
    }

    // Shipping Addresses
    if (c.shippingAddresses?.length) {
      c.shippingAddresses.forEach((sa: any, i: number) => {
        section(`Shipping Address ${i + 1}`);
        row('Address:', addrText(sa));
        if (sa.gstin) row('GSTIN:', sa.gstin);
        addrContacts(sa);
      });
    }

    // Product Preferences
    if (c.productMaterials?.some((m: any) => m.material)) {
      section('Product Preferences');
      c.productMaterials.forEach((m: any, i: number) => {
        if (!m.material) return;
        const forms = [m.form1, m.form2, m.form3].filter(Boolean).join(' / ');
        row(`Material ${i + 1}:`, m.material + (forms ? `  (${forms})` : ''));
      });
    }

    doc.save(`Customer_${c.customerId || c.companyName || 'Profile'}.pdf`);
  }
}
