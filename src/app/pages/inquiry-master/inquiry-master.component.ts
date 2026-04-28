import { Component, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DBService } from '../../service/db.service';
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
  id?: number;
  date: string;

  companyName?: string;
  customerName: string;
  customerPhone?: string;
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
  onCompanySelect() {
    if (!this.currentInquiry) return;

    const customer = this.customers.find(
      c => c.companyName === this.currentInquiry!.companyName
    );

    if (!customer) return;

    // Customer name from primaryContact or direct name field
    const pc = customer.primaryContact;
    const fullName = pc
      ? [pc.firstName, pc.lastName].filter(Boolean).join(' ')
      : '';
    this.currentInquiry.customerName = fullName || customer.name || '';

    // Phone / email — check primaryContact first, then top-level
    this.currentInquiry.customerPhone =
      pc?.mobile || customer.mobile || '';
    this.currentInquiry.email =
      pc?.email || customer.email || '';

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
    if (!id) return '-';
    return `INQ-${String(id).padStart(3, '0')}`;
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
    this.currentInquiry = {
      date: new Date().toISOString().slice(0, 10),
      companyName: '',
      customerName: '',
      customerPhone: '',
      email: '',
      officeAddress: '',
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