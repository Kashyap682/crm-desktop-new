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

  /* ─── Empty address contact ─── */
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

  async removeAddrGstFile(customer: any, addr: any) {
    addr.gstFile = undefined;
    await this.dbService.put('customers', customer);
  }

  async onAddrGstFileSelect(event: any, customer: any, addr: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      addr.gstFile = { name: file.name, type: file.type, data: reader.result as string };
      await this.dbService.put('customers', customer);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
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
    const contacts = Array.isArray(addr.contacts) && addr.contacts.length
      ? addr.contacts
      : [{ contactPerson: addr.contactPerson || '', department: addr.department || '',
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
  async loadFromIndexedDB() {
    const raw = await this.dbService.getAll('customers');
    this.customers = raw.map((c: any) => {
      const officeAddr = this.normalizeAddr(c.officeAddress);
      const billingAddr = this.normalizeAddr(c.billing);
      const pc = c.primaryContact || {};
      return {
        ...c,
        mobile: c.mobile || pc.mobile || officeAddr.mobile || '',
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
      await this.dbService.put('customers', this.newCustomer);
      if (storeIndex !== null && storeIndex !== -1) {
        this.customers[storeIndex] = JSON.parse(JSON.stringify(this.newCustomer));
      }
    } else {
      this.newCustomer.id = Date.now();
      await this.dbService.add('customers', this.newCustomer);
      this.customers.push(JSON.parse(JSON.stringify(this.newCustomer)));
    }

    this.cancelModal();
  }

  /* ─── Delete / Reset ─── */
  async deleteCustomer(customer: any) {
    const index = this.customers.findIndex(c => c.id === customer.id);
    if (index === -1) return;
    await this.dbService.delete('customers', customer.id);
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
          id: Date.now() + Math.random(),
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
        await this.dbService.add('customers', c);
        existingCustomers.push(c);
      }
      this.customers = existingCustomers;
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
        [`${prefix} Contact`]: cp?.contactPerson || a?.contactPerson || '',
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
    return [contact.title, contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || '-';
  }

  /* ─── PDF export ─── */
  downloadCustomerPDF(c: any) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const L = 14;
    let y = 15;

    const checkPage = (needed = 12) => {
      if (y + needed > pH - 15) {
        doc.addPage();
        y = 15;
      }
    };

    const section = (title: string) => {
      checkPage(16);
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
      const lines = doc.splitTextToSize(value || '-', pW - x2 - L);
      checkPage(lines.length * 5 + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(label, L, y);
      doc.setFont('helvetica', 'normal');
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
        const name = [cp.title, cp.contactPerson].filter(Boolean).join(' ') || '';
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
    if (c.businessVertical) row('Business Vertical:', c.businessVertical);
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
