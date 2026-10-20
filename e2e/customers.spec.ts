import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

interface Person {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  cpf_masked: string | null;
  kind: 'VISITOR' | 'CUSTOMER';
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  last_interaction_at: string | null;
  address: Record<string, string | null>;
  created_at: string;
}

function person(id: string, name: string, extra: Partial<Person> = {}): Person {
  return {
    id,
    phone: '5511988771020',
    name,
    email: null,
    cpf_masked: null,
    kind: 'CUSTOMER',
    is_blacklisted: false,
    blacklist_reason: null,
    last_interaction_at: null,
    address: {},
    created_at: '2030-03-01T12:00:00.000Z',
    ...extra,
  };
}

const PEOPLE = (): Person[] => [
  person('u-1', 'Rafael M.', {
    cpf_masked: '***.***.***-12',
    email: 'rafael@example.com',
    address: {
      zip: '01310100',
      street: 'Rua A',
      number: '10',
      comp: null,
      city: 'São Paulo',
      state: 'SP',
    },
  }),
  person('u-2', 'Bruno A.', { phone: '5531984007731', kind: 'VISITOR' }),
  person('u-3', 'Camila T.', { phone: '5521991204455', cpf_masked: '***.***.***-55' }),
  person('u-4', 'Dario B.', {
    phone: '5541977665544',
    is_blacklisted: true,
    blacklist_reason: 'Did not pay twice',
  }),
];

interface Options {
  people?: Person[];
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  limit?: number | null;
  listStatus?: number;
  patchAnswer?: object;
  storePatchAnswer?: object;
  createAnswer?: object;
  paidAnswer?: object;
}

interface Calls {
  lists: URLSearchParams[];
  patches: { id: string; body: Record<string, unknown> }[];
  created: Record<string, unknown>[];
  blacklisted: { id: string; reason: string }[];
  unblacklisted: string[];
  stores: Record<string, unknown>[];
  paid: string[];
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}): Promise<Calls> {
  const calls: Calls = {
    lists: [],
    patches: [],
    created: [],
    blacklisted: [],
    unblacklisted: [],
    stores: [],
    paid: [],
  };
  const people = options.people ?? PEOPLE();
  let limit = options.limit === undefined ? 60 : options.limit;

  await page.addInitScript(() => localStorage.setItem('current-store', 'store-1'));
  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: null,
        is_platform_admin: false,
        can_create_stores: false,
        store_limit: 1,
      },
    }),
  );
  await page.route(/\/v1\/store$/, (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.stores.push(body);
      if (options.storePatchAnswer) {
        return route.fulfill(options.storePatchAnswer as Parameters<typeof route.fulfill>[0]);
      }
      limit = body.inactivity_days_limit as number | null;
    }
    return route.fulfill({
      status: 200,
      json: {
        id: 'store-1',
        name: 'Card Hub',
        whatsapp_status: 'ONLINE',
        inactivity_days_limit: limit,
        role: options.role ?? 'OWNER',
        permissions: options.permissions ?? { can_manage_customers: true },
      },
    });
  });
  await page.route('**/v1/me/preferences', (route) =>
    route.fulfill({
      status: 200,
      json: {
        language: 'en',
        theme: 'SYSTEM',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        notifications: { in_app: true, email: true },
      },
    }),
  );
  await page.route('**/v1/notifications/unread-count', (route) =>
    route.fulfill({ status: 200, json: { count: 0 } }),
  );
  await page.route(/\/v1\/settlements\/[^/]+\/paid$/, (route) => {
    if (options.paidAnswer) {
      return route.fulfill(options.paidAnswer as Parameters<typeof route.fulfill>[0]);
    }
    calls.paid.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill({ status: 200, json: { id: 's-1', status: 'PAID' } });
  });
  await page.route(/\/v1\/customers\/[^/]+\/settlements/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: [
          {
            id: 's-1',
            status: 'PENDING',
            total_amount: '115.00',
            items: 2,
            paid_at: null,
            created_at: '2030-03-05T15:00:00.000Z',
          },
          {
            id: 's-2',
            status: 'PAID',
            total_amount: '340.00',
            items: 1,
            paid_at: '2030-03-02T15:00:00.000Z',
            created_at: '2030-03-01T15:00:00.000Z',
          },
        ],
        next_cursor: null,
      },
    }),
  );
  await page.route(/\/v1\/customers\/[^/]+\/bids/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: [
          {
            id: 'b-1',
            amount: '820.00',
            created_at: '2030-03-05T15:00:00.000Z',
            auction_id: 'a-1',
            auction_status: 'ACTIVE',
            won: false,
            card: { id: 'c-1', short_code: '0412', name: 'Charizard ex' },
          },
          {
            id: 'b-2',
            amount: '340.00',
            created_at: '2030-03-01T15:00:00.000Z',
            auction_id: 'a-2',
            auction_status: 'FINISHED',
            won: true,
            card: { id: 'c-2', short_code: '0377', name: 'Lugia V' },
          },
          {
            id: 'b-3',
            amount: '90.00',
            created_at: '2030-02-20T15:00:00.000Z',
            auction_id: 'a-3',
            auction_status: 'FINISHED',
            won: false,
            card: { id: 'c-3', short_code: '0301', name: 'Mew ex' },
          },
        ],
        next_cursor: null,
      },
    }),
  );
  await page.route(/\/v1\/customers\/[^/]+\/blacklist$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    const found = people.find((item) => item.id === id);
    if (!found) return route.fulfill(problem(404, 'CUSTOMER_NOT_FOUND'));
    if (route.request().method() === 'POST') {
      const { reason } = route.request().postDataJSON() as { reason: string };
      calls.blacklisted.push({ id, reason });
      found.is_blacklisted = true;
      found.blacklist_reason = reason;
    } else {
      calls.unblacklisted.push(id);
      found.is_blacklisted = false;
      found.blacklist_reason = null;
    }
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/customers\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    const found = people.find((item) => item.id === id);
    if (!found) return route.fulfill(problem(404, 'CUSTOMER_NOT_FOUND'));
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.patches.push({ id, body });
      if (options.patchAnswer)
        return route.fulfill(options.patchAnswer as Parameters<typeof route.fulfill>[0]);
      if (typeof body.name === 'string') found.name = body.name;
      if (body.cpf) found.cpf_masked = '***.***.***-01';
      if (body.address) found.address = body.address as Record<string, string | null>;
    }
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/customers(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.created.push(body);
      if (options.createAnswer)
        return route.fulfill(options.createAnswer as Parameters<typeof route.fulfill>[0]);
      const made = person('u-new', String(body.name), {
        phone: String(body.phone),
        kind: 'VISITOR',
      });
      people.push(made);
      return route.fulfill({ status: 201, json: made });
    }
    calls.lists.push(url.searchParams);
    if (options.listStatus) return route.fulfill(problem(options.listStatus, 'BAD'));
    const q = url.searchParams.get('q')?.toLowerCase();
    const kind = url.searchParams.get('kind');
    const blacklisted = url.searchParams.get('blacklisted');
    const inactive = url.searchParams.get('inactive');
    const consignor = url.searchParams.get('consignor');
    let matching = people.filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q) || item.phone.includes(q)) &&
        (!kind || item.kind === kind) &&
        (blacklisted !== 'true' || item.is_blacklisted) &&
        (consignor !== 'true' || item.id === 'u-3'),
    );
    if (inactive === 'true') {
      matching = [
        {
          ...person('u-9', 'Eva Quiet', { phone: '5521955554444' }),
          last_interaction_at: '2030-01-10T12:00:00.000Z',
        },
      ];
    }
    const cursor = url.searchParams.get('cursor');
    const page1 = matching.slice(0, 3);
    const rest = matching.slice(3);
    return route.fulfill({
      status: 200,
      json:
        cursor === null
          ? { items: page1, next_cursor: rest.length > 0 ? 'page-2' : null }
          : { items: rest, next_cursor: null },
    });
  });
  return calls;
}

// ---------------------------------------------------------------- the list

test('lists the customers with phone, CPF and what kind each one is', async ({ page }) => {
  await signedIn(page, { people: PEOPLE().slice(0, 3) });
  await page.goto('/customers');

  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Customers' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('link', { name: 'Rafael M.' })).toHaveAttribute(
    'href',
    '/customers/u-1',
  );
  await expect(table.getByText('(11) 98877-1020')).toBeVisible();
  await expect(table.getByText('***.***.***-12')).toBeVisible();
  await expect(table.getByText('Registered customer').first()).toBeVisible();
  await expect(table.getByText('Visitor (incomplete registration)')).toBeVisible();
});

test('marks a blacklisted customer', async ({ page }) => {
  await signedIn(page, { people: [PEOPLE()[3]!] });
  await page.goto('/customers');

  await expect(
    page.getByRole('table', { name: 'Customers' }).getByText('Blacklisted'),
  ).toBeVisible();
});

test('filters by type: a kind, or the consignors, and keeps it in the address', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/customers');

  await page.getByLabel('Type', { exact: true }).selectOption('VISITOR');
  await expect(page).toHaveURL(/\/customers\?type=VISITOR$/);
  await expect(page.getByRole('table', { name: 'Customers' }).getByRole('row')).toHaveCount(2);
  expect(calls.lists.at(-1)?.get('kind')).toBe('VISITOR');

  await page.getByLabel('Type', { exact: true }).selectOption('CONSIGNOR');
  await expect(page.getByRole('table', { name: 'Customers' }).getByText('Camila T.')).toBeVisible();
  expect(calls.lists.at(-1)?.get('consignor')).toBe('true');
  expect(calls.lists.at(-1)?.has('kind')).toBe(false);
});

test('searches after the person stops typing', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers');

  await page.getByRole('searchbox', { name: 'Search by name, phone or CPF' }).fill('camila');

  await expect(page.getByRole('table', { name: 'Customers' }).getByRole('row')).toHaveCount(2);
  expect(calls.lists.at(-1)?.get('q')).toBe('camila');
});

test('opens with the filters of the address and ignores what the API does not know', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/customers?type=ALIEN&q=bruno');

  await expect(page.getByRole('table', { name: 'Customers' }).getByText('Bruno A.')).toBeVisible();
  expect(calls.lists[0]?.has('kind')).toBe(false);
  expect(calls.lists[0]?.get('q')).toBe('bruno');
});

test('says when nothing matches and clears the filters', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers');

  await page.getByRole('searchbox', { name: 'Search by name, phone or CPF' }).fill('zzz');
  await expect(page.getByText('No customer found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear the filters' }).click();

  await expect(page.getByRole('table', { name: 'Customers' })).toBeVisible();
});

test('says so when there is no customer yet', async ({ page }) => {
  await signedIn(page, { people: [] });
  await page.goto('/customers');

  await expect(page.getByText('No customers yet')).toBeVisible();
});

test('shows more customers by cursor', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers');
  const table = page.getByRole('table', { name: 'Customers' });
  await expect(table.getByRole('row')).toHaveCount(4);

  await page.getByRole('button', { name: 'Show more' }).click();

  await expect(table.getByRole('row')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
});

test('shows an error with a way to try again', async ({ page }) => {
  await signedIn(page, { listStatus: 400 });
  await page.goto('/customers');

  await expect(page.getByText('We could not load the customers')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('does not open the customers for staff without the permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/customers');

  await expect(page.getByRole('table')).toHaveCount(0);
});

// ------------------------------------------------------------ the profile

test('shows the data of the customer, with the phone that cannot be changed', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers/u-1');

  await expect(page.getByRole('heading', { level: 2, name: 'Rafael M.' })).toBeVisible();
  await expect(page.getByLabel('Phone')).toHaveValue('(11) 98877-1020');
  await expect(page.getByLabel('Phone')).toBeDisabled();
  await expect(page.getByLabel('E-mail')).toHaveValue('rafael@example.com');
  await expect(page.getByLabel(/^CPF/)).toHaveValue('');
  await expect(
    page.getByText('On file: ***.***.***-12. Type a new one to replace it.'),
  ).toBeVisible();
  await expect(page.getByLabel('Postal code (CEP)')).toHaveValue('01310-100');
  await expect(page.getByLabel('Street')).toHaveValue('Rua A');
  await expect(page.getByLabel('City')).toHaveValue('São Paulo');
  await expect(page.getByLabel('State')).toHaveValue('SP');
});

test('warns about an incomplete registration', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers/u-2');

  await expect(page.getByText('Incomplete registration', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Fill in the CPF and the address to release the confirmation of a sale.'),
  ).toBeVisible();
});

test('saves only what changed, writing the CPF and the CEP as they are typed', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/u-2');
  await expect(page.getByLabel('Name')).toHaveValue('Bruno A.');

  await page.getByLabel(/^CPF/).fill('12345678901');
  await expect(page.getByLabel(/^CPF/)).toHaveValue('123.456.789-01');
  await page.getByLabel('Postal code (CEP)').fill('01310100');
  await expect(page.getByLabel('Postal code (CEP)')).toHaveValue('01310-100');
  await page.getByLabel('Street').fill('Rua B');
  await page.getByLabel('State').fill('sp');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Customer saved.')).toBeVisible();
  expect(calls.patches).toEqual([
    {
      id: 'u-2',
      body: {
        cpf: '12345678901',
        address: {
          zip: '01310100',
          street: 'Rua B',
          number: null,
          comp: null,
          city: null,
          state: 'SP',
        },
      },
    },
  ]);
});

test('says so and sends nothing when nothing changed', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/u-1');
  await expect(page.getByLabel('Name')).toHaveValue('Rafael M.');

  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Nothing was changed.')).toBeVisible();
  expect(calls.patches).toEqual([]);
});

test('checks the CPF, the CEP and the state before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/u-1');
  await expect(page.getByLabel('Name')).toHaveValue('Rafael M.');

  await page.getByLabel(/^CPF/).fill('123456');
  await page.getByLabel('Postal code (CEP)').fill('01310');
  await page.getByLabel('State').fill('S');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Enter the 11 digits of the CPF.')).toBeVisible();
  await expect(page.getByText('Enter the 8 digits of the postal code (CEP).')).toBeVisible();
  await expect(page.getByText('Enter the 2 letters of the state, like SP.')).toBeVisible();
  expect(calls.patches).toEqual([]);
});

test('shows the error of the API translated and keeps what was typed', async ({ page }) => {
  await signedIn(page, { patchAnswer: problem(422, 'CUSTOMER_CPF_INVALID') });
  await page.goto('/customers/u-1');
  await expect(page.getByLabel('Name')).toHaveValue('Rafael M.');

  await page.getByLabel(/^CPF/).fill('11111111111');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid CPF.' })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(page.getByLabel(/^CPF/)).toHaveValue('111.111.111-11');
});

test('adds the customer to the blacklist with a reason, and takes it off', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/u-1');

  await page.getByRole('button', { name: 'Add to the blacklist' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to the blacklist' });
  await dialog.getByRole('button', { name: 'Add and remove from the group' }).click();
  await expect(dialog.getByText('This field is required.')).toBeVisible();
  expect(calls.blacklisted).toEqual([]);

  await dialog.getByLabel('Reason').fill('Did not pay');
  await dialog.getByRole('button', { name: 'Add and remove from the group' }).click();

  await expect(page.getByText('Added to the blacklist.')).toBeVisible();
  expect(calls.blacklisted).toEqual([{ id: 'u-1', reason: 'Did not pay' }]);
  await expect(page.getByText('Did not pay')).toBeVisible();

  await page.getByRole('button', { name: 'Remove from the blacklist' }).click();

  await expect(page.getByText('Removed from the blacklist.')).toBeVisible();
  expect(calls.unblacklisted).toEqual(['u-1']);
});

test('shows what the customer owes and what they bid', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers/u-1');

  const settlements = page.getByRole('table', { name: 'Settlements' });
  await expect(settlements.getByText(/R\$\s?115\.00/)).toBeVisible();
  await expect(settlements.getByText('Pending')).toBeVisible();
  await expect(settlements.getByText('Paid')).toBeVisible();

  await page.getByRole('tab', { name: 'Bids history' }).click();

  const bids = page.getByRole('table', { name: 'Bids history' });
  await expect(bids.getByRole('link', { name: 'Charizard ex' })).toHaveAttribute(
    'href',
    '/auctions/a-1',
  );
  await expect(bids.getByText('Auction running')).toBeVisible();
  await expect(bids.getByText('Won', { exact: true })).toBeVisible();
  await expect(bids.getByText('Not won')).toBeVisible();
});

test('confirms the payment of a pending settlement after asking', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/u-1');

  const settlements = page.getByRole('table', { name: 'Settlements' });
  await expect(settlements.getByRole('button', { name: 'Confirm payment' })).toHaveCount(1);
  await settlements.getByRole('button', { name: 'Confirm payment' }).click();

  const dialog = page.getByRole('dialog', { name: 'Confirm the payment' });
  await expect(dialog).toContainText('The cards of this settlement become sold');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(calls.paid).toEqual([]);

  await settlements.getByRole('button', { name: 'Confirm payment' }).click();
  await dialog.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(page.getByText('Payment confirmed.')).toBeVisible();
  expect(calls.paid).toEqual(['s-1']);
});

test('shows the error of the confirmation translated, inside the dialog', async ({ page }) => {
  await signedIn(page, { paidAnswer: problem(409, 'SETTLEMENT_NOT_PENDING') });
  await page.goto('/customers/u-1');

  await page.getByRole('button', { name: 'Confirm payment' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Confirm the payment' });
  await dialog.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('says so when the customer does not exist', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers/nope');

  await expect(page.getByText('We could not open this customer')).toBeVisible();
});

// ------------------------------------------------------ the blacklist page

test('lists the blocked numbers and lets one go', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/blacklist');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Blacklist and inactivity' }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Blocked numbers' });
  await expect(table.getByText('(41) 97766-5544')).toBeVisible();
  await expect(table.getByText('Did not pay twice')).toBeVisible();

  await table.getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('Removed from the blacklist.')).toBeVisible();
  expect(calls.unblacklisted).toEqual(['u-4']);
});

test('blocks a number that is not a customer yet: creates it as a visitor, then blocks it', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/customers/blacklist');

  await page.getByRole('button', { name: 'Add to the blacklist' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add to the blacklist' });
  await dialog.getByLabel('Phone').fill('11955554444');
  await expect(dialog.getByLabel('Phone')).toHaveValue('(11) 95555-4444');
  await dialog.getByLabel('Reason').fill('Spam');
  await dialog.getByRole('button', { name: 'Add and remove from the group' }).click();

  await expect(page.getByText('Added to the blacklist.')).toBeVisible();
  expect(calls.created).toEqual([{ phone: '5511955554444', name: '(11) 95555-4444' }]);
  expect(calls.blacklisted).toEqual([{ id: 'u-new', reason: 'Spam' }]);
});

test('blocks a number the store already has, finding the customer by the phone', async ({
  page,
}) => {
  const calls = await signedIn(page, { createAnswer: problem(409, 'CUSTOMER_PHONE_TAKEN') });
  await page.goto('/customers/blacklist');

  await page.getByRole('button', { name: 'Add to the blacklist' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add to the blacklist' });
  await dialog.getByLabel('Phone').fill('11988771020');
  await dialog.getByLabel('Reason').fill('Fake bids');
  await dialog.getByRole('button', { name: 'Add and remove from the group' }).click();

  await expect(page.getByText('Added to the blacklist.')).toBeVisible();
  expect(calls.blacklisted).toEqual([{ id: 'u-1', reason: 'Fake bids' }]);
});

test('checks the phone and the reason before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/customers/blacklist');

  await page.getByRole('button', { name: 'Add to the blacklist' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add to the blacklist' });
  await dialog.getByLabel('Phone').fill('123');
  await dialog.getByRole('button', { name: 'Add and remove from the group' }).click();

  await expect(dialog.getByText('Enter the number with the area code.')).toBeVisible();
  await expect(dialog.getByText('This field is required.')).toBeVisible();
  expect(calls.created).toEqual([]);
});

test('shows who is about to be removed for inactivity, and when', async ({ page }) => {
  await signedIn(page);
  await page.goto('/customers/blacklist');

  await expect(page.getByLabel('Days')).toHaveValue('60');
  const table = page.getByRole('table', { name: 'Gray area: inactivity in the group' });
  await expect(table.getByText('Eva Quiet · (21) 95555-4444')).toBeVisible();
  await expect(table.getByText('Mar 11, 2030')).toBeVisible();
});

test('says there is no limit yet, and saves one', async ({ page }) => {
  const calls = await signedIn(page, { limit: null });
  await page.goto('/customers/blacklist');
  await expect(page.getByText('No limit set')).toBeVisible();

  await page.getByLabel('Days').fill('45');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Limit saved.')).toBeVisible();
  expect(calls.stores).toEqual([{ inactivity_days_limit: 45 }]);
  await expect(
    page.getByRole('table', { name: 'Gray area: inactivity in the group' }),
  ).toBeVisible();
});

test('sends a person who is not the owner to the no-permission screen when saving the limit', async ({
  page,
}) => {
  await signedIn(page, { storePatchAnswer: problem(403, 'OWNER_REQUIRED') });
  await page.goto('/customers/blacklist');

  await page.getByLabel('Days').fill('30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('You do not have permission to open this page')).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways, in the list, the profile and the blacklist', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

  await page.goto('/customers');
  await expect(page.getByRole('table', { name: 'Customers' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.goto('/customers/u-1');
  await expect(page.getByRole('heading', { level: 2, name: 'Rafael M.' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.goto('/customers/blacklist');
  await expect(page.getByRole('table', { name: 'Blocked numbers' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
