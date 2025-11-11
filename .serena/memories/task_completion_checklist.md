# Task Completion Checklist

When a coding task is completed, ensure the following steps are performed:

## 1. Code Quality
- [ ] TypeScript strict mode compliance (no `any` types unless necessary)
- [ ] Proper type annotations on properties and methods
- [ ] Consistent naming conventions (see code_style_and_conventions.md)
- [ ] Error handling with try-catch where appropriate
- [ ] Console logging for important operations

## 2. Testing
```bash
# Run affected tests based on changes
npm run test:airline         # If changed general/fuel/campaign/maintenance/fleet utils
npm run test:planes          # If changed fetchPlanes utils
npm test                     # Run all tests if major changes
```

## 3. Local Validation
```bash
# Test with visible browser for manual verification
npm run test:airline:headed
# OR use the PowerShell script
.\scripts\run-local-workflow.ps1 --headed
```

## 4. File Organization
- [ ] Utils in correct directory (core in `utils/`, fleet-specific in `utils/fleet/`)
- [ ] Proper file naming (`##_descriptiveName.utils.ts` pattern)
- [ ] Exports properly declared for cross-file usage

## 5. Data Persistence Considerations
If changes affect data structures:
- [ ] Verify `data/price-history.json` format compatibility
- [ ] Verify `data/planes.json` format compatibility
- [ ] Check GitHub Actions artifact handling

## 6. Environment Variables
If new configuration needed:
- [ ] Add to `.env.example` (if exists)
- [ ] Document in README.md
- [ ] Add to GitHub Actions workflow (`.github/workflows/01_airlineManager.yml`)

## 7. Documentation
- [ ] Update README.md if user-facing features changed
- [ ] Add JSDoc comments for complex logic
- [ ] Update relevant memory files if architecture changes

## 8. No Linting/Formatting Tools
**Important**: This project does not use automated linting or formatting tools (no ESLint, Prettier, etc.)
- Manual code review for style consistency
- Follow existing code patterns in the file you're editing

## 9. Git Workflow
```bash
git status                           # Check changes
git add <files>                      # Stage changes
git commit -m "descriptive message"  # Commit
# Push to GitHub for Actions to run
```

## Quick Validation Command
```powershell
# Complete local test before committing
npm ci && npm run install:browsers && npm run test:airline
```
