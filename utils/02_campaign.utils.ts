import { Page } from "@playwright/test";
import { GeneralUtils } from "./00_general.utils";

export class CampaignUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }    public async checkAndCreateEcoFriendlyCampaign() {
        console.log('Checking and Creating Eco-Friendly Campaign if needed...')

        await this.page.getByRole('button', { name: ' Marketing' }).click();

        await GeneralUtils.sleep(1000);

        // First check if there's already an active eco-friendly campaign
        const isActiveEcoFriendlyCampaign = await this.page.getByRole('cell', { name: ' Eco friendly' }).isVisible();
        
        if(isActiveEcoFriendlyCampaign) {
            console.log('Eco-Friendly Campaign is already active, no need to create a new one.');
        } else {
            // If no active campaign, create a new one
            await this.page.getByRole('button', { name: ' New campaign' }).click();
            await this.page.getByRole('cell', { name: 'Eco-friendly Increases' }).click();
            await this.page.getByRole('button', { name: '$' }).click();

            console.log("Eco-Friendly Campaign created successfully!");
        }

        console.log('Eco-Friendly Campaign check completed!');
    }
}