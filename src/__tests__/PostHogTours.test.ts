import { PostHogTours, PostHogNotInitializedError } from '../';

// Mock PostHog
const mockPosthog = {
  __loaded: true,
  isFeatureEnabled: jest.fn(),
  get_property: jest.fn(),
  people: {
    set: jest.fn(),
  },
  capture: jest.fn(),
};

// Mock DOM APIs used by PostHogTours
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

global.MutationObserver = class {
  observe = mockObserve;
  disconnect = mockDisconnect;
  takeRecords = jest.fn();
  constructor(public callback: any) {}
};

global.IntersectionObserver = class {
  observe = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn();
  unobserve = jest.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
  constructor(public callback: any, public options: any) {}
};

// Mock element.getBoundingClientRect
Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  value: () => ({
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    width: 100,
    height: 100,
  }),
  configurable: true,
});

describe('PostHogTours', () => {
  let tours: PostHogTours;
  const sampleTours = {
    'feature-a': {
      name: 'Feature A Tour',
      target: '#feature-a-element'
    },
    'feature-b': {
      name: 'Feature B Tour',
      target: '#feature-b-element'
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Clear localStorage
    localStorage.clear();

    // Track user properties
    const userProperties: Record<string, any> = {};

    // Configure mock responses
    mockPosthog.isFeatureEnabled.mockImplementation((flag) => true);
    mockPosthog.get_property.mockImplementation(() => userProperties);
    mockPosthog.people.set.mockImplementation((props) => {
      Object.assign(userProperties, props);
    });

    // Set up test DOM
    document.body.innerHTML = `
      <div id="app">
        <div id="feature-a-element"></div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should initialize with provided options', () => {
    tours = new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
    });

    expect(tours).toBeDefined();
  });

  it('should throw if PostHog is not initialized', () => {
    const uninitializedPosthog = { ...mockPosthog, __loaded: false };
    
    expect(() => {
      new PostHogTours({
        tours: sampleTours,
        posthogInstance: uninitializedPosthog as any,
      });
    }).toThrow(PostHogNotInitializedError);
  });

  it('should warn if feature flags are not configured', () => {
    mockPosthog.isFeatureEnabled.mockImplementation((flag) => false);
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
      debug: true, // Enable debug mode for this test
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('PostHog Tours: The following feature flags are not configured')
    );

    consoleWarnSpy.mockRestore();
  });

  it('should check for existing elements on initialization', () => {
    const querySelectorSpy = jest.spyOn(document, 'querySelector');
    
    tours = new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
    });
    
    expect(querySelectorSpy).toHaveBeenCalledWith('#feature-a-element');
    expect(querySelectorSpy).toHaveBeenCalledWith('#feature-b-element');
  });

  it('should get tour configuration by flag key', () => {
    tours = new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
    });
    
    const tourConfig = tours.getTourConfig('feature-a');
    
    expect(tourConfig).toEqual(sampleTours['feature-a']);
  });

  it('should mark a tour as seen', () => {
    tours = new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
      userPropertyPrefix: 'test_seen_',
    });
    
    tours.markTourAsSeen('feature-a');
    
    expect(mockPosthog.people.set).toHaveBeenCalledWith({
      'test_seen_feature-a': true,
    });
    
    expect(mockPosthog.capture).toHaveBeenCalledWith('tour_seen', {
      tour_id: 'feature-a',
      tour_name: 'Feature A Tour',
    });
  });

  it('should not trigger tour if user has already seen it', async () => {
    // Mock that user has already seen the tour
    mockPosthog.get_property.mockReturnValue({
      'seen_tour_feature-a': true,
    });
    
    const onEligibleMock = jest.fn();
    
    tours = new PostHogTours({
      tours: {
        'feature-a': {
          ...sampleTours['feature-a'],
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog as any,
    });
    
    // Force check for this tour
    await tours.checkTourEligibility('feature-a');
    
    expect(onEligibleMock).not.toHaveBeenCalled();
  });

  it('should trigger tour callback when element is present and user has not seen it', async () => {
    const onEligibleMock = jest.fn();
    
    tours = new PostHogTours({
      tours: {
        'feature-a': {
          ...sampleTours['feature-a'],
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog as any,
      checkElementVisibility: false, // Skip visibility check for this test
    });
    
    // Manually trigger check for this tour
    await tours.checkTourEligibility('feature-a');
    
    expect(onEligibleMock).toHaveBeenCalled();
    expect(onEligibleMock.mock.calls[0][1]).toBe('feature-a');
  });

  it('should use defaultOnEligible if tour does not have its own onEligible', async () => {
    const defaultOnEligibleMock = jest.fn();
    
    tours = new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
      defaultOnEligible: defaultOnEligibleMock,
      checkElementVisibility: false, // Skip visibility check for this test
    });
    
    // Manually trigger check for this tour
    await tours.checkTourEligibility('feature-a');
    
    expect(defaultOnEligibleMock).toHaveBeenCalled();
    expect(defaultOnEligibleMock.mock.calls[0][1]).toBe('feature-a');
  });

  it('should force a tour to show regardless of conditions', async () => {
    const onEligibleMock = jest.fn();
    
    tours = new PostHogTours({
      tours: {
        'feature-a': {
          ...sampleTours['feature-a'],
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog as any,
    });
    
    // Mark the tour as seen, which would normally prevent it from showing
    mockPosthog.get_property.mockReturnValue({
      'seen_tour_feature-a': true,
    });
    
    // Force the tour to show anyway
    const result = await tours.forceTour('feature-a');
    
    expect(result).toBe(true);
    expect(onEligibleMock).toHaveBeenCalled();
  });

  it('should check all tours and find the first eligible one', async () => {
    // Set up two tours, make only the second one eligible
    document.body.innerHTML = `
      <div id="app">
        <div id="feature-b-element"></div>
      </div>
    `;
    
    mockPosthog.isFeatureEnabled.mockImplementation((flag) => true);
    mockPosthog.get_property.mockReturnValue({
      'seen_tour_feature-a': true, // First tour seen already
    });
    
    const onEligibleMockA = jest.fn();
    const onEligibleMockB = jest.fn();
    
    tours = new PostHogTours({
      tours: {
        'feature-a': {
          ...sampleTours['feature-a'],
          onEligible: onEligibleMockA,
        },
        'feature-b': {
          ...sampleTours['feature-b'],
          onEligible: onEligibleMockB,
        },
      },
      posthogInstance: mockPosthog as any,
      checkElementVisibility: false, // Skip visibility check for this test
    });
    
    const results = await tours.checkAllTours();
    
    expect(results.length).toBe(2);
    expect(results[0].eligible).toBe(false); // First tour not eligible (seen already)
    expect(results[1].eligible).toBe(true);  // Second tour eligible
    
    expect(onEligibleMockA).not.toHaveBeenCalled();
    expect(onEligibleMockB).toHaveBeenCalled();
  });

  it('should reset all observers when reset is called', () => {
    tours = new PostHogTours({
      tours: sampleTours,
      posthogInstance: mockPosthog as any,
    });

    // Check that observers are set up
    expect((tours as any).observers.size).toBeGreaterThan(0);

    // Reset the tours
    tours.reset();

    // Assert that disconnect was called on all observers
    // and observers were recreated
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should prevent concurrent tours from being triggered', async () => {
    // Set up DOM with both tour elements
    document.body.innerHTML = `
      <div id="app">
        <div id="feature-a-element"></div>
        <div id="feature-b-element"></div>
      </div>
    `;

    const onEligibleMockA = jest.fn();
    const onEligibleMockB = jest.fn();

    tours = new PostHogTours({
      tours: {
        'feature-a': {
          ...sampleTours['feature-a'],
          onEligible: onEligibleMockA,
        },
        'feature-b': {
          ...sampleTours['feature-b'],
          onEligible: onEligibleMockB,
        },
      },
      posthogInstance: mockPosthog as any,
      checkElementVisibility: false,
    });

    // Trigger both tours
    await tours.checkTourEligibility('feature-a');
    await tours.checkTourEligibility('feature-b');

    // Only the first tour should have been triggered
    expect(onEligibleMockA).toHaveBeenCalledTimes(1);
    expect(onEligibleMockB).not.toHaveBeenCalled();
  });

  it('should check for other eligible tours after marking one as seen', async () => {
    // Set up DOM with both tour elements
    document.body.innerHTML = `
      <div id="app">
        <div id="feature-a-element"></div>
        <div id="feature-b-element"></div>
      </div>
    `;

    const onEligibleMockA = jest.fn();
    const onEligibleMockB = jest.fn();

    tours = new PostHogTours({
      tours: {
        'feature-a': {
          ...sampleTours['feature-a'],
          onEligible: onEligibleMockA,
        },
        'feature-b': {
          ...sampleTours['feature-b'],
          onEligible: onEligibleMockB,
        },
      },
      posthogInstance: mockPosthog as any,
      checkElementVisibility: false,
    });

    // Trigger first tour
    await tours.checkTourEligibility('feature-a');
    expect(onEligibleMockA).toHaveBeenCalledTimes(1);
    expect(onEligibleMockB).not.toHaveBeenCalled();

    // Mark first tour as seen - this should trigger check for other tours
    tours.markTourAsSeen('feature-a');

    // Wait for async checkAllTours to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // Second tour should now have been triggered
    expect(onEligibleMockB).toHaveBeenCalledTimes(1);
  });

  describe('localStorage sync', () => {
    it('should treat localStorage as authoritative even when PostHog disagrees', async () => {
      // Set up localStorage to indicate tour was seen
      localStorage.setItem('posthog_tours_seen', JSON.stringify({
        'seen_tour_feature-a': true
      }));

      // PostHog says tour was NOT seen (simulating sync delay or failure)
      mockPosthog.get_property.mockReturnValue({});

      const onEligibleMock = jest.fn();
      tours = new PostHogTours({
        tours: {
          'feature-a': {
            ...sampleTours['feature-a'],
            onEligible: onEligibleMock,
          },
        },
        posthogInstance: mockPosthog as any,
        checkElementVisibility: false,
      });

      // Check tour eligibility - should NOT be eligible because localStorage says it was seen
      const result = await tours.checkTourEligibility('feature-a');

      expect(result.alreadySeen).toBe(true);
      expect(result.eligible).toBe(false);
      expect(onEligibleMock).not.toHaveBeenCalled();

      // Verify localStorage is still authoritative
      const stored = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored['seen_tour_feature-a']).toBe(true);
    });

    it('should persist localStorage across multiple PostHogTours instances', () => {
      // First instance marks tour as seen
      const tours1 = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
      });

      tours1.markTourAsSeen('feature-a');

      // Verify it was saved to localStorage
      const stored1 = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored1['seen_tour_feature-a']).toBe(true);

      // Create a new instance (simulating page reload or component remount)
      // Mock PostHog to return empty (simulating it hasn't synced yet)
      mockPosthog.get_property.mockReturnValue({});

      const tours2 = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
      });

      // The new instance should still know the tour was seen from localStorage
      tours2.checkTourEligibility('feature-a').then(result => {
        expect(result.alreadySeen).toBe(true);
        expect(result.eligible).toBe(false);
      });
    });

    it('should prevent tour from showing again immediately after marking as seen', async () => {
      // Start with clean state
      localStorage.clear();
      mockPosthog.get_property.mockReturnValue({});

      const onEligibleMock = jest.fn();
      tours = new PostHogTours({
        tours: {
          'feature-a': {
            ...sampleTours['feature-a'],
            onEligible: onEligibleMock,
          },
        },
        posthogInstance: mockPosthog as any,
        checkElementVisibility: false,
      });

      // First check - tour should be eligible
      const result1 = await tours.checkTourEligibility('feature-a');
      expect(result1.eligible).toBe(true);
      expect(onEligibleMock).toHaveBeenCalledTimes(1);

      // Mark tour as seen
      tours.markTourAsSeen('feature-a');

      // Immediately check again (before PostHog could possibly sync)
      const result2 = await tours.checkTourEligibility('feature-a');
      expect(result2.alreadySeen).toBe(true);
      expect(result2.eligible).toBe(false);
      expect(onEligibleMock).toHaveBeenCalledTimes(1); // Should NOT be called again

      // Verify localStorage has it
      const stored = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored['seen_tour_feature-a']).toBe(true);
    });

    it('should simulate real-world tour interaction across page loads', async () => {
      // Scenario: User sees tour on page load 1, marks it as seen, then refreshes the page

      // Page Load 1: Tour shows for the first time
      localStorage.clear();
      mockPosthog.get_property.mockReturnValue({});

      const tours1 = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        checkElementVisibility: false,
      });

      // Tour should be eligible
      const result1 = await tours1.checkTourEligibility('feature-a');
      expect(result1.eligible).toBe(true);
      expect(result1.alreadySeen).toBe(false);

      // User completes the tour
      tours1.markTourAsSeen('feature-a');

      // Verify localStorage was updated
      const stored1 = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored1['seen_tour_feature-a']).toBe(true);

      // Page Load 2: User refreshes immediately (PostHog hasn't synced yet)
      mockPosthog.get_property.mockReturnValue({}); // PostHog still doesn't have the data

      const tours2 = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        checkElementVisibility: false,
      });

      // Tour should NOT show again thanks to localStorage
      const result2 = await tours2.checkTourEligibility('feature-a');
      expect(result2.eligible).toBe(false);
      expect(result2.alreadySeen).toBe(true);

      // Page Load 3: Much later, PostHog has synced
      mockPosthog.get_property.mockReturnValue({
        'seen_tour_feature-a': true
      });

      const tours3 = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        checkElementVisibility: false,
      });

      // Tour still shouldn't show (both localStorage and PostHog agree)
      const result3 = await tours3.checkTourEligibility('feature-a');
      expect(result3.eligible).toBe(false);
      expect(result3.alreadySeen).toBe(true);

      // Verify localStorage is still intact
      const stored3 = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored3['seen_tour_feature-a']).toBe(true);
    });

    it('should maintain localStorage authority even after PostHog sync', async () => {
      // localStorage says tour was seen
      localStorage.setItem('posthog_tours_seen', JSON.stringify({
        'seen_tour_feature-a': true
      }));

      // Initially PostHog doesn't have it
      mockPosthog.get_property.mockReturnValue({});

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        checkElementVisibility: false,
      });

      // Check - should not be eligible (localStorage says seen)
      const result1 = await tours.checkTourEligibility('feature-a');
      expect(result1.alreadySeen).toBe(true);

      // Now simulate PostHog syncing and having the data
      mockPosthog.get_property.mockReturnValue({
        'seen_tour_feature-a': true
      });

      // Check again - should still not be eligible
      const result2 = await tours.checkTourEligibility('feature-a');
      expect(result2.alreadySeen).toBe(true);

      // Now simulate PostHog losing the data (e.g., user logged out)
      mockPosthog.get_property.mockReturnValue({});

      // localStorage should STILL be authoritative
      const result3 = await tours.checkTourEligibility('feature-a');
      expect(result3.alreadySeen).toBe(true);
      expect(result3.eligible).toBe(false);
    });

    it('should sync PostHog data to localStorage on initialization', () => {
      // Set up PostHog to have some seen tours
      mockPosthog.get_property.mockReturnValue({
        'seen_tour_feature-a': true,
        'seen_tour_feature-b': true,
        'other_property': 'value' // Should be ignored
      });

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
      });

      // Check that localStorage was updated
      const stored = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored['seen_tour_feature-a']).toBe(true);
      expect(stored['seen_tour_feature-b']).toBe(true);
      expect(stored['other_property']).toBeUndefined();
    });

    it('should write to both localStorage and PostHog when marking tour as seen', () => {
      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        userPropertyPrefix: 'test_seen_',
      });

      tours.markTourAsSeen('feature-a');

      // Check PostHog was updated
      expect(mockPosthog.people.set).toHaveBeenCalledWith({
        'test_seen_feature-a': true,
      });

      // Check localStorage was updated
      const stored = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored['test_seen_feature-a']).toBe(true);
    });

    it('should check localStorage first when checking if tour was seen', async () => {
      // Set up localStorage to have the tour marked as seen
      localStorage.setItem('posthog_tours_seen', JSON.stringify({
        'seen_tour_feature-a': true
      }));

      // PostHog doesn't have it marked as seen
      mockPosthog.get_property.mockReturnValue({});

      const onEligibleMock = jest.fn();
      tours = new PostHogTours({
        tours: {
          'feature-a': {
            ...sampleTours['feature-a'],
            onEligible: onEligibleMock,
          },
        },
        posthogInstance: mockPosthog as any,
      });

      // Check tour eligibility - should not be eligible since localStorage says it was seen
      const result = await tours.checkTourEligibility('feature-a');
      expect(result.alreadySeen).toBe(true);
      expect(result.eligible).toBe(false);
      expect(onEligibleMock).not.toHaveBeenCalled();
    });

    it('should sync from PostHog to localStorage when PostHog has data but localStorage does not', async () => {
      // PostHog has the tour marked as seen
      mockPosthog.get_property.mockReturnValue({
        'seen_tour_feature-a': true
      });

      // localStorage is empty
      localStorage.clear();

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
      });

      // Check tour eligibility - this should sync localStorage
      await tours.checkTourEligibility('feature-a');

      // localStorage should now have the data
      const stored = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored['seen_tour_feature-a']).toBe(true);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Set corrupted JSON in localStorage
      localStorage.setItem('posthog_tours_seen', 'not valid JSON{');

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: true, // Enable debug mode to see the warning
      });

      tours.markTourAsSeen('feature-a');

      // Should have warned about corrupted data
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse posthog_tours_seen'),
        expect.any(Error)
      );

      // Should have cleared and set new data
      const stored = JSON.parse(localStorage.getItem('posthog_tours_seen') || '{}');
      expect(stored['seen_tour_feature-a']).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    it('should handle localStorage quota exceeded errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Make sure PostHog doesn't have any tours marked as seen initially
      mockPosthog.get_property.mockReturnValue({});

      // Use jest.spyOn to mock localStorage methods
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('{}');
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        // Only throw for our specific key
        if (key === 'posthog_tours_seen') {
          throw new DOMException('QuotaExceededError');
        }
      });

      // Create tours instance after mocking
      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: true, // Enable debug mode to see the error
      });

      tours.markTourAsSeen('feature-a');

      // Check if setItem was called
      expect(setItemSpy).toHaveBeenCalledWith('posthog_tours_seen', expect.any(String));

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save tour state'),
        expect.any(Error)
      );

      // PostHog should still have been updated
      expect(mockPosthog.people.set).toHaveBeenCalledWith({
        'seen_tour_feature-a': true,
      });

      // Restore mocks
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('debug mode', () => {
    it('should not log warnings when debug is false (default)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create tours with a missing feature flag
      mockPosthog.isFeatureEnabled.mockReturnValue(false);

      new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: false, // Explicitly set to false
      });

      // Console.warn should NOT have been called
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should log warnings when debug is true', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create tours with a missing feature flag
      mockPosthog.isFeatureEnabled.mockReturnValue(false);

      new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: true, // Enable debug mode
      });

      // Console.warn SHOULD have been called
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PostHog Tours: The following feature flags are not configured')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not log errors for localStorage failures when debug is false', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Use jest.spyOn to mock localStorage methods
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
        if (key === 'posthog_tours_seen') {
          throw new DOMException('QuotaExceededError');
        }
      });

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: false, // Silent mode
      });

      tours.markTourAsSeen('feature-a');

      // Console.error should NOT have been called
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log errors for localStorage failures when debug is true', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Use jest.spyOn to mock localStorage methods
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
        if (key === 'posthog_tours_seen') {
          throw new DOMException('QuotaExceededError');
        }
      });

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: true, // Enable debug mode
      });

      tours.markTourAsSeen('feature-a');

      // Console.error SHOULD have been called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save tour state'),
        expect.any(Error)
      );

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should not log warnings for corrupted localStorage when debug is false', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Set corrupted JSON in localStorage
      localStorage.setItem('posthog_tours_seen', 'not valid JSON{');

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: false, // Silent mode
      });

      // Try to mark a tour as seen, which will attempt to read the corrupted data
      tours.markTourAsSeen('feature-a');

      // Console.warn should NOT have been called
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should log warnings for corrupted localStorage when debug is true', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Set corrupted JSON in localStorage
      localStorage.setItem('posthog_tours_seen', 'not valid JSON{');

      tours = new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        debug: true, // Enable debug mode
      });

      // Try to mark a tour as seen, which will attempt to read the corrupted data
      tours.markTourAsSeen('feature-a');

      // Console.warn SHOULD have been called
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse posthog_tours_seen'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should default to silent mode when debug is not specified', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create tours without specifying debug option
      mockPosthog.isFeatureEnabled.mockReturnValue(false);

      new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
        // debug not specified - should default to false
      });

      // Console.warn should NOT have been called (default is silent)
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});