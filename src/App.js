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

  const TOMTOM_API_KEY = "nGm1TeUMB5RX9fDpILibniMBCM0Ec7qV";
  const showSidebar = !["/login", "/signup"].includes(location.pathname);

  const bottleneckCoords = [
    "6.5000,3.4025", // Third Mainland Bridge
    "6.4669,3.3850", // Carter Bridge
    "6.4641,3.3803", // Eko Bridge
    "6.4500,3.4000", // CMS Junction
    "6.4447,3.4175", // Obalende
    "6.4743,3.3904", // Adeniji Adele
    "6.4444,3.4272", // Falomo Roundabout
  ];

  function routeHasBottleneck(routeCoords) {
    const normalizedBottlenecks = bottleneckCoords.map((coord) => ({
      lat: Number(coord.split(",")[0]),
      lon: Number(coord.split(",")[1]),
    }));
    const EARTH_RADIUS = 6371000; // meters
    return routeCoords.some((coord) => {
      const [lat, lon] = coord.split(",").map(Number);
      return normalizedBottlenecks.some((bottleneck) => {
        const dLat = ((bottleneck.lat - lat) * Math.PI) / 180;
        const dLon = ((bottleneck.lon - lon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((bottleneck.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = EARTH_RADIUS * c;
        return distance <= 100; // Within 100 meters
      });
    });
  }

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

  const handleDemoCongestion = async () => {
    try {
      const demoPayload = {
        current_speed: 8,
        free_flow_speed: 40,
        delay_seconds: 400,
        hour: new Date().getHours(),
        day_of_week: new Date().getDay(),
        is_rush_hour:
          new Date().getHours() >= 16 && new Date().getHours() <= 21 ? 1 : 0,
        is_weekend: new Date().getDay() >= 5 ? 1 : 0,
        is_lagos_hotspot: 1,
      };

      const predictionRes = await axios.post(
        "http://localhost:8000/predict",
        demoPayload
      );

      const { predicted_travel_time, delay_seconds, message } =
        predictionRes.data;

      alert(
        `⚠️ DEMO: ${message}\nPredicted Travel Time: ${predicted_travel_time.toFixed(
          0
        )}s\nDelay: ${delay_seconds.toFixed(0)}s`
      );
    } catch (err) {
      setError("Error running demo congestion: " + err.message);
      console.error(err);
    }
  };

  const handleSearch = async () => {
    if (!pendingStart || !pendingEnd) {
      setError("Please select a start and destination");
      return;
    }

    const [startLat, startLon] = pendingStart.split(",").map(Number);
    const [endLat, endLon] = pendingEnd.split(",").map(Number);

    try {
      const routeResponse = await axios.get(
        `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLon}:${endLat},${endLon}/json?key=${TOMTOM_API_KEY}&computeBestOrder=true&routeType=fastest&maxAlternatives=2`
      );

      const routeData = routeResponse.data.routes;
      const routeCoords = routeData[0].legs[0].points.map(
        (p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`
      );

      const isBottleneck = routeHasBottleneck(routeCoords);

      if (isBottleneck) {
        // Prepare payload for prediction
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();
        const payload = {
          current_speed: 10, // Placeholder: ideally fetch from TomTom Traffic API
          free_flow_speed: 40, // Placeholder: adjust based on road data
          delay_seconds: 0, // Placeholder: will be updated by model
          hour: currentHour,
          day_of_week: currentDay,
          is_rush_hour: currentHour >= 6 && currentHour <= 21 ? 1 : 0,
          is_weekend: currentDay >= 5 ? 1 : 0,
          is_lagos_hotspot: 1,
        };

        const predictionRes = await axios.post(
          "http://localhost:8000/predict",
          payload
        );

        const { predicted_travel_time, delay_seconds, message } =
          predictionRes.data;
        const minutesUntilCongestion = Math.max(
          5,
          (delay_seconds / 60).toFixed(0)
        );

        alert(
          `${message}\nI think there is going to be traffic along that route in about ${minutesUntilCongestion} minutes, so maybe pick one of the alternate routes just to be safe.`
        );
      } else {
        alert("✅ Route looks clear. No bottlenecks detected.");
      }

      setStart(pendingStart);
      setEnd(pendingEnd);
      setError(null);
    } catch (err) {
      setError("Error checking traffic: " + err.message);
      console.error(err);
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
                        className="w-full p-3 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 transition"
                        onClick={handleDemoCongestion}
                        style={{ margin: "1rem" }}>
                        Demo Congestion
                      </button>
                      <button
                        onClick={handleSearch}
                        className="w-full p-3 bg-yellow-500 text-gray-800 rounded-lg hover:bg-yellow-600 transition">
                        Search
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
