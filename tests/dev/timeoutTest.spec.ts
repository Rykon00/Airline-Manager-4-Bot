import { test } from '@playwright/test';
import { GeneralUtils } from '../../utils/00_general.utils';
import { SmartFleetUtils } from '../../utils/04_fleet.utils';
import { BOT_CONFIG } from '../../config';

/**
 * Timeout Test - 60 Second Timeout
 * Tests the emergency timeout handling with a short 60s timeout
 *
 * Purpose:
 * - Verify that timeout checks work correctly in Phase 3A and 3B (30s buffer checks)
 * - Ensure early returns prevent tab-switching when time runs out
 * - Validate that data is saved before timeout occurs
 *
 * Configuration:
 * - Uses SAME logic as all other tests (respects .env MAX_DEPARTURES_OVERRIDE)
 * - If MAX_DEPARTURES_OVERRIDE not set: Uses 10% of fleet (default)
 * - If MAX_DEPARTURES_OVERRIDE=2: Uses 2 (recommended for faster timeout testing)
 * - Test timeout: 60 seconds (vs normal 180s)
 */
test('Timeout Test - 60s Emergency Handling', async ({ page }) => {
    test.setTimeout(60000); // 60 seconds - SHORT timeout for testing

    console.log('\n⏰ Starting Timeout Test (60s limit)...\n');

    // Use SAME config logic as rest of project (respects .env MAX_DEPARTURES_OVERRIDE)
    // ONLY difference: 60s timeout instead of 180s
    const smartFleetUtils = new SmartFleetUtils(page, BOT_CONFIG.fleet, 60000);

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

    console.log(`\n⏱️  TIMEOUT TEST CONFIG:`);
    console.log(`   Test timeout: 60 seconds (vs normal 180s)`);
    console.log(`   Max departures: ${maxDepartures} (from .env or 10% calculation)`);
    console.log(`   Expected: Bot should handle timeout gracefully with 30s checks\n`);

    // === PHASE 3: Process Planes (with timeout handling) ===
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
    console.log('⏰ TIMEOUT TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Test Timeout:          60 seconds`);
    console.log(`Total Fleet Size:      ${totalFleetSize} planes`);
    console.log(`  - Inflight:          ${fleetComposition.inflight}`);
    console.log(`  - Landed:            ${fleetComposition.landed}`);
    console.log(`  - Parked:            ${fleetComposition.parked}`);
    console.log(`  - Pending:           ${fleetComposition.pending}`);
    console.log(`\nCurrent Landed:        ${currentLanded} planes`);
    console.log(`Max Departures:        ${maxDepartures} planes`);
    console.log(`\nProcessed:             ${processedCount} planes`);
    console.log(`Departed:              ${departedCount} planes`);
    console.log(`\nFlights Scraped:       ${planesData.reduce((sum, p) => sum + p.flightHistory.length, 0)} total`);
    console.log(`\n✅ Test completed - Data saved successfully`);
    console.log('='.repeat(60));

    await page.close();
});
