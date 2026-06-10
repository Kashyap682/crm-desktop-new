import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';
import { ConfirmService } from '../../service/confirm.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {

  items: any[] = [];
  searchTerm = '';

  showModal = false;
  isEditing = false;

  form: any = {};

  vendorNames: string[] = [];

  groupPrefixMap: any = {
    'Material Distribution Division': 'MDD',
    'Projects': 'PROJ'
  };

  activeMenuId: any = null;
  menuPosition: { top: string; left: string } = { top: '0px', left: '0px' };

  constructor(private apiService: ApiService, private toastService: ToastService, private confirmService: ConfirmService) { }

  toggleActionMenu(event: Event, item: any) {
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    this.menuPosition = {
      top: `${rect.bottom + scrollY + 8}px`,
      left: `${rect.right + scrollX - 160}px`
    };

    this.activeMenuId = this.activeMenuId === item.name ? null : item.name;
  }

  closeActionMenu() {
    this.activeMenuId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    this.activeMenuId = null;
  }

  ngOnInit() {
    this.loadItems();
    this.loadVendorNames();
    // Auto-fill from inquiry if navigated with state
    const state = (history.state || {}) as any;
    if (state?.inquiryItem) {
      this.openAddModal(state.inquiryItem);
    }
  }

  /* ===============================
     Load Vendor Names from IndexedDB
  =============================== */
  async loadVendorNames() {
    try {
      const vendors = await this.apiService.getAll('vendors');
      this.vendorNames = vendors
        .map((v: any) => v.companyName)
        .filter((name: string) => !!name)
        .sort();
    } catch (error) {
      console.error('Error loading vendor names:', error);
      this.vendorNames = [];
    }
  }

  /* ===============================
     Product ID Generator
  =============================== */
  async generateNextProductIdByGroup(group: string): Promise<string> {
    const prefix = this.groupPrefixMap[group] || 'GEN';

    const allProducts = await this.apiService.getAll('inventory');
    const groupProducts = allProducts.filter((p: any) => p.group === group);

    let maxCounter = 0;
    groupProducts.forEach((p: any) => {
      if (p.productId) {
        const match = p.productId.match(/INV-.*?-(\d+)/);
        if (match) {
          const counter = parseInt(match[1], 10);
          if (counter > maxCounter) maxCounter = counter;
        }
      }
    });

    const next = maxCounter + 1;
    return `INV-${prefix}-${next.toString().padStart(4, '0')}`;
  }

  /* ===============================
     Calculations
  =============================== */
  calculateTotalValue(item: any): number {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.price) || 0;
    const gst = Number(item.gst) || 0;

    const subtotal = qty * rate;
    const gstAmount = (subtotal * gst) / 100;
    const total = subtotal + gstAmount;

    return total;
  }

  calculateFormTotalValue(): string {
    const qty = Number(this.form.quantity) || 0;
    const rate = Number(this.form.price) || 0;
    const gst = Number(this.form.gst) || 0;

    const subtotal = qty * rate;
    const gstAmount = (subtotal * gst) / 100;
    const total = subtotal + gstAmount;

    return `₹${total.toFixed(2)}`;
  }

  /* ===============================
     UI Actions
  =============================== */
  openAddModal(prefill?: any) {
    this.isEditing = false;
    this.showModal = true;
    this.form = {
      location: '',
      displayName: prefill?.productName || '',
      hsn: prefill?.hsn || '',
      unit: prefill?.uom || '',
      quantity: 0,
      purchaseRate: 0,
      category: '',
      vendorName: '',
      productMake: prefill?.make || '',
      weight: 0,
      packing: '',
      numberOfUnits: 0,
      stock: 0,
      // specs
      thickness: prefill?.thickness || '',
      density: prefill?.density || '',
      fsk: prefill?.fsk || '',
      alloy: prefill?.alloy || '',
      size: prefill?.size || '',
      // legacy compat
      group: '',
      price: 0,
      gst: 0
    };
  }

  openEditModal(item: any) {
    this.form = { ...item, purchaseRate: item.purchaseRate ?? item.price ?? 0 };
    this.isEditing = true;
    this.showModal = true;
    this.closeActionMenu();
  }

  async submitForm() {
    if (!this.form.location || !this.form.displayName || !this.form.unit) {
      this.toastService.warning('Please fill required fields: Location, Product/Material and UOM');
      return;
    }

    // map purchaseRate → price for backward compat
    this.form.price = Number(this.form.purchaseRate ?? this.form.price ?? 0);

    this.form.specifications = [
      this.form.thickness ? `Thickness: ${this.form.thickness}` : null,
      this.form.density ? `Density: ${this.form.density}` : null,
      this.form.fsk ? `FSK: ${this.form.fsk}` : null,
      this.form.alloy ? `Alloy: ${this.form.alloy}` : null,
      this.form.size ? `Size: ${this.form.size}` : null
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const allProducts = await this.apiService.getAll('inventory');

      const formName = this.form.displayName || this.form.name;

      const existingProduct = allProducts.find((p: any) =>
        p.location?.toLowerCase() === this.form.location?.toLowerCase() &&
        (p.displayName || p.name)?.toLowerCase() === formName?.toLowerCase() &&
        (p.size || '').toLowerCase() === (this.form.size || '').toLowerCase()
      );

      if (existingProduct && !this.isEditing) {
        const updatedQty = Number(existingProduct.quantity ?? 0) + Number(this.form.quantity ?? 0);

        await this.apiService.put('inventory', {
          ...existingProduct,
          quantity: updatedQty,
          numberOfUnits: Number(existingProduct.numberOfUnits ?? 0) + Number(this.form.numberOfUnits ?? 0)
        });

        this.toastService.success(`Stock updated — "${existingProduct.displayName || existingProduct.name}" new qty: ${updatedQty}`);
      } else {
        if (!this.form.productId) {
          this.form.productId = await this.generateNextProductIdByGroup(this.form.group);
        }

        const itemKey = this.isEditing && this.form.name?.includes('_')
          ? this.form.name
          : `${this.form.location}_${formName}_${this.form.size || 'nosize'}`.toLowerCase();

        await this.apiService.put('inventory', {
          ...this.form,
          name: itemKey,
          displayName: formName,
          quantity: Number(this.form.quantity ?? 0),
          price: Number(this.form.price ?? 0),
          gst: Number(this.form.gst ?? 0),
          numberOfUnits: Number(this.form.numberOfUnits ?? 0),
          weight: Number(this.form.weight ?? 0)
        });
        this.toastService.success(this.isEditing ? `"${formName}" updated` : `"${formName}" added to inventory`);
      }

      await this.loadItems();
      this.showModal = false;
    } catch (error) {
      console.error('Error saving inventory:', error);
      this.toastService.error('Failed to save inventory item');
    }
  }

  private normalizeLocation(loc: string): string {
    const map: Record<string, string> = { vasai: 'Vasai', jageshwari: 'Jageshwari', nagpur: 'Nagpur' };
    return map[(loc || '').toLowerCase()] || loc || '';
  }

  /* ===============================
     Data Load / Delete
  =============================== */
  async loadItems() {
    try {
      const raw = await this.apiService.getAll('inventory');
      this.items = raw.map((item: any) => ({
        ...item,
        location: this.normalizeLocation(item.location),
        purchaseRate: item.purchaseRate ?? item.price ?? 0
      }));
    } catch (error) {
      console.error('❌ Error loading inventory:', error);
      this.items = [];
    }
  }

  async deleteItem(item: any) {
    const displayName = item.displayName || item.name;
    if (!await this.confirmService.confirm(`Delete "${displayName}" (${item.size})?`, { danger: true })) return;
    try {
      await this.apiService.delete('inventory', item.name);
      await this.loadItems();
      this.toastService.success(`"${displayName}" deleted`);
      this.closeActionMenu();
    } catch (error) {
      console.error('❌ Error deleting item:', error);
      this.toastService.error('Failed to delete item');
    }
  }

  filteredItems() {
    const t = this.searchTerm.toLowerCase();
    return this.items.filter((i: any) => {
      const displayName = i.displayName || i.name;
      return (
        (displayName || '').toLowerCase().includes(t) ||
        (i.productId || '').toLowerCase().includes(t) ||
        (i.location || '').toLowerCase().includes(t) ||
        (i.group || '').toLowerCase().includes(t)
      );
    });
  }

  /* ===============================
     Excel
  =============================== */
  triggerFileUpload() {
    (document.getElementById('excelUpload') as HTMLInputElement).click();
  }

  async handleExcelUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev!.target!.result, { type: 'array' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const existingProducts = await this.apiService.getAll('inventory');

        let updatedCount = 0;
        let newCount = 0;

        for (const row of rows) {
          const rowLocation = row['Location'] || row['location'] || '';
          const rowGroup = 'Material Distribution Division';
          const rowName = row['Item / Material'] || row['Name'] || row['name'] || '';
          const rowSize = row['Size'] || row['size'] || '';
          const rowQty = Number(row['Qty'] || row['Quantity'] || row['quantity'] || 0);

          const existingProduct = existingProducts.find((p: any) =>
            p.location?.toLowerCase() === rowLocation.toLowerCase() &&
            (p.displayName || p.name)?.toLowerCase() === rowName.toLowerCase() &&
            (p.size || '').toLowerCase() === rowSize.toLowerCase()
          );

          if (existingProduct) {
            const updatedQty = Number(existingProduct.quantity ?? 0) + rowQty;
            const rowNumberOfUnits = Number(row['No. of Rolls/Bundles/pcs'] || row['No. of rolls/Bundles/pcs'] || row['numberOfUnits'] || 0);

            await this.apiService.put('inventory', {
              ...existingProduct,
              quantity: updatedQty,
              numberOfUnits: Number(existingProduct.numberOfUnits ?? 0) + rowNumberOfUnits
            });
            updatedCount++;
          } else {
            const rawProductId = row['Product ID'] || row['productId'] || '';
            const normalizeProductId = (raw: string, group: string): string => {
              if (!raw) return '';
              const pfx = this.groupPrefixMap[group] || 'GEN';
              const full = raw.match(/^INV-([A-Z]+)-(\d+)$/i);
              if (full) return `INV-${full[1].toUpperCase()}-${parseInt(full[2]).toString().padStart(4, '0')}`;
              const m = raw.match(/^(?:[A-Z]+-)?(\d+)$/i);
              if (m) return `INV-${pfx}-${parseInt(m[1]).toString().padStart(4, '0')}`;
              return raw;
            };
            const productId = normalizeProductId(rawProductId, rowGroup) || await this.generateNextProductIdByGroup(rowGroup);
            const itemKey = `${rowLocation}_${rowGroup}_${rowName}_${rowSize}`.toLowerCase();

            const thickness = row['Thickness'] || row['thickness'] || '';
            const density   = row['Density']   || row['density']   || '';
            const fsk       = row['FSK']        || row['fsk']       || '';
            const alloy     = row['Alloy']      || row['alloy']     || '';
            const specs = [
              thickness ? `Thickness: ${thickness}` : null,
              density   ? `Density: ${density}`     : null,
              fsk       ? `FSK: ${fsk}`             : null,
              alloy     ? `Alloy: ${alloy}`         : null,
              rowSize   ? `Size: ${rowSize}`        : null
            ].filter(Boolean).join(' | ');
            const newProduct = {
              name: itemKey,
              displayName: rowName,
              productId: productId,
              location: rowLocation,
              group: rowGroup,
              size: rowSize,
              hsn: row['HSN'] || row['hsn'] || '',
              unit: row['UOM'] || row['unit'] || '',
              numberOfUnits: Number(row['No. of Rolls/Bundles/pcs'] || row['No. of rolls/Bundles/pcs'] || row['numberOfUnits'] || 0),
              quantity: rowQty,
              price: Number(row['Purchase Rate'] || row['Rate'] || row['price'] || 0),
              purchaseRate: Number(row['Purchase Rate'] || row['Rate'] || row['price'] || 0),
              category: row['Category'] || row['category'] || '',
              vendorName: row['Vendor Name'] || row['vendorName'] || '',
              productMake: row['Product Make'] || row['productMake'] || '',
              thickness, density, fsk, alloy,
              specifications: specs,
              weight: Number(row['Weight'] || row['weight'] || 0),
              packing: row['Packing'] || row['packing'] || '',
              stock: Number(row['Stock'] || row['stock'] || 0),
              attachment: null
            };

            await this.apiService.put('inventory', newProduct);
            newCount++;
          }
        }

        await this.loadItems();
        this.toastService.success(`Excel imported — ${newCount} new, ${updatedCount} updated`);
      } catch (error) {
        console.error('❌ Error importing Excel:', error);
        this.toastService.error('Failed to import Excel — check the file format');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private inventoryRow(item: any) {
    const specs = item.specifications ? String(item.specifications) : '';
    const getSpec = (key: string) => {
      if (item[key] != null && item[key] !== '') return item[key];
      const re = new RegExp(`${key}:\\s*([^|]+)`, 'i');
      const m = specs.match(re);
      return m ? m[1].trim() : '';
    };
    return {
      'Location': item.location || '',
      'Item / Material': item.displayName || item.name || '',
      'HSN': item.hsn || '',
      'UOM': item.unit || '',
      'Qty': item.quantity ?? 0,
      'Purchase Rate': item.purchaseRate ?? item.price ?? 0,
      'Category': item.category || '',
      'Vendor Name': item.vendorName || '',
      'Product Make': item.productMake || '',
      'Weight': item.weight ?? 0,
      'Packing': item.packing || '',
      'No. of Rolls/Bundles/pcs': item.numberOfUnits ?? 0,
      'Stock': item.stock ?? 0,
      'Thickness': getSpec('thickness'),
      'Density': getSpec('density'),
      'FSK': getSpec('fsk'),
      'Alloy': getSpec('alloy'),
      'Size': item.size || ''
    };
  }

  downloadInventoryAsExcel() {
    const ws = XLSX.utils.json_to_sheet(this.items.map((item: any) => this.inventoryRow(item)));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'Inventory.xlsx');
  }

  downloadInventoryTemplate() {
    const ws = XLSX.utils.json_to_sheet([this.inventoryRow({})]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'Inventory-Template.xlsx');
  }

  /* ===============================
     Attachments
  =============================== */
  uploadAttachment(e: any) {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => {
        this.form.attachment = r.result;
        this.form.attachmentName = file.name;
        this.form.attachmentType = file.type;
      };
      r.readAsDataURL(file);
    }
  }

  async viewAttachment(it: any) {
    if (!it.attachment) {
      this.toastService.info('No attachment available');
      return;
    }

    const fileName = it.attachmentName || 'attachment';
    const fileType = it.attachmentType || 'application/octet-stream';

    const link = document.createElement('a');
    link.href = it.attachment;
    link.download = fileName;

    if (fileType.startsWith('image/') || fileType === 'application/pdf') {
      const download = await this.confirmService.confirm(
        fileName,
        { title: 'Open Attachment', confirmLabel: 'Download', cancelLabel: 'View in tab' }
      );

      if (download) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(it.attachment, '_blank');
      }
    } else {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    this.closeActionMenu();
  }

  cancelModal() {
    this.showModal = false;
    this.form = {};
  }
}