import { PostHogTours } from '../PostHogTours';

describe('PostHogTours - Element Detection', () => {
  let mockPosthog: any;
  let mutationObserverCallback: MutationCallback | null = null;
  let mutationObserverCallbacks: MutationCallback[] = [];
  let observerInstance: any;
  let observerInstances: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mutationObserverCallback = null;
    mutationObserverCallbacks = [];
    observerInstances = [];

    // Track user properties
    const userProperties: Record<string, any> = {};

    // Mock PostHog
    mockPosthog = {
      __loaded: true,
      isFeatureEnabled: jest.fn().mockReturnValue(true),
      get_property: jest.fn().mockImplementation(() => userProperties),
      people: {
        set: jest.fn().mockImplementation((props) => {
          Object.assign(userProperties, props);
        })
      },
      capture: jest.fn(),
    };

    // Mock MutationObserver to capture all callbacks
    global.MutationObserver = jest.fn().mockImplementation((callback: MutationCallback) => {
      mutationObserverCallback = callback;
      mutationObserverCallbacks.push(callback);
      observerInstance = {
        observe: jest.fn(),
        disconnect: jest.fn(),
        takeRecords: jest.fn(),
      };
      observerInstances.push(observerInstance);
      return observerInstance;
    }) as any;

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(),
      unobserve: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    })) as any;

    // Mock getBoundingClientRect to return element in viewport
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

    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should detect element that exists on initialization', async () => {
    const onEligibleMock = jest.fn();

    // Element exists before initialization
    document.body.innerHTML = '<div id="test-element"></div>';

    new PostHogTours({
      tours: {
        'test-tour': {
          name: 'Test Tour',
          target: '#test-element',
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog,
      checkElementVisibility: false,
    });

    // Element already exists, so callback should be triggered during init
    // Wait a tick for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onEligibleMock).toHaveBeenCalledTimes(1);
    expect(onEligibleMock).toHaveBeenCalledWith(
      expect.any(Element),
      'test-tour'
    );
  });

  it('should detect element added to DOM after initialization', async () => {
    const onEligibleMock = jest.fn();

    // Element does NOT exist yet
    document.body.innerHTML = '<div id="container"></div>';

    new PostHogTours({
      tours: {
        'test-tour': {
          name: 'Test Tour',
          target: '#test-element',
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog,
      checkElementVisibility: false,
    });

    // Verify MutationObserver was set up
    expect(global.MutationObserver).toHaveBeenCalled();
    expect(observerInstance.observe).toHaveBeenCalledWith(
      document.body,
      { childList: true, subtree: true }
    );

    // Callback should not have been called yet
    expect(onEligibleMock).not.toHaveBeenCalled();

    // Now add the element to the DOM
    const container = document.getElementById('container');
    const newElement = document.createElement('div');
    newElement.id = 'test-element';
    container?.appendChild(newElement);

    // Manually trigger the MutationObserver callback
    if (mutationObserverCallback) {
      mutationObserverCallback([] as any, observerInstance);
    }

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    // Now the callback should have been triggered
    expect(onEligibleMock).toHaveBeenCalledTimes(1);
    expect(onEligibleMock).toHaveBeenCalledWith(
      expect.any(Element),
      'test-tour'
    );

    // Observer should have been disconnected
    expect(observerInstance.disconnect).toHaveBeenCalled();
  });

  it('should not trigger callback if element appears but feature flag is disabled', async () => {
    const onEligibleMock = jest.fn();
    mockPosthog.isFeatureEnabled.mockReturnValue(false);

    document.body.innerHTML = '<div id="container"></div>';

    new PostHogTours({
      tours: {
        'test-tour': {
          name: 'Test Tour',
          target: '#test-element',
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog,
      checkElementVisibility: false,
    });

    // Add the element
    const container = document.getElementById('container');
    const newElement = document.createElement('div');
    newElement.id = 'test-element';
    container?.appendChild(newElement);

    // Trigger MutationObserver
    if (mutationObserverCallback) {
      mutationObserverCallback([] as any, observerInstance);
    }

    await new Promise(resolve => setTimeout(resolve, 0));

    // Callback should NOT be triggered because feature flag is off
    expect(onEligibleMock).not.toHaveBeenCalled();
  });

  it('should not trigger callback if element appears but user has already seen tour', async () => {
    const onEligibleMock = jest.fn();
    mockPosthog.get_property.mockReturnValue({
      'seen_tour_test-tour': true,
    });

    document.body.innerHTML = '<div id="container"></div>';

    new PostHogTours({
      tours: {
        'test-tour': {
          name: 'Test Tour',
          target: '#test-element',
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog,
      checkElementVisibility: false,
    });

    // Add the element
    const container = document.getElementById('container');
    const newElement = document.createElement('div');
    newElement.id = 'test-element';
    container?.appendChild(newElement);

    // Trigger MutationObserver
    if (mutationObserverCallback) {
      mutationObserverCallback([] as any, observerInstance);
    }

    await new Promise(resolve => setTimeout(resolve, 0));

    // Callback should NOT be triggered because tour was already seen
    expect(onEligibleMock).not.toHaveBeenCalled();
  });

  it('should handle multiple tours with different elements appearing at different times', async () => {
    const onEligibleMockA = jest.fn();
    const onEligibleMockB = jest.fn();

    document.body.innerHTML = '<div id="container"></div>';

    const tours = new PostHogTours({
      tours: {
        'tour-a': {
          name: 'Tour A',
          target: '#element-a',
          onEligible: onEligibleMockA,
        },
        'tour-b': {
          name: 'Tour B',
          target: '#element-b',
          onEligible: onEligibleMockB,
        },
      },
      posthogInstance: mockPosthog,
      checkElementVisibility: false,
    });

    const container = document.getElementById('container');

    // Capture the callbacks before first trigger
    const callbacksSnapshot = [...mutationObserverCallbacks];

    // Add first element
    const elementA = document.createElement('div');
    elementA.id = 'element-a';
    container?.appendChild(elementA);

    // Trigger all observers
    for (let i = 0; i < callbacksSnapshot.length; i++) {
      callbacksSnapshot[i]([] as any, observerInstances[i]);
    }

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onEligibleMockA).toHaveBeenCalledTimes(1);
    expect(onEligibleMockB).not.toHaveBeenCalled();

    // Add second element
    const elementB = document.createElement('div');
    elementB.id = 'element-b';
    container?.appendChild(elementB);

    // Only trigger observers that haven't been disconnected
    // In real life, MutationObserver wouldn't fire for disconnected observers
    // We need to manually check which observers are still active
    for (let i = 0; i < callbacksSnapshot.length; i++) {
      const observer = observerInstances[i];
      // Only trigger if disconnect wasn't called
      if (observer.disconnect.mock.calls.length === 0) {
        callbacksSnapshot[i]([] as any, observer);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onEligibleMockA).toHaveBeenCalledTimes(1); // Still just once
    // Tour B should NOT be called yet because Tour A is still active
    expect(onEligibleMockB).not.toHaveBeenCalled();

    // Mark tour A as seen, which should trigger check for other tours
    tours.markTourAsSeen('tour-a');

    await new Promise(resolve => setTimeout(resolve, 0));

    // Now tour B should be triggered
    expect(onEligibleMockB).toHaveBeenCalledTimes(1);
  });

  it('should continue watching if mutation occurs but element still not present', async () => {
    const onEligibleMock = jest.fn();

    document.body.innerHTML = '<div id="container"></div>';

    new PostHogTours({
      tours: {
        'test-tour': {
          name: 'Test Tour',
          target: '#test-element',
          onEligible: onEligibleMock,
        },
      },
      posthogInstance: mockPosthog,
      checkElementVisibility: false,
    });

    // Add a different element (not the one we're looking for)
    const container = document.getElementById('container');
    const wrongElement = document.createElement('div');
    wrongElement.id = 'wrong-element';
    container?.appendChild(wrongElement);

    // Trigger MutationObserver
    if (mutationObserverCallback) {
      mutationObserverCallback([] as any, observerInstance);
    }

    await new Promise(resolve => setTimeout(resolve, 0));

    // Callback should NOT be triggered
    expect(onEligibleMock).not.toHaveBeenCalled();

    // Observer should NOT be disconnected (still watching)
    expect(observerInstance.disconnect).not.toHaveBeenCalled();
  });
});
