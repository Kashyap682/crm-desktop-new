import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../service/api.service';
import { ToastService } from '../../service/toast.service';

@Component({
  selector: 'app-database',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.css']
})
export class DatabaseComponent implements OnInit {

  documents: any[] = [];
  filteredDocuments: any[] = [];

  searchTerm = '';
  filterCategory = '';

  isUploading = false;
  uploadStatus = '';

  categories = ['Datasheet', 'MSDS', 'Test Certificate', 'Drawing', 'Brochure', 'Other'];

  showUploadModal = false;
  uploadForm: any = { name: '', category: '', material: '', tags: '' };
  pendingFile: File | null = null;

  showPreviewModal = false;
  previewDoc: any = null;
  previewSafeUrl: SafeResourceUrl | null = null;

  constructor(private apiService: ApiService, private sanitizer: DomSanitizer, private toastService: ToastService) { }

  // ── Mapping helpers ──────────────────────────────────────

  private toDbRow(doc: any): any {
    return {
      name:        doc.name        || '',
      category:    doc.category    || 'Other',
      material:    doc.material    || null,
      tags:        doc.tags        || null,
      file_name:   doc.fileName    || null,
      file_type:   doc.fileType    || null,
      file_size:   doc.fileSize    ?? null,
      file_data:   doc.fileData    || null,
      uploaded_at: doc.uploadedAt  || new Date().toISOString(),
    };
  }

  private fromDbRow(row: any): any {
    return {
      id:         row.id,
      name:       row.name        || '',
      category:   row.category    || '',
      material:   row.material    || '',
      tags:       row.tags        || '',
      fileName:   row.file_name   || '',
      fileType:   row.file_type   || '',
      fileSize:   row.file_size   ?? 0,
      fileData:   row.file_data   || '',
      uploadedAt: row.uploaded_at || '',
    };
  }

  async ngOnInit() {
    await this.loadDocuments();
  }

  async loadDocuments() {
    try {
      const rows = await this.apiService.getAll('documents');
      this.documents = rows
        .map((r: any) => this.fromDbRow(r))
        .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    } catch {
      this.documents = [];
    }
    this.applyFilter();
  }

  applyFilter() {
    let result = [...this.documents];
    const term = this.searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(d =>
        (d.name || '').toLowerCase().includes(term) ||
        (d.material || '').toLowerCase().includes(term) ||
        (d.tags || '').toLowerCase().includes(term) ||
        (d.category || '').toLowerCase().includes(term)
      );
    }
    if (this.filterCategory) {
      result = result.filter(d => d.category === this.filterCategory);
    }
    this.filteredDocuments = result;
  }

  // ── Upload ───────────────────────────────────────────────

  triggerFileInput() {
    const input = document.getElementById('fileInput') as HTMLInputElement;
    input?.click();
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.pendingFile = file;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    this.uploadForm = { name: baseName, category: '', material: '', tags: '' };
    this.showUploadModal = true;
    input.value = '';
  }

  cancelUpload() {
    this.showUploadModal = false;
    this.pendingFile = null;
    this.uploadForm = { name: '', category: '', material: '', tags: '' };
  }

  async confirmUpload() {
    if (!this.pendingFile || !this.uploadForm.name.trim()) return;
    this.isUploading = true;

    try {
      const base64 = await this.fileToBase64(this.pendingFile);
      const doc = {
        name:       this.uploadForm.name.trim(),
        category:   this.uploadForm.category || 'Other',
        material:   this.uploadForm.material.trim(),
        tags:       this.uploadForm.tags.trim(),
        fileName:   this.pendingFile.name,
        fileType:   this.pendingFile.type,
        fileSize:   this.pendingFile.size,
        fileData:   base64,
        uploadedAt: new Date().toISOString()
      };
      await this.apiService.add('documents', this.toDbRow(doc));
      this.uploadStatus = '✓ Document uploaded successfully.';
      this.cancelUpload();
      await this.loadDocuments();
      setTimeout(() => { this.uploadStatus = ''; }, 4000);
    } catch {
      this.uploadStatus = '✗ Upload failed. Please try again.';
    }
    this.isUploading = false;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Actions ──────────────────────────────────────────────

  downloadDocument(doc: any) {
    const a = document.createElement('a');
    a.href = doc.fileData;
    a.download = doc.fileName || doc.name;
    a.click();
  }

  openPreview(doc: any) {
    this.previewDoc = doc;
    this.previewSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.fileData);
    this.showPreviewModal = true;
  }

  closePreview() {
    this.showPreviewModal = false;
    this.previewDoc = null;
    this.previewSafeUrl = null;
  }

  async deleteDocument(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await this.apiService.delete('documents', id);
      await this.loadDocuments();
      this.toastService.success('Document deleted');
    } catch (error) {
      console.error('❌ Failed to delete document:', error);
      this.toastService.error('Failed to delete document');
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getCategoryColor(cat: string): string {
    const map: Record<string, string> = { 'Datasheet': '#3b82f6', 'MSDS': '#ef4444', 'Test Certificate': '#10b981', 'Drawing': '#8b5cf6', 'Brochure': '#f59e0b', 'Other': '#6b7280' };
    return map[cat] || '#6b7280';
  }

  getCategoryBg(cat: string): string {
    const map: Record<string, string> = { 'Datasheet': '#eff6ff', 'MSDS': '#fef2f2', 'Test Certificate': '#f0fdf4', 'Drawing': '#f5f3ff', 'Brochure': '#fffbeb', 'Other': '#f9fafb' };
    return map[cat] || '#f9fafb';
  }

  getFileIconLabel(fileType: string): string {
    if (!fileType) return 'FILE';
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('image')) return 'IMG';
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return 'XLS';
    if (fileType.includes('word') || fileType.includes('document')) return 'DOC';
    return 'FILE';
  }

  getFileIconColor(fileType: string): string {
    if (!fileType) return '#6b7280';
    if (fileType.includes('pdf')) return '#ef4444';
    if (fileType.includes('image')) return '#8b5cf6';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '#10b981';
    if (fileType.includes('word') || fileType.includes('document')) return '#3b82f6';
    return '#6b7280';
  }

  isPreviewable(fileType: string): boolean {
    return !!(fileType?.includes('pdf') || fileType?.includes('image'));
  }

  countByCategory(cat: string): number {
    return this.documents.filter(d => d.category === cat).length;
  }
}
