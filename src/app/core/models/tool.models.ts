export type ToolIcon =
  'clock' | 'search' | 'checklist' | 'percent' | 'book' | 'chart' | 'server' | 'link' | 'terminal';

export interface Tool {
  id: string;
  name: string;
  description: string;
  url: string | null;
  link: string | null;
  sector: string | null;
  icon: ToolIcon;
}

export interface ToolGroup {
  sector: string;
  tools: Tool[];
}
