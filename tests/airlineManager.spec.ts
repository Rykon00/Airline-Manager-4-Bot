import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/00_general.utils';
import { FuelUtils } from '../utils/01_fuel.utils';
import { CampaignUtils } from '../utils/02_campaign.utils';
import { FleetUtils } from '../utils/04_fleet.utils';
import { MaintenanceUtils } from '../utils/03_maintenance.utils';
import { Logger } from '../utils/logger';

require('dotenv').config();

test('All Operations', async ({ page }) => {
  test.setTimeout(30000);
  const logger = Logger.getInstance();
  
  logger.info('=== Starting Airline Manager 4 Bot Operations ===');

  // Variable Initialization
  const fuelUtils = new FuelUtils(page);
  const generalUtils = new GeneralUtils(page);
  const campaignUtils = new CampaignUtils(page);
  const fleetUtils = new FleetUtils(page);
  const maintenanceUtils = new MaintenanceUtils(page);
  logger.info('Utility classes initialized');
  // End //

  // Login //
  logger.info('--- Starting login process... ---');
  await generalUtils.login(page);

  // Fuel Operations //
  logger.info('--- Starting fuel operations... ---');
  await page.locator('#mapMaint > img').first().click();
  await fuelUtils.buyFuel();

  await page.getByRole('button', { name: ' Co2' }).click();
  await GeneralUtils.sleep(1000);
  await fuelUtils.buyCo2();

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  logger.info('Fuel operations completed');
  // End //

  // Campaign Operations //
  logger.info('--- Starting marketing campaign operations... ---');
  await page.locator('div:nth-child(5) > #mapMaint > img').click();
  await campaignUtils.createCampaign();

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  await GeneralUtils.sleep(1000);
  logger.info('Marketing campaign operations completed');
  // End //

  // Repair Planes if needed //
  logger.info('--- Starting aircraft maintenance operations... ---');
  await page.locator('div:nth-child(4) > #mapMaint > img').click();
  
  await maintenanceUtils.checkPlanes();
  await GeneralUtils.sleep(1000);
  await maintenanceUtils.repairPlanes();

  await GeneralUtils.sleep(1000);

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  logger.info('Aircraft maintenance operations completed');
  // End //

  // Depart Planes Operations //
  logger.info('--- Starting aircraft departure operations... ---');
  await page.locator('#mapRoutes').getByRole('img').click();
  await GeneralUtils.sleep(2500);

  await fleetUtils.departPlanes();
  logger.info('Aircraft departure operations completed');
  // End //

  logger.info('=== All operations successfully completed ===');
  page.close();
});
