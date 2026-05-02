import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { DBService } from '../../service/db.service';

interface FileAttachment {
  name: string;
  type: string;
  data: string;
}

interface VendorAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin: string;
  gstFile?: any;
  contactPerson: string;
  email: string;
  mobile: string;
  department: string;
  contacts?: any[];
  // keep old fields for backward compat
  street?: string;
  area?: string;
}

interface Vendor {
  id?: number;
  vendorId?: string;
  vendorVertical?: string;
  vendorType?: string;        // Manufacturer | Dealer/Trader
  vendorCategory?: string;   // existing category field (Insulation, etc.)
  companyName?: string;
  category?: string;
  brandName?: string;
  location?: string;
  contactPerson?: string;

  officeAddress: VendorAddress;
  officeAddress2?: VendorAddress | null;

  billing: VendorAddress;
  billing2?: VendorAddress | null;

  // kept for backward compat
  shipping: {
    street: string; area: string; city: string;
    state: string; pincode: string; country: string;
  };

  website?: string;
  email?: string;
  mobile?: string;

  // Tax docs — gst moved to address; pan & msme stay here
  gst?: string;
  pan?: string;
  msme?: string;

  gstFile?: FileAttachment;
  panFile?: FileAttachment;
  msmeFile?: FileAttachment;

  paymentTerms?: string;
  products: string[];

  // Bank details
  bankIfsc?: string;
  cancelledChequeFile?: FileAttachment;

  // Primary contact
  primaryContact: {
    title?: string; firstName: string; lastName: string;
    mobile: string; mobileCode?: string; email: string;
    location: string; remarks: string;
  };

  // Datasheets
  datasheets: FileAttachment[];
}

@Component({
  selector: 'app-vendor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendor.component.html',
  styleUrls: ['./vendor.component.css']
})
export class VendorComponent implements OnInit {

  vendors: Vendor[] = [];
  filteredVendors: Vendor[] = [];
  newVendor: Vendor = this.getEmptyVendor();

  isEditing = false;
  showModal = false;
  searchTerm = '';
  editingIndex = -1;

  sameAsBilling = false;
  showOffice2 = false;
  showBilling2 = false;

  tempProduct = '';

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

  countryCodes: string[] = [
    '+91', '+1', '+44', '+971', '+966', '+65', '+61', '+49', '+86', '+81',
    '+60', '+62', '+880', '+92', '+94', '+977', '+66', '+84', '+55', '+27'
  ];

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

  constructor(private dbService: DBService) { }

  ngOnInit() { this.loadVendors(); }

  /* ─── Empty address ─── */
  private emptyAddrContact() {
    return { contactPerson: '', department: '', email: '', mobile: '', mobileCode: '+91' };
  }

  addAddrContact(addr: any) {
    if (!addr.contacts) addr.contacts = [];
    addr.contacts.push(this.emptyAddrContact());
  }

  removeAddrContact(addr: any, i: number) {
    if (addr.contacts?.length > 1) addr.contacts.splice(i, 1);
  }

  private emptyAddr(): VendorAddress {
    return {
      line1: '', line2: '', city: '', state: '', pincode: '',
      country: '', gstin: '', gstFile: undefined, contactPerson: '', email: '',
      mobile: '', department: '', street: '', area: '',
      contacts: [this.emptyAddrContact()]
    };
  }

  readFileToAddr(event: any, addr: any, key: string) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { addr[key] = { name: file.name, type: file.type, data: reader.result as string }; };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  private getEmptyVendor(): Vendor {
    return {
      vendorVertical: '',
      vendorType: '',
      vendorCategory: '',
      companyName: '',
      category: '',
      brandName: '',
      location: '',
      contactPerson: '',
      website: '',
      email: '',
      mobile: '',
      gst: '',
      pan: '',
      msme: '',
      paymentTerms: '',
      products: [],
      bankIfsc: '',
      cancelledChequeFile: undefined,
      primaryContact: { firstName: '', lastName: '', mobile: '', email: '', location: '', remarks: '' },
      datasheets: [],
      officeAddress: this.emptyAddr(),
      officeAddress2: null,
      billing: this.emptyAddr(),
      billing2: null,
      shipping: { street: '', area: '', city: '', state: '', pincode: '', country: 'India' }
    };
  }

  private normalizeAddr(addr: any): VendorAddress {
    if (!addr) return this.emptyAddr();
    const contacts = Array.isArray(addr.contacts) && addr.contacts.length
      ? addr.contacts
      : [{ contactPerson: addr.contactPerson || '', department: addr.department || '',
           email: addr.email || '', mobile: addr.mobile || '',
           mobileCode: addr.mobileCode || '+91' }];
    return {
      line1: addr.line1 || addr.street || '',
      line2: addr.line2 || addr.area || '',
      city: addr.city || '', state: addr.state || '',
      pincode: addr.pincode || '', country: addr.country || '',
      gstin: addr.gstin || '', gstFile: addr.gstFile || undefined,
      contactPerson: addr.contactPerson || '',
      email: addr.email || '', mobile: addr.mobile || '',
      department: addr.department || '',
      street: addr.street || '', area: addr.area || '',
      contacts
    };
  }

  private generateVendorId(): string {
    let max = 0;
    for (const v of this.vendors) {
      if (!v.vendorId) continue;
      const match = v.vendorId.match(/^VEN-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return 'VEN-' + (max + 1).toString().padStart(3, '0');
  }

  /* ─── Load ─── */
  async loadVendors() {
    const raw = await this.dbService.getAll('vendors');
    this.vendors = raw.map((v: any) => ({
      ...v,
      officeAddress: this.normalizeAddr(v.officeAddress || v.billing),
      billing: this.normalizeAddr(v.billing),
      primaryContact: v.primaryContact || { firstName: '', lastName: '', mobile: '', email: '', location: '', remarks: '' },
      products: v.products || [],
      datasheets: v.datasheets || []
    }));
    this.filteredVendors = [...this.vendors];
  }

  /* ─── Filter ─── */
  filterVendors() {
    const search = (this.searchTerm || '').toLowerCase();
    this.filteredVendors = !search
      ? [...this.vendors]
      : this.vendors.filter(v => JSON.stringify(v).toLowerCase().includes(search));
  }

  /* ─── Modal ─── */
  openAddModal() {
    this.isEditing = false;
    this.sameAsBilling = false;
    this.showOffice2 = false;
    this.showBilling2 = false;
    this.newVendor = this.getEmptyVendor();
    this.newVendor.vendorId = this.generateVendorId();
    this.showModal = true;
  }

  openEditModal(i: number) {
    this.isEditing = true;
    this.editingIndex = i;
    const v: any = JSON.parse(JSON.stringify(this.filteredVendors[i]));
    v.officeAddress = this.normalizeAddr(v.officeAddress || v.billing);
    v.billing       = this.normalizeAddr(v.billing);
    v.primaryContact = v.primaryContact || { firstName: '', lastName: '', mobile: '', email: '', location: '', remarks: '' };
    v.datasheets = v.datasheets || [];
    v.products   = v.products   || [];
    this.newVendor = v;
    this.showOffice2 = !!v.officeAddress2;
    this.showBilling2 = !!v.billing2;
    this.sameAsBilling = JSON.stringify(v.billing) === JSON.stringify(v.officeAddress);
    this.showModal = true;
  }

  cancelModal() {
    this.showModal = false;
    this.sameAsBilling = false;
    this.showOffice2 = false;
    this.showBilling2 = false;
    this.newVendor = this.getEmptyVendor();
    this.isEditing = false;
    this.editingIndex = -1;
  }

  /* ─── Same as office ─── */
  toggleSameAsBilling() {
    if (this.sameAsBilling) {
      this.newVendor.billing = { ...this.newVendor.officeAddress };
    }
  }

  /* ─── Extra address toggles ─── */
  addOffice2()  { this.showOffice2  = true; this.newVendor.officeAddress2 = this.emptyAddr(); }
  removeOffice2() { this.showOffice2 = false; this.newVendor.officeAddress2 = null; }
  addBilling2() { this.showBilling2 = true;  this.newVendor.billing2 = this.emptyAddr(); }
  removeBilling2() { this.showBilling2 = false; this.newVendor.billing2 = null; }

  /* ─── Products ─── */
  addProduct() {
    const value = (this.tempProduct || '').trim();
    if (!value) return;
    if (!this.newVendor.products) this.newVendor.products = [];
    this.newVendor.products.push(value);
    this.tempProduct = '';
  }

  removeProduct(index: number) { this.newVendor.products.splice(index, 1); }

  /* ─── Save ─── */
  async submitForm() {
    await this.dbService.put('vendors', this.newVendor);
    this.cancelModal();
    await this.loadVendors();
  }

  /* ─── Delete ─── */
  async deleteVendor(idx: number) {
    if (!confirm('Delete this vendor?')) return;
    const vendor = this.filteredVendors[idx];
    const key = vendor.id ?? vendor.vendorId;
    if (!key) return;
    await this.dbService.delete('vendors', key);
    await this.loadVendors();
  }

  /* ─── File helpers ─── */
  private readFile(file: File, cb: (f: FileAttachment) => void) {
    const r = new FileReader();
    r.onload = () => cb({ name: file.name, type: file.type, data: r.result as string });
    r.readAsDataURL(file);
  }

  onGstFileSelect(e: any)  { this.readFile(e.target.files[0], f => this.newVendor.gstFile  = f); }
  onPanFileSelect(e: any)  { this.readFile(e.target.files[0], f => this.newVendor.panFile  = f); }
  onMsmeFileSelect(e: any) { this.readFile(e.target.files[0], f => this.newVendor.msmeFile = f); }

  onCancelledChequeFileSelect(e: any) {
    this.readFile(e.target.files[0], f => this.newVendor.cancelledChequeFile = f);
  }

  onDatasheetSelect(e: any) {
    const file: File = e.target.files[0];
    if (!file) return;
    this.readFile(file, f => {
      if (!this.newVendor.datasheets) this.newVendor.datasheets = [];
      this.newVendor.datasheets.push(f);
    });
    e.target.value = '';
  }

  removeDatasheet(index: number) {
    this.newVendor.datasheets.splice(index, 1);
  }

  onGstFileSelectFromTable(e: any, v: Vendor)  { this.saveFile(e, v, 'gstFile'); }
  onPanFileSelectFromTable(e: any, v: Vendor)  { this.saveFile(e, v, 'panFile'); }
  onMsmeFileSelectFromTable(e: any, v: Vendor) { this.saveFile(e, v, 'msmeFile'); }

  private async saveFile(e: any, vendor: Vendor, key: 'gstFile' | 'panFile' | 'msmeFile') {
    const file = e.target.files[0];
    if (!file) return;
    this.readFile(file, async f => {
      vendor[key] = f;
      await this.dbService.put('vendors', vendor);
    });
  }

  async removeGSTFile(vendor: any) {
    if (!confirm('Remove GST document?')) return;
    vendor.gstFile = undefined;
    await this.dbService.put('vendors', vendor);
  }

  async removePanFile(vendor: any) {
    if (!confirm('Remove PAN document?')) return;
    vendor.panFile = undefined;
    await this.dbService.put('vendors', vendor);
  }

  async removeMSMEFile(vendor: any) {
    if (!confirm('Remove MSME document?')) return;
    vendor.msmeFile = undefined;
    vendor.msme = '';
    await this.dbService.put('vendors', vendor);
  }

  /* ─── Excel ─── */
  handleExcel(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      this.importVendorsFromExcel(rows);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  }

  async importVendorsFromExcel(rows: any[][]): Promise<void> {
    const headers: string[] = rows[0]?.map((h: any) => String(h || '').trim()) || [];
    const toObj = (row: any[]) => {
      const o: any = {};
      headers.forEach((h, i) => { o[h] = row[i] ?? ''; });
      return o;
    };
    const addrFromRow = (r: any, prefix: string) => ({
      line1: r[`${prefix} Line1`] || '', line2: r[`${prefix} Line2`] || '',
      city: r[`${prefix} City`] || '', state: r[`${prefix} State`] || '',
      pincode: r[`${prefix} Pincode`] || '', country: r[`${prefix} Country`] || 'India',
      gstin: r[`${prefix} GSTIN`] || '', contactPerson: r[`${prefix} Contact`] || '',
      email: r[`${prefix} Email`] || '', mobile: r[`${prefix} Mobile`] || '',
      department: r[`${prefix} Department`] || ''
    });

    let last = 0;
    this.vendors.forEach(v => {
      if (v.vendorId?.startsWith('VEN-')) {
        const n = parseInt(v.vendorId.replace('VEN-', ''), 10);
        if (!isNaN(n)) last = Math.max(last, n);
      }
    });
    for (let i = 1; i < rows.length; i++) {
      const r = toObj(rows[i]);
      if (!r['Company Name']) continue;
      last++;
      await this.dbService.add('vendors', {
        vendorId: `VEN-${last.toString().padStart(3, '0')}`,
        vendorType: r['Vendor Type'] || '',
        companyName: r['Company Name'] || '',
        brandName: r['Brand Name'] || '',
        category: r['Category'] || '',
        pan: r['PAN'] || '',
        msme: r['MSME'] || '',
        paymentTerms: r['Payment Terms'] || '',
        bankIfsc: r['Bank IFSC'] || '',
        products: r['Products'] ? String(r['Products']).split(',').map((p: string) => p.trim()) : [],
        officeAddress: addrFromRow(r, 'Office Address'),
        billing: addrFromRow(r, 'Billing'),
        shipping: { street: '', area: '', city: '', state: '', pincode: '', country: 'India' },
        primaryContact: {
          firstName: r['Primary Contact First Name'] || '',
          lastName: r['Primary Contact Last Name'] || '',
          mobile: r['Primary Contact Mobile'] || '',
          email: r['Primary Contact Email'] || '',
          location: r['Primary Contact Location'] || '',
          remarks: r['Primary Contact Remarks'] || ''
        },
        datasheets: []
      });
    }
    await this.loadVendors();
  }

  private vendorRow(v: any) {
    const addr = (a: any, prefix: string) => ({
      [`${prefix} Line1`]: a?.line1 || a?.street || '',
      [`${prefix} Line2`]: a?.line2 || a?.area || '',
      [`${prefix} City`]: a?.city || '',
      [`${prefix} State`]: a?.state || '',
      [`${prefix} Pincode`]: a?.pincode || '',
      [`${prefix} Country`]: a?.country || '',
      [`${prefix} GSTIN`]: a?.gstin || '',
      [`${prefix} Contact`]: a?.contactPerson || '',
      [`${prefix} Email`]: a?.email || '',
      [`${prefix} Mobile`]: a?.mobile || '',
      [`${prefix} Department`]: a?.department || ''
    });
    return {
      'Vendor Type': v.vendorType || '',
      'Company Name': v.companyName || '',
      'Brand Name': v.brandName || '',
      'Category': v.category || '',
      'Products': (v.products || []).join(', '),
      'Bank IFSC': v.bankIfsc || '',
      'PAN': v.pan || '',
      'MSME': v.msme || '',
      'Payment Terms': v.paymentTerms || '',
      ...addr(v.officeAddress, 'Office Address'),
      ...addr(v.billing, 'Billing'),
      'Primary Contact First Name': v.primaryContact?.firstName || '',
      'Primary Contact Last Name': v.primaryContact?.lastName || '',
      'Primary Contact Mobile': v.primaryContact?.mobile || '',
      'Primary Contact Email': v.primaryContact?.email || '',
      'Primary Contact Location': v.primaryContact?.location || '',
      'Primary Contact Remarks': v.primaryContact?.remarks || ''
    };
  }

  downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(this.vendors.map(v => this.vendorRow(v)));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, 'Vendor-List.xlsx');
  }

  downloadVendorTemplate() {
    const ws = XLSX.utils.json_to_sheet([this.vendorRow({})]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, 'Vendor-Template.xlsx');
  }
}
