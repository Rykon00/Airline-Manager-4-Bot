# Tech Stack

## Core Technologies
- **Language**: TypeScript (strict mode enabled)
- **Runtime**: Node.js LTS
- **Test Framework**: Playwright (@playwright/test v1.52.0)
- **Browser Automation**: Playwright with Chromium

## Dependencies
### Production
- `dotenv` (v16.4.5) - Environment variable management

### Development
- `@playwright/test` (v1.52.0) - E2E testing framework
- `@types/node` (v20.17.57) - TypeScript type definitions

## Configuration Files
- `tsconfig.json` - TypeScript compiler configuration (ES2016 target, CommonJS modules, strict mode)
- `playwright.config.ts` - Playwright test configuration
- `.env` - Local environment variables (not committed)
- `package.json` - Node.js project configuration

## Target Environment
- **Compiler Target**: ES2016
- **Module System**: CommonJS
- **Type Libraries**: ES2021 + DOM
- **Type Checking**: Strict mode enabled

## Build & Runtime
- No build step required (TypeScript executed via ts-node/Playwright)
- Direct test execution with Playwright runner
