// Re-export ACP provider registry for backward compatibility during migration
export { getAcpProvider as getProviderAdapter, listAcpProviders as listProviderAdapters } from '../acp/provider-registry.js'

// Empty adapters array for compatibility
export const providerAdapters: never[] = []
