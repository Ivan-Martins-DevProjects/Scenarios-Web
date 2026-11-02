import { Injectable, computed, signal } from '@angular/core';

import { FolderNode, HttpMethod, InterfaceCall, InterfaceFolder } from '../models/interface.models';

/**
 * Catálogo de requisições da consulta de interfaces. Os itens são estáticos no
 * frontend por enquanto — substitua as listas iniciais pelo contrato da API
 * quando o módulo ganhar backend.
 */
@Injectable({ providedIn: 'root' })
export class InterfacesService {
  private readonly _folders = signal<InterfaceFolder[]>([
    { id: 'folder-plataforma', name: 'Plataforma', parentId: null },
    { id: 'folder-externos', name: 'Serviços externos', parentId: null },
  ]);

  private readonly _calls = signal<InterfaceCall[]>([
    {
      id: 'plataforma-health',
      name: 'Health check',
      description: 'Status do servidor da plataforma (não exige autenticação).',
      method: 'GET',
      url: '/api/health',
      params: [],
      headers: [],
      body: '',
      folderId: 'folder-plataforma',
    },
    {
      id: 'plataforma-login',
      name: 'Login',
      description: 'Autentica um usuário e devolve o token JWT (Bearer).',
      method: 'POST',
      url: '/api/auth/login',
      params: [],
      headers: [],
      body: '{"email":"admin@scenarios.local","password":"senha"}',
      folderId: 'folder-plataforma',
    },
    {
      id: 'plataforma-sections',
      name: 'Listar setores',
      description: 'Cole o token devolvido pelo Login no header Authorization.',
      method: 'GET',
      url: '/api/sections/list-all',
      params: [
        { key: 'page', value: '1' },
        { key: 'page_size', value: '100' },
      ],
      headers: [{ key: 'Authorization', value: 'Bearer ' }],
      body: '',
      folderId: 'folder-plataforma',
    },
    {
      id: 'plataforma-folders',
      name: 'Listar pastas',
      description: 'Pastas da base de conhecimento — também exige o header Authorization.',
      method: 'GET',
      url: '/api/folders/list-all',
      params: [
        { key: 'page', value: '1' },
        { key: 'page_size', value: '10' },
        { key: 'order', value: 'name' },
      ],
      headers: [{ key: 'Authorization', value: 'Bearer ' }],
      body: '',
      folderId: 'folder-plataforma',
    },
    {
      id: 'externos-usuarios',
      name: 'Usuários de exemplo',
      description: 'Lista de usuários de uma API pública de testes (JSONPlaceholder).',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/users',
      params: [],
      headers: [],
      body: '',
      folderId: 'folder-externos',
    },
    {
      id: 'externos-criar-post',
      name: 'Criar post de exemplo',
      description: 'Envia um post de teste — a API responde com o recurso ecoado.',
      method: 'POST',
      url: 'https://jsonplaceholder.typicode.com/posts',
      params: [],
      headers: [],
      body: '{"title":"Teste da consulta","body":"Conteúdo enviado pelo console","userId":1}',
      folderId: 'folder-externos',
    },
    {
      id: 'externos-buscar-cep',
      name: 'Buscar CEP',
      description: 'Consulta um endereço pelo CEP (ViaCEP).',
      method: 'GET',
      url: 'https://viacep.com.br/ws/01001000/json/',
      params: [],
      headers: [],
      body: '',
      folderId: 'folder-externos',
    },
    {
      id: 'solta-consultar-post',
      name: 'Consultar post',
      description: 'Chamada de exemplo sem pasta — reorganize quando quiser.',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      params: [],
      headers: [],
      body: '',
      folderId: null,
    },
  ]);

  readonly folders = this._folders.asReadonly();
  readonly calls = this._calls.asReadonly();

  /** Árvore de pastas com as chamadas de cada nível — pastas podem aninhar sem limite. */
  readonly folderTree = computed<FolderNode[]>(() => {
    const calls = this._calls();

    const byParent = new Map<string | null, InterfaceFolder[]>();
    for (const folder of this._folders()) {
      const siblings = byParent.get(folder.parentId) ?? [];
      siblings.push(folder);
      byParent.set(folder.parentId, siblings);
    }

    const build = (parentId: string | null, visited: Set<string>): FolderNode[] => {
      const nodes: FolderNode[] = [];
      for (const folder of byParent.get(parentId) ?? []) {
        if (visited.has(folder.id)) {
          continue;
        }
        visited.add(folder.id);
        nodes.push({
          folder,
          calls: calls.filter((call) => call.folderId === folder.id),
          children: build(folder.id, visited),
        });
      }
      return nodes;
    };

    return build(null, new Set());
  });

  /** Pastas na ordem da árvore, com profundidade — usado nos seletores de pasta. */
  readonly folderOptions = computed<{ folder: InterfaceFolder; depth: number }[]>(() => {
    const options: { folder: InterfaceFolder; depth: number }[] = [];

    const walk = (nodes: FolderNode[], depth: number): void => {
      for (const node of nodes) {
        options.push({ folder: node.folder, depth });
        walk(node.children, depth + 1);
      }
    };

    walk(this.folderTree(), 0);
    return options;
  });

  /** Chamadas sem pasta associada — exibidas no grupo "Sem pasta". */
  readonly unfiledCalls = computed(() => this._calls().filter((call) => call.folderId === null));

  folderExists(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return this._folders().some((folder) => folder.name.trim().toLowerCase() === normalized);
  }

  createFolder(name: string, parentId: string | null = null): InterfaceFolder {
    const folder: InterfaceFolder = { id: crypto.randomUUID(), name: name.trim(), parentId };
    this._folders.update((folders) => [...folders, folder]);
    return folder;
  }

  /** Move uma chamada para outra pasta e devolve a chamada atualizada. */
  updateCallFolder(callId: string, folderId: string | null): InterfaceCall | null {
    this._calls.update((calls) =>
      calls.map((call) => (call.id === callId ? { ...call, folderId } : call)),
    );

    return this._calls().find((call) => call.id === callId) ?? null;
  }

  createCall(input: {
    name: string;
    description: string;
    method: HttpMethod;
    url: string;
    folderId: string | null;
  }): InterfaceCall {
    const call: InterfaceCall = {
      id: crypto.randomUUID(),
      ...input,
      params: [],
      headers: [],
      body: '',
    };

    this._calls.update((calls) => [...calls, call]);
    return call;
  }

  /** Persiste as alterações da chamada (nome, método, URL, parâmetros, headers, body). */
  updateCall(
    callId: string,
    changes: Partial<
      Pick<InterfaceCall, 'name' | 'description' | 'method' | 'url' | 'params' | 'headers' | 'body'>
    >,
  ): InterfaceCall | null {
    this._calls.update((calls) =>
      calls.map((call) => (call.id === callId ? { ...call, ...changes } : call)),
    );

    return this._calls().find((call) => call.id === callId) ?? null;
  }
}
