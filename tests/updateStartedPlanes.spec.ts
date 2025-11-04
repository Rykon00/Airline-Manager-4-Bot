import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/00_general.utils';
import { UpdatePlanesUtils } from '../utils/fleet/updatePlanes.utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Incremental update test - Updates only planes that were started by the bot
 * Reads started-flights.json and updates those specific planes in planes.json
 */
test('Update started planes incrementally', async ({ page }) => {
    console.log('========================================');
    console.log('INCREMENTAL PLANE UPDATE TEST');
    console.log('========================================\n');

    // Load started-flights.json
    const startedFlightsPath = path.join(process.cwd(), 'started-flights.json');

    if (!fs.existsSync(startedFlightsPath)) {
        console.log('No started-flights.json found - no planes to update');
        console.log('This is normal if no flights were started in the last bot run');
        return;
    }

    let startedFleetIds: string[] = [];
    try {
        const data = fs.readFileSync(startedFlightsPath, 'utf-8');
        const startedFlights = JSON.parse(data);

        // Extract unique FleetIDs
        startedFleetIds = Array.from(new Set(startedFlights.fleetIds || [])) as string[];

        console.log(`Found ${startedFleetIds.length} planes to update:`);
        console.log(startedFleetIds.join(', '));
        console.log();
    } catch (error) {
        console.error('Error reading started-flights.json:', error);
        return;
    }

    if (startedFleetIds.length === 0) {
        console.log('No FleetIDs found in started-flights.json');
        return;
    }

    // Login and navigate
    console.log('Logging in...');
    await GeneralUtils.login(page);
    await page.waitForLoadState('domcontentloaded');
    console.log('Login successful\n');

    // Update specific planes
    const updatePlanesUtils = new UpdatePlanesUtils(page);
    const updatedPlanes = await updatePlanesUtils.updateSpecificPlanes(startedFleetIds);

    console.log('\n========================================');
    console.log('INCREMENTAL UPDATE COMPLETED');
    console.log('========================================');
    console.log(`Updated ${updatedPlanes.length} planes`);
    console.log('planes.json has been updated with new flight data');

    // Clean up started-flights.json after successful update
    try {
        fs.unlinkSync(startedFlightsPath);
        console.log('Cleaned up started-flights.json');
    } catch (error) {
        console.error('Error cleaning up started-flights.json:', error);
    }
});
