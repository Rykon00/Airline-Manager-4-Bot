import { Page } from "@playwright/test";
import { GeneralUtils } from "./00_general.utils";

export class MaintenanceUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }

    public async repairPlanes() {
        console.log('Starting repairPlanes method...');
        await this.page.getByRole('button', { name: ' Plan' }).click();
        console.log('Clicked on Plan button.');
        await this.page.getByRole('button', { name: ' Bulk repair' }).click();
        console.log('Clicked on Bulk repair button.');
        await this.page.locator('#repairPct').selectOption('60');
        console.log('Selected repair percentage to 60%.');
        await GeneralUtils.sleep(1000);
        const noPlaneExists = await this.page.getByText('There are no aircraft worn to').isVisible();
        if(!noPlaneExists) {
            console.log('Planes found for repair. Proceeding with bulk repair.');
            await this.page.getByRole('button', { name: 'Plan bulk repair' }).click();
        } else {
            console.log('No planes require repair.');
        }
        console.log('Completed repairPlanes method.');
    }

    public async checkPlanes() {
        console.log('Starting checkPlanes method...');
        await this.page.getByRole('button', { name: ' Plan' }).click();
        console.log('Clicked on Plan button.');
        await this.page.getByRole('button', { name: ' Bulk check' }).click();
        console.log('Clicked on Bulk check button.');

        await GeneralUtils.sleep(2000);
        let clicked = false;

        const dangerChecksExits = await this.page.locator('.bg-white > .text-danger').first().isVisible();
        if(dangerChecksExits) {
            console.log('Danger checks exist. Clicking on planes with danger text.');
            const allCheckHoursDanger = await this.page.locator('.bg-white > .text-danger');
            let count = await allCheckHoursDanger.count();        
            for(let i = 0; i < count; i++) {
                const element = await allCheckHoursDanger.first();

                await element.click();
                clicked = true;

                console.log(`Clicked on danger check element ${i + 1} of ${count}.`);
                await GeneralUtils.sleep(500);
            }
        } else {
            console.log('No danger checks found.');
        }

        if(clicked) {
            console.log('Planning bulk check for clicked planes.');
            await this.page.getByRole('button', { name: 'Plan bulk check' }).click();
        }
        console.log('Completed checkPlanes method.');
    }
}