import { Component } from '@angular/core';
import { read, writeFileXLSX } from 'xlsx';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { utils, writeFile } from 'xlsx';
import { DBService } from '../../service/db.service';
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

  businessVerticals: string[] = [
    'Projects',
    'Material Distribution Division',
    'Both'
  ];

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

  /* ─── Empty address object ─── */
  private emptyAddr() {
    return {
      street: '', area: '', line1: '', line2: '',
      pincode: '', city: '', state: '', country: '',
      gstin: '', gstFile: undefined as any,
      contactPerson: '', email: '', mobile: '', department: ''
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
      gstin: '',
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
      productMaterials: [this.emptyMaterial()],
      businessVertical: ''
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
    if (this.showBilling2 && this.newCustomer.billing2) {
      this.billingChoiceShippingIndex = i;
      this.showBillingChoiceModal = true;
    } else {
      this.newCustomer.shippingAddresses[i] = { ...this.newCustomer.billing };
    }
  }

  applyBillingChoice(which: 1 | 2) {
    const src = which === 2 ? this.newCustomer.billing2 : this.newCustomer.billing;
    this.newCustomer.shippingAddresses[this.billingChoiceShippingIndex] = { ...src };
    this.showBillingChoiceModal = false;
  }

  /* ─── File handler for address GST document ─── */
  readFileToAddr(event: any, addr: any, key: string) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { addr[key] = { name: file.name, type: file.type, data: reader.result as string }; };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  /* ─── File handlers ─── */
  onPanFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.panFile = { name: file.name, type: file.type, data: reader.result as string };
    };
    reader.readAsDataURL(file);
  }

  async onPanFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      customer.panFile = { name: file.name, type: file.type, data: reader.result as string };
      await this.dbService.put('customers', customer);
    };
    reader.readAsDataURL(file);
  }

  onLogoSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;
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
    const reader = new FileReader();
    reader.onload = () => {
      this.newCustomer.msmeFile = { name: file.name, type: file.type, data: reader.result as string };
    };
    reader.readAsDataURL(file);
  }

  async onMsmeFileSelectFromTable(event: any, customer: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      customer.msmeFile = { name: file.name, type: file.type, data: reader.result as string };
      await this.dbService.put('customers', customer);
    };
    reader.readAsDataURL(file);
  }

  async removePanFile(customer: any) {
    if (!confirm('Remove PAN document?')) return;
    customer.panFile = undefined;
    await this.dbService.put('customers', customer);
  }

  async removeMSMEFile(customer: any) {
    if (!confirm('Remove MSME document?')) return;
    customer.msmeFile = undefined;
    customer.msme = '';
    await this.dbService.put('customers', customer);
  }

  constructor(private router: Router, private dbService: DBService) {
    this.loadFromIndexedDB();
    this.dbService.getAll('inventory').then(inv => this.inventory = inv);
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
      department: addr.department || ''
    };
  }

  /* ─── Load ─── */
  async loadFromIndexedDB() {
    const raw = await this.dbService.getAll('customers');
    this.customers = raw.map((c: any) => {
      const officeAddr = this.normalizeAddr(c.officeAddress);
      const billingAddr = this.normalizeAddr(c.billing);
      const pc = c.primaryContact || {};
      return {
        ...c,
        mobile: c.mobile || pc.mobile || officeAddr.mobile || '',
        gstin: c.gstin || billingAddr.gstin || officeAddr.gstin || '',
        officeAddress: officeAddr,
        billing:  billingAddr,
        shippingAddresses: Array.isArray(c.shippingAddresses) && c.shippingAddresses.length
          ? c.shippingAddresses.map((a: any) => this.normalizeAddr(a))
          : [this.normalizeAddr(c.shipping)],
        primaryContact:   { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '', ...pc },
        secondaryContact: { title: '', firstName: '', lastName: '', mobile: '', email: '', remarks: '', ...(c.secondaryContact || {}) },
        productMaterials: this.migrateProductMaterials(c)
      };
    });
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
    this.dbService.getAll('customers').then(customers => {
      this.newCustomer.customerId = this.generateCustomerId(customers);
    });
  }

  openEditModal(index: number) {
    const c = JSON.parse(JSON.stringify(this.customers[index]));
    c.officeAddress = this.normalizeAddr(c.officeAddress);
    c.billing  = this.normalizeAddr(c.billing);
    // Normalize shippingAddresses — migrate legacy `shipping` field
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
      const existing = this.customers[this.editingIndex];
      this.newCustomer.id = existing.id;
      await this.dbService.put('customers', this.newCustomer);
      this.customers[this.editingIndex] = JSON.parse(JSON.stringify(this.newCustomer));
    } else {
      this.newCustomer.id = Date.now();
      await this.dbService.add('customers', this.newCustomer);
      this.customers.push(JSON.parse(JSON.stringify(this.newCustomer)));
    }

    this.cancelModal();
  }

  /* ─── Delete / Reset ─── */
  async deleteCustomer(index: number) {
    await this.dbService.delete('customers', this.customers[index].id);
    this.customers.splice(index, 1);
  }

  async resetCustomers() {
    await this.dbService.clearStore('customers');
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

      const existingCustomers = await this.dbService.getAll('customers');
      let lastNumber = this.getLastCustomerNumber(existingCustomers);

      const formatted = data.map((row: any) => {
        lastNumber++;
        const addr = (prefix: string) => ({
          line1: row[`${prefix} Line1`] || '',
          line2: row[`${prefix} Line2`] || '',
          city: row[`${prefix} City`] || '',
          state: row[`${prefix} State`] || '',
          pincode: row[`${prefix} Pincode`] || '',
          country: row[`${prefix} Country`] || 'India',
          gstin: row[`${prefix} GSTIN`] || '',
          contactPerson: row[`${prefix} Contact`] || '',
          email: row[`${prefix} Email`] || '',
          mobile: row[`${prefix} Mobile`] || '',
          department: row[`${prefix} Department`] || ''
        });
        const contact = (prefix: string) => ({
          firstName: row[`${prefix} First Name`] || '',
          lastName: row[`${prefix} Last Name`] || '',
          mobile: row[`${prefix} Mobile`] || '',
          email: row[`${prefix} Email`] || '',
          location: row[`${prefix} Location`] || '',
          remarks: row[`${prefix} Remarks`] || ''
        });
        return {
          id: Date.now() + Math.random(),
          customerId: `CUS-${lastNumber.toString().padStart(3, '0')}`,
          customerType: row['Customer Type'] || '',
          name: row['Name'] || '',
          companyName: row['Company Name'] || '',
          email: row['Email'] || '',
          landline: row['Landline'] || '',
          website: row['Website'] || '',
          pan: row['PAN'] || '',
          msme: row['MSME'] || '',
          officeAddress: addr('Office'),
          billing: addr('Billing'),
          shipping: { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' },
          primaryContact: contact('Primary Contact'),
          secondaryContact: contact('Secondary Contact'),
          productPrefs: {
            material: row['Material Preference'] || '',
            form1: row['Form 1'] || '',
            form2: row['Form 2'] || '',
            form3: row['Form 3'] || ''
          }
        };
      });

      for (const c of formatted) {
        await this.dbService.add('customers', c);
        existingCustomers.push(c);
      }
      this.customers = existingCustomers;
    };

    reader.readAsBinaryString(target.files[0]);
  }

  /* ─── Excel Export ─── */
  private customerRow(c: any) {
    return {
      'Customer Type': c.customerType || '',
      'Name': c.name || '',
      'Company Name': c.companyName || '',
      'Email': c.email || '',
      'Landline': c.landline || '',
      'Website': c.website || '',
      'PAN': c.pan || '',
      'MSME': c.msme || '',
      'Office Line1': c.officeAddress?.line1 || c.officeAddress?.street || '',
      'Office Line2': c.officeAddress?.line2 || c.officeAddress?.area || '',
      'Office City': c.officeAddress?.city || '',
      'Office State': c.officeAddress?.state || '',
      'Office Pincode': c.officeAddress?.pincode || '',
      'Office Country': c.officeAddress?.country || '',
      'Office GSTIN': c.officeAddress?.gstin || '',
      'Office Contact': c.officeAddress?.contactPerson || '',
      'Office Email': c.officeAddress?.email || '',
      'Office Mobile': c.officeAddress?.mobile || '',
      'Office Department': c.officeAddress?.department || '',
      'Billing Line1': c.billing?.line1 || c.billing?.street || '',
      'Billing Line2': c.billing?.line2 || c.billing?.area || '',
      'Billing City': c.billing?.city || '',
      'Billing State': c.billing?.state || '',
      'Billing Pincode': c.billing?.pincode || '',
      'Billing Country': c.billing?.country || '',
      'Billing GSTIN': c.billing?.gstin || '',
      'Billing Contact': c.billing?.contactPerson || '',
      'Billing Email': c.billing?.email || '',
      'Billing Mobile': c.billing?.mobile || '',
      'Billing Department': c.billing?.department || '',
      'Primary Contact First Name': c.primaryContact?.firstName || '',
      'Primary Contact Last Name': c.primaryContact?.lastName || '',
      'Primary Contact Mobile': c.primaryContact?.mobile || '',
      'Primary Contact Email': c.primaryContact?.email || '',
      'Primary Contact Location': c.primaryContact?.location || '',
      'Primary Contact Remarks': c.primaryContact?.remarks || '',
      'Secondary Contact First Name': c.secondaryContact?.firstName || '',
      'Secondary Contact Last Name': c.secondaryContact?.lastName || '',
      'Secondary Contact Mobile': c.secondaryContact?.mobile || '',
      'Secondary Contact Email': c.secondaryContact?.email || '',
      'Secondary Contact Location': c.secondaryContact?.location || '',
      'Secondary Contact Remarks': c.secondaryContact?.remarks || '',
      'Material Preference': c.productPrefs?.material || '',
      'Form 1': c.productPrefs?.form1 || '',
      'Form 2': c.productPrefs?.form2 || '',
      'Form 3': c.productPrefs?.form3 || ''
    };
  }

  downloadExcel() {
    this.dbService.getAll('customers').then((customers: any[]) => {
      const ws = utils.json_to_sheet(customers.map(c => this.customerRow(c)));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Customers');
      writeFile(wb, 'Customers.xlsx');
    });
  }

  downloadCustomerTemplate() {
    const ws = utils.json_to_sheet([this.customerRow({})]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Customers');
    writeFile(wb, 'Customer-Template.xlsx');
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
    return [contact.title, contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || '-';
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
    row('GSTIN:', c.gstin || '-');
    row('PAN:', c.pan || '-');
    row('MSME:', c.msme || '-');

    // Primary Contact
    section('Primary Contact');
    row('Name:', this.formatContactName(c.primaryContact));
    row('Mobile:', c.primaryContact?.mobile || '-');
    row('Email:', c.primaryContact?.email || '-');
    if (c.primaryContact?.remarks) row('Remarks:', c.primaryContact.remarks);

    // Secondary Contact
    if (c.secondaryContact?.firstName) {
      section('Secondary Contact');
      row('Name:', this.formatContactName(c.secondaryContact));
      row('Mobile:', c.secondaryContact?.mobile || '-');
      row('Email:', c.secondaryContact?.email || '-');
    }

    // Office Address
    section('Office Address');
    row('Address:', addrText(c.officeAddress));

    // Billing Address
    section('Billing Address');
    row('Address:', addrText(c.billing));
    if (c.billing?.gstin) row('GSTIN:', c.billing.gstin);
    if (c.billing2) { y += 2; row('Address 2:', addrText(c.billing2)); }

    // Shipping Addresses
    if (c.shippingAddresses?.length) {
      section('Shipping Address(es)');
      c.shippingAddresses.forEach((sa: any, i: number) => {
        row(`Shipping ${i + 1}:`, addrText(sa));
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
