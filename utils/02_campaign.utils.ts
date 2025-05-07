import { Page } from '@playwright/test';
import { Logger } from './logger';
import { GeneralUtils } from './00_general.utils';

export class CampaignUtils {
  private page: Page;
  private logger: Logger;

  constructor(page: Page) {
    this.page = page;
    this.logger = Logger.getInstance();
  }

  /**
   * Checks active campaigns and logs their remaining time
   * @returns true if an active eco-friendly campaign exists, false otherwise
   */
  async checkActiveCampaigns(): Promise<boolean> {
    this.logger.info('Checking active marketing campaigns...');
    let hasActiveEcoFriendlyCampaign = false;

    try {
      // Navigate to Marketing tab first using the same approach as in createCampaign
      this.logger.info('Navigating to MARKETING tab...');
      await this.navigateToMarketingTab();
      
      // Look for active campaigns
      const activeCampaignRows = this.page.locator('table.table tbody tr');
      const count = await activeCampaignRows.count();
      
      if (count === 0) {
        this.logger.info('No active marketing campaigns found.');
        return false;
      }

      this.logger.info(`Found ${count} active marketing campaign(s):`);
      
      // Process each active campaign
      let validCampaignsFound = false;
      for (let i = 0; i < count; i++) {
        const row = activeCampaignRows.nth(i);
        
        // Extract campaign type, status and time remaining
        const campaignType = await row.locator('td').nth(0).innerText();
        const remainingTime = await row.locator('td').nth(1).innerText();
        
        // Only log campaigns that have valid time formats (like XX:XX:XX)
        const isValidTimeFormat = /\d{2}:\d{2}:\d{2}/.test(remainingTime);
        
        if (isValidTimeFormat) {
          // Log the campaign details without the "Campaign X:" prefix
          this.logger.info(`${campaignType} - Remaining: ${remainingTime}`);
          validCampaignsFound = true;
        }
        
        // Check if it's an eco-friendly campaign (using case-insensitive check)
        if (campaignType.toLowerCase().includes('eco') && 
            campaignType.toLowerCase().includes('friendly')) {
          hasActiveEcoFriendlyCampaign = true;
          this.logger.info('Active eco-friendly campaign detected.');
        }
      }
      
      if (!validCampaignsFound) {
        this.logger.info('No campaigns with valid time format found.');
      }
      
      return hasActiveEcoFriendlyCampaign;
    } catch (error) {
      this.logger.error(`Error checking active campaigns: ${error}`);
      return false; // Assume no active eco-friendly campaign in case of error
    }
  }

  /**
   * Helper method to navigate to MARKETING tab
   */
  private async navigateToMarketingTab(): Promise<void> {
    try {
      // First try by tab role with name
      const marketingTab = this.page.getByRole('tab', { name: 'MARKETING', exact: true });
      if (await marketingTab.isVisible({ timeout: 5000 })) {
        this.logger.info('Found MARKETING tab by role');
        await marketingTab.click();
      } else {
        // Try using a more specific selector - look for nav or tab links
        const marketingTabAlt = this.page.locator('ul.nav-tabs a', { hasText: 'MARKETING' });
        if (await marketingTabAlt.isVisible({ timeout: 5000 })) {
          this.logger.info('Found MARKETING tab by nav-tabs selector');
          await marketingTabAlt.click();
        } else {
          // Last resort - try to find any clickable element containing the text
          this.logger.info('Trying to find MARKETING tab by generic text content');
          await this.page.locator('a, button', { hasText: /MARKETING/i }).first().click();
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to click MARKETING tab with standard selectors: ${err}`);
      // Try a last resort selector - looking for any element with MARKETING text
      await this.page.locator('text=MARKETING').click();
    }
    
    await GeneralUtils.sleep(2000);
  }

  /**
   * Creates a marketing campaign with focus on eco-friendly options
   * First checks for active campaigns and only creates a new one if needed
   */
  async createCampaign(): Promise<void> {
    this.logger.info('Starting marketing campaign operations...');

    try {
      // First check if there are any active eco-friendly campaigns
      const hasActiveEcoFriendly = await this.checkActiveCampaigns();
      
      if (hasActiveEcoFriendly) {
        this.logger.info('Eco-friendly campaign already active. No need to create a new one.');
        return;
      }
      
      this.logger.info('No active eco-friendly campaign found. Creating new campaign...');
      
      // Look for New campaign link
      try {
        this.logger.info('Looking for New campaign link...');
        // Try different approaches to find the New campaign link
        let newCampaignLinkFound = false;
        
        // First approach
        try {
          const newCampaignLink = this.page.getByRole('link', { name: 'New campaign' });
          if (await newCampaignLink.isVisible({ timeout: 5000 })) {
            await newCampaignLink.click();
            newCampaignLinkFound = true;
          }
        } catch (err) {
          this.logger.warn(`Could not find New campaign link by role: ${err}`);
        }
        
        // Second approach if first failed
        if (!newCampaignLinkFound) {
          try {
            const altLink = this.page.locator('a:has-text("New campaign")').first();
            if (await altLink.isVisible({ timeout: 5000 })) {
              await altLink.click();
              newCampaignLinkFound = true;
            }
          } catch (err) {
            this.logger.warn(`Could not find New campaign link by text selector: ${err}`);
          }
        }
        
        // Third approach if previous failed
        if (!newCampaignLinkFound) {
          // Look for any button or link that might be used to create a new campaign
          const anyNewButton = this.page.locator('a:has-text("New"), button:has-text("New")').first();
          if (await anyNewButton.isVisible({ timeout: 5000 })) {
            await anyNewButton.click();
            newCampaignLinkFound = true;
          } else {
            throw new Error('Could not find any New campaign link or button');
          }
        }
        
        await GeneralUtils.sleep(2000);
        
        // Select eco-friendly campaign
        this.logger.info('Selecting Eco-friendly campaign option...');
        await this.page.getByText('Eco-friendly').click();
        await GeneralUtils.sleep(1000);

        // Click on create button
        this.logger.info('Creating campaign...');
        await this.page.getByRole('button', { name: 'Create' }).click();
        await GeneralUtils.sleep(1000);

        this.logger.info('Marketing campaign created successfully');
        
        // Check active campaigns again to verify and log the new campaign
        await this.checkActiveCampaigns();
      } catch (err) {
        this.logger.error(`Error creating new campaign: ${err}`);
        throw err;
      }
    } catch (error) {
      this.logger.error(`Error in campaign operations: ${error}`);
      throw error;
    }
  }
}