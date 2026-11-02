import { Component, computed, effect, ElementRef, inject, input, signal, viewChild, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { MarkdownService } from '../../../core/services/markdown.service';
import { NoteReferenceItem, NoteVersionItem } from '../../../core/models/note-api.models';
import { buildSearchRegex } from '../../../core/utils/search-pattern';
import { Modal } from '../../../shared/modal/modal';

type Tab = 'references' | 'comments';

type ConfirmTarget =
  | { kind: 'reference'; id: string; label: string }
  | { kind: 'version'; id: string; label: string }
  | { kind: 'note'; id: string; label: string };

/**
 * Detalhe da nota, alimentado por GET /api/notes/get-info.
 * As versões vêm paginadas; clicar em uma versão atualiza a descrição,
 * o conteúdo e as referências exibidos.
 */
@Component({
  selector: 'app-note-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Modal],
  templateUrl: './note-detail.html',
  styleUrl: './note-detail.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class NoteDetail implements OnInit {
  readonly noteId = input.required<string>();

  /** Termo da pesquisa que originou a navegação (?search=). */
  readonly search = input<string | undefined>(undefined);
  /** Tipo de resultado clicado (?kind=) — define onde destacar a ocorrência. */
  readonly kind = input<string | undefined>(undefined);

  readonly noteHeadingRef = viewChild<ElementRef<HTMLElement>>('noteHeading');
  readonly noteBodyRef = viewChild<ElementRef<HTMLElement>>('noteBody');
  readonly referencesPanelRef = viewChild<ElementRef<HTMLElement>>('referencesPanel');

  readonly kb = inject(KnowledgeBaseService);
  readonly auth = inject(AuthService);
  private readonly markdown = inject(MarkdownService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  readonly activeTab = signal<Tab>('references');

  /* ---------------- Versões ---------------- */

  private readonly selectedVersionId = signal<string | null>(null);

  readonly versions = computed(() => this.info()?.versions ?? []);

  /** Versão em exibição: a selecionada, ou a mais recente quando nenhuma está selecionada. */
  readonly viewVersion = computed<NoteVersionItem | undefined>(() => {
    const versions = this.versions();
    if (versions.length === 0) {
      return undefined;
    }
    const id = this.selectedVersionId();
    return (id !== null ? versions.find((v) => v.id === id) : undefined) ?? versions[0];
  });

  readonly isViewingOldVersion = computed(() => {
    const version = this.viewVersion();
    const versions = this.versions();
    return versions.length > 1 && !!version && version.id !== versions[0].id;
  });

  /* ---------------- Info ---------------- */

  readonly info = this.kb.noteInfo;
  readonly loading = this.kb.noteInfoLoading;
  readonly error = this.kb.noteInfoError;

  readonly note = computed(() => this.info()?.note);

  readonly folder = computed(() => {
    const note = this.note();
    return note ? this.kb.folderById(note.folder_id) : undefined;
  });

  readonly hasContent = computed(() => (this.viewVersion()?.content ?? '').trim() !== '');

  readonly renderedContent = computed(() =>
    this.markdown.render(this.viewVersion()?.content ?? ''),
  );

  readonly references = computed(() => this.viewVersion()?.references ?? []);

  readonly referencesCount = computed(() => this.references().length);

  constructor() {
    this.versionForm.controls.content.valueChanges.subscribe((value) =>
      this.versionPreviewText.set(value),
    );

    // Dispara o destaque da pesquisa quando as informações da nota chegam.
    effect(() => {
      const loading = this.kb.noteInfoLoading();
      const info = this.kb.noteInfo();
      if (!loading && info && this.highlightPending()) {
        setTimeout(() => {
          this.highlightPending.set(false);
          this.applyHighlight();
        }, 200);
      }
    });
  }

  ngOnInit(): void {
    if (this.search()) {
      this.highlightPending.set(true);
    }
    this.kb.loadNoteInfo(this.noteId());
  }

  /* ---------------- Criação de nova versão ---------------- */

  readonly showCreateVersion = signal(false);
  readonly creatingVersion = signal(false);
  readonly versionPreview = signal(false);
  readonly versionPreviewText = signal('');
  readonly versionPreviewHtml = computed(() => this.markdown.render(this.versionPreviewText()));

  readonly versionForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    content: ['', [Validators.required, Validators.minLength(10)]],
  });

  openCreateVersion(): void {
    const current = this.versions()[0];

    this.versionForm.patchValue({
      name: `v${this.versions().length + 1}`,
      description: current?.description ?? '',
      content: current?.content ?? '',
    });
    this.versionPreviewText.set(current?.content ?? '');
    this.versionPreview.set(false);
    this.showCreateVersion.set(true);
  }

  /** Cria uma versão de nota (nova versão do conteúdo). */
  createVersion(): void {
    const note = this.note();
    if (!note || this.versionForm.invalid || this.creatingVersion()) {
      this.versionForm.markAllAsTouched();
      return;
    }

    this.creatingVersion.set(true);
    this.kb
      .createNoteVersion({
        note_id: note.id,
        ...this.versionForm.getRawValue(),
      })
      .subscribe({
        next: () => {
          this.creatingVersion.set(false);
          this.showCreateVersion.set(false);
          this.selectCurrentVersion();
          this.kb.loadNoteInfo(this.noteId());
        },
        error: () => this.creatingVersion.set(false),
      });
  }

  /* ---------------- Destaque da ocorrência da pesquisa ---------------- */

  private highlightPending = signal(false);

  private applyHighlight(): void {
    const term = this.search();
    if (!term) {
      return;
    }
    const regex = buildSearchRegex(term);
    const kind = this.kind() ?? 'content';

    if (kind === 'reference') {
      this.activeTab.set('references');
      setTimeout(() => this.highlightReference(regex), 150);
      return;
    }

    if (kind === 'note') {
      const heading = this.noteHeadingRef()?.nativeElement;
      if (heading && this.highlightInElement(heading, regex)) {
        return;
      }
      heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const body = this.noteBodyRef()?.nativeElement;
    if (body && this.highlightInElement(body, regex)) {
      return;
    }
    body?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Localiza a primeira referência que casa e a destaca. */
  private highlightReference(regex: RegExp): void {
    const panel = this.referencesPanelRef()?.nativeElement;
    if (!panel) {
      return;
    }

    const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-ref-id]'));
    for (const card of cards) {
      regex.lastIndex = 0;
      if (regex.test(card.textContent ?? '')) {
        if (this.highlightInElement(card, regex)) {
          return;
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('reference-flash');
        setTimeout(() => card.classList.remove('reference-flash'), 3500);
        return;
      }
    }
  }

  /**
   * Percorre os nós de texto do elemento, envolve a primeira ocorrência em
   * <mark>, rola até ela e remove a marcação após alguns segundos.
   */
  private highlightInElement(root: HTMLElement, regex: RegExp): boolean {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;

    while (node) {
      const text = node.textContent ?? '';
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (match && match.index >= 0) {
        try {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);

          const mark = document.createElement('mark');
          mark.className = 'search-flash';
          range.surroundContents(mark);
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

          setTimeout(() => {
            const parent = mark.parentNode;
            if (parent) {
              parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
              parent.normalize();
            }
          }, 3500);
          return true;
        } catch {
          return false;
        }
      }
      node = walker.nextNode() as Text | null;
    }
    return false;
  }

  /* ---------------- Tela cheia ---------------- */

  readonly fullscreen = signal(false);

  protected onEscape(): void {
    if (this.fullscreen()) {
      this.fullscreen.set(false);
    }
  }

  /* ---------------- CRUD de referências ---------------- */

  readonly showRefForm = signal(false);
  readonly savingRef = signal(false);
  readonly editingRefId = signal<string | null>(null);

  readonly refForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    content: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    description: [''],
  });

  /** Abre o formulário para adicionar uma referência à versão atual. */
  openAddReference(): void {
    this.editingRefId.set(null);
    this.refForm.reset({ name: '', content: '', description: '' });
    this.showRefForm.set(true);
  }

  /** Abre o formulário para editar uma referência existente. */
  openEditReference(ref: NoteReferenceItem): void {
    this.editingRefId.set(ref.id);
    this.refForm.patchValue({
      name: ref.name,
      content: ref.content,
      description: ref.description,
    });
    this.showRefForm.set(true);
  }

  saveReference(): void {
    const version = this.versions()[0];
    if (!version || this.refForm.invalid || this.savingRef()) {
      this.refForm.markAllAsTouched();
      return;
    }

    const { name, content, description } = this.refForm.getRawValue();
    this.savingRef.set(true);

    const editingId = this.editingRefId();
    const request$ =
      editingId !== null
        ? this.kb.updateReference({ reference_id: editingId, name, content, description })
        : this.kb.createReference({
            note_version_id: version.id,
            name,
            content,
            description,
          });

    request$.subscribe({
      next: () => {
        this.savingRef.set(false);
        this.showRefForm.set(false);
        this.kb.loadNoteInfo(this.noteId());
      },
      error: () => this.savingRef.set(false),
    });
  }

  /* ---------------- Exclusões ---------------- */

  readonly confirmTarget = signal<ConfirmTarget | null>(null);
  readonly deleting = signal(false);

  /* ---------------- Renomear versão ---------------- */

  readonly renaming = signal<NoteVersionItem | null>(null);
  readonly renameSaving = signal(false);
  readonly renameName = signal('');
  readonly renameError = signal('');

  openRename(version: NoteVersionItem): void {
    this.renaming.set(version);
    this.renameName.set(version.name);
    this.renameError.set('');
  }

  renameVersion(): void {
    const version = this.renaming();
    if (!version || this.renameSaving()) {
      return;
    }
    if (!this.renameName().trim()) {
      this.renameError.set('Informe o nome da versão.');
      return;
    }

    this.renameSaving.set(true);
    this.kb.updateNoteVersionName(version.id, this.renameName().trim()).subscribe({
      next: () => {
        this.renameSaving.set(false);
        this.renaming.set(null);
        this.kb.loadNoteInfo(this.noteId());
      },
      error: () => {
        this.renameSaving.set(false);
        this.renameError.set('Não foi possível renomear a versão agora. Tente novamente.');
      },
    });
  }

  askDeleteReference(ref: NoteReferenceItem): void {
    this.confirmTarget.set({ kind: 'reference', id: ref.id, label: ref.name });
  }

  askDeleteVersion(version: NoteVersionItem): void {
    this.confirmTarget.set({ kind: 'version', id: version.id, label: version.name });
  }

  askDeleteNote(): void {
    const note = this.note();
    if (note) {
      this.confirmTarget.set({ kind: 'note', id: note.id, label: note.name });
    }
  }

  executeConfirm(): void {
    const target = this.confirmTarget();
    if (!target || this.deleting()) {
      return;
    }

    this.deleting.set(true);

    if (target.kind === 'reference') {
      this.kb.deleteReference(target.id).subscribe({
        next: () => this.afterDelete(),
        error: () => this.deleting.set(false),
      });
      return;
    }

    if (target.kind === 'version') {
      this.kb.deleteNoteVersion(target.id).subscribe({
        next: () => {
          this.selectCurrentVersion();
          this.afterDelete();
        },
        error: () => this.deleting.set(false),
      });
      return;
    }

    this.kb.deleteNote(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
        const folder = this.folder();
        void this.router.navigate(folder ? ['/kb/folder', folder.id] : ['/kb']);
      },
      error: () => this.deleting.set(false),
    });
  }

  private afterDelete(): void {
    this.deleting.set(false);
    this.confirmTarget.set(null);
    this.kb.loadNoteInfo(this.noteId());
  }

  selectVersion(id: string): void {
    this.selectedVersionId.set(id);
  }

  selectCurrentVersion(): void {
    this.selectedVersionId.set(null);
  }

  retry(): void {
    this.selectedVersionId.set(null);
    this.kb.loadNoteInfo(this.noteId());
  }

  /** Nome do autor de uma versão (resolvido pelo backend). */
  protected versionAuthorName(version: NoteVersionItem): string {
    return version.created_by_name?.trim() !== '' ? version.created_by_name : 'Não informado';
  }

  /** Exibe o valor informado ou "Não informado" quando vazio. */
  protected orUninformed(value: string | undefined | null): string {
    return value && value.trim() !== '' ? value : 'Não informado';
  }

  protected isLink(value: string | undefined | null): boolean {
    return !!value && /^https?:\/\//.test(value.trim());
  }
}
