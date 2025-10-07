# PostHogTours Development Guide

## Commands
- Build: `npm run build`
- Test: `npm test`
- Run single test: `npx jest <testName>` or `npx jest <path/to/test.ts>`
- Lint: `npm run lint`
- TypeCheck: `npx tsc --noEmit`

## Code Style
- **Imports**: Group imports (external then internal), sort alphabetically
- **Types**: Use explicit typing, prefer interfaces for objects
- **Naming**: 
  - Classes: PascalCase (e.g., PostHogTours)
  - Methods/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
- **Error Handling**: Create custom error classes extending Error
- **File Structure**: One class per file, named after the class
- **TypeScript**: Strict mode enabled, isolatedModules and esModuleInterop
- **Exports**: Named exports preferred over default exports
- **Comments**: JSDoc style for public APIs

## PostHog Integration
Uses posthog-js as a peer dependency, feature flags for tour activation.