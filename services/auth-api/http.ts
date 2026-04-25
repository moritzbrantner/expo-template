import type { IncomingMessage, ServerResponse } from 'node:http';

type FieldErrors = Record<string, string>;

function getCommonHeaders(corsOrigin: string) {
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  };
}

export function json(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  corsOrigin: string,
): void {
  response.writeHead(statusCode, {
    ...getCommonHeaders(corsOrigin),
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

export function sendError(
  response: ServerResponse,
  {
    code,
    corsOrigin,
    fieldErrors,
    message,
    requestId,
    statusCode,
  }: {
    code: string;
    corsOrigin: string;
    fieldErrors?: FieldErrors;
    message: string;
    requestId: string;
    statusCode: number;
  },
): void {
  json(
    response,
    statusCode,
    {
      code,
      error: message,
      message,
      fieldErrors,
      requestId,
    },
    corsOrigin,
  );
}

export function noContent(response: ServerResponse, corsOrigin: string): void {
  response.writeHead(204, getCommonHeaders(corsOrigin));
  response.end();
}

export async function parseBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

export function getBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function getStringParam(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getPaginationCursor(requestUrl: URL): number {
  const cursor = Number(requestUrl.searchParams.get('cursor') ?? '0');
  return Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
}

export function paginate<T>(items: T[], cursor: number, pageSize: number) {
  const pageItems = items.slice(cursor, cursor + pageSize);
  return {
    items: pageItems,
    nextCursor: cursor + pageSize < items.length ? String(cursor + pageSize) : null,
  };
}

export function getRequestIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
}
