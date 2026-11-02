export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValue {
  key: string;
  value: string;
}

export interface InterfaceFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface FolderNode {
  folder: InterfaceFolder;
  calls: InterfaceCall[];
  children: FolderNode[];
}

export interface InterfaceCall {
  id: string;
  name: string;
  description: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  folderId: string | null;
}

export interface CallFolder {
  folder: InterfaceFolder | null;
  calls: InterfaceCall[];
}
