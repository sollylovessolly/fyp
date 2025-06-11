
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, NavLink } from 'react-router-dom';
import axios from 'axios';
import { supabase } from './supabaseClient';
import Map from './components/Map';
import Traffic from './components/Traffic';
import Login from './components/Login';
import Signup from './components/Signup';
import Profile from './components/Profile';
import SavedRoutes from './components/SavedRoutes';
import './App.css';

export const locations = [
  { name: 'Victoria Island', coords: '6.4541,3.3947' },
  { name: 'Lekki Phase 1', coords: '6.4691,3.5851' },
  { name: 'Ikoyi', coords: '6.4590,3.4365' },
  { name: 'Banana Island', coords: '6.4678,3.4498' },
  { name: 'Eko Atlantic', coords: '6.4089,3.4068' },
  { name: 'CMS (Marina)', coords: '6.4503,3.3958' },
];

function App() {
  const [start, setStart] = useState(locations[0]?.coords || '');
  const [end, setEnd] = useState(locations[1]?.coords || '');
  const [weather, setWeather] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState('main');
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    // Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Weather fetch
    const WEATHER_API_KEY = '12345abcde67890fghij1234567890ab'; // Hardcoded (replace with your key)
    const fetchWeather = async () => {
      try {
        if (!start || !end) {
          setError('Start or end coordinates missing');
          return;
        }
        const [startLat, startLon] = start.split(',').map(Number);
        const [endLat, endLon] = end.split(',').map(Number);
        if (isNaN(startLat) || isNaN(startLon) || isNaN(endLat) || isNaN(endLon)) {
          setError('Invalid coordinates');
          return;
        }
        const avgLat = (startLat + endLat) / 2;
        const avgLon = (startLon + endLon) / 2;
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${avgLat}&lon=${avgLon}&appid=${WEATHER_API_KEY}&units=metric`
        );
        setWeather({
          description: response.data.weather[0].description,
          temperature: response.data.main.temp,
        });
        setError(null);
      } catch (err) {
        setError('Failed to fetch weather: ' + err.message);
        console.error('Weather fetch error:', err.message);
      }
    };

    fetchWeather();
    return () => subscription.unsubscribe();
  }, [start, end]);

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (!session) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex">
        {/* Vertical Navbar */}
        <div
          className={`fixed inset-y-0 left-0 bg-blue-900 text-white w-64 transform ${
            isNavOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 transition-transform duration-300 ease-in-out z-50`}
        >
          <div className="p-4">
            <h1 className="text-2xl font-bold">Lagos Navigator</h1>
          </div>
          <nav className="flex flex-col p-4 space-y-2">
            {session ? (
              <>
                <NavLink
                  to="/map"
                  className={({ isActive }) =>
                    `p-2 rounded ${isActive ? 'bg-blue-700' : 'hover:bg-blue-800'}`
                  }
                  onClick={() => setIsNavOpen(false)}
                >
                  Map
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `p-2 rounded ${isActive ? 'bg-blue-700' : 'hover:bg-blue-800'}`
                  }
                  onClick={() => setIsNavOpen(false)}
                >
                  Profile
                </NavLink>
                <NavLink
                  to="/saved-routes"
                  className={({ isActive }) =>
                    `p-2 rounded ${isActive ? 'bg-blue-700' : 'hover:bg-blue-800'}`
                  }
                  onClick={() => setIsNavOpen(false)}
                >
                  Saved Routes
                </NavLink>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsNavOpen(false);
                  }}
                  className="p-2 text-left rounded hover:bg-red-600"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `p-2 rounded ${isActive ? 'bg-blue-700' : 'hover:bg-blue-800'}`
                  }
                  onClick={() => setIsNavOpen(false)}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  className={({ isActive }) =>
                    `p-2 rounded ${isActive ? 'bg-blue-700' : 'hover:bg-blue-800'}`
                  }
                  onClick={() => setIsNavOpen(false)}
                >
                  Sign Up
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {/* Mobile Navbar Toggle */}
        <button
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-blue-900 text-white rounded"
          onClick={() => setIsNavOpen(!isNavOpen)}
        >
          {isNavOpen ? 'Close' : 'Menu'}
        </button>

        {/* Main Content */}
        <div className="flex-1 ml-0 md:ml-64 p-6">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/map"
              element={
                <ProtectedRoute>
                  <div className="max-w-5xl mx-auto">
                    {error && (
                      <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg shadow-md w-full max-w-lg">
                        {error}
                      </div>
                    )}
                    <div className="w-full max-w-lg mb-8 bg-white p-6 rounded-lg shadow-lg">
                      <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Starting Point</label>
                        <select
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        >
                          {locations.map(loc => (
                            <option key={loc.name} value={loc.coords}>{loc.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Destination</label>
                        <select
                          value={end}
                          onChange={(e) => setEnd(e.target.value)}
                          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        >
                          {locations.map(loc => (
                            <option key={loc.name} value={loc.coords}>{loc.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Map
                      start={start}
                      end={end}
                      weather={weather}
                      selectedRoute={selectedRoute}
                      setSelectedRoute={setSelectedRoute}
                    />
                    <div className="w-full max-w-lg mt-8">
                      <Traffic weather={weather} />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/saved-routes" element={<ProtectedRoute><SavedRoutes /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;