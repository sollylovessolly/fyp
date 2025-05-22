
export async function getRoute(start, end) {
  const TOMTOM_API_KEY = '8HW8UzF88GLp2mL9myetUktvvhazsgkI'; // Your hardcoded key

  try {
    // TomTom Routing API
    const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${start}:${end}/json?key=${TOMTOM_API_KEY}&maxAlternatives=1&traffic=true`;
    console.log('Fetching route from:', routeUrl);
    const routeResponse = await fetch(routeUrl);
    if (!routeResponse.ok) {
      throw new Error(`Routing API error: ${routeResponse.statusText}`);
    }
    const routeData = await routeResponse.json();
    console.log('Raw route data:', routeData);

    // TomTom Traffic API
    const trafficUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_API_KEY}&point=${start}`;
    console.log('Fetching traffic from:', trafficUrl);
    const trafficResponse = await fetch(trafficUrl);
    if (!trafficResponse.ok) {
      throw new Error(`Traffic API error: ${trafficResponse.statusText}`);
    }
    const trafficData = await trafficResponse.json();
    console.log('Raw traffic data:', trafficData);

    // Process routes
    const routes = routeData.routes
      .map((route, index) => {
        if (!route.legs?.[0]?.points?.length) {
          console.warn(`Route ${index} has no valid points`, route);
          return null;
        }
        return {
          id: index === 0 ? 'main' : 'alternate',
          path: route.legs[0].points.map(point => [point.latitude, point.longitude]),
          color: index === 0 ? '#FF0000' : '#800080',
          eta: Math.round(route.summary.travelTimeInSeconds / 60),
        };
      })
      .filter(route => route !== null && route.path.length > 1);

    if (!routes.length) {
      throw new Error('No valid routes with sufficient points');
    }

    // Process traffic data
    const traffic = {
      coordinates: { coordinate: routes[0]?.path || [] },
      currentSpeed: trafficData.flowSegmentData?.currentSpeed ?? 0,
      freeFlowSpeed: trafficData.flowSegmentData?.freeFlowSpeed ?? 0,
    };

    return { routes, traffic };
  } catch (error) {
    console.error('Error in getRoute:', error.message);
    throw new Error(`Failed to fetch routes or traffic: ${error.message}`);
  }
}
