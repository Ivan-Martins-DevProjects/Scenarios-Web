import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ToolsService } from '../../core/services/tools.service';
import { Tool } from '../../core/models/tool.models';

/**
 * Hub de ferramentas: cada ferramenta disponível é exibida em um card,
 * agrupado por setor — como as pastas da base de conhecimento.
 */
@Component({
  selector: 'app-tools',
  imports: [],
  templateUrl: './tools.html',
  styleUrl: './tools.scss',
})
export class Tools {
  readonly toolsSvc = inject(ToolsService);
  constructor(private router: Router) { }

  onClick(item: Tool) {
    if (item.url == null && item.link != null) {
      window.location.href = item.link
    }

    if (item.url != null && item.link == null) {
      this.router.navigate([item.url])
    }
  }
}
