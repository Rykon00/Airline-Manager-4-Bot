/**
 * Fleet Utils - Central Facade/Proxy for all Fleet Operations
 *
 * This file serves as the central entry point for all fleet-related utilities.
 * Implementation details are organized in the ./fleet/ subdirectory.
 *
 * Usage:
 *   import { SmartFleetUtils } from '../utils/04_fleet.utils';
 *
 * Benefits:
 *   - Maintains chronological numbering (00-05) matching script execution order
 *   - Single import point for all fleet operations
 *   - Implementation details cleanly organized in subdirectory
 *   - Easy to extend with new fleet features
 */

// Re-export all fleet-related utilities
export { SmartFleetUtils } from './fleet/smartFleetUtils';
export { FetchPlanesUtils } from './fleet/fetchPlanes.utils';
export { UpdatePlanesUtils } from './fleet/updatePlanes.utils';

// Re-export types and utilities
export * from './fleet/fleetTypes';
export * from './fleet/timestampUtils';
