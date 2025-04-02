# PostHog Tours

A TypeScript package for creating guided product tours in PostHog, leveraging feature flags and user properties to deliver targeted onboarding experiences.

## Installation

```bash
npm install posthog-tours
```

or

```bash
yarn add posthog-tours
```

## Features

- Uses PostHog feature flags to control tour visibility
- Tracks seen tours with PostHog user properties
- Shows tours only when elements are present on screen
- Provides callbacks when a tour becomes eligible to show
- Monitors element visibility with Intersection Observer
- Supports custom CSS selectors for targeting elements

## Usage

```typescript
import { PostHogTours } from "posthog-tours";

// Initialize PostHogTours
const tours = new PostHogTours({
  tours: {
    "feature-flag-key": {
      // This key must match a PostHog feature flag
      name: "My Feature Tour",
      steps: [
        {
          title: "Welcome to the new feature!",
          content: "This is a guided tour of our new feature.",
          target: ".feature-element", // CSS selector for the element
          properties: "bottom",
        },
      ],
      onEligible: (element, tourId) => {
        // Custom callback when tour becomes eligible to show
        // Implementation of your tour UI goes here

        // When the user completes or dismisses the tour, mark it as seen
        tours.markTourAsSeen(tourId);
      },
    },
  },
  userPropertyPrefix: "seen_tour_", // Prefix for PostHog user properties
});
```

A tour becomes eligible when:

1. The matching feature flag is enabled for the user
2. The target element is present and visible on the screen
3. The user has not seen the tour before (based on user properties)

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the package:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## License

MIT
