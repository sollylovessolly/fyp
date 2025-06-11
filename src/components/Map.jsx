
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import 'leaflet/dist/leaflet.css';
import '../App.css';
import { locations } from '../App';

function Map({ start, end, weather, selectedRoute, setSelectedRoute }) {
  const [routes, setRoutes] = useState([]);
  const [error, setError] = useState(null);
  const mapRef = useRef();

  // Hardcoded TomTom API key (replace with your actual key)
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

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setError(null);
        // Validate start and end
        if (!start || !end || typeof start !== 'string' || typeof end !== 'string') {
          throw new Error('Invalid start or end coordinates');
        }
        console.log('Fetching routes with:', { start, end });
        const startCoords = start.split(',').map(Number);
        const endCoords = end.split(',').map(Number);
        if (startCoords.length !== 2 || endCoords.length !== 2 || startCoords.some(isNaN) || endCoords.some(isNaN)) {
          throw new Error('Invalid coordinate format');
        }
        const response = await fetch(
          `https://api.tomtom.com/routing/1/calculateRoute/${startCoords.join(',')}:${endCoords.join(',')}/json?key=${TOMTOM_API_KEY}&maxAlternatives=2`
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.description);
        const newRoutes = data.routes?.map((route, index) => {
          const coords = route.legs[0].points?.map(p => [p.latitude, p.longitude]) || [];
          return {
            id: index,
            coordinates: coords,
            summary: route.summary || {},
            name: index === 0 ? 'main' : `alternate${index}`,
          };
        }) || [];
        setRoutes(newRoutes);
        console.log('Routes received:', newRoutes);
      } catch (err) {
        setError('Failed to fetch routes: ' + err.message);
        console.error('Fetch routes error:', err.message);
      }
    };
    if (start && end) {
      fetchRoutes();
    }
  }, [start, end, TOMTOM_API_KEY]);

  useEffect(() => {
    if (mapRef.current && Array.isArray(routes) && routes.length > 0) {
      const validCoordinates = routes
        .flatMap(route => route.coordinates || [])
        .filter(coord => Array.isArray(coord) && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));
      if (validCoordinates.length > 0) {
        const bounds = L.latLngBounds(validCoordinates);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [routes]);

  const handleSaveRoute = async () => {
    try {
      const selected = routes.find(r => r.name === selectedRoute);
      if (!selected) {
        setError('No route selected');
        return;
      }
      const startLoc = locations.find(loc => loc.coords === start);
      const endLoc = locations.find(loc => loc.coords === end);
      if (!startLoc || !endLoc) {
        setError('Invalid start or end location');
        return;
      }
      console.log('Saving route:', { startLoc, endLoc, selectedRoute });
      const { error: routesError } = await supabase.from('saved_routes').insert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        start_name: startLoc.name,
        end_name: endLoc.name,
        start_addr: start,
        end_addr: end,
      });
      if (routesError) throw routesError;
      alert('Route saved!');
    } catch (err) {
      setError('Failed to save route: ' + err.message);
      console.error('Save route error:', err);
    }
  };

  if (error) {
    return <div className="text-red-600 text-center mt-4">{error}</div>;
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {weather && (
        <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded-lg shadow-md w-full max-w-lg">
          Weather: {weather.description}, {weather.temperature}°C
        </div>
      )}
      {Array.isArray(routes) && routes.length > 0 && (
        <div className="mb-6 w-full max-w-lg">
          <label className="block text-gray-700 font-medium mb-2">Select Route</label>
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            {routes.map(route => (
              <option key={route.id} value={route.name}>
                {route.name === 'main' ? 'Main Route' : `Alternate ${route.id}`} (
                {(route.summary.length / 1000).toFixed(1)} km, {(route.summary.travelTimeInSeconds / 60).toFixed(0)} min)
              </option>
            ))}
          </select>
          <button
            onClick={handleSaveRoute}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            Save Route
          </button>
        </div>
      )}
      <MapContainer
        ref={mapRef}
        center={[6.5244, 3.3792]}
        zoom={12}
        style={{ height: '500px', width: '100%' }}
        className="rounded-lg shadow-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {start && typeof start === 'string' && start.split(',').length === 2 && (
          <Marker position={start.split(',').map(Number)} icon={startIcon}>
            <Popup>Start: {locations.find(loc => loc.coords === start)?.name}</Popup>
          </Marker>
        )}
        {end && typeof end === 'string' && end.split(',').length === 2 && (
          <Marker position={end.split(',').map(Number)} icon={endIcon}>
            <Popup>End: {locations.find(loc => loc.coords === end)?.name}</Popup>
          </Marker>
        )}
        {Array.isArray(routes) &&
          routes.map(route => (
            <Polyline
              key={route.id}
              positions={route.coordinates || []}
              color={route.name === selectedRoute ? 'blue' : 'gray'}
              weight={route.name === selectedRoute ? 5 : 3}
              opacity={route.name === selectedRoute ? 1 : 0.5}
            />
          ))}
      </MapContainer>
    </div>
  );
}

export default Map;