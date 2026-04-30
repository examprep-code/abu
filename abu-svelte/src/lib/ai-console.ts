type AiPayload = Record<string, unknown>;
type AiResponse = Record<string, unknown>;

const shouldLogAiPayload = (payload: AiPayload): boolean =>
  !payload.save_only && !payload.saveOnly;

const PROMPT_KEY_PATTERN =
  /(?:prompt|instruction|criteria|premise|reference|lueckentext|musterloesung|source|title|answer_text|value)/i;

const logTitle = (prefix: string, payload: AiPayload, status?: number): string => {
  const sheet = typeof payload.sheet === 'string' && payload.sheet ? payload.sheet : 'ohne-sheet';
  const key = typeof payload.key === 'string' && payload.key ? payload.key : 'ohne-key';
  const suffix = typeof status === 'number' ? ` (${status})` : '';
  return `[ABU KI] ${prefix}: ${sheet}/${key}${suffix}`;
};

const formatPlainValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const promptSourceKeys = (payload: AiPayload): string[] =>
  Object.keys(payload).filter((key) => PROMPT_KEY_PATTERN.test(key));

const buildRequestPlaintext = (endpoint: string, payload: AiPayload): string => {
  const lines = ['KI-Anfrage ans Backend', `Endpoint: ${endpoint}`];
  ['sheet', 'key', 'user', 'classroom', 'exercise_type'].forEach((field) => {
    const value = payload[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      lines.push(`${field}: ${formatPlainValue(value)}`);
    }
  });
  lines.push('');
  lines.push('--- Payload ---');
  Object.entries(payload).forEach(([key, value]) => {
    lines.push(`${key}: ${formatPlainValue(value)}`);
  });
  return lines.join('\n').trim();
};

const buildRequestWithPromptKeysPlaintext = (endpoint: string, payload: AiPayload): string => {
  const lines = [buildRequestPlaintext(endpoint, payload), '', '=== Prompt-/Kontext-Keys ==='];
  const keys = promptSourceKeys(payload);
  if (!keys.length) {
    lines.push('Keine Prompt-/Kontext-Keys im Frontend-Payload gefunden.');
  } else {
    keys.forEach((key) => {
      lines.push(`- ${key}`);
    });
  }
  return lines.join('\n').trim();
};

const chatgptFromResponse = (response: AiResponse): unknown => {
  if (
    response &&
    typeof response === 'object' &&
    response.data &&
    typeof response.data === 'object' &&
    'chatgpt' in response.data
  ) {
    return response.data.chatgpt;
  }
  return undefined;
};

const buildResponsePlaintext = (endpoint: string, status: number, response: AiResponse): string => {
  const chatgpt = chatgptFromResponse(response);
  const lines = ['KI-Antwort vom Backend', `Endpoint: ${endpoint}`, `HTTP-Status: ${status}`];
  if (chatgpt && typeof chatgpt === 'object') {
    const result = chatgpt as Record<string, unknown>;
    if (result.model) lines.push(`model: ${formatPlainValue(result.model)}`);
    if (result.classification_label || result.classification !== undefined) {
      const label = formatPlainValue(result.classification_label).trim();
      const score = formatPlainValue(result.classification).trim();
      lines.push(`classification: ${label || '[leer]'}${score ? ` (${score})` : ''}`);
    }
    if (result.error) {
      lines.push('', '--- Fehler ---', formatPlainValue(result.error));
    }
    const answerText = result.raw || result.explanation;
    if (answerText) {
      lines.push('', '--- Antworttext ---', formatPlainValue(answerText));
    } else {
      lines.push('', '--- KI-Antwort ---', formatPlainValue(chatgpt));
    }
  } else {
    lines.push('', '--- Backend-Response ---', formatPlainValue(response));
  }
  return lines.join('\n').trim();
};

export function logAiRequest(endpoint: string, payload: AiPayload): void {
  if (!shouldLogAiPayload(payload)) return;
  console.groupCollapsed(logTitle('Anfrage', payload));
  console.log('Endpoint', endpoint);
  console.log('Anfrage Plaintext\n' + buildRequestPlaintext(endpoint, payload));
  console.log(
    'Anfrage + Prompt-Keys Plaintext\n' + buildRequestWithPromptKeysPlaintext(endpoint, payload)
  );
  console.log('Payload an Backend', payload);
  console.groupEnd();
}

export function logAiResponse(
  endpoint: string,
  payload: AiPayload,
  status: number,
  response: AiResponse
): void {
  if (!shouldLogAiPayload(payload)) return;
  const chatgpt = chatgptFromResponse(response);

  console.groupCollapsed(logTitle('Antwort', payload, status));
  console.log('Endpoint', endpoint);
  console.log('Antwort Plaintext\n' + buildResponsePlaintext(endpoint, status, response));
  console.log('KI-Antwort', chatgpt ?? response);
  console.log('Backend-Response', response);
  console.groupEnd();
}

export function logAiError(endpoint: string, payload: AiPayload, error: unknown): void {
  if (!shouldLogAiPayload(payload)) return;
  console.groupCollapsed(logTitle('Fehler', payload));
  console.log('Endpoint', endpoint);
  console.error(error);
  console.groupEnd();
}
