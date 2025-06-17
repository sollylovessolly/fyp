import React, { useState } from "react";

const WeatherForecast = ({ weatherForecast }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!weatherForecast) return null;

  const formatHour = (hour) => {
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

const getWeatherIcon = (condition) => {
  const conditionLower = condition.toLowerCase();
  // Handle main categories (like your partner's format)
  if (conditionLower === "thunderstorm") return "⛈️";
  if (conditionLower === "rain" || conditionLower === "drizzle") return "🌧️";
  if (conditionLower === "clouds") return "☁️";
  if (conditionLower === "clear") return "☀️";
  if (conditionLower === "fog" || conditionLower === "mist") return "🌫️";
  if (conditionLower === "dust" || conditionLower === "sand") return "🌪️";
  if (conditionLower === "haze" || conditionLower === "smoke") return "🌫️";
  return "🌤️";
};

  const getImpactColor = (impact) => {
    switch (impact) {
      case "severe":
        return "text-red-600 font-bold";
      case "moderate":
        return "text-orange-600 font-semibold";
      case "light":
        return "text-yellow-600";
      default:
        return "text-green-600";
    }
  };

  const hasWeatherAlerts =
    weatherForecast.weather_alerts && weatherForecast.weather_alerts.length > 0;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Lagos Weather</h3>
            <p className="text-blue-100 text-sm">Traffic Impact Forecast</p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-2xl">
              <span className="mr-2">
                {getWeatherIcon(weatherForecast.current_weather.condition)}
              </span>
              <span className="text-xl font-bold">
                {weatherForecast.current_weather.temperature}°C
              </span>
            </div>
            <p className="text-blue-100 text-xs">
              {weatherForecast.current_weather.condition}
            </p>
          </div>
        </div>
      </div>

      {/* Weather Alerts */}
      {hasWeatherAlerts && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-200">
          <h4 className="font-semibold text-yellow-800 text-sm mb-2">
            ⚠️ Upcoming Weather Alerts
          </h4>
          <div className="space-y-1">
            {weatherForecast.weather_alerts.map((alert, index) => (
              <p key={index} className="text-yellow-700 text-xs">
                {alert}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Current Impact */}
      {weatherForecast.current_weather.weather_impact !== "none" && (
        <div className="p-3 bg-orange-50 border-b border-orange-200">
          <p
            className={`text-sm ${getImpactColor(
              weatherForecast.current_weather.weather_impact
            )}`}>
            Current weather is affecting traffic conditions
          </p>
        </div>
      )}

      {/* Hourly Forecast Toggle */}
      {weatherForecast.hourly_forecast &&
        weatherForecast.hourly_forecast.length > 0 && (
          <div className="p-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between text-left text-gray-700 hover:text-blue-600 transition">
              <span className="font-medium text-sm">
                4-Hour Weather Forecast
              </span>
              <span className="text-lg">{isExpanded ? "📊" : "📈"}</span>
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-600 border-b pb-2">
                  <span>Time</span>
                  <span>Weather</span>
                  <span>Temp</span>
                  <span>Impact</span>
                </div>

                {weatherForecast.hourly_forecast.map((forecast, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-4 gap-2 text-xs items-center py-1 border-b border-gray-100">
                    <span className="font-medium">
                      {formatHour(forecast.hour)}
                    </span>
                    <span className="flex items-center">
                      <span className="mr-1">
                        {getWeatherIcon(forecast.condition)}
                      </span>
                      <span className="truncate">
                        {forecast.condition.split(" ")[0]}
                      </span>
                    </span>
                    <span>{forecast.temperature}°C</span>
                    <span
                      className={`${getImpactColor(
                        forecast.weather_impact
                      )} capitalize`}>
                      {forecast.weather_impact === "none"
                        ? "✅"
                        : forecast.weather_impact}
                    </span>
                  </div>
                ))}

                <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  💡 Weather conditions can significantly affect Lagos traffic
                  patterns
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default WeatherForecast;
