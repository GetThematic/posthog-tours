import posthog from 'posthog-js';

export interface TourConfig {
  name: string;
  steps: TourStep[];
}

export interface TourStep {
  title: string;
  content: string;
  target?: string; // CSS selector for the element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface FeatureFlagTour {
  flagKey: string;
  tour: TourConfig;
}

export interface PostHogToursOptions {
  tours: Record<string, TourConfig>;
  posthogInstance?: typeof posthog;
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