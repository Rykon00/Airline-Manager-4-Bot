import { Page } from "@playwright/test";
import { GeneralUtils } from "./00_general.utils";
import { Logger } from "./logger";

require('dotenv').config();

export class FleetUtils {
    page : Page;
    maxTry : number; // Added to prevent infinite loop in case of no fuel available
    private logger: Logger;

    constructor(page : Page) {
        this.page = page;
        this.maxTry = 8; // TODO: Find another way 
        this.logger = Logger.getInstance();
    }

    public async departPlanes() {
        let departAllVisible = await this.page.locator('#departAll').isVisible();
        this.logger.info('Checking for ready-to-depart aircraft...');

        let count = 0; 
        while(departAllVisible && count < this.maxTry) {
            this.logger.info('Starting departure for 20 or fewer aircraft...');

            let departAll = await this.page.locator('#departAll');
            
            await departAll.click();
            await GeneralUtils.sleep(1500);
            
            const cantDepartPlane = await this.page.getByText('×Unable to departSome A/C was').isVisible();
            if(cantDepartPlane) {
                this.logger.warn('Some aircraft could not depart');
                break;
            }

            departAllVisible = await this.page.locator('#departAll').isVisible();
            count++;
        
            this.logger.info(`Departure completed for ${count * 20} or fewer aircraft`);
        }
        
        if (count === 0) {
            this.logger.info('No aircraft available for departure');
        } else {
            this.logger.info(`Total of approximately ${count * 20} aircraft departed`);
        }
    }
}