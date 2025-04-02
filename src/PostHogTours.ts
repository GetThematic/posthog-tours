import posthog from 'posthog-js';
import { 
  PostHogToursOptions, 
  PostHogNotInitializedError, 
  PostHogFeatureFlagsNotConfiguredError,
  TourConfig,
  TourEligibilityResult
} from './types';

export class PostHogTours {
  private posthog: typeof posthog;
  private tours: Record<string, TourConfig>;
  private observers: Map<string, MutationObserver> = new Map();
  private intersectionObservers: Map<string, IntersectionObserver> = new Map();
  private userPropertyPrefix: string;
  private defaultOnEligible?: (element: Element, tourId: string) => void;
  private shouldCheckElementVisibility: boolean;

  constructor(options: PostHogToursOptions) {
    this.posthog = options.posthogInstance || posthog;
    this.tours = options.tours;
    this.userPropertyPrefix = options.userPropertyPrefix || 'seen_tour_';
    this.defaultOnEligible = options.defaultOnEligible;
    this.shouldCheckElementVisibility = options.checkElementVisibility ?? true;

    // Check if PostHog is initialized
    if (!this.posthog.__loaded) {
      throw new PostHogNotInitializedError();
    }

    // Validate that all provided feature flags exist
    this.validateFeatureFlags();

    // Start monitoring all tours
    this.startMonitoringTours();
  }

  private validateFeatureFlags(): void {
    const missingFlags = Object.keys(this.tours).filter(flag => !this.posthog.isFeatureEnabled(flag));
    
    if (missingFlags.length > 0) {
      console.warn(`PostHog Tours: The following feature flags are not configured: ${missingFlags.join(', ')}. These tours will be ignored.`);
    }
  }

  private startMonitoringTours(): void {
    Object.entries(this.tours).forEach(([flagKey, tour]) => {
      if (tour.target) {
        this.monitorElement(flagKey, tour.target);
      }
    });
  }

  private monitorElement(flagKey: string, selector: string): void {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      this.checkTourEligibility(flagKey);
      return;
    }

    // Set up observer to watch for the element
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        this.observers.delete(flagKey);
        this.checkTourEligibility(flagKey);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set(flagKey, observer);
  }

  public async checkTourEligibility(tourId: string): Promise<TourEligibilityResult> {
    const tour = this.tours[tourId];
    const selector = tour.target;

    if (!selector) {
      return {
        eligible: false,
        element: null,
        tourId,
        flagEnabled: this.posthog.isFeatureEnabled(tourId) || false,
        targetPresent: false,
        alreadySeen: this.hasTourBeenSeen(tourId)
      };
    }

    const element = document.querySelector(selector);
    const flagEnabled = this.posthog.isFeatureEnabled(tourId) || false;
    const alreadySeen = this.hasTourBeenSeen(tourId);
    
    const result: TourEligibilityResult = {
      eligible: false,
      element,
      tourId,
      flagEnabled,
      targetPresent: !!element,
      alreadySeen
    };

    // Element doesn't exist or flag is off or user has already seen it
    if (!element || !flagEnabled || alreadySeen) {
      return result;
    }

    // If we need to check visibility
    if (this.shouldCheckElementVisibility) {
      const isVisible = await this.checkVisibility(tourId, element);
      if (!isVisible) {
        return result;
      }
    }

    // We've met all conditions!
    result.eligible = true;

    // Call the callback
    const onEligible = tour.onEligible || this.defaultOnEligible;
    if (onEligible && element) {
      onEligible(element, tourId);
    }

    return result;
  }

  private checkVisibility(tourId: string, element: Element): Promise<boolean> {
    return new Promise((resolve) => {
      // If the element is already in the viewport, resolve immediately
      const rect = element.getBoundingClientRect();
      const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );

      if (isInViewport) {
        resolve(true);
        return;
      }

      // Otherwise, set up an IntersectionObserver to wait for it to become visible
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          this.intersectionObservers.delete(tourId);
          resolve(true);
        }
      }, { threshold: 0.1 }); // Element is visible when at least 10% is in view

      observer.observe(element);
      this.intersectionObservers.set(tourId, observer);

      // Set a timeout to prevent waiting forever if the element never becomes visible
      setTimeout(() => {
        if (this.intersectionObservers.has(tourId)) {
          observer.disconnect();
          this.intersectionObservers.delete(tourId);
          resolve(false);
        }
      }, 30000); // 30 second timeout
    });
  }

  private hasTourBeenSeen(tourId: string): boolean {
    const userProperties = this.posthog.get_property('$properties') || {};
    return !!userProperties[`${this.userPropertyPrefix}${tourId}`];
  }

  public markTourAsSeen(tourId: string): void {
    const properties: Record<string, any> = {};
    properties[`${this.userPropertyPrefix}${tourId}`] = true;
    
    this.posthog.people.set(properties);
    
    // Also capture an event for analytics purposes
    this.posthog.capture('tour_seen', {
      tour_id: tourId,
      tour_name: this.tours[tourId]?.name
    });
  }

  public async checkAllTours(): Promise<TourEligibilityResult[]> {
    const results: TourEligibilityResult[] = [];
    
    for (const tourId of Object.keys(this.tours)) {
      const result = await this.checkTourEligibility(tourId);
      results.push(result);
      
      // If we found an eligible tour, no need to check others
      if (result.eligible) {
        break;
      }
    }
    
    return results;
  }

  public reset(): void {
    // Clear all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    this.intersectionObservers.forEach(observer => observer.disconnect());
    this.intersectionObservers.clear();
    
    // Start monitoring again
    this.startMonitoringTours();
  }

  public getTourConfig(flagKey: string): TourConfig | undefined {
    return this.tours[flagKey];
  }
  
  public async forceTour(tourId: string): Promise<boolean> {
    const tour = this.tours[tourId];
    if (!tour || !tour.target) {
      return false;
    }
    
    const element = document.querySelector(tour.target);
    if (!element) {
      return false;
    }
    
    const onEligible = tour.onEligible || this.defaultOnEligible;
    if (onEligible) {
      onEligible(element, tourId);
      return true;
    }
    
    return false;
  }
} 