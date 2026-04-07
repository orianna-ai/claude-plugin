export function usePaywall(_options: { successUrl: string; cancelUrl: string }) {
  return {
    showPaywall: false,
    paywallData: null,
    checkPaywall: async () => false,
    handleUpgrade: () => {},
    closePaywall: () => {},
  };
}
