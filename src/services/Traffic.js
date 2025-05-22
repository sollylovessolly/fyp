export const getTrafficPrediction = (weather) => {
    const baseTime = 30;
    const congestion = weather.rain > 2 ? 0.8 : 0.4;
    const incident = Math.random() > 0.7 ? 'Accident' : 'None'; // 30% chance
    const time = baseTime * (1 + congestion) * (incident === 'Accident' ? 1.5 : 1);
    return {
      route: 'Car',
      time: Math.round(time),
      congestion,
      weather_impact: weather.rain > 0 ? 'rain' : 'none',
      incident
    };
  };