import { Page } from "@playwright/test";
import { GeneralUtils } from "./00_general.utils";

export class CampaignUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }    
    
    public async checkAndCreateEcoFriendlyCampaign() {
        console.log('Checking and Creating Eco-Friendly Campaign if needed...');

        try {
            await this.page.getByRole('button', { name: ' Marketing' }).click();
            await GeneralUtils.sleep(1000);

            // Check if there's already an active eco-friendly campaign
            const isActiveEcoFriendlyCampaign = await this.page.getByRole('cell', { name: ' Eco friendly' }).isVisible();

            if (isActiveEcoFriendlyCampaign) {
                console.log('Eco-Friendly Campaign is already active, no need to create a new one.');
                return;
            }

            // Check if enough funds are available
            const fundsAvailable = await this.page.getByText('Available funds:').locator('span').innerText();
            const funds = parseFloat(fundsAvailable.replace(/[^0-9.-]+/g, ''));

            if (isNaN(funds)) {
                console.log('Error: Unable to parse available funds. Skipping campaign creation.');
                return;
            }

            if (funds < 1000) { // Assuming 1000 is the minimum required amount
                console.log(`Not enough funds to create an Eco-Friendly Campaign. Available: ${funds}, Required: 1000. Skipping...`);
                return;
            }

            // If no active campaign and enough funds, create a new one
            await this.page.getByRole('button', { name: ' New campaign' }).click();
            await this.page.getByRole('cell', { name: 'Eco-friendly Increases' }).click();
            await this.page.getByRole('button', { name: '$' }).click();

            console.log('Eco-Friendly Campaign created successfully!');
        } catch (error) {
            console.log('An error occurred while checking or creating the Eco-Friendly Campaign:', (error as Error).message);
        }

        console.log('Eco-Friendly Campaign check completed!');
    }    /**
     * Checks if an airline reputation campaign is already active,
     * and creates one if needed. This function should be called
     * after the eco-friendly campaign check.
     */
    public async checkAndCreateAirlineReputationCampaign() {
        console.log('Checking and Creating Airline Reputation Campaign if needed...');
        
        // Ensure we are on the Marketing tab
        const isMarketingTabVisible = await this.page.getByRole('button', { name: ' Marketing' }).isVisible();
        if (isMarketingTabVisible) {
            await this.page.getByRole('button', { name: ' Marketing' }).click();
            await GeneralUtils.sleep(1500);
        }
        
        // Check for active campaigns
        console.log('Looking for active Airline Reputation campaign...');
        
        // Look for active campaigns with a timer (which indicates they're running)
        // We specifically look for a row with "Airline reputation" and a timer, not campaign selection rows or headers
        let hasActiveAirlineReputationCampaign = false;
        
        try {
            // Find any row that contains the text "Airline reputation" AND shows a timer (XX:XX:XX format)
            // Since we only want to check active campaigns, we need to detect if there are any rows with timers
            const airlineRepRows = await this.page.locator('tr')
                .filter({ hasText: /Airline reputation/i })
                .filter({ hasText: /\d{2}:\d{2}:\d{2}/ })
                .count();
            
            hasActiveAirlineReputationCampaign = airlineRepRows > 0;
            console.log(`Found ${airlineRepRows} active Airline Reputation campaigns with timers`);
        } catch (error) {
            console.log('Error checking for active Airline Reputation campaigns:', (error as any).message);
            hasActiveAirlineReputationCampaign = false;
        }
        
        if(hasActiveAirlineReputationCampaign) {
            console.log('Airline Reputation Campaign is already active, no need to create a new one.');
        } else {
            console.log('No active Airline Reputation Campaign found. Creating a new one...');
            try {
                // First click on the "New campaign" button to open the campaign selection menu
                console.log('Clicking on New Campaign button...');
                await this.page.getByRole('button', { name: ' New campaign' }).click();
                await GeneralUtils.sleep(2000);
                
                // Select the "Increase airline reputation" option
                console.log('Selecting Airline Reputation campaign type...');
                // Use cell role with exact text to select the campaign type
                await this.page.getByRole('cell', { name: 'Increase airline reputation' }).click();
                await GeneralUtils.sleep(2000);
                
                // Handle the dropdown for selecting campaign duration if it appears
                console.log('Checking for hours dropdown...');
                try {
                    const selectElement = await this.page.locator('select');
                    const isDropdownVisible = await selectElement.isVisible();
                      if (isDropdownVisible) {
                        console.log('Hours dropdown found. Setting to 24 Hours...');
                        await selectElement.selectOption('24 Hours');
                        await GeneralUtils.sleep(1500);
                    } else {
                        console.log('No hours dropdown visible, continuing...');
                    }
                } catch (error) {
                    console.log('Error with hours dropdown:', (error as Error).message);
                }
                
                // Directly target Campaign 4 row and the button within it
                console.log('Looking for Campaign 4 row...');
                try {
                    // Method 1: Try to find Campaign 4 row by its content
                    const campaign4Row = await this.page.getByRole('row', { name: /Campaign 4.*25.*35.*\$/ });
                    const isCampaign4Visible = await campaign4Row.isVisible();
                    
                    if (isCampaign4Visible) {
                        console.log('Campaign 4 row found. Clicking on it...');
                        await campaign4Row.click();
                        await GeneralUtils.sleep(1000);
                        
                        // Now find the red button with $ inside this row
                        console.log('Looking for the $ button in Campaign 4 row...');
                        const dollarButton = await campaign4Row.getByRole('button', { name: /\$/ });
                        
                        if (await dollarButton.isVisible()) {
                            console.log('Found $ button, clicking to purchase Campaign 4...');
                            await dollarButton.click();
                            await GeneralUtils.sleep(2000);
                            console.log('Successfully clicked on Campaign 4 purchase button');
                        } else {
                            // Fallback to finding all $ buttons and clicking the last one (highest priced)
                            console.log('$ button not found in Campaign 4 row, trying alternative approach...');
                            const allDollarButtons = await this.page.getByRole('button', { name: /\$/ }).all();
                            
                            if (allDollarButtons.length > 0) {
                                const lastButton = allDollarButtons[allDollarButtons.length - 1];
                                console.log(`Found ${allDollarButtons.length} $ buttons. Clicking the last one...`);
                                await lastButton.click();
                                await GeneralUtils.sleep(2000);
                                console.log('Successfully clicked on $ button (alternative method)');
                            } else {
                                console.log('ERROR: Could not find any $ buttons');
                            }
                        }
                    } else {
                        // Fallback: If we can't find Campaign 4 row specifically,
                        // try to find all rows with "CAMPAIGN" and use the last one (highest index)
                        console.log('Campaign 4 row not found directly. Using alternative method...');
                        const allCampaignRows = await this.page.locator('tr:has-text("CAMPAIGN")').all();
                        
                        if (allCampaignRows.length > 0) {
                            // Get the last row (should be Campaign 4 if there are 4 options)
                            const lastCampaignRow = allCampaignRows[allCampaignRows.length - 1];
                            console.log(`Found ${allCampaignRows.length} campaign rows. Selecting the last one...`);
                            await lastCampaignRow.click();
                            await GeneralUtils.sleep(1000);
                            
                            // Find all $ buttons and click the last one
                            const allButtons = await this.page.getByRole('button', { name: /\$/ }).all();
                            if (allButtons.length > 0) {
                                await allButtons[allButtons.length - 1].click();
                                await GeneralUtils.sleep(2000);
                                console.log('Clicked the highest priced button');
                            } else {
                                console.log('ERROR: No $ buttons found after selecting campaign row');
                            }
                        } else {
                            console.log('ERROR: No campaign rows found at all');
                        }
                    }
                } catch (error) {
                    console.log('Error selecting Campaign 4:', (error as Error).message);
                }
                
                console.log('Airline Reputation Campaign creation attempt completed');
            } catch (error) {
                console.log('Error creating Airline Reputation campaign:', (error as Error).message);
            }
        }
        
        console.log('Airline Reputation Campaign check completed!');
        await GeneralUtils.sleep(1000); // Give time for UI updates after campaign operation
    }
}