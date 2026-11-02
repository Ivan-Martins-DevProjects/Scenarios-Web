import { Routes } from '@angular/router';

import { authGuard, adminGuard, guestGuard } from './core/guards/auth.guard';
import { Login } from './features/login/login';
import { Layout } from './layout/layout';
import { Dashboard } from './features/dashboard/dashboard';
import { KnowledgeBase } from './features/knowledge-base/knowledge-base';
import { Folder } from './features/knowledge-base/folder/folder';
import { NoteDetail } from './features/knowledge-base/note-detail/note-detail';
import { Interfaces } from './features/interfaces/interfaces';
import { Users } from './features/users/users';
import { Sections } from './features/sections/sections';
import { Tools } from './features/tools/tools';

export const routes: Routes = [
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: Dashboard },
      { path: 'kb', component: KnowledgeBase },
      { path: 'kb/folder/:folderId', component: Folder },
      { path: 'kb/note/:noteId', component: NoteDetail },
      { path: 'interfaces', component: Interfaces },
      { path: 'ferramentas', component: Tools },
      {
        path: 'users',
        component: Users,
        canActivate: [adminGuard],
      },
      {
        path: 'sections',
        component: Sections,
        canActivate: [adminGuard],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
