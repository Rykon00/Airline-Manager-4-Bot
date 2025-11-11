/**
 * Central Bot Configuration
 *
 * This file provides a single source of truth for all bot configuration.
 *
 * Benefits:
 * - Defines sensible defaults for all operations
 * - Overridable via environment variables (for GitHub Actions)
 * - Type-safe configuration management
 * - Easy to extend for new features
 *
 * Usage in code:
 *   import { BOT_CONFIG } from './config';
 *   const email = BOT_CONFIG.auth.email;
 *
 * Usage with GitHub Actions:
 *   Set repository variables/secrets to override defaults
 *   Example: MAX_FUEL_PRICE=600 will override the default 550
 *
 * Usage locally:
 *   Create a .env file with your values (see .env.example)
 *   Example: MAX_DEPARTURES_OVERRIDE=5 npm run test:airline:headed
 */

import * as dotenv from 'dotenv';

/**
 * IMPORTANT: This config uses getter properties to ALWAYS read fresh values from .env
 * Each access reloads .env and reads process.env - NO CACHING!
 * This ensures .env changes are immediately effective without restart!
 */

// Helper function to reload .env on every access
function reloadEnv() {
    dotenv.config({ override: true });
}

export const BOT_CONFIG = {
    /**
     * Fuel & CO2 Purchase Limits
     * Default thresholds for automated purchasing
     */
    get fuel() {
        reloadEnv();
        return {
            maxFuelPrice: parseInt(process.env.MAX_FUEL_PRICE || '550'),
            maxCo2Price: parseInt(process.env.MAX_CO2_PRICE || '120')
        };
    },

    /**
     * Fleet Management Configuration
     * Controls automated departure and scraping behavior
     */
    get fleet() {
        reloadEnv();
        return {
            // Percentage of total fleet to depart per run (0.10 = 10%)
            percentage: parseFloat(process.env.FLEET_PERCENTAGE || '0.10'),

            // Min delay between plane operations (ms)
            minDelay: parseInt(process.env.FLEET_MIN_DELAY || '1000'),

            // Max delay between plane operations (ms)
            maxDelay: parseInt(process.env.FLEET_MAX_DELAY || '2000'),

            // Mock mode: if true, no real departures (for testing)
            mockMode: process.env.FLEET_MOCK_MODE === 'true',

            // Global maximum: max departures per run (overrides percentage calculation)
            // If not set or empty, no override is applied (uses percentage-based calculation)
            maxDeparturesOverride: process.env.MAX_DEPARTURES_OVERRIDE && process.env.MAX_DEPARTURES_OVERRIDE.trim() !== ''
                ? parseInt(process.env.MAX_DEPARTURES_OVERRIDE)
                : undefined
        };
    }

    // Future expansion areas:
    // campaigns: { ... }
    // maintenance: { ... }
    // scraping: { ... }
    // notifications: { ... }
};

// Type exports for better IDE support
export type BotConfig = typeof BOT_CONFIG;
export type FleetConfig = typeof BOT_CONFIG.fleet;
export type FuelConfig = typeof BOT_CONFIG.fuel;
