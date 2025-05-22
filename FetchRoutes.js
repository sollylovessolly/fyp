const axios = require('axios');
const fs = require('fs').promises;

const TOMTOM_API_KEY = '8HW8UzF88GLp2mL9myetUktvvhazsgkI'; // Replace with your TomTom API key
const ROUTING_URL = 'https://api.tomtom.com/routing/1/calculateRoute';
const TRAFFIC_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';

async function fetchRoutes() {
  try {
    const start = '6.6097,3.3081'; // Oshodi
    const end = '6.4412,3.4249'; // VI
    console.log('Fetching routes:', { start, end });

    // Fetch routes
    const routeResponse = await axios.get(
      `${ROUTING_URL}/${start}:${end}/json`,
      {
        params: {
          key: TOMTOM_API_KEY,
          routeType: 'fastest',
          travelMode: 'car',
          maxAlternatives: 1,
          traffic: false, // Static routes
          computeTravelTimeFor: 'all',
        },
      }
    );
    console.log('Route response:', routeResponse.data);

    // Fetch traffic (for congestion simulation)
    const centerLat = (6.6097 + 6.4412) / 2;
    const centerLon = (3.3081 + 3.4249) / 2;
    const trafficResponse = await axios.get(TRAFFIC_URL, {
      params: {
        key: TOMTOM_API_KEY,
        point: `${centerLat},${centerLon}`,
        unit: 'KMPH',
      },
    });
    console.log('Traffic response:', trafficResponse.data);

    // Process routes
    const routes = routeResponse.data.routes.map((route, index) => ({
      id: index === 0 ? 'main' : 'alt',
      path: route.legs.flatMap(leg => leg.points.map(p => [p.latitude, p.longitude])),
      color: index === 0 ? '#FF0000' : '#800080',
      eta: Math.round(route.summary.travelTimeInSeconds / 60) + (index === 0 ? 5 : 10), // Simulate congestion
    }));
    const traffic = {
      currentSpeed: 15, // Hardcode congestion
      freeFlowSpeed: trafficResponse.data.flowSegmentData?.freeFlowSpeed || 60,
      coordinates: {
        coordinate: trafficResponse.data.flowSegmentData?.coordinates?.coordinate || [
          { latitude: 6.525, longitude: 3.3665 },
          { latitude: 6.510, longitude: 3.3600 },
          { latitude: 6.500, longitude: 3.3550 },
        ],
      },
    };

    // Save to JSON
    const output = { routes, traffic };
    await fs.writeFile('src/services/mockRoutes.json', JSON.stringify(output, null, 2));
    console.log('Saved routes to src/services/mockRoutes.json');
  } catch (error) {
    console.error('Error:', error.message, error.response?.data, error.response?.status);
  }
}

fetchRoutes();