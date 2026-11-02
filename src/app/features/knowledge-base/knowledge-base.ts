import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { KnowledgeBaseService } from '../../core/services/knowledge-base.service';
import { AuthService } from '../../core/services/auth.service';
import { MatchSegment, SearchHit, SearchMatch } from '../../core/models/search.models';
import { buildSearchPattern } from '../../core/utils/search-pattern';
import { Modal } from '../../shared/modal/modal';
import { Pager } from '../../shared/pager/pager';

@Component({
  selector: 'app-knowledge-base',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Modal, Pager],
  templateUrl: './knowledge-base.html',
  styleUrl: './knowledge-base.scss',
})
export class KnowledgeBase implements OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  readonly kb = inject(KnowledgeBaseService);
  readonly auth = inject(AuthService);

  /** Setores que o usuário possui — únicas opções ao associar uma pasta. */
  readonly mySections = computed(() => {
    const user = this.auth.user();
    return user
      ? this.kb.sections().filter((section) => user.sections.includes(section.id))
      : [];
  });

  readonly totalFolders = computed(() => this.kb.foldersPaging()?.total_items ?? 0);

  /* ---------------- Filtro e ordenação ---------------- */

  readonly sectionFilter = signal('');
  readonly order = signal('name');

  /* ---------------- Paginação ---------------- */

  readonly totalPages = computed(() => this.kb.foldersPaging()?.total_pages ?? 0);
  readonly currentPage = this.kb.currentFolderPage;

  constructor() {
    this.kb.loadFolders(1, '', 'name');
    this.kb.loadSections();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  reload(): void {
    this.kb.loadFolders(1, this.sectionFilter(), this.order());
  }

  goToPage(page: number): void {
    if (
      this.kb.foldersLoading() ||
      page < 1 ||
      page > this.totalPages() ||
      page === this.currentPage()
    ) {
      return;
    }
    this.kb.loadFolders(page, this.sectionFilter(), this.order());
  }

  /* ---------------- Criação de pasta ---------------- */

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly redirecting = signal(false);

  readonly folderForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    section_id: [''],
  });

  openCreate(): void {
    this.folderForm.reset({ name: '', description: '', section_id: '' });
    this.showCreate.set(true);
  }

  createFolder(): void {
    if (this.folderForm.invalid || this.creating()) {
      this.folderForm.markAllAsTouched();
      return;
    }

    const { name, description, section_id } = this.folderForm.getRawValue();

    this.creating.set(true);
    this.kb
      .createFolder({
        name,
        description,
        section_id: section_id || null,
      })
      .subscribe({
        next: (folder) => {
          // Delay fixo de 2s: garante que a pasta esteja registrada antes de entrar.
          this.creating.set(false);
          this.redirecting.set(true);
          this.kb.loadFolders(1, this.sectionFilter(), this.order());
          setTimeout(() => {
            this.redirecting.set(false);
            this.showCreate.set(false);
            void this.router.navigate(['/kb/folder', folder.id]);
          }, 2000);
        },
        error: () => {
          this.creating.set(false);
        },
      });
  }

  /* ---------------- Busca global (regex) ---------------- */

  readonly searchTerm = signal('');
  readonly searchHits = signal<SearchHit[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal('');
  readonly showResults = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);

    clearTimeout(this.searchTimer);

    if (value.trim() === '') {
      this.showResults.set(false);
      this.searchHits.set([]);
      this.searchError.set('');
      return;
    }

    this.searchTimer = setTimeout(() => this.runSearch(value), 400);
  }

  private runSearch(query: string): void {
    this.searching.set(true);
    this.searchError.set('');
    this.showResults.set(true);

    this.kb.search(buildSearchPattern(query)).subscribe({
      next: (response) => {
        this.searchHits.set(response.data ?? []);
        this.searching.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.searching.set(false);
        this.searchHits.set([]);
        this.searchError.set(
          err.error?.error === 'BAD_REQUEST'
            ? 'Expressão regular inválida.'
            : 'Não foi possível executar a busca agora.',
        );
      },
    });
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.showResults.set(false);
    this.searchHits.set([]);
    this.searchError.set('');
  }

  /** Divide o trecho em segmentos marcando o que casou com a expressão. */
  matchSegments(match: SearchMatch): MatchSegment[] {
    const segments: MatchSegment[] = [];
    let cursor = 0;

    for (const [start, end] of match.ranges) {
      if (start > cursor) {
        segments.push({ text: match.excerpt.slice(cursor, start), matched: false });
      }
      segments.push({ text: match.excerpt.slice(start, end), matched: true });
      cursor = end;
    }
    if (cursor < match.excerpt.length) {
      segments.push({ text: match.excerpt.slice(cursor), matched: false });
    }
    return segments;
  }

  kindLabel(kind: SearchHit['kind']): string {
    switch (kind) {
      case 'folder':
        return 'Pasta';
      case 'note':
        return 'Nota';
      case 'reference':
        return 'Referência';
      default:
        return 'Conteúdo';
    }
  }

  openHit(hit: SearchHit): void {
    const term = this.searchTerm();
    this.clearSearch();

    if (hit.kind === 'folder') {
      void this.router.navigate(['/kb/folder', hit.folder_id]);
      return;
    }

    if (hit.note_id) {
      void this.router.navigate(['/kb/note', hit.note_id], {
        queryParams: { search: term, kind: hit.kind },
      });
    }
  }
}
