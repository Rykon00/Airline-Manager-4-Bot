# Airline Manager 4 Bot - Entwicklungsdokumentation

## Projektübersicht

Dies ist ein automatisierter Bot für das Browserspiel "Airline Manager 4", entwickelt mit Playwright und TypeScript. Der Bot wird über GitHub Actions stündlich ausgeführt und optimiert Spieloperationen automatisch.

**Technologie-Stack:**
- Playwright für Browser-Automatisierung
- TypeScript für typsichere Entwicklung
- GitHub Actions für zeitgesteuerte Ausführung
- dotenv für Konfigurationsverwaltung

---

## Projektstruktur

```
├── tests/                     # Playwright-Testdateien (Hauptlogik)
│   ├── airlineManager.spec.ts # Hauptbot-Workflow
│   └── fetchPlanes.spec.ts    # Flugzeugdaten-Sammlung
├── utils/                     # Wiederverwendbare Utility-Module
│   ├── 00_general.utils.ts    # Login, Sleep, allg. Funktionen
│   ├── 01_fuel.utils.ts       # Treibstoff- & CO2-Kauf
│   ├── 02_campaign.utils.ts   # Kampagnen-Management
│   ├── 03_maintenance.utils.ts # Wartung & Reparaturen
│   ├── 04_fleet.utils.ts      # Flotten-Operations
│   └── fleet/                 # Sub-Module für Fleet-Utils
├── .github/workflows/         # GitHub Actions Workflows
├── planes.json                # Flugzeugdaten (dynamisch)
└── cookies.json               # Session-Cookies (lokal)
```

---

## Aktuell implementierte Features

### ✅ Core-Funktionalität
1. **Authentifizierung**: Automatischer Login mit gespeicherten Credentials
2. **Treibstoff-Management**: Kauf von Fuel & CO2 bei günstigen Preisen
3. **Kampagnen**: Auto-Start von Eco-Friendly & Airline Reputation Kampagnen
4. **Wartung**: Automatische Reparaturen und A-Checks
5. **Flottensteuerung**: Abflug aller bereiten Flugzeuge

---

## Entwicklungsziele & Erweiterungsrichtungen

### 🎯 Priorität 1: Stabilität & Robustheit
- [ ] **Error Handling verbessern**: Einheitliche Try-Catch-Blöcke in allen Utils
- [ ] **Logging-System**: Strukturiertes Logging mit Zeitstempeln
- [ ] **Retry-Mechanismen**: Automatische Wiederholungen bei Netzwerkfehlern
- [ ] **Health Checks**: Validierung vor kritischen Operationen

### 🎯 Priorität 2: Intelligente Entscheidungen
- [ ] **Preis-Historie**: Tracking von Fuel/CO2-Preisen über Zeit
- [ ] **Optimierte Kaufstrategie**: Machine Learning für besten Kaufzeitpunkt
- [ ] **Route-Optimierung**: Automatische Routenplanung basierend auf Profit
- [ ] **Flottenmanagement**: Intelligente Flugzeugzuweisung zu Routen

### 🎯 Priorität 3: Neue Features
- [ ] **Hub-Management**: Automatische Hub-Erweiterungen
- [ ] **Marketing-Automation**: Dynamische Preisanpassungen
- [ ] **Finanz-Tracking**: Überwachung von Einnahmen/Ausgaben
- [ ] **Konkurrenz-Analyse**: Tracking anderer Airlines

### 🎯 Priorität 4: Entwickler-Experience
- [ ] **Unit Tests**: Testabdeckung für alle Utils
- [ ] **CI/CD Pipeline**: Automatische Tests vor Deployment
- [ ] **Dokumentation**: JSDoc für alle öffentlichen Methoden
- [ ] **Type Safety**: Strikte TypeScript-Konfiguration

---

## Code-Standards & Best Practices

### ⚙️ TypeScript Guidelines

```typescript
// ✅ RICHTIG: Explizite Typen, async/await, Error Handling
async function buyFuel(maxPrice: number): Promise<boolean> {
  try {
    const currentPrice = await this.getFuelPrice();
    if (currentPrice <= maxPrice) {
      await this.executePurchase();
      console.log(`✅ Fuel gekauft für ${currentPrice}`);
      return true;
    }
    console.log(`⏸️ Fuel zu teuer: ${currentPrice} > ${maxPrice}`);
    return false;
  } catch (error) {
    console.error('❌ Fehler beim Fuel-Kauf:', error);
    return false;
  }
}

// ❌ FALSCH: Keine Typen, fehlendes Error Handling
async function buyFuel(maxPrice) {
  const price = await this.getFuelPrice();
  if (price <= maxPrice) {
    await this.executePurchase();
  }
}
```

### 📏 Namenskonventionen
- **Klassen**: `PascalCase` (z.B. `FuelUtils`, `MaintenanceUtils`)
- **Methoden**: `camelCase` (z.B. `buyFuel`, `checkPlanes`)
- **Konstanten**: `UPPER_SNAKE_CASE` (z.B. `MAX_FUEL_PRICE`)
- **Private Methoden**: `_camelCase` (z.B. `_calculateOptimalPrice`)

### 🔧 Playwright Best Practices

```typescript
// ✅ RICHTIG: Wartbare Selektoren mit getByRole/getByText
await page.getByRole('button', { name: 'Kaufen' }).click();
await page.getByText('Treibstoff kaufen').click();

// ❌ FALSCH: Fragile CSS/XPath-Selektoren
await page.locator('#btn-123 > div > span').click();
```

### 🛡️ Error Handling Pattern

```typescript
// Standard Error Handling Template für alle Utils
try {
  // Hauptlogik
  console.log('🔄 Starte Operation...');
  await operation();
  console.log('✅ Operation erfolgreich');
} catch (error) {
  console.error('❌ Fehler bei Operation:', error);
  throw new Error(`Operation fehlgeschlagen: ${error.message}`);
}
```

---

## Handlungsvorgaben für Claude Code

### 🚨 KRITISCHE REGELN (NIEMALS BRECHEN!)

1. **KEINE Breaking Changes an bestehenden Utils**
   - Bestehende Methoden-Signaturen NICHT ändern
   - Neue Features als NEUE Methoden hinzufügen
   - Alte Methoden ggf. als `@deprecated` markieren

2. **IMMER Error Handling implementieren**
   - Jede async-Funktion MUSS try-catch haben
   - Fehler MÜSSEN geloggt werden
   - Bei kritischen Fehlern: Workflow MUSS abbrechen

3. **KEINE Hardcoded Credentials**
   - Credentials NUR über `process.env` laden
   - Sensible Daten NIEMALS in Code committen
   - `.env`-Datei MUSS in `.gitignore` sein

4. **Playwright Timeouts beachten**
   - Standard-Timeout: 30 Sekunden
   - Bei langsamen Operationen: Explizite Timeouts setzen
   - `test.setTimeout()` MUSS am Anfang jedes Tests stehen

### 📝 Entwicklungsworkflow

#### Beim Hinzufügen neuer Features:

1. **Analyse**: Verstehe die Spiellogik vollständig
2. **Planung**: Welche Utils sind betroffen?
3. **Implementation**: 
   - Neue Utils in passende Datei (oder neue erstellen)
   - Tests in `tests/` anpassen
   - Error Handling von Anfang an einbauen
4. **Testing**: Lokale Ausführung mit `npx playwright test`
5. **Dokumentation**: JSDoc-Kommentare hinzufügen

#### Beim Refactoring:

1. **Rückwärtskompatibilität prüfen**: Nutzt existierender Code diese Methode?
2. **Tests aktualisieren**: Alle betroffenen Tests anpassen
3. **Deprecation-Strategie**: Alte Methoden mit `@deprecated` markieren
4. **Migration Guide**: Wenn nötig, Upgrade-Anleitung schreiben

### 🎯 Feature-Request Handling

**Wenn der User ein neues Feature anfragt:**

1. ✅ **ZUERST FRAGEN**:
   ```
   "Ich verstehe, du möchtest [Feature] hinzufügen. 
   Bevor ich implementiere:
   - Soll dieses Feature sofort oder nur bei bestimmten Bedingungen laufen?
   - Welche Priorität hat es (soll es den Workflow blockieren bei Fehler)?
   - Gibt es Preis-Limits oder andere Parameter?"
   ```

2. ✅ **DANN PLANEN**:
   - Welche Utils-Datei ist am besten geeignet?
   - Brauchen wir neue Umgebungsvariablen?
   - Welche Selektoren müssen wir finden?

3. ✅ **IMPLEMENTIERUNG**:
   - Feature schrittweise entwickeln
   - Nach jedem Schritt Rückfrage: "Soll ich fortfahren?"
   - Code-Snippets zur Überprüfung zeigen

4. ✅ **TESTING-HINWEISE**:
   - Lokales Testing mit `npx playwright test --headed`
   - Auf Timing-Probleme hinweisen
   - Empfohlene Testszenarien auflisten

### 🔍 Code-Review Checkliste

Vor jedem Commit prüfen:
- [ ] TypeScript-Fehler behoben? (`npx tsc --noEmit`)
- [ ] Console.logs mit aussagekräftigen Emojis? (✅❌🔄⏸️)
- [ ] Error Handling implementiert?
- [ ] Selektoren wartbar (getByRole statt CSS)?
- [ ] Kommentare für komplexe Logik?
- [ ] Secrets/Credentials NICHT hardcoded?

---

## Umgebungsvariablen

**Required:**
- `EMAIL`: Airline Manager 4 Login
- `PASSWORD`: Airline Manager 4 Passwort

**Optional:**
- `MAX_FUEL_PRICE`: Maximum Fuel-Preis (Default: 550)
- `MAX_CO2_PRICE`: Maximum CO2-Preis (Default: 120)

**Neue Variablen hinzufügen:**
1. In GitHub: Settings > Secrets and variables > Actions
2. In Code: `const value = process.env.VARIABLE || 'default'`
3. In CLAUDE.md dokumentieren!

---

## Debugging & Troubleshooting

### Lokale Ausführung
```bash
# Mit Browser-UI (für Debugging)
npx playwright test --headed

# Einzelner Test
npx playwright test airlineManager.spec.ts

# Mit Debug-Modus
PWDEBUG=1 npx playwright test
```

### Häufige Probleme

**Problem: "Element nicht gefunden"**
- Lösung: `await page.waitForSelector()` vor Click verwenden
- Ursache: Seite noch nicht vollständig geladen

**Problem: "Timeout exceeded"**
- Lösung: `test.setTimeout()` erhöhen oder `page.waitForLoadState('networkidle')`
- Ursache: Langsame Netzwerkverbindung oder Spielserver

**Problem: "Login fehlgeschlagen"**
- Lösung: Credentials in GitHub Secrets prüfen
- Ursache: Falsche oder abgelaufene Credentials

---

## Kommunikationsrichtlinien

### Bei Codeänderungen:
- Immer erklären WAS und WARUM geändert wird
- Breaking Changes FETT markieren
- Alternative Lösungen anbieten bei komplexen Problemen

### Bei Fehlern:
- Fehlermeldung vollständig ausgeben
- Mögliche Ursachen auflisten
- Schritt-für-Schritt Lösungsweg vorschlagen

### Bei neuen Features:
- User-Anforderungen bestätigen
- Implementation-Plan skizzieren
- Auf Abhängigkeiten und Risiken hinweisen

---

## Version & Changelog

**Aktuelle Version**: 1.0.0

### Geplante Updates:
- v1.1.0: Intelligentes Fuel-Preis-Tracking
- v1.2.0: Route-Optimierung
- v2.0.0: Machine Learning Integration

---

**Letzte Aktualisierung**: 2025-10-28
**Maintained by**: Claude Code Assistant
