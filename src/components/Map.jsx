
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRoute } from '../services/Route';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41],
});

function Map({ start, end, weather, selectedRoute, setSelectedRoute }) {
  const [routes, setRoutes] = useState([]);
  const [trafficData, setTrafficData] = useState(null);
  const [mainETA, setMainETA] = useState(45);
  const [altETA, setAltETA] = useState(50);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('Map.jsx with TomTom API');
    console.log('Input coords:', { start, end });

    const fetchRoutes = async () => {
      try {
        console.log('getRoute called with:', { start, end });
        const response = await getRoute(start, end);
        console.log('Routes received:', response.routes);
        const validRoutes = response.routes.filter(route => route.path?.length > 1);
        console.log('Valid routes:', validRoutes);
        if (validRoutes.length === 0) {
          console.warn('No valid routes with sufficient points');
          setError('No valid routes found. Please check coordinates.');
          setRoutes([]);
          setTrafficData(null);
          setMainETA(45);
          setAltETA(50);
          return;
        }
        setRoutes(validRoutes);
        setTrafficData(response.traffic);
        setMainETA(validRoutes[0]?.eta || 45);
        setAltETA(validRoutes[1]?.eta || 50);
        setError(null);
        console.log('Main total:', validRoutes[0]?.eta || 45, 'Alt total:', validRoutes[1]?.eta || 50);
      } catch (error) {
        console.error('Error fetching routes:', error.message);
        setError('Failed to fetch routes: ' + error.message);
        setRoutes([]);
        setTrafficData(null);
        setMainETA(45);
        setAltETA(50);
      }
    };

    if (start && end) {
      fetchRoutes();
    }
  }, [start, end]);

  const startPos = start.split(',').map(Number);
  const endPos = end.split(',').map(Number);
  const center = [(startPos[0] + endPos[0]) / 2, (startPos[1] + endPos[1]) / 2];

  const getTrafficColor = (traffic) => {
    if (!traffic) return '#808080';
    const speedRatio = traffic.currentSpeed / traffic.freeFlowSpeed;
    if (speedRatio > 0.75) return '#00FF00';
    if (speedRatio > 0.5) return '#FFFF00';
    return '#FF0000';
  };

  console.log('Map rendering:', { startPos, endPos, routes, trafficData, error });

  return (
    <div className="relative">
      {error && (
        <div className="absolute top-4 left-4 bg-red-100 bg-opacity-90 p-4 rounded-lg shadow-lg border border-red-200 z-10">
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {startPos[0] && startPos[1] && (
          <Marker position={startPos} icon={blueIcon}>
            <Popup>Start: {start}</Popup>
          </Marker>
        )}
        {endPos[0] && endPos[1] && (
          <Marker position={endPos} icon={redIcon}>
            <Popup>End: {end}</Popup>
          </Marker>
        )}
        {routes.map(route => (
          route.path?.length > 1 && (
            <Polyline
              key={route.id}
              positions={route.path}
              color={route.color}
              weight={selectedRoute === route.id ? 6 : 4}
              opacity={selectedRoute === route.id ? 1 : 0.6}
              eventHandlers={{
                click: () => {
                  console.log('Route clicked:', route.id);
                  setSelectedRoute(route.id);
                },
              }}
            >
              <Popup>{route.id.toUpperCase()} Route: {route.eta} mins</Popup>
            </Polyline>
          )
        ))}
        {trafficData?.coordinates?.coordinate?.length > 1 && (
          <Polyline
            positions={trafficData.coordinates.coordinate}
            color={getTrafficColor(trafficData)}
            weight={3}
            opacity={0.8}
            dashArray="5, 10"
          >
            <Popup>
              Traffic: {trafficData.currentSpeed} km/h (
              {trafficData.currentSpeed < trafficData.freeFlowSpeed * 0.75 ? 'Congested' : trafficData.currentSpeed < trafficData.freeFlowSpeed * 0.9 ? 'Slow' : 'Free'})
            </Popup>
          </Polyline>
        )}
      </MapContainer>
      <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-800">
          Route: <span className="text-blue-600">{selectedRoute.toUpperCase()}</span> | ETA:{' '}
          <span className="text-orange-500">{selectedRoute === 'main' ? mainETA : altETA} mins</span>
        </p>
        {trafficData && (
          <p className="text-sm text-gray-600">
            Traffic:{' '}
            <span
              className={`font-medium ${
                getTrafficColor(trafficData) === '#FF0000'
                  ? 'text-red-500'
                  : getTrafficColor(trafficData) === '#FFFF00'
                  ? 'text-yellow-500'
                  : 'text-green-500'
              }`}
            >
              {trafficData.currentSpeed} km/h (
              {trafficData.currentSpeed < trafficData.freeFlowSpeed * 0.75
                ? 'Congested'
                : trafficData.currentSpeed < trafficData.freeFlowSpeed * 0.9
                ? 'Slow'
                : 'Free'
              })
            </span>
          </p>
        )}
        {weather && (
          <p className="text-sm text-gray-600">
            Weather: <span className="font-medium text-blue-500">{weather.description || 'Unknown'}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default Map;
