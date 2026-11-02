import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/models/auth.models';

interface Tool {
  name: string;
  description: string;
  icon: 'book' | 'tool';
  link: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly auth = inject(AuthService);

  readonly profile = signal<AuthUser | null>(this.auth.user());
  readonly loadingProfile = signal(true);

  protected readonly initials = computed(
    () => this.profile()?.name?.trim().charAt(0).toUpperCase() ?? '',
  );
  protected readonly firstName = computed(() => this.profile()?.name?.trim().split(' ')[0] ?? '');

  readonly tools: Tool[] = [
    {
      name: 'Base de conhecimento',
      description: 'Notas, referências e discussões documentadas pela equipe.',
      icon: 'book',
      link: '/kb',
    },
    {
      name: 'Ferramentas',
      description: 'Utilitários e atalhos usados no dia a dia.',
      icon: 'tool',
      link: '/ferramentas',
    },
  ];

  constructor() {
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.profile.set(user);
        this.loadingProfile.set(false);
      },
      error: () => this.loadingProfile.set(false),
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
