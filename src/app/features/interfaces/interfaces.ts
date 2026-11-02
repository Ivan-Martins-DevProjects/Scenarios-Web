import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { InterfacesService } from '../../core/services/interfaces.service';
import {
  FolderNode,
  HttpMethod,
  InterfaceCall,
  KeyValue,
} from '../../core/models/interface.models';
import { parseCurl } from '../../core/utils/curl';
import { highlightCode } from '../../core/utils/highlight';
import { Modal } from '../../shared/modal/modal';

interface CallDraft {
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  curl: string;
}

type ComposerTab = 'params' | 'headers' | 'body' | 'curl';

interface ResponseResult {
  kind: 'response';
  status: number;
  durationMs: number;
  body: string | null;
}

interface ResponseError {
  kind: 'error';
  message: string;
}

type ResponseState = ResponseResult | ResponseError | null;

const BodylessMethods: readonly HttpMethod[] = ['GET', 'HEAD'];
const MaxResponseLength = 20000;
const BlankCallHint =
  'Requisição em branco — preencha os campos ou cole um comando cURL na aba cURL.';

/**
 * Consulta de interfaces: console de requisições no estilo Postman.
 * À esquerda ficam as chamadas agrupadas por pasta; à direita, o editor
 * da requisição (parâmetros, headers e body) — a resposta da última
 * requisição enviada aparece logo abaixo.
 */
@Component({
  selector: 'app-interfaces',
  imports: [ReactiveFormsModule, NgTemplateOutlet, Modal],
  templateUrl: './interfaces.html',
  styleUrl: './interfaces.scss',
  host: {
    '(document:click)': 'closeMenu()',
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class Interfaces implements OnDestroy {
  readonly interfacesSvc = inject(InterfacesService);
  readonly auth = inject(AuthService);

  private readonly fb = inject(NonNullableFormBuilder);

  readonly methods: readonly HttpMethod[] = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
  ];

  private readonly drafts = new Map<string, CallDraft>();
  private readonly responses = new Map<string, ResponseState>();
  private readonly collapsedFolders = signal<ReadonlySet<string>>(new Set());

  private activeRequest: AbortController | null = null;

  readonly selectedCall = signal<InterfaceCall | null>(null);
  readonly draft = signal<CallDraft>({
    name: '',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: '',
    curl: '',
  });
  readonly response = signal<ResponseState>(null);
  readonly sending = signal(false);
  readonly activeTab = signal<ComposerTab>('params');
  readonly curlError = signal('');
  readonly bodyEnabled = computed(() => !BodylessMethods.includes(this.draft().method));
  readonly bodyHighlight = computed(() => highlightCode(this.draft().body));
  readonly responseHighlight = computed(() => {
    const result = this.response();
    return result?.kind === 'response' && result.body !== null ? highlightCode(result.body) : '';
  });
  readonly isDirty = computed(() => {
    const call = this.selectedCall();
    const draft = this.draft();
    if (!call) {
      return false;
    }
    return (
      draft.name !== call.name ||
      draft.method !== call.method ||
      draft.url !== call.url ||
      draft.body !== call.body ||
      !Interfaces.samePairs(draft.params, call.params) ||
      !Interfaces.samePairs(draft.headers, call.headers)
    );
  });

  private readonly bodyHighlightBox = viewChild<ElementRef<HTMLElement>>('bodyHighlightBox');

  constructor() {
    const first = this.interfacesSvc.calls()[0];
    if (first) {
      this.select(first);
    }
  }

  ngOnDestroy(): void {
    this.activeRequest?.abort();
  }

  /* ---------------- Pastas e seleção ---------------- */

  readonly unfiledKey = 'sem-pasta';

  isCollapsed(folder: string): boolean {
    return this.collapsedFolders().has(folder);
  }

  toggleFolder(folder: string): void {
    const next = new Set(this.collapsedFolders());
    if (next.has(folder)) {
      next.delete(folder);
    } else {
      next.add(folder);
    }
    this.collapsedFolders.set(next);
  }

  countCalls(node: FolderNode): number {
    return (
      node.calls.length + node.children.reduce((total, child) => total + this.countCalls(child), 0)
    );
  }

  folderIndent(depth: number): string {
    return depth === 0 ? '' : '— '.repeat(depth);
  }

  private expandIfCollapsed(key: string): void {
    if (this.isCollapsed(key)) {
      this.toggleFolder(key);
    }
  }

  /** Expande a pasta escolhida e todas as ancestrais para revelar a chamada movida. */
  private expandPathTo(folderId: string | null): void {
    if (folderId === null) {
      this.expandIfCollapsed(this.unfiledKey);
      return;
    }

    const chain = [folderId];
    const visited = new Set<string>([folderId]);
    let current = this.interfacesSvc.folders().find((folder) => folder.id === folderId);

    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      chain.unshift(current.parentId);
      const parentId = current.parentId;
      current = this.interfacesSvc.folders().find((folder) => folder.id === parentId);
    }

    for (const id of chain) {
      this.expandIfCollapsed(id);
    }
  }

  select(call: InterfaceCall): void {
    const current = this.selectedCall();
    if (current?.id === call.id) {
      return;
    }

    if (current) {
      this.drafts.set(current.id, this.draft());
    }

    this.selectedCall.set(call);
    this.draft.set(this.drafts.get(call.id) ?? this.draftFor(call));
    this.response.set(this.responses.get(call.id) ?? null);
    this.curlError.set('');
  }

  /* ---------------- Edição da requisição ---------------- */

  setTab(tab: ComposerTab): void {
    this.activeTab.set(tab);
  }

  setName(name: string): void {
    this.draft.update((draft) => ({ ...draft, name }));
  }

  save(): void {
    const call = this.selectedCall();
    if (!call || !this.isDirty()) {
      return;
    }

    const draft = this.draft();
    const name = draft.name.trim() === '' ? call.name : draft.name.trim();
    const description = call.description === BlankCallHint ? '' : call.description;

    const updated = this.interfacesSvc.updateCall(call.id, {
      name,
      description,
      method: draft.method,
      url: draft.url,
      params: draft.params.map((param) => ({ ...param })),
      headers: draft.headers.map((header) => ({ ...header })),
      body: draft.body,
    });

    if (updated) {
      this.draft.update((current) => ({ ...current, name }));
      this.selectedCall.set(updated);
    }
  }

  setMethod(method: string): void {
    this.draft.update((draft) => ({ ...draft, method: method as HttpMethod }));
  }

  setUrl(url: string): void {
    this.draft.update((draft) => ({ ...draft, url }));
  }

  setBody(body: string): void {
    this.draft.update((draft) => ({ ...draft, body }));
  }

  setCurl(curl: string): void {
    this.draft.update((draft) => ({ ...draft, curl }));
  }

  applyCurl(): void {
    const parsed = parseCurl(this.draft().curl);
    if (parsed === null) {
      this.curlError.set(
        'Não foi possível interpretar o comando — verifique se ele começa com curl e contém uma URL.',
      );
      return;
    }

    this.curlError.set('');
    this.draft.update((draft) => ({
      ...draft,
      method: parsed.method,
      url: parsed.url,
      params: parsed.params,
      headers: parsed.headers,
      body: parsed.body,
    }));
    this.activeTab.set('params');
  }

  updateParam(index: number, field: 'key' | 'value', value: string): void {
    this.draft.update((draft) => ({
      ...draft,
      params: Interfaces.patchItem(draft.params, index, field, value),
    }));
  }

  updateHeader(index: number, field: 'key' | 'value', value: string): void {
    this.draft.update((draft) => ({
      ...draft,
      headers: Interfaces.patchItem(draft.headers, index, field, value),
    }));
  }

  addParam(): void {
    this.draft.update((draft) => ({ ...draft, params: [...draft.params, emptyPair()] }));
  }

  addHeader(): void {
    this.draft.update((draft) => ({ ...draft, headers: [...draft.headers, emptyPair()] }));
  }

  removeParam(index: number): void {
    this.draft.update((draft) => ({
      ...draft,
      params: draft.params.filter((_, i) => i !== index),
    }));
  }

  removeHeader(index: number): void {
    this.draft.update((draft) => ({
      ...draft,
      headers: draft.headers.filter((_, i) => i !== index),
    }));
  }

  /* ---------------- Pasta da requisição ---------------- */

  setCallFolder(value: string): void {
    const call = this.selectedCall();
    if (!call) {
      return;
    }

    const folderId = value || null;
    const updated = this.interfacesSvc.updateCallFolder(call.id, folderId);
    if (updated) {
      this.selectedCall.set(updated);
      this.expandPathTo(folderId);
    }
  }

  syncBodyScroll(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    const box = this.bodyHighlightBox()?.nativeElement;
    if (box) {
      box.scrollTop = target.scrollTop;
      box.scrollLeft = target.scrollLeft;
    }
  }

  /* ---------------- Menu de criação (+) ---------------- */

  readonly menuOpen = signal(false);

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  /* ---------------- Nova requisição ---------------- */

  openCreateCall(): void {
    this.closeMenu();

    const call = this.interfacesSvc.createCall({
      name: this.nextUntitledName(),
      description: BlankCallHint,
      method: 'GET',
      url: '',
      folderId: null,
    });

    if (this.isCollapsed(this.unfiledKey)) {
      this.toggleFolder(this.unfiledKey);
    }

    this.select(call);
    this.activeTab.set('curl');
  }

  private nextUntitledName(): string {
    const base = 'Nova requisição';
    const taken = this.interfacesSvc
      .calls()
      .filter((call) => call.name === base || call.name.startsWith(`${base} `)).length;

    return taken === 0 ? base : `${base} ${taken + 1}`;
  }

  /* ---------------- Nova pasta ---------------- */

  readonly showCreateFolder = signal(false);
  readonly folderError = signal('');

  readonly folderForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    parentId: [''],
  });

  openCreateFolder(): void {
    this.closeMenu();
    this.folderForm.reset({ name: '', parentId: '' });
    this.folderError.set('');
    this.showCreateFolder.set(true);
  }

  createFolder(): void {
    if (this.folderForm.invalid) {
      this.folderForm.markAllAsTouched();
      return;
    }

    const { name, parentId } = this.folderForm.getRawValue();

    if (this.interfacesSvc.folderExists(name)) {
      this.folderError.set('Já existe uma pasta com este nome.');
      return;
    }

    const folder = this.interfacesSvc.createFolder(name, parentId || null);
    if (folder.parentId !== null) {
      this.expandPathTo(folder.parentId);
    }
    this.showCreateFolder.set(false);
  }

  /* ---------------- Envio ---------------- */

  async send(): Promise<void> {
    if (this.sending() || !this.selectedCall()) {
      return;
    }

    const draft = this.draft();
    const method = draft.method;
    const url = this.buildUrl(draft.url, draft.params);
    const headers = this.buildHeaders(draft.headers, method, draft.body);
    const hasBody = this.bodyEnabled() && draft.body.trim() !== '';

    this.sending.set(true);
    this.activeRequest = new AbortController();
    const startedAt = performance.now();

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? draft.body : undefined,
        signal: this.activeRequest.signal,
      });

      const text = await response.text();
      const durationMs = Math.max(1, Math.round(performance.now() - startedAt));

      this.setResponse({
        kind: 'response',
        status: response.status,
        durationMs,
        body: this.formatBody(text),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      this.setResponse({
        kind: 'error',
        message:
          'Não foi possível completar a requisição. Verifique a URL, a conexão e se o destino ' +
          `permite chamadas feitas pelo navegador (CORS). Detalhe: ${detail}`,
      });
    } finally {
      this.sending.set(false);
      this.activeRequest = null;
    }
  }

  statusTone(status: number): 'ok' | 'redirect' | 'error' {
    if (status >= 200 && status < 300) {
      return 'ok';
    }
    if (status >= 300 && status < 400) {
      return 'redirect';
    }
    return 'error';
  }

  /* ---------------- Auxiliares ---------------- */

  private setResponse(state: ResponseState): void {
    this.response.set(state);

    const call = this.selectedCall();
    if (call) {
      this.responses.set(call.id, state);
    }
  }

  private draftFor(call: InterfaceCall): CallDraft {
    return {
      name: call.name,
      method: call.method,
      url: call.url,
      params: call.params.map((param) => ({ ...param })),
      headers: call.headers.map((header) => ({ ...header })),
      body: call.body,
      curl: '',
    };
  }

  private buildUrl(url: string, params: KeyValue[]): string {
    const base = url.trim();
    const query = params
      .filter((param) => param.key.trim() !== '')
      .map(
        (param) =>
          `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value.trim())}`,
      )
      .join('&');

    if (query === '') {
      return base;
    }
    return base.includes('?') ? `${base}&${query}` : `${base}?${query}`;
  }

  private buildHeaders(
    headers: KeyValue[],
    method: HttpMethod,
    body: string,
  ): Record<string, string> {
    const map: Record<string, string> = {};

    for (const header of headers) {
      if (header.key.trim() !== '') {
        map[header.key.trim()] = header.value;
      }
    }

    const hasBody = !BodylessMethods.includes(method) && body.trim() !== '';
    const hasContentType = Object.keys(map).some((key) => key.toLowerCase() === 'content-type');

    if (hasBody && !hasContentType) {
      map['Content-Type'] = 'application/json';
    }

    return map;
  }

  private formatBody(text: string): string | null {
    if (text === '') {
      return null;
    }

    let formatted = text;
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      formatted = text;
    }

    if (formatted.length > MaxResponseLength) {
      return `${formatted.slice(0, MaxResponseLength)}\n… (resposta truncada)`;
    }
    return formatted;
  }

  private static patchItem(
    items: KeyValue[],
    index: number,
    field: 'key' | 'value',
    value: string,
  ): KeyValue[] {
    return items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
  }

  private static samePairs(a: KeyValue[], b: KeyValue[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i].key !== b[i].key || a[i].value !== b[i].value) {
        return false;
      }
    }
    return true;
  }
}

function emptyPair(): KeyValue {
  return { key: '', value: '' };
}
