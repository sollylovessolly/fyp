
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import 'leaflet/dist/leaflet.css';
import '../App.css';
import { locations } from '../App';

function Map({ end = '6.4089,3.4068', weather, selectedRoute, setSelectedRoute }) {
  const [routes, setRoutes] = useState([]);
  const [trafficData, setTrafficData] = useState({});
  const [lastTrafficUpdate, setLastTrafficUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [incidentType, setIncidentType] = useState('accident');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const mapRef = useRef();

  const TOMTOM_API_KEY = '8HW8UzF88GLp2mL9myetUktvvhazsgkI';

  const startIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const endIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const incidentIcon = (type) => new L.Icon({
    iconUrl: type === 'accident'
      ? 'https://img.icons8.com/color/48/000000/car-crash.png'
      : 'https://img.icons8.com/color/48/000000/roadblock.png',
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
    main: '#0000FF', // Blue
    'alternate-1': '#00FF00', // Green
    'alternate-2': '#800080', // Purple
  };

  // Traffic congestion colors
  const trafficColors = {
    heavy: '#FF0000', // Red: currentSpeed/freeFlowSpeed < 0.5
    moderate: '#FFFF00', // Yellow: 0.5–0.8
    clear: '#00FF00', // Green: >0.8
  };

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation(`${latitude},${longitude}`);
          console.log('Current location:', { latitude, longitude });
        },
        (err) => {
          setError('Failed to get location: ' + err.message);
          console.error('Geolocation error:', err);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  }, []);

  // Fetch multiple routes and hotspots
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setError(null);
        if (!currentLocation || !end || typeof end !== 'string') {
          throw new Error('Invalid start or end coordinates');
        }
        console.log('Fetching routes with:', { start: currentLocation, end });
        const startCoords = currentLocation.split(',').map(Number);
        const endCoords = end.split(',').map(Number);
        if (startCoords.length !== 2 || endCoords.length !== 2 || startCoords.some(isNaN) || endCoords.some(isNaN)) {
          throw new Error('Invalid coordinate format');
        }
        const response = await fetch(
          `https://api.tomtom.com/routing/1/calculateRoute/${startCoords.join(',')}:${endCoords.join(',')}/json?key=${TOMTOM_API_KEY}&maxAlternatives=2`
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
        setSelectedRoute('main');
        console.log('Routes fetched:', newRoutes);
      } catch (err) {
        setError('Failed to fetch routes: ' + err.message);
        console.error('Error fetching routes:', err);
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

    if (currentLocation && end) {
      fetchRoutes();
      fetchHotspots();
    }
  }, [currentLocation, end]);

  // Fetch traffic flow data
  useEffect(() => {
    const fetchTrafficData = async () => {
      if (!routes.length) return;
      try {
        const newTrafficData = {};
        for (const route of routes) {
          const coords = route.coordinates;
          const points = [
            coords[0], // Start
            coords[Math.floor(coords.length / 2)], // Midpoint
            coords[coords.length - 1], // End
          ].filter(c => c && c.length === 2);
          const trafficResults = [];
          for (const [lat, lon] of points) {
            try {
              const response = await fetch(
                `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?key=${TOMTOM_API_KEY}&point=${lat},${lon}`
              );
              if (!response.ok) {
                throw new Error(`Traffic API error: ${response.status}`);
              }
              const data = await response.json();
              if (data.flowSegmentData) {
                trafficResults.push({
                  point: [lat, lon],
                  currentSpeed: data.flowSegmentData.currentSpeed,
                  freeFlowSpeed: data.flowSegmentData.freeFlowSpeed,
                  coordinates: data.flowSegmentData.coordinates?.coordinate?.map(c => [c.latitude, c.longitude]) || [],
                });
              }
            } catch (err) {
              console.warn(`Failed to fetch traffic for point ${lat},${lon}:`, err.message);
              trafficResults.push({
                point: [lat, lon],
                currentSpeed: null,
                freeFlowSpeed: null,
                coordinates: [],
              });
            }
          }
          newTrafficData[route.name] = trafficResults;
        }
        setTrafficData(newTrafficData);
        setLastTrafficUpdate(new Date().toLocaleTimeString());
        console.log('Traffic data fetched:', newTrafficData);
      } catch (err) {
        console.error('Error fetching traffic data:', err);
        setTrafficData({});
      }
    };

    fetchTrafficData();
    const interval = setInterval(fetchTrafficData, 60000); // Refresh every 60s
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

  // Fit map to route bounds
  useEffect(() => {
    if (!mapRef.current || !Array.isArray(routes) || !currentLocation) {
      console.log('Map ref or routes not ready:', { mapRef: !!mapRef.current, routes: routes.length, currentLocation });
      return;
    }

    const selected = routes.find(r => r.name === selectedRoute);
    const validCoordinates = selected?.coordinates
      ?.filter(coord => Array.isArray(coord) && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1])) || [];

    if (validCoordinates.length > 0) {
      console.log('Fitting map to bounds:', validCoordinates.length);
      const bounds = L.latLngBounds(validCoordinates);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else {
      const coords = currentLocation.split(',').map(Number);
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        console.log('Centering map on current location:', coords);
        mapRef.current.setView(coords, 12);
      } else {
        console.log('Invalid current location:', currentLocation);
      }
    }
  }, [routes, currentLocation, selectedRoute, trafficData]);

  const handleSaveRoute = async () => {
    try {
      const selected = routes.find(r => r.name === selectedRoute);
      if (!selected) {
        setError('No route selected');
        return;
      }
      const endLoc = locations.find(loc => loc.coords === end);
      if (!endLoc) {
        setError('Invalid end location');
        return;
      }
      console.log('Saving route:', { start: currentLocation, endLoc, selectedRoute });
      const { error: routesError } = await supabase.from('saved_routes').insert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        start_name: 'Current Location',
        end_name: endLoc.name,
        start_addr: currentLocation,
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
    if (!currentLocation) {
      setError('Current location not available');
      return;
    }
    if (!incidentDesc.trim()) {
      setError('Please provide a description');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const [lat, lon] = currentLocation.split(',').map(Number);
      const { data, error: incidentError } = await supabase.from('incidents').insert([
        {
          user_id: (await supabase.auth.getUser()).data.user.id,
          location_lat: lat,
          location_lon: lon,
          geom: `SRID=4326;POINT(${lon} ${lat})`,
          type: incidentType,
          description: incidentDesc.trim(),
          is_verified: false,
        },
      ]).select();
      if (incidentError) throw incidentError;
      setShowReportForm(false);
      setIncidentDesc('');
      setSuccessMessage('Incident reported successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      console.log('Incident:', data[0]);
      setIncidents((prev) => [...prev, data[0], demoRoadblock]);
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

  // Get congestion color for a route
  const getCongestionColor = (routeName) => {
    const traffic = trafficData[routeName];
    if (!traffic || !traffic.length || !traffic.some(t => t.currentSpeed && t.freeFlowSpeed)) {
      console.log(`No valid traffic data for ${routeName}, using fallback color`);
      return routeColors[routeName] || '#0000FF';
    }
    const validTraffic = traffic.filter(t => t.currentSpeed && t.freeFlowSpeed);
    const avgRatio = validTraffic.reduce((sum, t) => sum + (t.currentSpeed / t.freeFlowSpeed), 0) / validTraffic.length;
    console.log(`Traffic ratio for ${routeName}: ${avgRatio}`);
    if (avgRatio < 0.5) return trafficColors.heavy;
    if (avgRatio <= 0.8) return trafficColors.moderate;
    return trafficColors.clear;
  };

  // Get congestion status and speed for UI
  const getCongestionInfo = (routeName) => {
    const traffic = trafficData[routeName];
    if (!traffic || !traffic.length || !traffic.some(t => t.currentSpeed && t.freeFlowSpeed)) {
      return { status: 'Unknown', speed: 'N/A', color: routeColors[routeName] || '#0000FF' };
    }
    const validTraffic = traffic.filter(t => t.currentSpeed && t.freeFlowSpeed);
    const avgRatio = validTraffic.reduce((sum, t) => sum + (t.currentSpeed / t.freeFlowSpeed), 0) / validTraffic.length;
    const avgSpeed = validTraffic.reduce((sum, t) => sum + t.currentSpeed, 0) / validTraffic.length;
    let status, color;
    if (avgRatio < 0.5) {
      status = 'Heavy Traffic';
      color = trafficColors.heavy;
    } else if (avgRatio <= 0.8) {
      status = 'Moderate Traffic';
      color = trafficColors.moderate;
    } else {
      status = 'Clear';
      color = trafficColors.clear;
    }
    return { status, speed: `${avgSpeed.toFixed(1)} km/h`, color };
  };

  // Handle route selection
  const handleRouteSelect = (routeName) => {
    console.log('Selecting route:', routeName);
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
      {Array.isArray(routes) && routes.length > 0 && (
        <div className="mb-6 w-full max-w-md mx-auto">
          <div className="mb-4 p-4 bg-yellow-100 text-gray-800 rounded-lg shadow-md">
            <p className="font-semibold mb-2">Select Route:</p>
            <div className="flex flex-wrap gap-2">
              {routes.map((route) => {
                const { status, speed, color } = getCongestionInfo(route.name);
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
        center={[6.5244, 3.3792]}
        zoom={12}
        style={{ height: '600px', width: '100%' }}
        className="rounded-lg shadow-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {currentLocation && typeof currentLocation === 'string' && currentLocation.split(',').length === 2 && (
          <Marker position={currentLocation.split(',').map(Number)} icon={startIcon}>
            <Popup>Start: Current Location</Popup>
          </Marker>
        )}
        {end && typeof end === 'string' && end.split(',').length === 2 && (
          <Marker position={end.split(',').map(Number)} icon={endIcon}>
            <Popup>End: {locations.find(loc => loc.coords === end)?.name || 'Victoria Island'}</Popup>
          </Marker>
        )}
        {Array.isArray(routes) &&
          routes
            .filter(route => route.name === selectedRoute)
            .map(route => (
              <Polyline
                key={`${route.id}-${JSON.stringify(trafficData[route.name])}`}
                positions={route.coordinates || []}
                color={getCongestionColor(route.name)}
                weight={5}
                opacity={1}
              />
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
              <p className="text-gray-600 text-sm">Using your current location</p>
              {currentLocation && (
                <p className="text-yellow-500 text-sm font-medium">
                  Location: ({currentLocation.split(',').map(n => Number(n).toFixed(4)).join(', ')})
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !currentLocation}
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