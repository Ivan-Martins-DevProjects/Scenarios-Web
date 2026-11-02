/** Highlight de sintaxe para JSON e XML nos corpos de requisição e resposta. */
export function highlightCode(text: string): string {
  const language = detectLanguage(text);
  if (language === 'json') {
    return highlightJson(text);
  }
  if (language === 'xml') {
    return highlightXml(text);
  }
  return escapeHtml(text);
}

const MaxHighlightLength = 50000;

function detectLanguage(text: string): 'json' | 'xml' | 'text' {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  if (trimmed.startsWith('<')) {
    return 'xml';
  }
  return 'text';
}

function span(className: string, content: string): string {
  return `<span class="${className}">${escapeHtml(content)}</span>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightJson(text: string): string {
  if (text.length > MaxHighlightLength) {
    return escapeHtml(text);
  }

  const pattern =
    /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])/g;

  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      result += escapeHtml(text.slice(cursor, match.index));
    }

    if (match[1] !== undefined) {
      if (match[2] !== undefined) {
        result += span('tok-key', match[1]) + escapeHtml(match[2]);
      } else {
        result += span('tok-string', match[1]);
      }
    } else if (match[3] !== undefined) {
      result += span('tok-literal', match[3]);
    } else if (match[4] !== undefined) {
      result += span('tok-number', match[4]);
    } else if (match[5] !== undefined) {
      result += span('tok-punct', match[5]);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    result += escapeHtml(text.slice(cursor));
  }
  return result;
}

function highlightXml(text: string): string {
  if (text.length > MaxHighlightLength) {
    return escapeHtml(text);
  }

  const pattern =
    /(<!--[\s\S]*?-->)|(<!\[CDATA\[[\s\S]*?\]\]>)|(<\?[\s\S]*?\?>)|(<![^>]*>)|(<\/?)([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)(\s*\/?>)/g;

  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      result += escapeHtml(text.slice(cursor, match.index));
    }

    if (match[1] !== undefined) {
      result += span('tok-comment', match[1]);
    } else if (match[2] !== undefined) {
      result += span('tok-string', match[2]);
    } else if (match[3] !== undefined || match[4] !== undefined) {
      result += span('tok-meta', match[0]);
    } else {
      result +=
        span('tok-punct', match[5]) +
        span('tok-tag', match[6]) +
        highlightXmlAttrs(match[7]) +
        span('tok-punct', match[8]);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    result += escapeHtml(text.slice(cursor));
  }
  return result;
}

function highlightXmlAttrs(chunk: string): string {
  const pattern = /(\s+)([A-Za-z_][\w.:-]*)(\s*=\s*)("[^"]*"|'[^']*')|(\s+)([A-Za-z_][\w.:-]*)/g;

  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(chunk)) !== null) {
    if (match.index > cursor) {
      result += escapeHtml(chunk.slice(cursor, match.index));
    }

    if (match[2] !== undefined) {
      result +=
        escapeHtml(match[1]) +
        span('tok-attr', match[2]) +
        escapeHtml(match[3]) +
        span('tok-string', match[4]);
    } else {
      result += escapeHtml(match[5]) + span('tok-attr', match[6]);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < chunk.length) {
    result += escapeHtml(chunk.slice(cursor));
  }
  return result;
}
