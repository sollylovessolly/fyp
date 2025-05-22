import axios from 'axios';
const API_KEY = '2fae322e4a2bd69e8a0f394339de3207'; 
export const getWeather = async () => {
  const res = await axios.get(
    `https://api.openweathermap.org/data/2.5/weather?lat=6.5244&lon=3.3792&appid=${API_KEY}&units=metric`
  );
  return {
    condition: res.data.weather[0].main,
    temp: res.data.main.temp,
    rain: res.data.rain?.['1h'] || 0
  };
};