import { Page } from "@playwright/test";
import { GeneralUtils } from "./00_general.utils";
import { Logger } from "./logger";

export class MaintenanceUtils {
    page : Page;
    private logger: Logger;

    constructor(page : Page) {
        this.page = page;
        this.logger = Logger.getInstance();
    }

    public async repairPlanes() {
        this.logger.info('Starting aircraft repair process...');
        try {
            // Use ID or more specific selector to identify the Plan button
            await this.page.locator('#popBtn2').click();
            // Alternative methods if ID is not reliable:
            // await this.page.getByRole('button', { name: ' Plan', exact: true }).first().click();
            // await this.page.locator('button.popMenuBtn:has-text(" Plan")').click();
            
            await GeneralUtils.sleep(1000);
            await this.page.getByRole('button', { name: ' Bulk repair' }).click();
            await this.page.locator('#repairPct').selectOption('60');
            await GeneralUtils.sleep(1000);
            
            const noPlaneExists = await this.page.getByText('There are no aircraft worn to').isVisible();
            if(!noPlaneExists) {
                await this.page.getByRole('button', { name: 'Plan bulk repair' }).click();
                this.logger.info('Aircraft scheduled for repair');
            } else {
                this.logger.info('No aircraft available for repair');
            }
        } catch (error) {
            this.logger.error(`Error during aircraft repair: ${error}`);
            throw error;
        }
    }

    public async checkPlanes() {
        this.logger.info('Starting aircraft inspection process...');
        try {
            // Use ID or more specific selector to identify the Plan button
            await this.page.locator('#popBtn2').click();
            // Alternative methods if ID is not reliable:
            // await this.page.getByRole('button', { name: ' Plan', exact: true }).first().click();
            // await this.page.locator('button.popMenuBtn:has-text(" Plan")').click();
            
            await GeneralUtils.sleep(1000);
            await this.page.getByRole('button', { name: ' Bulk check' }).click();

            await GeneralUtils.sleep(2000);
            let clicked = false;

            // Click only planes with danger text
            const dangerChecksExits = await this.page.locator('.bg-white > .text-danger').first().isVisible();
            if(dangerChecksExits) {
                const allCheckHoursDanger = await this.page.locator('.bg-white > .text-danger');
                let count = await allCheckHoursDanger.count();        
                for(let i = 0; i < count; i++) {
                    const element = await allCheckHoursDanger.first();

                    await element.click();
                    clicked = true;

                    await GeneralUtils.sleep(500);
                }
                
                this.logger.info(`${count} aircraft selected for inspection`);
            } else {
                this.logger.info('No aircraft need inspection');
            }

            if(clicked) {
                await this.page.getByRole('button', { name: 'Plan bulk check' }).click();
                this.logger.info('Aircraft inspections scheduled');
            }
        } catch (error) {
            this.logger.error(`Error during aircraft inspection: ${error}`);
            throw error;
        }
    }
}