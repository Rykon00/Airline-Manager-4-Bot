# Airline Manager 4 Bot - Documentation Index

This directory contains comprehensive documentation for the Airline Manager 4 Bot project. All documentation is stored in the `.serena/memories/` directory for AI assistant reference.

## Quick Reference

### For New Developers
1. Start with [project_overview.md](project_overview.md)
2. Read [tech_stack.md](tech_stack.md)
3. Follow [environment_setup.md](environment_setup.md)
4. Review [codebase_structure.md](codebase_structure.md)

### For Development
1. [architecture_patterns.md](architecture_patterns.md) - Design patterns and guidelines
2. [code_style_and_conventions.md](code_style_and_conventions.md) - Coding standards
3. [api_reference.md](api_reference.md) - Complete Utils API documentation
4. [data_structures.md](data_structures.md) - All interfaces and data models

### For Testing
1. [testing_guide.md](testing_guide.md) - Complete testing documentation
2. [suggested_commands.md](suggested_commands.md) - NPM scripts and CLI commands
3. [task_completion_checklist.md](task_completion_checklist.md) - Pre-commit checklist

### For Operations
1. [workflow_details.md](workflow_details.md) - GitHub Actions workflows explained
2. [features_implementation.md](features_implementation.md) - Feature details and config
3. [troubleshooting.md](troubleshooting.md) - Common issues and solutions

## Documentation Overview

### Project Understanding

#### [project_overview.md](project_overview.md)
High-level project description covering:
- Purpose and key features
- Execution context (GitHub Actions + local)
- Intelligent price analytics system
- Automated operations

#### [tech_stack.md](tech_stack.md)
Technology stack details:
- TypeScript, Node.js, Playwright
- Dependencies and versions
- Configuration files
- Build and runtime environment

#### [codebase_structure.md](codebase_structure.md)
File organization and directory layout:
- Root directory structure
- Utils organization (numbered execution order)
- Test files mapping
- Data files and their persistence

### Architecture & Design

#### [architecture_patterns.md](architecture_patterns.md)
Design principles and patterns:
- Utility class pattern with dependency injection
- Sequential execution order (00-05)
- Page object pattern
- Data persistence strategy
- Price analytics engine design
- Chart scraping system
- Two-tier fleet management
- Error handling and graceful degradation

#### [code_style_and_conventions.md](code_style_and_conventions.md)
Coding standards:
- TypeScript configuration (strict mode)
- Naming conventions (classes, files, interfaces)
- Class structure pattern
- Documentation style
- Type definitions approach

### API & Data

#### [api_reference.md](api_reference.md)
Complete API documentation for all Utils classes:
- `PriceAnalyticsUtils` - Intelligent price analysis
- `FuelUtils` - Fuel/CO2 purchasing
- `FleetUtils` - Fleet operations
- `FetchPlanesUtils` - Full fleet data collection
- `UpdatePlanesUtils` - Incremental updates
- `CampaignUtils` - Campaign management
- `MaintenanceUtils` - Maintenance operations
- `GeneralUtils` - Login and helpers

Each with:
- Constructor signatures
- Public/private methods
- Parameters and return types
- Usage examples
- Implementation notes

#### [data_structures.md](data_structures.md)
All interfaces and data models:
- `TimeslotEntry`, `PriceHistory`, `PriceStatistics`
- `FlightHistory`, `PlaneInfo`
- `StartedFlights`
- File locations and persistence
- Data quality scoring algorithm
- Data migration logic

### Testing & Development

#### [testing_guide.md](testing_guide.md)
Complete testing documentation:
- Test philosophy (E2E only)
- Playwright configuration
- Test files breakdown (3 test suites)
- Local testing setup
- Test output interpretation
- Debugging tools and techniques
- Performance benchmarks
- Best practices and common failures

#### [environment_setup.md](environment_setup.md)
Step-by-step setup guide:
- Prerequisites (Node.js, Git, etc.)
- Local development setup (5 steps)
- GitHub Actions setup (CI/CD)
- Project structure overview
- Environment variables reference
- Data directory setup
- IDE setup (VS Code)
- Platform-specific notes (Windows/Mac/Linux)
- Troubleshooting setup issues

#### [suggested_commands.md](suggested_commands.md)
Quick command reference:
- System commands (Windows)
- NPM scripts (test, install)
- PowerShell scripts
- Playwright commands
- Development workflow
- Environment setup

#### [task_completion_checklist.md](task_completion_checklist.md)
Pre-commit checklist:
- Code quality checks
- Testing commands
- Local validation
- File organization
- Data persistence considerations
- Documentation updates
- Git workflow

### Operations & Deployment

#### [workflow_details.md](workflow_details.md)
GitHub Actions workflows explained:
- Trigger schedules (cron, manual)
- Job configuration
- Execution flow (3 phases)
- Artifact management
- Browser caching
- Test execution details
- Environment variables creation
- Common issues with workflows

#### [features_implementation.md](features_implementation.md)
Feature details and implementation:
- Intelligent price analytics (algorithms, data flow)
- Chart scraping mechanism
- Fuel/CO2 purchasing logic
- Campaign management
- Maintenance operations
- Fleet operations (departures, tracking)
- Full fleet data collection (3 modes)
- Incremental fleet updates
- Feature dependencies
- Configuration points
- Extension opportunities
- Performance characteristics
- Reliability features

#### [troubleshooting.md](troubleshooting.md)
Comprehensive troubleshooting guide:
- Login issues
- Price analytics issues
- Fleet management issues
- GitHub Actions issues
- Data integrity issues
- Performance issues
- Selector issues (AM4 website changes)
- Development issues
- Debugging tools (local & CI)
- Data inspection commands
- Getting help

## Documentation Maintenance

### When to Update

**Add new documentation when**:
- Adding major features
- Changing architecture
- Introducing new patterns
- Adding new dependencies

**Update existing documentation when**:
- Modifying public APIs
- Changing data structures
- Updating workflows
- Fixing common issues

### Documentation Standards

- Use Markdown format (`.md`)
- Include code examples with syntax highlighting
- Add tables for comparisons
- Use bullet points for lists
- Include file paths with line numbers when referencing code
- Keep language clear and concise

## Quick Links

### Most Common Tasks

| Task | Documentation |
|------|---------------|
| Setup new development environment | [environment_setup.md](environment_setup.md) |
| Run tests locally | [testing_guide.md](testing_guide.md) → Local Testing Setup |
| Add new feature | [architecture_patterns.md](architecture_patterns.md) → Extension Points |
| Fix test failure | [troubleshooting.md](troubleshooting.md) → Common Issues |
| Configure GitHub Actions | [workflow_details.md](workflow_details.md) |
| Understand price analytics | [features_implementation.md](features_implementation.md) → Intelligent Price Analytics |
| Modify data structures | [data_structures.md](data_structures.md) |
| Check API usage | [api_reference.md](api_reference.md) |

### Documentation by Role

**Developer**:
1. [architecture_patterns.md](architecture_patterns.md)
2. [api_reference.md](api_reference.md)
3. [code_style_and_conventions.md](code_style_and_conventions.md)
4. [data_structures.md](data_structures.md)

**DevOps/CI**:
1. [workflow_details.md](workflow_details.md)
2. [environment_setup.md](environment_setup.md) → GitHub Actions Setup
3. [troubleshooting.md](troubleshooting.md) → GitHub Actions Issues

**QA/Tester**:
1. [testing_guide.md](testing_guide.md)
2. [suggested_commands.md](suggested_commands.md)
3. [troubleshooting.md](troubleshooting.md) → Common Test Failures

**Product/Feature Owner**:
1. [project_overview.md](project_overview.md)
2. [features_implementation.md](features_implementation.md)
3. [codebase_structure.md](codebase_structure.md)

## External Resources

- **Main README**: [../README.md](../../README.md) - User-facing documentation
- **Playwright Docs**: https://playwright.dev/docs/intro
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/intro.html
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Airline Manager 4**: https://www.airlinemanager.com/
- **Original Discord**: `muhittin852`

## Contributing to Documentation

When adding or updating documentation:

1. **Keep it organized**: Files in `.serena/memories/` directory
2. **Use clear naming**: Descriptive filenames (lowercase, underscores)
3. **Link between docs**: Use relative links to related documentation
4. **Update this index**: Add new files to appropriate sections above
5. **Test links**: Ensure all internal links work
6. **Keep it current**: Update docs when code changes

## Version Information

**Last Major Update**: 2025-11-04
**Documentation Version**: 1.0
**Project Version**: Based on latest commit

---

**Note**: This documentation is maintained for AI assistant reference. For user-facing documentation, see the main [README.md](../../README.md) file.
