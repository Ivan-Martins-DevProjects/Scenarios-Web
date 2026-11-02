import { HttpMethod, KeyValue } from '../models/interface.models';

/** Requisição normalizada extraída de um comando curl. */
export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
}

const HttpMethods: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

const HeaderFlags: readonly string[] = ['H', 'header'];
const DataFlags: readonly string[] = [
  'd',
  'data',
  'data-ascii',
  'data-binary',
  'data-raw',
  'data-urlencode',
];
const MethodFlags: readonly string[] = ['X', 'request'];

/** Flags válidas do curl que recebem um valor mas não geram campo na requisição. */
const IgnoredValueFlags: readonly string[] = [
  'A',
  'user-agent',
  'b',
  'cookie',
  'c',
  'cookie-jar',
  'e',
  'referer',
  'F',
  'form',
  'K',
  'config',
  'm',
  'max-time',
  'o',
  'output',
  'u',
  'user',
  'w',
  'write-out',
  'x',
  'proxy',
];

/** Tokens que encerram o comando quando aparecem fora de aspas. */
const ChainBreakers: readonly string[] = ['&&', '||', ';', '|'];

/**
 * Interpreta um comando curl colado pelo usuário e distribui o conteúdo nos
 * campos da requisição: método, URL, parâmetros de query, headers e body.
 * Retorna null quando o comando não pode ser interpretado.
 */
export function parseCurl(input: string): ParsedCurl | null {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    return null;
  }

  let index = 0;
  if (tokens[0] === '$') {
    index += 1;
  }

  const command = (tokens[index] ?? '').toLowerCase();
  if (command !== 'curl' && command !== 'curl.exe') {
    return null;
  }
  index += 1;

  let method: string | null = null;
  let url: string | null = null;
  let dataAsParams = false;
  let sawData = false;
  let onlyPositional = false;
  const headers: KeyValue[] = [];
  const dataParts: string[] = [];
  const inlineParams: KeyValue[] = [];

  while (index < tokens.length) {
    const token = tokens[index];

    if (ChainBreakers.includes(token)) {
      break;
    }

    if (token === '$' || token === '-') {
      index += 1;
      continue;
    }

    const isFlag = token.startsWith('--') || /^-[a-zA-Z0-9#]/.test(token);
    if (isFlag && !onlyPositional) {
      if (token === '--') {
        onlyPositional = true;
        index += 1;
        continue;
      }

      const { flag, inline } = splitFlag(token);

      if (flag === 'G' || flag === 'get') {
        dataAsParams = true;
        index += 1;
        continue;
      }

      const takesValue =
        HeaderFlags.includes(flag) ||
        DataFlags.includes(flag) ||
        MethodFlags.includes(flag) ||
        IgnoredValueFlags.includes(flag) ||
        flag === 'json';

      let value = inline;
      if (value === null && takesValue) {
        index += 1;
        value = tokens[index] ?? null;
      }
      index += 1;

      if (value === null) {
        continue;
      }

      if (MethodFlags.includes(flag)) {
        method = value;
        continue;
      }

      if (HeaderFlags.includes(flag)) {
        pushHeader(headers, value);
        continue;
      }

      if (DataFlags.includes(flag)) {
        sawData = true;
        if (!value.startsWith('@')) {
          dataParts.push(value);
        }
        continue;
      }

      if (flag === 'json') {
        sawData = true;
        if (!value.startsWith('@')) {
          dataParts.push(value);
        }
        pushHeader(headers, 'Content-Type: application/json');
        pushHeader(headers, 'Accept: application/json');
        continue;
      }

      continue;
    }

    if (url === null && token !== '') {
      url = token;
    }
    index += 1;
  }

  if (url === null || url === '') {
    return null;
  }

  if (dataAsParams) {
    for (const part of dataParts) {
      pushParam(inlineParams, part);
    }
  }

  const { base, params } = splitUrl(url);

  return {
    method: resolveMethod(method, sawData && !dataAsParams),
    url: base,
    params: [...params, ...inlineParams],
    headers,
    body: dataAsParams ? '' : dataParts.join('&'),
  };
}

/** Quebra o comando em tokens respeitando aspas simples, duplas e "\<enter>" de continuação. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let hasToken = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === '\\' && i + 1 < input.length) {
      const next = input[i + 1];
      if (next === '\n' || next === '\r') {
        i += 2;
        continue;
      }
      current += next;
      hasToken = true;
      i += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      i += 1;
      while (i < input.length && input[i] !== quote) {
        if (quote === '"' && input[i] === '\\' && i + 1 < input.length) {
          const next = input[i + 1];
          if (next === '"' || next === '\\') {
            current += next;
            i += 2;
            continue;
          }
        }
        current += input[i];
        hasToken = true;
        i += 1;
      }
      i += 1;
      continue;
    }

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
      i += 1;
      continue;
    }

    current += char;
    hasToken = true;
    i += 1;
  }

  if (hasToken) {
    tokens.push(current);
  }
  return tokens;
}

/** Separa uma flag curta ou longa, incluindo valores grudados (-XPOST) ou após "=" (--header="A: b"). */
function splitFlag(token: string): { flag: string; inline: string | null } {
  if (token.startsWith('--')) {
    const body = token.slice(2);
    const eq = body.indexOf('=');
    if (eq >= 0) {
      return { flag: body.slice(0, eq), inline: body.slice(eq + 1) };
    }
    return { flag: body, inline: null };
  }

  const short = /^-([a-zA-Z0-9#])(.*)$/.exec(token);
  if (short) {
    return { flag: short[1], inline: short[2] === '' ? null : short[2] };
  }
  return { flag: token.slice(1), inline: null };
}

/** Adiciona um header no formato "Nome: Valor" (ignora entradas sem dois-pontos). */
function pushHeader(headers: KeyValue[], raw: string): void {
  const colon = raw.indexOf(':');
  if (colon === -1) {
    return;
  }

  const key = raw.slice(0, colon).trim();
  const value = raw.slice(colon + 1).trim();
  if (key === '') {
    return;
  }
  headers.push({ key, value });
}

/** Converte um par "chave=valor" (ou "chave" isolada) em parâmetro de query. */
function pushParam(params: KeyValue[], raw: string): void {
  const eq = raw.indexOf('=');
  if (eq === -1) {
    params.push({ key: decodeSafe(raw), value: '' });
    return;
  }
  params.push({ key: decodeSafe(raw.slice(0, eq)), value: decodeSafe(raw.slice(eq + 1)) });
}

/** Separa a query string da URL e decodifica os pares. */
function splitUrl(url: string): { base: string; params: KeyValue[] } {
  const withoutHash = url.split('#')[0];
  const question = withoutHash.indexOf('?');
  if (question === -1) {
    return { base: withoutHash, params: [] };
  }

  const base = withoutHash.slice(0, question);
  const query = withoutHash.slice(question + 1);
  const params: KeyValue[] = [];

  for (const pair of query.split('&')) {
    if (pair === '') {
      continue;
    }
    pushParam(params, pair);
  }

  return { base, params };
}

/** Decodifica um trecho de query string ("+" vira espaço; falhas de decode mantêm o original). */
function decodeSafe(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    return part;
  }
}

/** Mantém o método informado quando suportado; caso contrário, deduz a partir dos dados. */
function resolveMethod(method: string | null, impliedPost: boolean): HttpMethod {
  if (method !== null) {
    const normalized = method.trim().toUpperCase();
    if (HttpMethods.includes(normalized as HttpMethod)) {
      return normalized as HttpMethod;
    }
  }
  return impliedPost ? 'POST' : 'GET';
}
