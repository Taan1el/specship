import * as demoApi from './demoApi'
import * as liveApi from './api'

/**
 * Single switch between the real Express API client and the in-browser
 * demo client. Both modules expose the same function signatures, so the
 * rest of the app never needs to know which one is active.
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const impl = isDemoMode ? demoApi : liveApi

export const fetchHealth = impl.fetchHealth
export const listSpecs = impl.listSpecs
export const createSpec = impl.createSpec
export const updateSpecStatus = impl.updateSpecStatus

/** Only available in demo mode. Clears saved demo data back to the seed specs. */
export const resetDemoData = isDemoMode ? demoApi.resetDemoData : undefined

export { ApiError } from './api'
export type { ApiErrorBody, ApiErrorIssue } from './api'
