import posthog from 'posthog-js';
import { PostHogTours } from '../';

// Add a dummy test to prevent Jest from complaining
test('This is just an example file, not a test', () => {
  expect(true).toBe(true);
});

// This file is not a test, but rather a usage example to show how to integrate the library

/**
 * Example 1: Basic setup with default options
 */
function basicSetup() {
  // First, initialize PostHog
  posthog.init('your_api_key', {
    api_host: 'https://app.posthog.com',
  });

  // Define your tours, keyed by feature flag names
  const tours = new PostHogTours({
    tours: {
      'onboarding-tour': {
        name: 'Welcome Tour',
        steps: [
          {
            title: 'Welcome to our app!',
            content: 'Let us show you around.',
            target: '.dashboard-welcome', // CSS selector for the element to highlight
            placement: 'bottom',
          },
          {
            title: 'Create your first project',
            content: 'Click here to create your first project.',
            target: '.create-project-button',
            placement: 'right',
          },
        ],
        // This callback runs when all conditions are met
        onEligible: (element, tourId) => {
          console.log(`Tour ${tourId} is ready to be shown`);
          showTourUI(element, tourId, tours);
        }
      }
    }
  });

  // When a tour is completed, mark it as seen
  function showTourUI(element: Element, tourId: string, tours: PostHogTours) {
    const tourConfig = tours.getTourConfig(tourId);
    if (!tourConfig) return;

    // Here you would implement your own UI to show the tour
    // This is just a placeholder
    alert(`Starting tour: ${tourConfig.name}`);

    // When the tour is completed, mark it as seen
    tours.markTourAsSeen(tourId);
  }
}

/**
 * Example 2: Using with a UI library like react-joyride
 */
function withJoyrideSample() {
  // This is a simplified example assuming a React application with react-joyride
  
  // Define your tours
  const tours = new PostHogTours({
    tours: {
      'new-feature-tour': {
        name: 'New Feature Introduction',
        steps: [
          {
            title: 'New Feature',
            content: 'Check out our new analytics dashboard.',
            target: '#analytics-tab',
            placement: 'bottom',
          }
        ],
        // The onEligible callback would trigger your React component to show the tour
        onEligible: (element, tourId) => {
          // In a React app, you would set state here to trigger the Joyride component
          window.dispatchEvent(new CustomEvent('start-tour', { 
            detail: { tourId, element } 
          }));
        }
      }
    },
    // A prefix for the user properties in PostHog that track which tours a user has seen
    userPropertyPrefix: 'has_seen_tour_',
  });

  // When a tour is completed in your React component:
  function onTourComplete(tourId: string) {
    tours.markTourAsSeen(tourId);
  }
}

/**
 * Example 3: Advanced usage with multiple tours and custom conditions
 */
function advancedUsage() {
  // Initialize with multiple tours and custom options
  const tours = new PostHogTours({
    tours: {
      'dashboard-intro': {
        name: 'Dashboard Introduction',
        steps: [
          {
            title: 'Dashboard Overview',
            content: 'This is your main dashboard.',
            target: '.dashboard-container',
            placement: 'bottom',
          }
        ]
      },
      'analytics-intro': {
        name: 'Analytics Introduction',
        steps: [
          {
            title: 'Analytics Overview',
            content: 'Here you can see your analytics.',
            target: '.analytics-container',
            placement: 'top',
          }
        ]
      }
    },
    // Default handler for all tours if they don't have their own
    defaultOnEligible: (element, tourId) => {
      console.log(`Tour ${tourId} is ready to show`);
      // Your UI implementation here
    }
  });

  // You can check the eligibility status of all tours
  async function checkForEligibleTours() {
    const results = await tours.checkAllTours();
    
    // The first eligible tour will have already triggered its callback
    const eligibleTour = results.find(result => result.eligible);
    
    if (eligibleTour) {
      console.log(`Tour ${eligibleTour.tourId} is now showing`);
    } else {
      console.log('No eligible tours found');
    }
  }

  // If you want to force a tour to show regardless of conditions
  async function showSpecificTour(tourId: string) {
    const success = await tours.forceTour(tourId);
    if (success) {
      console.log(`Forced tour ${tourId} to show`);
    } else {
      console.log(`Could not force tour ${tourId} (tour not found or target element missing)`);
    }
  }

  // Reset all observers if the app state changes significantly
  function onAppStateChange() {
    tours.reset();
  }
}