import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/00_general.utils';
import { FetchPlanesUtils } from '../utils/fleet/fetchPlanes.utils';
import * as fs from 'fs';

require('dotenv').config();

test('Fetch All Planes', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes timeout for this operation

  // Initialize utilities
  const generalUtils = new GeneralUtils(page);
  const fetchPlanesUtils = new FetchPlanesUtils(page);

  // Login to the system
  await generalUtils.login(page);
  console.log('Successfully logged in');

  // Fetch all planes and write to JSON
  try {
    console.log('Starting to fetch all planes...');
    const planes = await fetchPlanesUtils.getAllPlanes();
    console.log(`Successfully fetched ${planes.length} planes`);
    
    // Write data to JSON file
    fs.writeFileSync('planes.json', JSON.stringify(planes, null, 2));
    console.log('Planes data written to planes.json');
      // fs.writeFileSync('planes.json', JSON.stringify(planes, null, 2));
    // console.log('Planes data written to planes.json');
    
    // Optional: Write timestamped version for history
    // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // const historyFilename = `planes_${timestamp}.json`;
    // fs.writeFileSync(historyFilename, JSON.stringify(planes, null, 2));
    // console.log(`Historical data written to ${historyFilename}`);
  } catch (error) {
    console.error('Error while fetching planes data:', error);
    throw error; // Re-throw to fail the test
  }

  // Close the page
  await page.close();
});