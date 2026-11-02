import { inject, Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }

  /**
   * Converte Markdown em HTML seguro:
   * 1. `marked` transforma o Markdown em HTML;
   * 2. `DOMPurify` remove qualquer conteúdo perigoso (scripts, eventos, etc.);
   * 3. o resultado é marcado como confiável para o binding `[innerHTML]`.
   */
  render(source: string): SafeHtml {
    const rawHtml = marked.parse(source ?? '', { async: false });
    const clean = DOMPurify.sanitize(rawHtml);
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
