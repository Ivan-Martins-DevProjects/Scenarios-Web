import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth.models';
import { PaginatedResponse, Paging } from '../models/folder.models';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role_id: string;
  sections: string[];
}

export interface UpdateUserInput {
  user_id: string;
  name: string;
  email?: string;
  password?: string;
  role_id: string;
  sections: string[];
}

/** Administração de usuários: listagem e definição de role e setores. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  private static readonly PageSize = 10;

  private readonly _users = signal<AuthUser[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');
  private readonly _paging = signal<Paging | null>(null);
  private readonly _currentPage = signal(1);

  readonly users = this._users.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();

  /** Carrega uma página de usuários (10 itens por página). */
  loadUsers(page?: number): void {
    const targetPage = page ?? this._currentPage();

    this._currentPage.set(targetPage);
    this._loading.set(true);
    this._error.set('');

    this.http
      .get<PaginatedResponse<AuthUser>>(`${environment.apiUrl}/users/list-all`, {
        params: { page: targetPage, page_size: UserService.PageSize },
      })
      .subscribe({
        next: (response) => {
          this._users.set(response.data ?? []);
          this._paging.set(response.paging ?? null);
          this._loading.set(false);
        },
        error: () => {
          this._error.set(
            'Não foi possível carregar os usuários. Verifique se o servidor está ativo e tente novamente.',
          );
          this._loading.set(false);
        },
      });
  }

  /** Define a role e os setores de um usuário via POST /api/users/update. */
  updateUser(input: UpdateUserInput) {
    return this.http.post<AuthUser>(`${environment.apiUrl}/users/update`, input);
  }

  /** Cria um novo usuário via POST /api/users/create. */
  createUser(input: CreateUserInput) {
    return this.http.post<AuthUser>(`${environment.apiUrl}/users/create`, input);
  }

  /** Exclui um usuário via POST /api/users/delete. */
  deleteUser(userId: string) {
    return this.http.post(`${environment.apiUrl}/users/delete`, {
      user_id: userId,
    });
  }
}
