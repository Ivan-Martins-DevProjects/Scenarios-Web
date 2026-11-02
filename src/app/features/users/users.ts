import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthUser } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { KnowledgeBaseService } from '../../core/services/knowledge-base.service';
import { UpdateUserInput, UserService } from '../../core/services/user.service';
import { Modal } from '../../shared/modal/modal';
import { Pager } from '../../shared/pager/pager';

/**
 * Administração de usuários (apenas administradores): visualiza, cria,
 * edita e exclui usuários, definindo a role (ações) e os setores (acesso).
 */
@Component({
  selector: 'app-users',
  imports: [DatePipe, ReactiveFormsModule, Modal, Pager],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  readonly auth = inject(AuthService);
  readonly kb = inject(KnowledgeBaseService);
  readonly userSvc = inject(UserService);

  private readonly fb = inject(NonNullableFormBuilder);

  readonly totalPages = computed(() => this.userSvc.paging()?.total_pages ?? 0);
  readonly totalUsers = computed(() => this.userSvc.paging()?.total_items ?? 0);

  constructor() {
    this.kb.loadRoles();
    this.kb.loadSections();
  }

  ngOnInit(): void {
    this.userSvc.loadUsers(1);
  }

  goToPage(page: number): void {
    if (this.userSvc.loading()) {
      return;
    }
    this.userSvc.loadUsers(page);
  }

  /* ---------------- Criação ---------------- */

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly createSections = signal<string[]>([]);

  readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role_id: ['', Validators.required],
  });

  openCreate(): void {
    this.createForm.reset({ name: '', email: '', password: '', role_id: '' });
    this.createSections.set([]);
    this.showCreate.set(true);
  }

  toggleCreateSection(sectionId: string): void {
    this.createSections.update((sections) =>
      sections.includes(sectionId)
        ? sections.filter((id) => id !== sectionId)
        : [...sections, sectionId],
    );
  }

  create(): void {
    if (this.createForm.invalid || this.creating()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    this.userSvc
      .createUser({
        ...this.createForm.getRawValue(),
        sections: this.createSections(),
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.showCreate.set(false);
          this.userSvc.loadUsers();
        },
        error: () => {
          this.creating.set(false);
          this.createForm.controls.email.setErrors({ conflict: true });
        },
      });
  }

  /* ---------------- Edição ---------------- */

  readonly editing = signal<AuthUser | null>(null);
  readonly saving = signal(false);
  readonly editName = signal('');
  readonly editEmail = signal('');
  readonly editPassword = signal('');
  readonly editRoleId = signal('');
  readonly editSections = signal<string[]>([]);
  readonly editError = signal('');

  openEdit(user: AuthUser): void {
    this.editing.set(user);
    this.editName.set(user.name);
    this.editEmail.set(user.email);
    this.editPassword.set('');
    this.editRoleId.set(user.role_id);
    this.editSections.set([...user.sections]);
    this.editError.set('');
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  toggleEditSection(sectionId: string): void {
    this.editSections.update((sections) =>
      sections.includes(sectionId)
        ? sections.filter((id) => id !== sectionId)
        : [...sections, sectionId],
    );
  }

  saveUser(): void {
    const user = this.editing();
    if (!user || this.saving()) {
      return;
    }
    if (!this.editName().trim()) {
      this.editError.set('Informe o nome do usuário.');
      return;
    }
    if (!this.editEmail().trim()) {
      this.editError.set('Informe o e-mail do usuário.');
      return;
    }
    if (!this.editRoleId()) {
      this.editError.set('Selecione uma role para o usuário.');
      return;
    }

    const input: UpdateUserInput = {
      user_id: user.id,
      name: this.editName().trim(),
      email: this.editEmail().trim(),
      role_id: this.editRoleId(),
      sections: this.editSections(),
    };
    const newPassword = this.editPassword();
    if (newPassword) {
      input.password = newPassword;
    }

    this.saving.set(true);
    this.userSvc.updateUser(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEdit();
        this.userSvc.loadUsers();
      },
      error: (err: { error?: { error?: string; message?: string } }) => {
        this.saving.set(false);
        const apiError = err.error?.error;
        if (apiError === 'CONFLICT') {
          this.editError.set('Este e-mail já está cadastrado para outro usuário.');
        } else if (apiError === 'BAD_REQUEST') {
          this.editError.set('Verifique os dados informados (e-mail válido e senha com no mínimo 6 caracteres).');
        } else {
          this.editError.set('Não foi possível salvar as alterações agora. Tente novamente.');
        }
      },
    });
  }

  /* ---------------- Exclusão ---------------- */

  readonly confirmTarget = signal<AuthUser | null>(null);
  readonly deleting = signal(false);

  askDelete(user: AuthUser): void {
    this.confirmTarget.set(user);
  }

  deleteUser(): void {
    const user = this.confirmTarget();
    if (!user || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.userSvc.deleteUser(user.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
        this.userSvc.loadUsers();
      },
      error: () => {
        this.deleting.set(false);
        this.confirmTarget.set(null);
      },
    });
  }
}
