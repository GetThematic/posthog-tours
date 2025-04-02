// Main entry point for posthog-tours
// Export your public API here

export const VERSION = '0.1.0';

export { PostHogTours } from './PostHogTours';
export * from './types';

// Example usage:
/*
import { PostHogTours } from 'posthog-tours';

// Initialize PostHogTours
const tours = new PostHogTours({
  tours: {
    'feature-flag-key': {
      name: 'My Feature Tour',
      target: '.feature-element', // CSS selector for the element
      onEligible: (element, tourId) => {
        // Custom callback when tour becomes eligible
        // Show your tour UI here
        console.log(`Tour ${tourId} is ready to be shown`);
        
        // Don't forget to mark the tour as seen when completed
        tours.markTourAsSeen(tourId);
      }
    }
  },
  defaultOnEligible: (element, tourId) => {
    // Default handler for all tours
    console.log(`Default handler for tour ${tourId}`);
  },
  userPropertyPrefix: 'seen_tour_' // Prefix for PostHog user properties
});
*/ 