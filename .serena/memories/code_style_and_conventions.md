# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled (all strict type checking options)
- **Target**: ES2016
- **Module System**: CommonJS
- **Type Checking**: Full type annotations required

## Naming Conventions

### Classes
- **Pattern**: PascalCase with descriptive suffixes
- **Suffix Convention**: `Utils` for utility classes
- **Examples**: 
  - `GeneralUtils`
  - `FuelUtils`
  - `PriceAnalyticsUtils`
  - `FetchPlanesUtils`

### Files
- **Pattern**: `##_descriptiveName.utils.ts`
- **Numbering**: Leading numbers indicate execution order (00-05)
- **Examples**:
  - `00_general.utils.ts` (first to run)
  - `01_fuel.utils.ts`
  - `05_priceAnalytics.utils.ts`

### Interfaces and Types
- **Pattern**: PascalCase descriptive names
- **Export**: Exported when used across files
- **Examples**:
  - `PlaneInfo`
  - `ChartDataPoint`
  - `PriceStatistics`
  - `TimeslotEntry`
  - `FlightHistory`

### Properties and Methods
- **Pattern**: camelCase
- **Access Modifiers**: `private` for internal state/methods, `public` (implicit) for API
- **Examples**:
  - `maxFuelPrice` (property)
  - `buyFuel()` (method)
  - `generatePriceReport()` (method)

## Class Structure Pattern
```typescript
export class SomeUtils {
    // Properties (public first, then private)
    page: Page;
    maxTry: number;
    private historyFilePath: string;
    
    // Constructor
    constructor(page: Page, config: ConfigType) {
        // initialization
    }
    
    // Public methods
    async publicMethod(): Promise<void> {
        // implementation
    }
    
    // Private methods
    private helperMethod(): ReturnType {
        // implementation
    }
}
```

## Documentation Style
- **JSDoc**: Used for complex classes and methods
- **Inline Comments**: Explanatory comments for complex logic
- **Example**: PriceAnalyticsUtils has comprehensive class-level documentation

## Type Definitions
- **Explicit Types**: Properties explicitly typed
- **Interface over Type**: Prefer `interface` for object shapes
- **Return Types**: Methods include explicit return type annotations

## Error Handling
- Try-catch blocks for external operations (file I/O, browser interactions)
- Graceful fallbacks for missing data
- Console logging for debugging and status updates
