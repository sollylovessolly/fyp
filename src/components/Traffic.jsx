import { useState, useEffect } from 'react';
import { getTrafficPrediction } from '../services/Traffic';
const Traffic = ({ weather }) => {
  const [prediction, setPrediction] = useState(null);
  useEffect(() => {
    if (weather) {
      setPrediction(getTrafficPrediction(weather));
      const interval = setInterval(() => setPrediction(getTrafficPrediction(weather)), 30000); // 30 secs
      return () => clearInterval(interval);
    }
  }, [weather]);
  if (!prediction) return <p>Loading prediction...</p>;
  return (
    <div>
      <h2>Traffic Prediction</h2>
      <p>Route: {prediction.route}, Time: {prediction.time} mins</p>
      <p>Congestion: {prediction.congestion}, Weather: {prediction.weather_impact}</p>
    </div>
  );
};
export default Traffic;