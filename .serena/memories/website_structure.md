# AM4 Website Structure & Navigation

## Overview
AM4 (Airline Manager 4) ist eine browser-basierte SPA die AJAX nutzt.
**Website**: https://airlinemanager.com/

## Navigation zur Fleet
```typescript
await page.locator('#mapRoutes').getByRole('img').click();
await page.waitForSelector('div[id^="routeMainList"]');
```

## Fleet List Structure
**Row Selector**: `div[id^="routeMainList"]`
**FleetID**: `span[id^="acRegList"]` → ID Format: `acRegList105960065`
**Registration**: TextContent des FleetID-Spans
**Detail Link**: Erster `<a>` Tag in Row
**Pagination**: `.pagination-next` (20 Flugzeuge pro Seite)

## Detail View - VERIFIZIERTE STRUKTUR ✅
**Container**: `#detailsAction` (AJAX-Overlay, kein Modal)
**Trigger**: Click auf Detail-Link → `Ajax('fleet_details.php?id={FLEET_ID}','detailsAction')`
**Back Button**: `span.glyphicons-chevron-left`

### Aircraft Details - ECHTE HTML-Struktur
```html
<div class="col-6">
  <span class="s-text text-secondary">Aircraft</span><br>
  <span class="m-text">DC-9-10</span><br>
  <span class="s-text text-secondary">Delivered</span><br>
  <span class="m-text">6 months ago</span><br>
  <span class="s-text text-secondary">Hours to check</span><br>
  <span class="m-text">50</span><br>
  <span class="s-text text-secondary">Range</span><br>
  <span class="m-text">2,036km</span><br>
</div>
<div class="col-6">
  <span class="s-text text-secondary">Flight hours/Cycles</span><br>
  <span class="m-text">3625 / 719</span><br>
  <span class="s-text text-secondary">Min runway</span><br>
  <span class="m-text">2,000ft</span><br>
  <span class="s-text text-secondary">Wear</span><br>
  <span class="m-text">30.41%</span><br>
  <span class="s-text text-secondary">Type</span><br>
  <span class="m-text">Pax</span><br>
</div>
```

**WICHTIG:**
- Labels: `span.s-text.text-secondary` (OHNE Doppelpunkt!)
- Werte: `span.m-text` (direkt nach `<br>`)
- NICHT in divs, sondern spans!
- Labels und Werte sind durch `<br>` getrennt

### Flight History - VERIFIZIERTE Struktur ✅
```html
<div id="flight-history">
  <div class="row bg-light m-text p-1 border">
    <div class="col-3">7 days ago<br><span class="s-text">ELQ-FRA</span></div>
    <div class="col-3">L-0008<br><span class="s-text">49,934 Quotas</span></div>
    <div class="col-3"><b>Y</b>25 <b>J</b>12 <b>F</b>8<br><span class="s-text">52,095 Lbs</span></div>
    <div class="col-3 text-right text-success"><b>$105,176</b></div>
  </div>
  <!-- Weitere Flüge ... -->
</div>
```

## PROBLEM: Detail-Extraktion schlägt fehl

**Symptom**:
```json
{
  "aircraftType": null,
  "delivered": null,
  "hoursToCheck": null,
  "range": null,
  "flightHistory": [...] // ✅ funktioniert!
}
```

**Root Cause**:
`getTextFromDivLabel(container, 'Aircraft:')` findet Daten nicht.
Beweis: Flight History funktioniert (selber Container!).
Problem: Label-basierte Extraktion ist zu generisch.

## LÖSUNG: Funktionierende Selektoren ✅

### Methode 1: Label + Nächster span.m-text
```typescript
async function extractField(container: Locator, labelText: string): Promise<string | null> {
  try {
    // Finde Label-Span
    const labelSpan = container
      .locator(`span.s-text.text-secondary:has-text("${labelText}")`)
      .first();
    
    if (await labelSpan.count() === 0) return null;
    
    // Hole Parent div
    const parentDiv = labelSpan.locator('..');
    
    // Alle m-text spans im parent
    const valueSpans = parentDiv.locator('span.m-text');
    
    // Finde Index vom Label
    const allLabels = parentDiv.locator('span.s-text.text-secondary');
    const labelCount = await allLabels.count();
    
    for (let i = 0; i < labelCount; i++) {
      const text = await allLabels.nth(i).textContent();
      if (text?.trim() === labelText) {
        // Wert ist an selber Position in m-text spans
        if (await valueSpans.nth(i).count() > 0) {
          return await valueSpans.nth(i).textContent();
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Usage:
const aircraftType = await extractField(detailContainer, 'Aircraft');
const delivered = await extractField(detailContainer, 'Delivered');
const hoursToCheck = await extractField(detailContainer, 'Hours to check');
const range = await extractField(detailContainer, 'Range');
const flightHoursCycles = await extractField(detailContainer, 'Flight hours/Cycles');
const minRunway = await extractField(detailContainer, 'Min runway');
const wear = await extractField(detailContainer, 'Wear');
```

### Methode 2: XPath (Alternative)
```typescript
const aircraftType = await detailContainer
  .locator('xpath=//span[contains(@class,"text-secondary") and text()="Aircraft"]/following-sibling::br/following-sibling::span[@class="m-text"][1]')
  .textContent();
```

## Debug-Strategie

1. **Screenshot beim Extrahieren**:
```typescript
await page.screenshot({ path: `debug-plane-${fleetId}.png` });
const html = await detailContainer.innerHTML();
console.log('Container HTML:', html.substring(0, 500));
```

2. **Count Labels**:
```typescript
const labelCount = await detailContainer
  .locator('div:has-text("Aircraft")')
  .count();
console.log(`Found ${labelCount} "Aircraft" labels`);
```

3. **Playwright Debug Mode**:
```bash
PWDEBUG=1 npx playwright test tests/fetchPlanes.spec.ts
```
