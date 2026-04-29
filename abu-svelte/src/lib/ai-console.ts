type AiPayload = Record<string, unknown>;
type AiResponse = Record<string, unknown>;

const shouldLogAiPayload = (payload: AiPayload): boolean =>
  !payload.save_only && !payload.saveOnly;

const logTitle = (prefix: string, payload: AiPayload, status?: number): string => {
  const sheet = typeof payload.sheet === 'string' && payload.sheet ? payload.sheet : 'ohne-sheet';
  const key = typeof payload.key === 'string' && payload.key ? payload.key : 'ohne-key';
  const suffix = typeof status === 'number' ? ` (${status})` : '';
  return `[ABU KI] ${prefix}: ${sheet}/${key}${suffix}`;
};

export function logAiRequest(endpoint: string, payload: AiPayload): void {
  if (!shouldLogAiPayload(payload)) return;
  console.groupCollapsed(logTitle('Anfrage', payload));
  console.log('Endpoint', endpoint);
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
  const chatgpt =
    response &&
    typeof response === 'object' &&
    response.data &&
    typeof response.data === 'object' &&
    'chatgpt' in response.data
      ? response.data.chatgpt
      : undefined;

  console.groupCollapsed(logTitle('Antwort', payload, status));
  console.log('Endpoint', endpoint);
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
