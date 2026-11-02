import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { SectionUsage } from '../../core/models/section.models';
import { SectionService } from '../../core/services/section.service';
import { Modal } from '../../shared/modal/modal';
import { Pager } from '../../shared/pager/pager';

/**
 * Administração de setores (apenas administradores): os setores organizam
 * as pastas da plataforma e definem o acesso dos usuários.
 */
@Component({
  selector: 'app-sections',
  imports: [DatePipe, ReactiveFormsModule, Modal, Pager],
  templateUrl: './sections.html',
  styleUrl: './sections.scss',
})
export class Sections implements OnInit {
  readonly sectionSvc = inject(SectionService);

  private readonly fb = inject(NonNullableFormBuilder);

  readonly totalPages = computed(() => this.sectionSvc.paging()?.total_pages ?? 0);
  readonly totalSections = computed(() => this.sectionSvc.paging()?.total_items ?? 0);

  ngOnInit(): void {
    this.sectionSvc.loadSections(1);
  }

  goToPage(page: number): void {
    if (this.sectionSvc.loading()) {
      return;
    }
    this.sectionSvc.loadSections(page);
  }

  inUse(section: SectionUsage): boolean {
    return section.folder_count > 0 || section.user_count > 0;
  }

  /* ---------------- Criação ---------------- */

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly createError = signal('');

  readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
  });

  openCreate(): void {
    this.createForm.reset({ name: '', description: '' });
    this.createError.set('');
    this.showCreate.set(true);
  }

  create(): void {
    if (this.createForm.invalid || this.creating()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    this.sectionSvc.createSection(this.createForm.getRawValue()).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreate.set(false);
        this.sectionSvc.loadSections();
      },
      error: (err: { error?: { error?: string } }) => {
        this.creating.set(false);
        this.createError.set(
          err.error?.error === 'CONFLICT'
            ? 'Já existe um setor com este nome.'
            : 'Não foi possível criar o setor agora. Tente novamente.',
        );
      },
    });
  }

  /* ---------------- Edição ---------------- */

  readonly editing = signal<SectionUsage | null>(null);
  readonly saving = signal(false);
  readonly editError = signal('');

  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
  });

  openEdit(section: SectionUsage): void {
    this.editing.set(section);
    this.editForm.patchValue({ name: section.name, description: section.description });
    this.editError.set('');
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  save(): void {
    const section = this.editing();
    if (!section || this.editForm.invalid || this.saving()) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.sectionSvc
      .updateSection({
        section_id: section.id,
        ...this.editForm.getRawValue(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEdit();
          this.sectionSvc.loadSections();
        },
        error: (err: { error?: { error?: string } }) => {
          this.saving.set(false);
          this.editError.set(
            err.error?.error === 'CONFLICT'
              ? 'Já existe um setor com este nome.'
              : 'Não foi possível salvar as alterações agora. Tente novamente.',
          );
        },
      });
  }

  /* ---------------- Exclusão ---------------- */

  readonly confirmTarget = signal<SectionUsage | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal('');

  askDelete(section: SectionUsage): void {
    this.confirmTarget.set(section);
    this.deleteError.set('');
  }

  deleteSection(): void {
    const section = this.confirmTarget();
    if (!section || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.sectionSvc.deleteSection(section.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
        this.sectionSvc.loadSections();
      },
      error: (err: { error?: { message?: string } }) => {
        this.deleting.set(false);
        this.deleteError.set(
          err.error?.message ??
            'Não foi possível excluir o setor agora. Tente novamente.',
        );
      },
    });
  }
}
