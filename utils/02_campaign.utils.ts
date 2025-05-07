import { Page } from "@playwright/test";
import { GeneralUtils } from "./00_general.utils";
import { Logger } from "./logger";

export class CampaignUtils {
    page : Page;
    private logger: Logger;

    constructor(page : Page) {
        this.page = page;
        this.logger = Logger.getInstance();
    }

    /**
     * Reads the remaining time of active campaigns and logs them to console
     */
    private async readRemainingCampaignTimes(): Promise<boolean> {
        // First we need to click on the Marketing tab to see active campaigns
        await this.page.getByRole('button', { name: ' Marketing' }).click();
        await GeneralUtils.sleep(500);
        
        // Check if there are any active campaigns by looking for campaign items
        const airlineReputationElement = await this.page.locator('text=Airline reputation').first();
        const ecoFriendlyElement = await this.page.locator('text=Eco friendly').first();
        
        let hasActiveCampaigns = false;
        
        try {
            // Get campaign remaining times
            if (await airlineReputationElement.isVisible()) {
                hasActiveCampaigns = true;
                const airlineRepTime = await this.page.locator('text=Airline reputation').first().locator('xpath=..').locator('text=/\\d{2}:\\d{2}:\\d{2}/').innerText();
                this.logger.info(`Active airline reputation campaign: ${airlineRepTime} remaining`);
            }
            
            if (await ecoFriendlyElement.isVisible()) {
                hasActiveCampaigns = true;
                const ecoFriendlyTime = await this.page.locator('text=Eco friendly').first().locator('xpath=..').locator('text=/\\d{2}:\\d{2}:\\d{2}/').innerText();
                this.logger.info(`Active eco-friendly campaign: ${ecoFriendlyTime} remaining`);
            }
            
            if (hasActiveCampaigns) {
                this.logger.info('Found active campaigns with remaining time');
            } else {
                this.logger.info('No active campaigns found');
            }
        } catch (error) {
            this.logger.error(`Error reading campaign times: ${error}`);
            return false;
        }
        
        return hasActiveCampaigns;
    }

    public async createCampaign() {
        this.logger.info('Checking active campaigns status...');
        
        // First read remaining campaign times
        const hasActiveCampaigns = await this.readRemainingCampaignTimes();
        
        // If campaigns exist, we don't need to create a new one
        if (hasActiveCampaigns) {
            this.logger.info('Active campaigns found, not creating a new one');
            return;
        }
        
        this.logger.info('Creating eco-friendly campaign...');
        
        // At this point, we're already on the Marketing tab, so we don't need to navigate there again
        await this.page.getByRole('button', { name: ' Create a new marketing campaign' }).click();
        await this.page.getByRole('button', { name: 'Eco-friendly campaign' }).click();
        
        // Wait for the page to load
        await GeneralUtils.sleep(500);
        
        // Click create campaign button
        await this.page.getByRole('button', { name: 'Create campaign' }).click();

        this.logger.info('Eco-friendly campaign successfully created');
    }
}