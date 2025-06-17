import TrafficAlert from './components/TrafficAlert';
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  NavLink,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import { supabase } from "./supabaseClient";
import Map from "./components/Map";
import Traffic from "./components/Traffic";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Profile from "./components/Profile";
import SavedRoutes from "./components/SavedRoutes";
import "./App.css";

export const locations = [
  { name: "Victoria Island", coords: "6.4541,3.3947" },
  { name: "Lekki Phase 1", coords: "6.4691,3.5851" },
  { name: "Ikoyi", coords: "6.4590,3.4365" },
  { name: "Banana Island", coords: "6.4678,3.4498" },
  { name: "Eko Atlantic", coords: "6.4089,3.4068" },
  { name: "CMS (Marina)", coords: "6.4503,3.3958" },
  { name: "Ajah", coords: "6.4653,3.6077" },
  { name: "3rd Mainland Bridge", coords: "6.4983,3.4044" },
  { name: "Falomo", coords: "6.4514,3.4251" },
  { name: "Obalende", coords: "6.4468,3.4132" },
  { name: "Ijora", coords: "6.4686,3.3737" },
];

function MainContent() {
  const [start, setStart] = useState(locations[0].coords); // Victoria Island
  const [end, setEnd] = useState(locations[3].coords); // Banana Island
  const [pendingStart, setPendingStart] = useState(locations[0].coords);
  const [pendingEnd, setPendingEnd] = useState(locations[3].coords);
  const [startMode, setStartMode] = useState("custom"); // 'current' or 'custom'
  const [startQuery, setStartQuery] = useState(locations[0].name);
  const [endQuery, setEndQuery] = useState(locations[3].name);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState("main");
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const [isPredicting, setIsPredicting] = useState(false);

// Add this state
const [trafficPrediction, setTrafficPrediction] = useState(null);

  const TOMTOM_API_KEY = "8HW8UzF88GLp2mL9myetUktvvhazsgkI";
  const showSidebar = !["/login", "/signup"].includes(location.pathname);

  // Track current location
  useEffect(() => {
    let watchId = null;
    if (startMode === "current" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation(`${latitude},${longitude}`);
          setPendingStart(`${latitude},${longitude}`);
          setStartQuery("Current Location");
          console.log("Current location updated:", { latitude, longitude });
        },
        (err) => {
          setError("Failed to get current location: " + err.message);
          console.error("Geolocation error:", err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [startMode]);
  // ! ================================================================
const predictCongestion = async (start, end) => {
  try {
    setError(null);

    const response = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ start, end }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Prediction failed");
    }

    const result = await response.json();
    console.log("Prediction result:", result);

    // Set the traffic prediction state instead of using alert
    setTrafficPrediction(result);

    return result;
  } catch (err) {
    console.error("Error fetching prediction:", err.message);
    setError(`Traffic prediction failed: ${err.message}`);
    return null;
  }
};

const handleSearch = async () => {
  if (!pendingStart || !pendingEnd) {
    setError("Please select a start and destination");
    return;
  }

  console.log("handleSearch: Before update", {
    start,
    end,
    pendingStart,
    pendingEnd,
  });

  setStart(pendingStart);
  setEnd(pendingEnd);

  console.log("handleSearch: After update", {
    start: pendingStart,
    end: pendingEnd,
  });

  // Show loading state
  setIsPredicting(true);

  try {
    // Fire the backend traffic prediction
    await predictCongestion(pendingStart, pendingEnd);
  } finally {
    setIsPredicting(false);
  }
};
  // Toggle start mode
  const handleToggleStartMode = () => {
    const newMode = startMode === "current" ? "custom" : "current";
    setStartMode(newMode);
    if (newMode === "current" && currentLocation) {
      setPendingStart(currentLocation);
      setStartQuery("Current Location");
    } else {
      setPendingStart(locations[0].coords);
      setStartQuery(locations[0].name);
    }
    console.log("Start mode toggled to:", newMode);
  };

  // Fetch weather
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const WEATHER_API_KEY =
      process.env.REACT_APP_WEATHER_API_KEY ||
      "2fae322e4a2bd69e8a0f394339de3207";
    const fetchWeather = async () => {
      try {
        if (!start || !end) {
          setError("Start or end coordinates missing");
          return;
        }
        const [startLat, startLon] = start.split(",").map(Number);
        const [endLat, endLon] = end.split(",").map(Number);
        if (
          isNaN(startLat) ||
          isNaN(startLon) ||
          isNaN(endLat) ||
          isNaN(endLon)
        ) {
          setError("Invalid coordinates");
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
          .map((item) => ({
            time: new Date(item.dt * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
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
        setError("Error fetching weather: " + err.message);
        console.error("Weather fetch error:", err.message);
      }
    };

    if (start && end) {
      fetchWeather();
    }
    return () => subscription.unsubscribe();
  }, [start, end]);

  useEffect(() => {
    console.log("Selected route updated:", selectedRoute);
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
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } md:translate-x-0 transition-transform duration-300 ease-in-out z-20 shadow-lg`}>
            <div className="p-6 border-b border-blue-700">
              <h1 className="text-2xl font-bold">Lagos Navigator</h1>
            </div>
            <nav className="flex flex-col p-4 space-y-3">
              {session ? (
                <>
                  <NavLink
                    to="/map"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${
                        isActive
                          ? "bg-yellow-500 text-black"
                          : "hover:bg-blue-700"
                      }`
                    }
                    onClick={() => setIsSidebarOpen(false)}>
                    Map
                  </NavLink>
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${
                        isActive
                          ? "bg-yellow-500 text-black"
                          : "hover:bg-blue-700"
                      }`
                    }
                    onClick={() => setIsSidebarOpen(false)}>
                    Profile
                  </NavLink>
                  <NavLink
                    to="/saved-routes"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${
                        isActive
                          ? "bg-yellow-500 text-black"
                          : "hover:bg-blue-700"
                      }`
                    }
                    onClick={() => setIsSidebarOpen(false)}>
                    Saved Routes
                  </NavLink>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsSidebarOpen(false);
                    }}
                    className="p-3 text-left rounded-lg font-medium hover:bg-red-600">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${
                        isActive
                          ? "bg-yellow-500 text-black"
                          : "hover:bg-blue-700"
                      }`
                    }
                    onClick={() => setIsSidebarOpen(false)}>
                    Login
                  </NavLink>
                  <NavLink
                    to="/signup"
                    className={({ isActive }) =>
                      `p-3 rounded-lg font-medium ${
                        isActive
                          ? "bg-yellow-500 text-black"
                          : "hover:bg-blue-700"
                      }`
                    }
                    onClick={() => setIsSidebarOpen(false)}>
                    Sign Up
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <button
            className="md:hidden fixed top-4 left-4 z-30 p-2 bg-blue-800 text-white rounded-full hover:bg-blue-900"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? "✖" : "☰"}
          </button>
        </>
      )}
      <div
        className={`flex-1 p-8 ${
          showSidebar ? "md:ml-64" : ""
        } flex justify-center items-center`}>
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
                    {trafficPrediction && (
                      <TrafficAlert
                        prediction={trafficPrediction}
                        onClose={() => setTrafficPrediction(null)}
                      />
                    )}
                    <div className="w-full max-w-md mx-auto bg-white p-6 rounded-lg">
                      <div className="mb-4">
                        <button
                          onClick={handleToggleStartMode}
                          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                          {startMode === "current"
                            ? "Use Custom Start Point"
                            : "Use Current Location"}
                        </button>
                      </div>
                      {startMode === "custom" && (
                        <div className="mb-4">
                          <label className="block text-gray-700 font-medium mb-2">
                            Select Starting Point
                          </label>
                          <select
                            value={pendingStart}
                            onChange={(e) => {
                              setPendingStart(e.target.value);
                              setStartQuery(
                                locations.find(
                                  (loc) => loc.coords === e.target.value
                                )?.name || ""
                              );
                              console.log("Start dropdown changed:", {
                                pendingStart: e.target.value,
                                startQuery: locations.find(
                                  (loc) => loc.coords === e.target.value
                                )?.name,
                              });
                            }}
                            className="w-full p-3 border rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-yellow-500 transition">
                            {locations.map((loc) => (
                              <option key={loc.name} value={loc.coords}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                          Select Destination
                        </label>
                        <select
                          value={pendingEnd}
                          onChange={(e) => {
                            setPendingEnd(e.target.value);
                            setEndQuery(
                              locations.find(
                                (loc) => loc.coords === e.target.value
                              )?.name || ""
                            );
                            console.log("End dropdown changed:", {
                              pendingEnd: e.target.value,
                              endQuery: locations.find(
                                (loc) => loc.coords === e.target.value
                              )?.name,
                            });
                          }}
                          className="w-full p-3 border rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-yellow-500 transition">
                          {locations.map((loc) => (
                            <option key={loc.name} value={loc.coords}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleSearch}
                        disabled={isPredicting}
                        className={`w-full p-3 rounded-lg transition ${
                          isPredicting
                            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                            : "bg-yellow-500 text-gray-800 hover:bg-yellow-600"
                        }`}>
                        {isPredicting ? "Analyzing Traffic..." : "Search"}
                      </button>
                    </div>
                    <Map
                      start={start}
                      end={end}
                      weather={weather}
                      selectedRoute={selectedRoute}
                      setSelectedRoute={setSelectedRoute}
                      currentLocation={
                        startMode === "current" ? currentLocation : null
                      }
                      key={`${start}-${end}`}
                    />
                    <div className="w-full max-w-md mx-auto mt-8">
                      <Traffic weather={weather} />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved-routes"
              element={
                <ProtectedRoute>
                  <SavedRoutes />
                </ProtectedRoute>
              }
            />
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
