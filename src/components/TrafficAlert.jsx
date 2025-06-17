import React from 'react';

const TrafficAlert = ({ prediction, onClose }) => {
  if (!prediction) return null;

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes} minutes`;
  };

  const getAlertStyle = (status) => {
    if (status === "warning") {
      return "bg-red-100 border-red-500 text-red-800";
    }
    return "bg-green-100 border-green-500 text-green-800";
  };

  return (
    <div className={`fixed top-4 right-4 max-w-sm p-4 border-l-4 rounded-lg shadow-lg z-50 ${getAlertStyle(prediction.status)}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-2">
            {prediction.status === "warning" ? "🚨 Traffic Alert" : "✅ Clear Route"}
          </h3>
          
          {prediction.status === "warning" ? (
            <div>
              <p className="font-medium">Bottleneck: {prediction.bottleneck_location}</p>
              <p>Predicted time: {formatTime(prediction.predicted_travel_time)}</p>
              <p className="text-sm mt-2">Consider alternate routes or different timing.</p>
            </div>
          ) : (
            <p>No major congestion expected on this route.</p>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="ml-2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default TrafficAlert;
