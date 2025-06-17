import { useState } from "react";

const CongestionAlert = ({ prediction, onClose }) => {
  const [showForecast, setShowForecast] = useState(false);

  if (!prediction) return null;

  const formatHour = (hour) => {
    if (hour === 0) return "12:00 AM";
    if (hour === 12) return "12:00 PM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  const getCongestionColor = (level) => {
    switch (level) {
      case "severe":
        return "text-red-600 font-bold";
      case "heavy":
        return "text-orange-600 font-semibold";
      case "moderate":
        return "text-yellow-600";
      case "light":
        return "text-blue-600";
      case "clear":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getCongestionIcon = (level) => {
    switch (level) {
      case "severe":
        return "🔴";
      case "heavy":
        return "🟠";
      case "moderate":
        return "🟡";
      case "light":
        return "🔵";
      case "clear":
        return "🟢";
      default:
        return "⚪";
    }
  };

  const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getAlertConfig = (status, congestionLevel) => {
    switch (status) {
      case "alert":
        return {
          bgColor: "bg-red-100",
          borderColor: "border-red-500",
          textColor: "text-red-800",
          icon: "🚨",
          title: "Traffic Alert",
        };
      case "warning":
        return {
          bgColor: "bg-orange-100",
          borderColor: "border-orange-500",
          textColor: "text-orange-800",
          icon: "⚠️",
          title: "Traffic Warning",
        };
      case "info":
        return {
          bgColor: "bg-blue-100",
          borderColor: "border-blue-500",
          textColor: "text-blue-800",
          icon: "ℹ️",
          title: "Traffic Info",
        };
      default:
        return {
          bgColor: "bg-green-100",
          borderColor: "border-green-500",
          textColor: "text-green-800",
          icon: "✅",
          title: "Clear Route",
        };
    }
  };

  const config = getAlertConfig(prediction.status, prediction.congestion_level);

  // Filter out any invalid forecast data
  const validForecast =
    prediction.hourly_forecast?.filter(
      (f) => f.predicted_congestion_level !== "unknown"
    ) || [];

  return (
    <div
      className={`fixed top-4 right-4 max-w-sm p-4 border-l-4 rounded-lg shadow-lg z-50 ${config.bgColor} ${config.borderColor} ${config.textColor}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-2 flex items-center">
            <span className="mr-2">{config.icon}</span>
            {config.title}
          </h3>

          <div className="space-y-2">
            <p className="font-medium">
              Bottleneck: {prediction.bottleneck_location}
            </p>

            <p className="text-sm">
              Current condition:{" "}
              <span
                className={`font-medium capitalize ${getCongestionColor(
                  prediction.congestion_level
                )}`}>
                {getCongestionIcon(prediction.congestion_level)}{" "}
                {prediction.congestion_level}
              </span>
            </p>

            {/* AI RECOMMENDATIONS - This is where users will see them */}
            {prediction.ai_recommendation && (
              <div className="mt-3 p-3 bg-white bg-opacity-60 rounded-lg border border-gray-300">
                <h4 className="font-semibold text-sm mb-1 flex items-center">
                  <span className="mr-1">🤖</span>
                  AI Recommendations
                </h4>
                <p className="text-xs leading-relaxed">
                  {prediction.ai_recommendation}
                </p>
              </div>
            )}

            {/* Weather Information */}
            {prediction.weather_forecast?.current_weather && (
              <div className="mt-2 p-2 bg-white bg-opacity-40 rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <span className="mr-1">🌤️</span>
                    {prediction.weather_forecast.current_weather.condition}
                  </span>
                  <span className="font-medium">
                    {prediction.weather_forecast.current_weather.temperature}°C
                  </span>
                </div>
                {prediction.weather_forecast.current_weather.weather_impact !==
                  "none" && (
                  <div className="mt-1 text-xs font-medium text-orange-700">
                    Weather affecting traffic conditions
                  </div>
                )}
              </div>
            )}

            {/* Forecast Summary */}
            {prediction.forecast_summary && (
              <div className="mt-3 p-2 bg-white bg-opacity-50 rounded">
                <p className="text-sm font-medium">
                  {prediction.forecast_summary}
                </p>
              </div>
            )}

            {/* Hourly Forecast Toggle */}
            {validForecast.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowForecast(!showForecast)}
                  className="text-sm underline hover:no-underline flex items-center">
                  <span className="mr-1">{showForecast ? "📊" : "📈"}</span>
                  {showForecast ? "Hide" : "Show"} traffic conditions ahead
                </button>

                {showForecast && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs font-semibold flex justify-between items-center py-1 border-b-2 border-gray-400">
                      <span>Time</span>
                      <span>Expected Condition</span>
                    </div>
                    {validForecast.map((forecast, index) => (
                      <div
                        key={index}
                        className="text-xs flex justify-between items-center py-1 border-b border-gray-300">
                        <span className="font-medium">
                          {formatHour(forecast.hour)}
                        </span>
                        <span
                          className={`flex items-center ${getCongestionColor(
                            forecast.predicted_congestion_level
                          )}`}>
                          <span className="mr-1">
                            {getCongestionIcon(
                              forecast.predicted_congestion_level
                            )}
                          </span>
                          {capitalizeFirst(forecast.predicted_congestion_level)}{" "}
                          Traffic
                        </span>
                      </div>
                    ))}
                    <div className="text-xs text-gray-600 mt-2 italic">
                      * Based on historical traffic patterns
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="ml-2 text-gray-500 hover:text-gray-700 text-lg font-bold">
          ✕
        </button>
      </div>
    </div>
  );
};

export default CongestionAlert;
