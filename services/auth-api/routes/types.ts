import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Store, StoredUser } from '../store';

export type RouteHandlerContext = {
  corsOrigin: string;
  request: IncomingMessage;
  response: ServerResponse;
  requestUrl: URL;
  store: Store;
  sendWelcomeEmail: (user: StoredUser) => Promise<void>;
};
