import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import 'leaflet/dist/leaflet.css';
import '../App.css';

function Map({ start, end, weather, selectedRoute, setSelectedRoute, currentLocation }) {
  const [routes, setRoutes] = useState([]);
  const [trafficSegments, setTrafficSegments] = useState({});
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [incidentType, setIncidentType] = useState('accident');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const mapRef = useRef();

  const TOMTOM_API_KEY = '8HW8UzF88GLp2mL9myetUktvvhazsgkI';

  // Custom icons
  const startIcon = new L.Icon({
    iconUrl: 'https://img.icons8.com/color/48/marker-blue.png',
    iconRetinaUrl: 'https://img.icons8.com/color/48/marker-blue.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const endIcon = new L.Icon({
    iconUrl: 'https://img.icons8.com/color/48/marker-yellow.png',
    iconRetinaUrl: 'https://img.icons8.com/color/48/marker-yellow.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const currentLocationIcon = new L.Icon({
    iconUrl: 'https://img.icons8.com/color/48/marker-purple.png',
    iconRetinaUrl: 'https://img.icons8.com/color/48/marker-purple.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const incidentIcon = (type) => new L.Icon({
    iconUrl: type === 'accident'
      ? 'https://img.icons8.com/color/48/car-crash.png'
      : 'https://img.icons8.com/color/48/roadblock.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

  // Demo roadblock
  const demoRoadblock = {
    id: 'demo-1',
    location_lat: 6.4575,
    location_lon: 3.1818,
    type: 'roadblock',
    description: 'Permanent roadblock for demonstration near Victoria Island',
    created_at: new Date().toISOString(),
    is_verified: true,
  };

  // Route base colors
  const routeColors = {
    main: '#0000FF',
    'alternate-1': '#00FF00',
    'alternate-2': '#800080',
  };

  // Traffic congestion colors (5 levels)
  const trafficColors = {
    veryHeavy: '#8B0000', // < 0.3
    heavy: '#FF0000', // 0.3–0.5
    moderate: '#FFA500', // 0.5–0.7
    light: '#FFFF00', // 0.7–0.9
    clear: '#00FF00', // > 0.9
  };

  // Fetch routes
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setError(null);
        if (!start || !end || typeof start !== 'string' || typeof end !== 'string') {
          throw new Error('Invalid start or end coordinates');
        }
        console.log('fetchRoutes: Received props', { start, end });
        const startCoordArray = start.split(',').map(Number);
        const endCoordArray = end.split(',').map(Number);
        if (
          startCoordArray.length !== 2 ||
          endCoordArray.length !== 2 ||
          startCoordArray.some(isNaN) ||
          endCoordArray.some(isNaN)
        ) {
          throw new Error('Invalid coordinate format');
        }
        const response = await fetch(
          `https://api.tomtom.com/routing/1/calculateRoute/${startCoordArray.join(',')}:${endCoordArray.join(',')}/json?key=${TOMTOM_API_KEY}&maxAlternatives=2`
        );
        if (!response.ok) {
          throw new Error(`TomTom Routing API error: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error.description);
        const newRoutes = data.routes?.map((route, index) => ({
          id: index,
          coordinates: route.legs?.[0]?.points?.map(p => [p.latitude, p.longitude]) || [],
          summary: route.summary || {},
          name: index === 0 ? 'main' : `alternate-${index}`,
        })) || [];
        if (newRoutes.length === 0) {
          throw new Error('No routes found');
        }
        setRoutes(newRoutes);
        if (!newRoutes.find(r => r.name === selectedRoute)) {
          setSelectedRoute('main');
        }
        console.log('fetchRoutes: Routes set', newRoutes);
      } catch (err) {
        setError('Failed to fetch routes: ' + err.message);
        console.error('Error fetching routes:', err);
        setRoutes([]);
      }
    };

    const fetchHotspots = async () => {
      try {
        const { data, error } = await supabase.rpc('get_incident_hotspots');
        if (error) throw error;
        setHotspots(data || []);
        console.log('Hotspots fetched:', data);
      } catch (err) {
        console.error('Error fetching hotspots:', err);
        setHotspots([]);
      }
    };

    if (start && end) {
      setRoutes([]); // Clear routes
      fetchRoutes();
      fetchHotspots();
    }
  }, [start, end, setSelectedRoute]);

  // Fetch traffic segment data
  useEffect(() => {
    const fetchTrafficData = async () => {
      if (!routes.length) return;
      try {
        const newTrafficSegments = {};
        for (const route of routes) {
          const coords = route.coordinates;
          const sampleIndices = [
            0,
            Math.floor(coords.length * 0.167),
            Math.floor(coords.length * 0.333),
            Math.floor(coords.length * 0.5),
            Math.floor(coords.length * 0.667),
            Math.floor(coords.length * 0.833),
            coords.length - 1,
          ].filter((i, idx, arr) => arr.indexOf(i) === idx);
          const segments = [];
          for (let i = 0; i < sampleIndices.length - 1; i++) {
            const startIdx = sampleIndices[i];
            const endIdx = sampleIndices[i + 1];
            const segmentCoords = coords.slice(startIdx, endIdx + 1);
            const midPoint = segmentCoords[Math.floor(segmentCoords.length / 2)];
            try {
              const response = await fetch(
                `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?key=${TOMTOM_API_KEY}&point=${midPoint[0]},${midPoint[1]}`
              );
              if (!response.ok) {
                throw new Error(`Traffic API error: ${response.status}`);
              }
              const data = await response.json();
              if (data.flowSegmentData) {
                const ratio = data.flowSegmentData.currentSpeed / data.flowSegmentData.freeFlowSpeed;
                segments.push({
                  coordinates: segmentCoords,
                  ratio: ratio,
                  currentSpeed: data.flowSegmentData.currentSpeed,
                  freeFlowSpeed: data.flowSegmentData.freeFlowSpeed,
                });
              } else {
                segments.push({
                  coordinates: segmentCoords,
                  ratio: null,
                  currentSpeed: null,
                  freeFlowSpeed: null,
                });
              }
            } catch (err) {
              console.warn(`Failed to fetch traffic for point ${midPoint}:`, err.message);
              segments.push({
                coordinates: segmentCoords,
                ratio: null,
                currentSpeed: null,
                freeFlowSpeed: null,
              });
            }
          }
          newTrafficSegments[route.name] = segments;
        }
        setTrafficSegments(newTrafficSegments);
        setLastTrafficUpdate(new Date().toLocaleTimeString());
        console.log('Traffic segments fetched:', newTrafficSegments);
      } catch (err) {
        console.error('Error fetching traffic data:', err);
        setTrafficSegments({});
      }
    };

    fetchTrafficData();
    const interval = setInterval(fetchTrafficData, 60000);
    return () => clearInterval(interval);
  }, [routes]);

  // Fetch geofenced incidents
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        if (!routes.length) {
          setIncidents([demoRoadblock]);
          return;
        }
        const routePoints = routes.find(r => r.name === selectedRoute)?.coordinates
          .map(([lat, lon]) => `${lon},${lat}`)
          .join(',') || '';
        if (!routePoints) {
          setIncidents([demoRoadblock]);
          return;
        }
        const { data, error } = await supabase.rpc('get_geofenced_incidents', {
          route_points: routePoints,
          distance_meters: 500,
        });
        if (error) throw error;
        setIncidents([...(data || []), demoRoadblock]);
        console.log('Geofenced incidents fetched:', data);
      } catch (err) {
        setError('Failed to fetch incidents: ' + err.message);
        console.error('Error fetching incidents:', err);
        setIncidents([demoRoadblock]);
      }
    };

    fetchIncidents();
  }, [routes, selectedRoute]);

  // Center map
  useEffect(() => {
    if (!mapRef.current) {
      console.log('Map ref not ready');
      return;
    }

    console.log('Center map: Routes and props', { routes: routes.length, start, end });

    if (routes.length) {
      const selected = routes.find(r => r.name === selectedRoute);
      const validCoordinates = selected?.coordinates
        ?.filter(c => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1])) || [];
      if (validCoordinates.length) {
        console.log('Fitting map to bounds:', validCoordinates.length);
        const bounds = L.latLngBounds(validCoordinates);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } else if (start && typeof start === 'string' && start.split(',').length === 2) {
      const coords = start.split(',').map(Number);
      if (coords.every(n => !isNaN(n))) {
        console.log('Centering map on start coords:', coords);
        mapRef.current.setView(coords, 12);
      }
    }
  }, [routes, start, end, selectedRoute]);

  const handleSaveRoute = async () => {
    try {
      const selected = routes.find(r => r.name === selectedRoute);
      if (!selected) {
        setError('No route selected');
        return;
      }
      const startName = start === currentLocation ? 'Current Location' : start;
      console.log('Saving route:', { start: startName, end });
      const { error: routesError } = await supabase.from('saved_routes').insert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        start_name: startName,
        end_name: end,
        start_addr: start,
        end_addr: end,
      });
      if (routesError) throw routesError;
      setSuccessMessage('Route saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to save route: ' + err.message);
      console.error('Error saving route:', err);
    }
  };

  const handleReportIncident = async (e) => {
    e.preventDefault();
    if (!start) {
      setError('Starting point not available for reporting');
      return;
    }
    if (!incidentDesc.trim()) {
      setError('Please provide a description');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const [lat, lon] = start.split(',').map(Number);
      const { data, error: incidentError } = await supabase.from('incidents').insert([
        {
          user_id: (await supabase.auth.getUser()).data.user.id,
          location_lat: lat,
          location_lon: lon,
          geom: `SRID=4326;POINT(${lon} ${lat})`,
          type: incidentType,
          description: incidentDesc.trim(),
          is_verified: false,
          created_at: new Date().toISOString(),
        },
      ]).select();
      if (incidentError) throw incidentError;
      setShowReportForm(false);
      setIncidentDesc('');
      setSuccessMessage('Incident reported successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      console.log('Incident reported:', data[0]);
      setIncidents((prev) => [...prev.filter(i => i.id !== 'demo-1'), data[0], demoRoadblock]);
    } catch (err) {
      setError('Failed to report incident: ' + err.message);
      console.error('Error reporting:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearIncidents = async () => {
    try {
      const { error } = await supabase.from('incidents').delete().neq('id', 0);
      if (error) throw error;
      setIncidents([demoRoadblock]);
      setSuccessMessage('Incidents cleared');
      setTimeout(() => setSuccessMessage(null), 3000);
      console.log('Incidents cleared');
    } catch (err) {
      setError('Failed to clear incidents: ' + err.message);
      console.error('Error clearing incidents:', err);
    }
  };

  // Get segment congestion color
  const getSegmentColor = (ratio) => {
    if (!ratio) return '#0000FF';
    if (ratio < 0.3) return trafficColors.veryHeavy;
    if (ratio < 0.5) return trafficColors.heavy;
    if (ratio < 0.7) return trafficColors.moderate;
    if (ratio < 0.9) return trafficColors.light;
    return trafficColors.clear;
  };

  // Get overall congestion
  const getOverallCongestion = (routeName) => {
    const segments = trafficSegments[routeName];
    if (!segments || !segments.length || !segments.some(s => s.ratio)) {
      return { status: 'Unknown', speed: 'N/A', color: routeColors[routeName] || '#0000FF', ratio: 1 };
    }
    const validSegments = segments.filter(s => s.ratio);
    const avgRatio = validSegments.reduce((sum, s) => sum + s.ratio, 0) / validSegments.length;
    const avgSpeed = validSegments.reduce((sum, s) => sum + (s.currentSpeed || 0), 0) / validSegments.length;
    let status, color;
    if (avgRatio < 0.3) {
      status = 'Very Heavy Traffic';
      color = trafficColors.veryHeavy;
    } else if (avgRatio < 0.5) {
      status = 'Heavy Traffic';
      color = trafficColors.heavy;
    } else if (avgRatio < 0.7) {
      status = 'Moderate Traffic';
      color = trafficColors.moderate;
    } else if (avgRatio < 0.9) {
      status = 'Light Traffic';
      color = trafficColors.light;
    } else {
      status = 'Clear';
      color = trafficColors.clear;
    }
    return { status, speed: `${avgSpeed.toFixed(1)} km/h`, color, ratio: avgRatio };
  };

  // Handle route selection
  const handleRouteSelect = (routeName) => {
    console.log('Selecting route:', routeName, 'Current selected:', selectedRoute);
    setSelectedRoute(routeName);
  };

  // Calculate max incident count for hotspot opacity
  const maxCount = hotspots.length > 0 ? Math.max(...hotspots.map(h => h.incident_count)) : 1;

  if (error) return <div className="text-red-500 text-center mt-6">{error}</div>;

  return (
    <div className="w-full max-w-3xl mx-auto relative">
      {weather && (
        <div className="fixed bottom-4 right-4 w-64 bg-white p-4 rounded-lg shadow-lg border border-gray-200 z-[1000]">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">Weather</h4>
          <div className="text-xs text-gray-600">
            <p><strong>Now:</strong> {weather.current?.description}, {weather.current?.temperature}°C</p>
            {weather.forecast?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {weather.forecast.map((hour, i) => (
                  <li key={i}>
                    {hour.time}: {hour.description}, {hour.temperature}°C
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-200 text-gray-800 p-3 rounded-lg shadow-md z-[2000]">
          {successMessage}
        </div>
      )}
      {routes.length > 0 && (
        <div className="mb-6 w-full max-w-md mx-auto">
          <div className="mb-4 p-4 bg-yellow-100 text-gray-800 rounded-lg shadow-md">
            <p className="font-semibold mb-2">Select Route:</p>
            <div className="flex flex-wrap gap-2">
              {routes.map((route) => {
                const { status, speed, color } = getOverallCongestion(route.name);
                return (
                  <button
                    key={route.id}
                    onClick={() => handleRouteSelect(route.name)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition flex items-center ${
                      selectedRoute === route.name
                        ? 'bg-yellow-500 text-gray-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-yellow-300'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: color }}
                    ></span>
                    {route.name === 'main' ? 'Main Route' : `Alternate ${route.id}`}
                    {route.summary.travelTimeInSeconds && ` (${(route.summary.travelTimeInSeconds / 60).toFixed(0)} min)`}
                    {` - ${status} (${speed})`}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm">
              Predicted Traffic: {(routes.find(r => r.name === selectedRoute)?.summary.travelTimeInSeconds / 60 * (new Date().getHours() > 17 ? 1.5 : 1)).toFixed(0)} min (based on {new Date().getHours() > 17 ? 'peak' : 'off-peak'} hours)
            </p>
            {lastTrafficUpdate && (
              <p className="mt-1 text-xs text-gray-600">
                Traffic Data Updated: {lastTrafficUpdate}
              </p>
            )}
          </div>
          <button
            onClick={handleSaveRoute}
            className="mt-4 w-full px-4 py-2 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 transition"
          >
            Save Selected Route
          </button>
        </div>
      )}
      <MapContainer
        ref={mapRef}
        center={[6.5244, 3.3792]} // Lagos default, dynamic centering below
        zoom={12}
        style={{ height: '600px', width: '100%' }}
        className="rounded-lg shadow-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {currentLocation && (
          <Marker position={currentLocation.split(',').map(Number)} icon={currentLocationIcon}>
            <Popup>Your Current Location</Popup>
          </Marker>
        )}
        {start && typeof start === 'string' && start.split(',').length === 2 && start.split(',').map(Number).every(n => !isNaN(n)) && (
          <Marker position={start.split(',').map(Number)} icon={startIcon}>
            <Popup>Starting Point</Popup>
          </Marker>
        )}
        {end && typeof end === 'string' && end.split(',').length === 2 && end.split(',').map(Number).every(n => !isNaN(n)) && (
          <Marker position={end.split(',').map(Number)} icon={endIcon}>
            <Popup>Destination</Popup>
          </Marker>
        )}
        {routes
          .filter(route => route.name === selectedRoute)
          .map(route => (
            <React.Fragment key={route.id}>
              {trafficSegments[route.name]?.map((segment, idx) => (
                <Polyline
                  key={`${route.id}-${idx}`}
                  positions={segment.coordinates || []}
                  color={getSegmentColor(segment.ratio)}
                  weight={5}
                  opacity={1}
                />
              ))}
            </React.Fragment>
          ))}
        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.location_lat, incident.location_lon]}
            icon={incidentIcon(incident.type)}
          >
            <Popup>
              <b>{incident.type.charAt(0).toUpperCase() + incident.type.slice(1)}</b>
              <p>{incident.description || 'No description'}</p>
              <p>Reported: {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'N/A'}</p>
              <p>Verified: {incident.is_verified ? 'Yes' : 'No'}</p>
            </Popup>
          </Marker>
        ))}
        {hotspots.map((hotspot, index) => (
          <Circle
            key={index}
            center={[hotspot.center_lat, hotspot.center_lon]}
            radius={500}
            color="#DEAC00"
            fillOpacity={0.3 * (hotspot.incident_count / maxCount)}
          >
            <Popup>{hotspot.incident_count} incidents in this area</Popup>
          </Circle>
        ))}
      </MapContainer>
      <div className="mt-6 w-full max-w-md mx-auto space-y-4">
        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          {showReportForm ? 'Cancel Report' : 'Report Incident'}
        </button>
        {showReportForm && (
          <form onSubmit={handleReportIncident} className="mt-4 p-6 bg-white shadow-lg rounded-lg">
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-1">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full p-3 border rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-yellow-500 transition"
              >
                <option value="accident">Accident</option>
                <option value="roadblock">Roadblock</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-1">Description</label>
              <textarea
                value={incidentDesc}
                onChange={(e) => setIncidentDesc(e.target.value)}
                placeholder="Describe the incident (e.g., 'Two cars crashed on the highway')"
                className="w-full p-3 border rounded-lg text-gray-800 focus:ring-2 focus:ring-yellow-500 transition"
                rows="4"
                required
              />
            </div>
            <div className="mb-4">
              <p className="block text-gray-700 font-medium mb-1">Location</p>
              <p className="text-gray-600 text-sm">Using your starting point</p>
              {start && (
                <p className="text-yellow-500 text-sm font-medium">
                  Location: ({start.split(',').map(n => Number(n).toFixed(4)).join(', ')})
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !start}
              className="w-full px-4 py-2 bg-yellow-500 text-gray-800 rounded-lg transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        )}
        <button
          onClick={handleClearIncidents}
          className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
        >
          Clear All Incidents
        </button>
      </div>
    </div>
  );
}

export default Map;