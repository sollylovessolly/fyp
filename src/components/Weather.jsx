import { useState, useEffect } from 'react';
import { getWeather } from '../services/Weather';
const Weather = () => {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    const fetchWeather = () => getWeather().then(setWeather).catch(console.error);
    fetchWeather();
    const interval = setInterval(fetchWeather, 60000); // 1 min
    return () => clearInterval(interval);
  }, []);
  if (!weather) return <p>Loading weather...</p>;
  return (
    <div>
      <h2>Lagos Weather</h2>
      <p>{weather.condition}, {weather.temp}°C, Rain: {weather.rain} mm/h</p>
    </div>
  );
};
export default Weather;