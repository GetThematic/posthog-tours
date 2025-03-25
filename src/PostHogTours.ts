import posthog from 'posthog-js';
import { 
  PostHogToursOptions, 
  PostHogNotInitializedError, 
  PostHogFeatureFlagsNotConfiguredError,
  TourConfig
} from './types';

export class PostHogTours {
  private posthog: typeof posthog;
  private tours: Record<string, TourConfig>;
  private observers: Map<string, MutationObserver> = new Map();

  constructor(options: PostHogToursOptions) {
    this.posthog = options.posthogInstance || posthog;
    this.tours = options.tours;

    // Check if PostHog is initialized
    if (!this.posthog.__loaded) {
      throw new PostHogNotInitializedError();
    }

    // Validate that all provided feature flags exist
    this.validateFeatureFlags();

    // Start monitoring first steps of all tours
    this.startMonitoringFirstSteps();
  }

  private validateFeatureFlags(): void {
    const missingFlags = Object.keys(this.tours).filter(flag => !this.posthog.isFeatureEnabled(flag));
    
    if (missingFlags.length > 0) {
      throw new PostHogFeatureFlagsNotConfiguredError(missingFlags);
    }
  }

  private startMonitoringFirstSteps(): void {
    Object.entries(this.tours).forEach(([flagKey, tour]) => {
      const firstStep = tour.steps[0];
      if (firstStep?.target) {
        this.monitorElement(flagKey, firstStep.target);
      }
    });
  }

  private monitorElement(flagKey: string, selector: string): void {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      console.log(`First step target found for tour "${flagKey}":`, selector);
      return;
    }

    // Set up observer to watch for the element
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`First step target found for tour "${flagKey}":`, selector);
        obs.disconnect();
        this.observers.delete(flagKey);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set(flagKey, observer);
  }

  public getTourConfig(flagKey: string): TourConfig | undefined {
    return this.tours[flagKey];
  }
} 