import type { ProviderId, ProviderOrderState, ProviderTarget } from './providerTypes.ts';

export function resolveProvider(
  targetKey: ProviderTarget['key'],
  configuredProvider: unknown,
): ProviderId;

export function resolvePinnedProvider(
  targetKey: ProviderTarget['key'],
  state: ProviderOrderState | null | undefined,
  configuredProvider: unknown,
  allowConfiguredWhenMissing?: boolean,
): ProviderId;

export function shouldCreateProviderOrder(
  state: ProviderOrderState | null | undefined,
  action: string,
  stateWasMissing?: boolean,
): boolean;
