import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client';
import { createPlanApi } from './plan';

describe('plan api', () => {
  it('reads the plan, the limits and the usage', async () => {
    const request = vi.fn().mockResolvedValue({});
    const signal = new AbortController().signal;
    await createPlanApi({ request } as unknown as ApiClient).overview(signal);
    expect(request).toHaveBeenCalledWith('/v1/plan', { signal });
  });

  it('asks the administration for a change', async () => {
    const request = vi.fn().mockResolvedValue({});
    await createPlanApi({ request } as unknown as ApiClient).requestChange({
      requested_plan: 'NETWORK',
      message: 'We opened a second store',
    });
    expect(request).toHaveBeenCalledWith('/v1/plan/change-requests', {
      method: 'POST',
      body: { requested_plan: 'NETWORK', message: 'We opened a second store' },
    });
  });
});
