type Token = {
  type: string;
  value: string;
};

export const tokenizeCss = (value = ''): Token[] => {
  const tokens: Token[] = [];
  if (!value) return tokens;

  const length = value.length;
  let i = 0;
  const push = (type: string, chunk: string) => {
    if (!chunk) return;
    tokens.push({ type, value: chunk });
  };
  const isWhitespace = (char: string) => /\s/.test(char);
  const isWordStart = (char: string) => /[a-zA-Z_-]/.test(char);
  const isWord = (char: string) => /[a-zA-Z0-9_-]/.test(char);

  while (i < length) {
    const char = value[i];

    if (isWhitespace(char)) {
      let j = i + 1;
      while (j < length && isWhitespace(value[j])) j += 1;
      push('ws', value.slice(i, j));
      i = j;
      continue;
    }

    if (char === '/' && value[i + 1] === '*') {
      let j = i + 2;
      while (j < length && !(value[j - 1] === '*' && value[j] === '/')) j += 1;
      push('comment', value.slice(i, Math.min(j + 1, length)));
      i = Math.min(j + 1, length);
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let j = i + 1;
      while (j < length) {
        if (value[j] === '\\') {
          j += 2;
          continue;
        }
        if (value[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      push('string', value.slice(i, j));
      i = j;
      continue;
    }

    if (char === '@') {
      let j = i + 1;
      while (j < length && isWord(value[j])) j += 1;
      push('atrule', value.slice(i, j));
      i = j;
      continue;
    }

    if (char === '#') {
      let j = i + 1;
      while (j < length && /[0-9a-fA-F]/.test(value[j])) j += 1;
      if (j > i + 1) {
        push('number', value.slice(i, j));
        i = j;
        continue;
      }
    }

    if (/\d/.test(char)) {
      let j = i + 1;
      while (j < length && /[\d.]/.test(value[j])) j += 1;
      while (j < length && /[a-zA-Z%]/.test(value[j])) j += 1;
      push('number', value.slice(i, j));
      i = j;
      continue;
    }

    if (isWordStart(char)) {
      let j = i + 1;
      while (j < length && isWord(value[j])) j += 1;
      push('ident', value.slice(i, j));
      i = j;
      continue;
    }

    push('punct', char);
    i += 1;
  }

  let inBlock = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'punct' && token.value === '{') {
      inBlock = true;
      continue;
    }
    if (token.type === 'punct' && token.value === '}') {
      inBlock = false;
      continue;
    }
    if (!inBlock && token.type === 'ident') {
      token.type = 'selector';
      continue;
    }
    if (inBlock && token.type === 'ident') {
      let j = index + 1;
      while (j < tokens.length && tokens[j].type === 'ws') j += 1;
      if (tokens[j]?.type === 'punct' && tokens[j]?.value === ':') {
        token.type = 'property';
      }
    }
  }

  return tokens;
};

const tokenizeHtmlTag = (value: string, tokens: Token[]) => {
  if (!value) return;
  const length = value.length;
  let i = 0;
  const push = (type: string, chunk: string) => {
    if (!chunk) return;
    tokens.push({ type, value: chunk });
  };
  const isWhitespace = (char: string) => /\s/.test(char);

  if (value[i] === '<') {
    push('punct', '<');
    i += 1;
  }

  if (value[i] === '/' || value[i] === '!' || value[i] === '?') {
    push('punct', value[i]);
    i += 1;
  }

  let start = i;
  while (i < length && /[A-Za-z0-9:-]/.test(value[i])) i += 1;
  push('tag', value.slice(start, i));

  while (i < length) {
    const char = value[i];
    if (char === '>') {
      push('punct', '>');
      i += 1;
      break;
    }
    if (char === '/' && value[i + 1] === '>') {
      push('punct', '/>');
      i += 2;
      break;
    }
    if (isWhitespace(char)) {
      let j = i + 1;
      while (j < length && isWhitespace(value[j])) j += 1;
      push('ws', value.slice(i, j));
      i = j;
      continue;
    }
    if (char === '=') {
      push('punct', '=');
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      let j = i + 1;
      while (j < length) {
        if (value[j] === '\\') {
          j += 2;
          continue;
        }
        if (value[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      push('string', value.slice(i, j));
      i = j;
      continue;
    }
    let j = i + 1;
    while (j < length && !isWhitespace(value[j]) && value[j] !== '=' && value[j] !== '>') {
      if (value[j] === '/' && value[j + 1] === '>') break;
      j += 1;
    }
    push('attr', value.slice(i, j));
    i = j;
  }
};

export const tokenizeHtml = (value = ''): Token[] => {
  const tokens: Token[] = [];
  if (!value) return tokens;

  const length = value.length;
  let i = 0;
  const push = (type: string, chunk: string) => {
    if (!chunk) return;
    tokens.push({ type, value: chunk });
  };
  const isWhitespace = (char: string) => /\s/.test(char);

  while (i < length) {
    const char = value[i];

    if (char === '<') {
      if (value.startsWith('<!--', i)) {
        let j = i + 4;
        while (j < length && !value.startsWith('-->', j)) j += 1;
        const end = value.startsWith('-->', j) ? j + 3 : length;
        push('comment', value.slice(i, end));
        i = end;
        continue;
      }
      let j = i + 1;
      let inQuote: string | null = null;
      while (j < length) {
        const next = value[j];
        if (inQuote) {
          if (next === '\\') {
            j += 2;
            continue;
          }
          if (next === inQuote) {
            inQuote = null;
            j += 1;
            continue;
          }
          j += 1;
          continue;
        }
        if (next === '"' || next === "'") {
          inQuote = next;
          j += 1;
          continue;
        }
        if (next === '>') {
          j += 1;
          break;
        }
        j += 1;
      }
      tokenizeHtmlTag(value.slice(i, j), tokens);
      i = j;
      continue;
    }

    if (char === '&') {
      let j = i + 1;
      while (j < length && /[a-zA-Z0-9#]/.test(value[j])) j += 1;
      if (value[j] === ';') {
        j += 1;
        push('entity', value.slice(i, j));
        i = j;
        continue;
      }
    }

    if (isWhitespace(char)) {
      let j = i + 1;
      while (j < length && isWhitespace(value[j])) j += 1;
      push('ws', value.slice(i, j));
      i = j;
      continue;
    }

    let j = i + 1;
    while (j < length && !/[<&\s]/.test(value[j])) j += 1;
    push('text', value.slice(i, j));
    i = j;
  }

  return tokens;
};
