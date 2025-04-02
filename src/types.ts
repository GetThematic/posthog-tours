import posthog from 'posthog-js';

export interface TourConfig {
  name: string;
  target: string; // CSS selector for the element to highlight
  onEligible?: (element: Element, tourId: string) => void;
}

export interface FeatureFlagTour {
  flagKey: string;
  tour: TourConfig;
}

export interface TourEligibilityResult {
  eligible: boolean;
  element: Element | null;
  tourId: string;
  flagEnabled: boolean;
  targetPresent: boolean;
  alreadySeen: boolean;
}

export interface PostHogToursOptions {
  tours: Record<string, TourConfig>;
  posthogInstance?: typeof posthog;
  userPropertyPrefix?: string;
  defaultOnEligible?: (element: Element, tourId: string) => void;
  checkElementVisibility?: boolean;
}

export class PostHogNotInitializedError extends Error {
  constructor() {
    super('PostHog has not been initialized. Please initialize PostHog before using posthog-tours.');
    this.name = 'PostHogNotInitializedError';
  }
}

export class PostHogFeatureFlagsNotConfiguredError extends Error {
  constructor(missingFlags: string[]) {
    super(
      `The following feature flags are not configured in PostHog: ${missingFlags.join(', ')}`
    );
    this.name = 'PostHogFeatureFlagsNotConfiguredError';
  }
} 