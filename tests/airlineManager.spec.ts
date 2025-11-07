import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/00_general.utils';
import { FuelUtils } from '../utils/01_fuel.utils';
import { CampaignUtils } from '../utils/02_campaign.utils';
import { MaintenanceUtils } from '../utils/03_maintenance.utils';
import { SmartFleetUtils } from '../utils/04_fleet.utils';
import { BOT_CONFIG } from '../config';
import * as fs from 'fs';

test('All Operations', async ({ page }) => {
  test.setTimeout(180000); // 3 minutes for Smart Fleet processing

  // Variable Initialization
  const fuelUtils = new FuelUtils(page);
  const generalUtils = new GeneralUtils(page);
  const campaignUtils = new CampaignUtils(page);
  const maintenanceUtils = new MaintenanceUtils(page);

  // Smart Fleet: Use central configuration
  const smartFleetUtils = new SmartFleetUtils(page, BOT_CONFIG.fleet);
  // End //

  // Login //
  await generalUtils.login(page);

  // Fuel Operations //
  await page.locator('#mapMaint > img').first().click();
  await fuelUtils.buyFuel();

  await page.getByRole('button', { name: ' Co2' }).click();
  await GeneralUtils.sleep(1000);
  await fuelUtils.buyCo2();

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  // End //  // Campaign Operations //
  await page.locator('div:nth-child(5) > #mapMaint > img').click();
  await campaignUtils.checkAndCreateEcoFriendlyCampaign();

  // Check and create airline reputation campaign after eco-friendly check
  await campaignUtils.checkAndCreateAirlineReputationCampaign();

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  await GeneralUtils.sleep(1000)
  // End //

  // Repair Planes if needed //
  console.log('Navigating to Maintenance section.');
  await page.locator('div:nth-child(4) > #mapMaint > img').click();

  console.log('Checking planes for maintenance.');
  await maintenanceUtils.checkPlanes();
  await GeneralUtils.sleep(1000);

  console.log('Repairing planes if necessary.');
  await maintenanceUtils.repairPlanes();
  await GeneralUtils.sleep(1000);

  console.log('Closing maintenance popup.');
  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  // End //

  // Smart Fleet Operations //
  console.log('\n🚀 Starting Smart Fleet Processing...\n');

  // === PHASE 1: Navigate to Fleet Overview ===
  await smartFleetUtils.navigateToFleetOverview();

  // === PHASE 2: Count & Calculate ===
  const {
    totalFleetSize,
    fleetComposition,
    currentLanded,
    maxDepartures
  } = await smartFleetUtils.getFleetSizeAndCalculateLimit();

  // === PHASE 3: Process Planes (Depart & Scrape) ===
  const {
    processedCount,
    departedCount,
    planesData
  } = await smartFleetUtils.processLandedPlanes(maxDepartures);

  // === Save Data ===
  smartFleetUtils.saveCache(totalFleetSize, fleetComposition, planesData);
  smartFleetUtils.savePlanesData(planesData);

  // === Summary ===
  const additionallyScraped = processedCount - departedCount;
  const totalFlights = planesData.reduce((sum, p) => sum + p.flightHistory.length, 0);

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
  console.log(`\n--- Processing Results ---`);
  console.log(`Departed & Scraped:    ${departedCount} planes`);
  console.log(`Additionally Scraped:  ${additionallyScraped} planes (other inflight)`);
  console.log(`Total Processed:       ${processedCount} planes`);
  console.log(`\nFlights Scraped:       ${totalFlights} total`);
  console.log('='.repeat(60));
  // End //

  await page.close();
});
