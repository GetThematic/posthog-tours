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
      target: ".feature-element", // CSS selector for the element to highlight
      onEligible: (element, tourId) => {
        // Custom callback when tour becomes eligible to show
        // Implementation of your tour UI goes here

        // When the user completes or dismisses the tour, mark it as seen
        tours.markTourAsSeen(tourId);
      },
    },
  },
  userPropertyPrefix: "seen_tour_", // Prefix for PostHog user properties
  defaultOnEligible: (element, tourId) => {
    // Default handler for all tours if they don't specify their own
  },
  checkElementVisibility: true, // Whether to check if elements are visible before showing tour
});
```

A tour becomes eligible when:

1. The matching feature flag is enabled for the user
2. The target element is present and visible on the screen
3. The user has not seen the tour before (based on user properties)

## Advanced Usage

### Multiple Tours

```typescript
const tours = new PostHogTours({
  tours: {
    "dashboard-intro": {
      name: "Dashboard Introduction",
      target: ".dashboard-container",
      onEligible: (element, tourId) => {
        // Custom handling for this specific tour
      },
    },
    "analytics-intro": {
      name: "Analytics Introduction",
      target: ".analytics-container",
      // Using defaultOnEligible since no specific handler provided
    },
  },
  defaultOnEligible: (element, tourId) => {
    // Default handler for all tours that don't specify their own
    console.log(`Tour ${tourId} is ready to show`);
    // Your UI implementation here
  },
});

// Check eligibility of all tours
async function checkForEligibleTours() {
  const results = await tours.checkAllTours();

  // The first eligible tour will have already triggered its callback
  const eligibleTour = results.find((result) => result.eligible);

  if (eligibleTour) {
    console.log(`Tour ${eligibleTour.tourId} is now showing`);
  }
}

// Force a specific tour to show regardless of conditions
async function showSpecificTour(tourId: string) {
  const success = await tours.forceTour(tourId);
}

// Reset all observers if the app state changes significantly
function onAppStateChange() {
  tours.reset();
}
```

### Tour Eligibility

A tour becomes eligible when all these conditions are met:

1. The matching feature flag is enabled for the user
2. The target element is present in the DOM
3. The element is visible on screen (if `checkElementVisibility` is true)
4. The user has not seen the tour before (based on user properties)

You can check a specific tour's eligibility:

```typescript
const result = await tours.checkTourEligibility("feature-flag-key");
console.log(result);
// {
//   eligible: boolean,
//   element: Element | null,
//   tourId: string,
//   flagEnabled: boolean,
//   targetPresent: boolean,
//   alreadySeen: boolean
// }
```

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
