import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Store, StoredUser } from '../store';

export type RouteHandlerContext = {
  corsOrigin: string;
  request: IncomingMessage;
  requestId: string;
  requestUrl: URL;
  response: ServerResponse;
  sendAuthEmail: (payload: {
    html: string;
    subject: string;
    text: string;
    to: string;
  }) => Promise<void>;
  store: Store;
  log: (event: string, payload?: Record<string, unknown>) => void;
};

export type UserEmailPayload = {
  subject: string;
  text: (user: StoredUser, token: string) => string;
  html: (user: StoredUser, token: string) => string;
};
