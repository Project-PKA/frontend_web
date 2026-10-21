import type { paths } from './generated';
import type { ApiClient } from './client';

/** `GET /v1/store/message-templates`: what the bot says in the group, with the store's own text. */
export type MessageTemplates = paths['/v1/store/message-templates']['get'] extends {
  responses: { 200: { content: { 'application/json': infer Body } } };
}
  ? Body
  : never;
export type MessageTemplate = MessageTemplates['items'][number];
export type TemplateKey = MessageTemplate['key'];

/** What `PATCH /v1/store` takes (the owner only): everything is optional, only what changed goes. */
export interface StoreChanges {
  name?: string;
  inactivity_days_limit?: number | null;
  pix_key?: string | null;
  /** The invitation link of the group (`https://chat.whatsapp.com/...`). */
  whatsapp_invite_url?: string | null;
  /** Needs the link of the group and `acknowledge_public_group_link: true`. */
  showcase_enabled?: boolean;
  /** Confirms that the link of the group becomes public in the showcase. */
  acknowledge_public_group_link?: boolean;
}

export function createStoreApi(client: ApiClient) {
  return {
    /**
     * Days without interaction until the bot removes a member from the group; `null` turns it off.
     * Needs the owner: the API answers 403 otherwise.
     */
    setInactivityLimit: (days: number | null) =>
      client.request<unknown>('/v1/store', {
        method: 'PATCH',
        body: { inactivity_days_limit: days },
      }),
    /** The owner changes the store: PIX key, group link, showcase. */
    update: (changes: StoreChanges) =>
      client.request<unknown>('/v1/store', { method: 'PATCH', body: changes }),
    templates: (signal?: AbortSignal) =>
      client.request<MessageTemplates>('/v1/store/message-templates', { signal }),
    /** The store's own text for one message; only the placeholders of the message are accepted. */
    setTemplate: (key: TemplateKey, body: string) =>
      client.request<MessageTemplate>(`/v1/store/message-templates/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: { body },
      }),
    /** Back to the default text of the bot. */
    resetTemplate: (key: TemplateKey) =>
      client.request<MessageTemplate>(`/v1/store/message-templates/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      }),
  };
}

export type StoreApi = ReturnType<typeof createStoreApi>;
