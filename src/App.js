import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import axios from 'axios';

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <h1 className="text-center text-red-500 font-semibold">Something went wrong with the map.</h1>;
    }
    return this.props.children;
  }
}

function App() {
  const [start, setStart] = useState('6.5244,3.3792'); // Lagos center
const [end, setEnd] = useState('6.4541,3.3947'); // Victoria Island
  const [weather, setWeather] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState('main');
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('App.js with enhanced UI');
    console.log('Current coords:', { start, end });
    console.log('Environment variables:', {
  TOMTOM_API_KEY: process.env.REACT_APP_TOMTOM_API_KEY,
  WEATHER_API_KEY: process.env.REACT_APP_WEATHER_API_KEY,
});

    const fetchWeather = async () => {
      try {
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=6.5244&lon=3.3792&appid=${process.env.REACT_APP_WEATHER_API_KEY}
`
        );
        setWeather(response.data.weather[0]);
        console.log('Weather:', response.data.weather[0]);
      } catch (err) {
        console.error('Weather fetch error:', err);
      }
    };
    fetchWeather();
  }, []);

  const validateCoords = (coords, type) => {
    const [lat, lon] = coords.split(',').map(Number);
    if (isNaN(lat) || isNaN(lon) || lat < 6.4 || lat > 6.7 || lon < 3.2 || lon > 3.5) {
      setError(`${type} must be valid Lagos coords (lat: 6.4-6.7, lon: 3.2-3.5)`);
      return false;
    }
    setError('');
    return true;
  };

  const handleStartChange = (e) => {
    const coords = e.target.value;
    if (validateCoords(coords, 'Start')) {
      setStart(coords);
    }
  };

  const handleEndChange = (e) => {
    const coords = e.target.value;
    if (validateCoords(coords, 'End')) {
      setEnd(coords);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const coords = `${latitude},${longitude}`;
          if (validateCoords(coords, 'Current Location')) {
            setStart(coords);
            console.log('Current location set:', coords);
          }
        },
        (err) => {
          setError('Failed to get current location: ' + err.message);
          console.error('Geolocation error:', err);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  };

  console.log('App rendering:', { start, end, selectedRoute });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6">
        <h1 className="text-4xl font-bold text-center text-blue-700 mb-8">Lagos Traffic Management</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">Start Coordinates (lat,lon)</label>
            <input
              type="text"
              value={start}
              onChange={handleStartChange}
              className="input-focus w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-gray-50"
              placeholder="e.g., 6.6097,3.3081"
            />
            <button
              onClick={getCurrentLocation}
              className="btn-primary w-full mt-3 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Use Current Location
            </button>
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-gray-700">End Coordinates (lat,lon)</label>
            <input
              type="text"
              value={end}
              onChange={handleEndChange}
              className="input-focus w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-gray-50"
              placeholder="e.g., 6.4412,3.4249"
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-center font-medium mb-6 animate-pulse">{error}</p>}
        <div className="flex justify-center space-x-6 mb-8">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="main"
              checked={selectedRoute === 'main'}
              onChange={() => setSelectedRoute('main')}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-2 text-gray-700 font-semibold">Main Route</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="alt"
              checked={selectedRoute === 'alt'}
              onChange={() => setSelectedRoute('alt')}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-2 text-gray-700 font-semibold">Alternate Route</span>
          </label>
        </div>
        <ErrorBoundary>
          <div className="map-card">
            <Map
              start={start}
              end={end}
              weather={weather}
              selectedRoute={selectedRoute}
              setSelectedRoute={setSelectedRoute}
            />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;