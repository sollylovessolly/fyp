
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, NavLink, useLocation } from 'react-router-dom';
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

function MainContent() {
  const [start, setStart] = useState(locations[0]?.coords || '');
  const [end, setEnd] = useState(locations[1]?.coords || '');
  const [weather, setWeather] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState('main');
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const showSidebar = !['/login', '/signup'].includes(location.pathname);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const WEATHER_API_KEY = process.env.REACT_APP_WEATHER_API_KEY || '2fae322e4a2bd69e8a0f394339de3207';
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
        const currentResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=${avgLat}&lon=${avgLon}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const forecastResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${avgLat}&lon=${avgLon}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const hourlyForecast = forecastResponse.data.list
          .slice(0, 3)
          .map(item => ({
            time: new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: item.weather[0].description,
            temperature: item.main.temp,
          }));
        setWeather({
          current: {
            description: currentResponse.data.weather[0].description,
            temperature: currentResponse.data.main.temp,
          },
          forecast: hourlyForecast,
        });
        setError(null);
      } catch (err) {
        setError('Error fetching weather: ' + err.message);
        console.error('Weather fetch error:', err.message);
      }
    };

    fetchWeather();
    return () => subscription.unsubscribe();
  }, [start, end]);

  useEffect(() => {
    console.log('Selected route updated:', selectedRoute);
  }, [selectedRoute]);

  const ProtectedRoute = ({ children }) => {
    if (!session) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {showSidebar && (
        <>
          <div
            className={`fixed inset-y-0 left-0 bg-blue-800 text-white w-64 transform ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 transition-transform duration-300 ease-in-out z-20 shadow-lg`}
          >
            <div className="p-6 border-b border-blue-700">
              <h1 className="text-2xl font-bold">Lagos Navigator</h1>
            </div>
            <nav className="flex flex-col p-4 space-y-3">
              {session ? (
                <>
                  <NavLink
                    to="/map"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${isActive ? 'bg-yellow-500 text-black' : 'hover:bg-blue-700'}`
                    }
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Map
                  </NavLink>
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${isActive ? 'bg-yellow-500 text-black' : 'hover:bg-blue-700'}`
                    }
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Profile
                  </NavLink>
                  <NavLink
                    to="/saved-routes"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${isActive ? 'bg-yellow-500 text-black' : 'hover:bg-blue-700'}`
                    }
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Saved Routes
                  </NavLink>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsSidebarOpen(false);
                    }}
                    className="p-3 text-left rounded-lg font-medium hover:bg-red-600"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${isActive ? 'bg-yellow-500 text-black' : 'hover:bg-blue-700'}`
                    }
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/signup"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${isActive ? 'bg-yellow-500 text-black' : 'hover:bg-blue-700'}`
                    }
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Sign Up
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <button
            className="md:hidden fixed top-4 left-4 z-30 p-2 bg-blue-800 text-white rounded-full hover:bg-blue-900"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? '✖' : '☰'}
          </button>
        </>
      )}
      <div className={`flex-1 p-8 ${showSidebar ? 'md:ml-64' : ''} flex justify-center items-center`}>
        <div className="w-full max-w-3xl space-y-6">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/map"
              element={
                <ProtectedRoute>
                  <div className="w-full space-y-6">
                    {error && (
                      <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg shadow-md w-full max-w-md mx-auto">
                        {error}
                      </div>
                    )}
                    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-lg">
                      <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Starting Point</label>
                        <select
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                          className="w-full p-3 border rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-yellow-500 transition"
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
                          className="w-full p-3 border rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-yellow-500 transition"
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
                    <div className="w-full max-w-md mx-auto mt-8">
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
    </div>
  );
}

function App() {
  return (
    <Router>
      <MainContent />
    </Router>
  );
}

export default App;