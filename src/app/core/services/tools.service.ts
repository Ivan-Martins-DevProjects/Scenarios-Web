import { Injectable } from '@angular/core';

import { Tool, ToolGroup } from '../models/tool.models';

/**
 * Catálogo de ferramentas da plataforma. Os itens são estáticos no
 * frontend por enquanto — substitua esta lista pelo contrato da API
 * quando o módulo ganhar backend.
 */
@Injectable({ providedIn: 'root' })
export class ToolsService {
  private static readonly GeneralSector = 'Geral';

  readonly tools: Tool[] = [
    {
      id: 'painel-sla',
      name: 'Painel de SLA',
      description: 'Acompanhe em tempo real os prazos e a situação dos chamados abertos.',
      url: null,
      link: 'https://sla-sn.ivandev.cloud',
      sector: 'Suporte',
      icon: 'clock',
    },
    {
      id: 'consulta-interface',
      name: 'Consulta de Interfaces',
      description: 'Busque dados e infomações consultando as interfaces disponíveis de cada cliente',
      url: '/interfaces',
      link: null,
      sector: 'Suporte',
      icon: 'search',
    },
    {
      id: 'triagem-chamados',
      name: 'Triagem de Chamados',
      description: 'Checklist guiado para classificar, priorizar e escalar novos atendimentos.',
      url: 'https://triagem.exemplo.com.br',
      link: null,
      sector: 'Suporte',
      icon: 'checklist',
    },
    {
      id: 'calculadora-planos',
      name: 'Calculadora de Planos',
      description:
        'Simule propostas, descontos e prazos de contratação antes de enviar ao cliente.',
      url: 'https://simulador.exemplo.com.br',
      link: null,
      sector: 'Comercial',
      icon: 'percent',
    },
    {
      id: 'biblioteca-propostas',
      name: 'Biblioteca de Propostas',
      description: 'Modelos e minutas prontos para personalizar e enviar durante a negociação.',
      url: 'https://propostas.exemplo.com.br',
      link: null,
      sector: 'Comercial',
      icon: 'book',
    },
    {
      id: 'indicadores-atendimento',
      name: 'Indicadores de Atendimento',
      description: 'Relatórios consolidados de volume, tempo de resposta e satisfação do cliente.',
      url: 'https://indicadores.exemplo.com.br',
      link: null,
      sector: 'Gestão',
      icon: 'chart',
    },
    {
      id: 'painel-infraestrutura',
      name: 'Painel de Infraestrutura',
      description: 'Status dos ambientes, histórico de deploys e alertas de monitoramento.',
      url: 'https://devops.exemplo.com.br',
      link: null,
      sector: 'Gestão',
      icon: 'server',
    },
    {
      id: 'central-links',
      name: 'Central de Links',
      description: 'Atalhos e serviços externos usados no dia a dia, em um só lugar.',
      url: 'https://links.exemplo.com.br',
      link: null,
      sector: null,
      icon: 'link',
    },
    {
      id: 'consulta-interfaces',
      name: 'Consulta de Interfaces',
      description: 'Console estilo Postman: monte requisições, envie e veja a resposta na hora.',
      url: null,
      link: '/interfaces',
      sector: null,
      icon: 'terminal',
    },
  ];

  /** Ferramentas agrupadas por setor, na ordem de primeira aparição do catálogo. */
  readonly groups: ToolGroup[] = ToolsService.buildGroups(this.tools);

  private static buildGroups(tools: Tool[]): ToolGroup[] {
    const sectorGroups: ToolGroup[] = [];
    let general: ToolGroup | null = null;

    for (const tool of tools) {
      const sector = tool.sector ?? ToolsService.GeneralSector;

      if (sector === ToolsService.GeneralSector) {
        general ??= { sector, tools: [] };
        general.tools.push(tool);
        continue;
      }

      let group = sectorGroups.find((candidate) => candidate.sector === sector);
      if (!group) {
        group = { sector, tools: [] };
        sectorGroups.push(group);
      }
      group.tools.push(tool);
    }

    return general ? [...sectorGroups, general] : sectorGroups;
  }
}
