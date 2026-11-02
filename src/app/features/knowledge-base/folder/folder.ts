import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { MarkdownService } from '../../../core/services/markdown.service';
import { AuthService } from '../../../core/services/auth.service';
import { Modal } from '../../../shared/modal/modal';
import { Pager } from '../../../shared/pager/pager';

@Component({
  selector: 'app-folder',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Modal, Pager],
  templateUrl: './folder.html',
  styleUrl: './folder.scss',
})
export class Folder implements OnInit {
  readonly folderId = input.required<string>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly markdown = inject(MarkdownService);

  readonly kb = inject(KnowledgeBaseService);
  readonly auth = inject(AuthService);

  readonly folder = computed(() => {
    const folder = this.kb.currentFolder();
    return folder && folder.id === this.folderId() ? folder : undefined;
  });

  readonly totalNotes = computed(() => this.kb.folderNotesPaging()?.total_items ?? 0);
  readonly totalPages = computed(() => this.kb.folderNotesPaging()?.total_pages ?? 0);

  /* ---------------- Criação de nota ---------------- */

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly contentPreview = signal(false);
  readonly contentText = signal('');
  readonly previewHtml = computed(() => this.markdown.render(this.contentText()));

  readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    content: ['', [Validators.required, Validators.minLength(10)]],
    versionName: ['v1', Validators.required],
  });

  constructor() {
    this.createForm.controls.content.valueChanges.subscribe((value) =>
      this.contentText.set(value),
    );
  }

  ngOnInit(): void {
    this.kb.loadFolderInfo(this.folderId());
    this.kb.loadNotesFromFolder(this.folderId(), 1);
  }

  goToPage(page: number): void {
    if (this.kb.folderNotesLoading()) {
      return;
    }
    this.kb.loadNotesFromFolder(this.folderId(), page);
  }

  /* ---------------- Edição de pasta (admin/editor) ---------------- */

  readonly showEdit = signal(false);
  readonly savingEdit = signal(false);

  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
  });

  openEdit(): void {
    const folder = this.folder();
    if (!folder) {
      return;
    }
    this.editForm.patchValue({ name: folder.name, description: folder.description });
    this.showEdit.set(true);
  }

  editFolder(): void {
    const folder = this.folder();
    if (!folder || this.editForm.invalid || this.savingEdit()) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.savingEdit.set(true);
    this.kb
      .updateFolder({
        folder_id: this.folderId(),
        ...this.editForm.getRawValue(),
      })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.showEdit.set(false);
          this.kb.loadFolderInfo(this.folderId());
        },
        error: () => {
          this.savingEdit.set(false);
        },
      });
  }

  /* ---------------- Exclusão de pasta ---------------- */

  readonly showConfirm = signal(false);
  readonly deleting = signal(false);

  askDelete(): void {
    this.showConfirm.set(true);
  }

  deleteFolder(): void {
    const folder = this.folder();
    if (!folder || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.kb.deleteFolder(folder.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.showConfirm.set(false);
        void this.router.navigate(['/kb']);
      },
      error: () => this.deleting.set(false),
    });
  }

  /* ---------------- Criação de nota (nota + primeira versão) ---------------- */

  openCreate(): void {
    this.createForm.reset({ name: '', description: '', content: '', versionName: 'v1' });
    this.contentPreview.set(false);
    this.contentText.set('');
    this.showCreate.set(true);
  }

  create(): void {
    const folder = this.folder();
    if (!folder || this.createForm.invalid || this.creating()) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { name, description, content, versionName } = this.createForm.getRawValue();
    this.creating.set(true);

    // 1) cria a nota na pasta; 2) cria a primeira versão com o conteúdo.
    this.kb.createNote({ folder_id: folder.id, name, description }).subscribe({
      next: (note) => {
        this.kb
          .createNoteVersion({ note_id: note.id, name: versionName, description, content })
          .subscribe({
            next: () => {
              this.creating.set(false);
              this.showCreate.set(false);
              void this.router.navigate(['/kb/note', note.id]);
            },
            error: () => this.creating.set(false),
          });
      },
      error: () => this.creating.set(false),
    });
  }
}
