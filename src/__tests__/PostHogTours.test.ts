import { PostHogTours, PostHogNotInitializedError, PostHogFeatureFlagsNotConfiguredError } from '../';

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
    
    // Configure mock responses
    mockPosthog.isFeatureEnabled.mockImplementation((flag) => true);
    mockPosthog.get_property.mockReturnValue({});
    
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

  it('should throw if feature flags are not configured', () => {
    mockPosthog.isFeatureEnabled.mockImplementation((flag) => false);
    
    expect(() => {
      new PostHogTours({
        tours: sampleTours,
        posthogInstance: mockPosthog as any,
      });
    }).toThrow(PostHogFeatureFlagsNotConfiguredError);
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
});