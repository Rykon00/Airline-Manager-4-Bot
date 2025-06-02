import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/00_general.utils';
import { FuelUtils } from '../utils/01_fuel.utils';
import { CampaignUtils } from '../utils/02_campaign.utils';
import { FleetUtils } from '../utils/04_fleet.utils';
import { MaintenanceUtils } from '../utils/03_maintenance.utils';
import * as fs from 'fs';

require('dotenv').config();

test('All Operations', async ({ page }) => {
  test.setTimeout(180000); // Increased timeout to 3 minutes to handle pagination

  // Variable Initialization
  const fuelUtils = new FuelUtils(page);
  const generalUtils = new GeneralUtils(page);
  const campaignUtils = new CampaignUtils(page);
  const fleetUtils = new FleetUtils(page);
  const maintenanceUtils = new MaintenanceUtils(page);
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
  await page.locator('div:nth-child(4) > #mapMaint > img').click();
  
  await maintenanceUtils.checkPlanes();
  await GeneralUtils.sleep(1000);
  await maintenanceUtils.repairPlanes();
  await GeneralUtils.sleep(1000);

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  // End //
  // Depart Planes Operations //
  await page.locator('#mapRoutes').getByRole('img').click();
  await GeneralUtils.sleep(2500);

  await fleetUtils.departPlanes();
  // End //

  // Fetch all planes and write to JSON
  try {
    console.log('Starting to fetch all planes...');
    const planes = await fleetUtils.getAllPlanes();
    console.log(`Successfully fetched ${planes.length} planes`);
    fs.writeFileSync('planes.json', JSON.stringify(planes, null, 2));
    console.log('Planes data written to planes.json');
  } catch (error) {
    console.error('Error while fetching planes data:', error);
  }

  page.close();
});
