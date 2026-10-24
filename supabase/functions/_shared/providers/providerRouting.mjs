export const ACTIVATION_PROVIDERS = Object.freeze(['prodseller', 'zfourstore']);

export function resolveProvider(targetKey, configuredProvider) {
  return ACTIVATION_PROVIDERS.includes(configuredProvider) ? configuredProvider : 'prodseller';
}

export function resolvePinnedProvider(targetKey, state, configuredProvider, allowConfiguredWhenMissing = false) {
  if (state?.provider && ACTIVATION_PROVIDERS.includes(state.provider)) return state.provider;
  if (state) return 'prodseller';
  return allowConfiguredWhenMissing ? resolveProvider(targetKey, configuredProvider) : 'prodseller';
}

export function shouldCreateProviderOrder(state, action, stateWasMissing = false) {
  if (action === 'status' || state?.orderId || state?.status === 'success' || state?.status === 'failed') {
    return false;
  }
  if (stateWasMissing) return true;
  if (!state || state.status === 'not_started') return action === 'deliver';
  if (state.status === 'insufficient_balance' || state.status === 'retryable') return action === 'retry';
  if (state.status === 'starting') return action === 'deliver' || action === 'retry';
  return false;
}
