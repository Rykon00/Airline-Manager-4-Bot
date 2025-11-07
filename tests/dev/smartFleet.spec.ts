import { test } from '@playwright/test';
import { GeneralUtils } from '../../utils/00_general.utils';
import { SmartFleetUtils } from '../../utils/04_fleet.utils';
import { BOT_CONFIG } from '../../config';

/**
 * Smart Fleet Management Test
 * Implements the Fleet-Based Departure Limiting Strategy
 * See: utils/fleet/FLEET_SCRAPING_STRATEGY.md
 */
test('Smart Fleet Processing', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    console.log('\n🚀 Starting Smart Fleet Processing...\n');

    // Use central configuration from config.ts (respects .env settings)
    const smartFleetUtils = new SmartFleetUtils(page, BOT_CONFIG.fleet);

    const generalUtils = new GeneralUtils(page);

    // === PHASE 0: Login ===
    console.log('🔐 Phase 0: Login');
    await generalUtils.login(page);

    // === PHASE 1: Navigate to Fleet Overview ===
    await smartFleetUtils.navigateToFleetOverview();

    // === PHASE 2: Count & Calculate ===
    const {
        totalFleetSize,
        fleetComposition,
        currentLanded,
        maxDepartures
    } = await smartFleetUtils.getFleetSizeAndCalculateLimit();

    // === PHASE 3: Process Planes ===
    const {
        processedCount,
        departedCount,
        planesData
    } = await smartFleetUtils.processLandedPlanes(maxDepartures);

    // === Save Data ===
    smartFleetUtils.saveCache(totalFleetSize, fleetComposition, planesData);
    smartFleetUtils.savePlanesData(planesData);

    // === Summary ===
    console.log('\n' + '='.repeat(60));
    console.log('📊 SMART FLEET PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Fleet Size:      ${totalFleetSize} planes`);
    console.log(`  - Inflight:          ${fleetComposition.inflight}`);
    console.log(`  - Landed:            ${fleetComposition.landed}`);
    console.log(`  - Parked:            ${fleetComposition.parked}`);
    console.log(`  - Pending:           ${fleetComposition.pending}`);
    console.log(`\nCurrent Landed:        ${currentLanded} planes`);
    console.log(`Departure Strategy:    10% of total fleet`);
    console.log(`Max Departures:        ${maxDepartures} planes`);
    console.log(`\nProcessed:             ${processedCount} planes`);
    console.log(`Departed:              ${departedCount} planes`);
    console.log(`\nFlights Scraped:       ${planesData.reduce((sum, p) => sum + p.flightHistory.length, 0)} total`);
    console.log('='.repeat(60));

    await page.close();
});
