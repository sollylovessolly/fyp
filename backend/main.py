import requests
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
from tensorflow.keras.models import load_model
import os
from datetime import datetime, timedelta
import uvicorn
from typing import List
import requests


app = FastAPI(title="Lagos Traffic Prediction API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and data
model = None
df = None
feature_scaler = None
target_scaler = None

# Configuration
BOTTLENECKS = {
    "Third_Mainland_Bridge",
    "Carter_Bridge", 
    "Eko_Bridge",
    "CMS_Junction",
    "Marina_Road",
    "Obalende",
    "Adeniji_Adele",
    "Falomo_Roundabout",
    "Awolowo_Road"
}

FEATURES = [
    "current_speed", "free_flow_speed", "delay_seconds",
    "hour", "day_of_week", "is_rush_hour", "is_weekend", "is_lagos_hotspot"
]

class RouteRequest(BaseModel):
    start: str
    end: str

class HourlyForecast(BaseModel):
    hour: int
    predicted_congestion_level: str
    confidence: str

class WeatherInfo(BaseModel):
    condition: str
    temperature: float
    humidity: float = None
    visibility: float = None
    weather_impact: str

class WeatherForecastItem(BaseModel):
    hour: int
    condition: str
    temperature: float
    weather_impact: str
    traffic_warning: str = None

class WeatherForecast(BaseModel):
    current_weather: WeatherInfo
    hourly_forecast: List[WeatherForecastItem]
    weather_alerts: List[str] = []

# UPDATED: Congestion-focused response model (no travel time predictions)
class CongestionResponse(BaseModel):
    status: str  # "info", "warning", "alert"
    message: str
    bottleneck_location: str = None
    congestion_level: str = None  # "clear", "light", "moderate", "heavy", "severe"
    congestion_ratio: float = None
    hourly_forecast: List[HourlyForecast] = []
    forecast_summary: str = None
    weather_forecast: WeatherForecast = None
    ai_recommendation: str = None  # Additional AI insights

def predict_hourly_congestion(segment_data, current_hour):
    """Predict congestion levels (not travel times) for the next few hours"""
    
    historical_patterns = {}
    
    # Define typical Lagos traffic patterns as fallback
    lagos_patterns = {
        # Early morning (6-8 AM): Heavy traffic
        6: {"level": "heavy"},
        7: {"level": "heavy"},
        8: {"level": "heavy"},
        
        # Morning (9-11 AM): Moderate
        9: {"level": "moderate"},
        10: {"level": "light"},
        11: {"level": "light"},
        
        # Midday (12-2 PM): Light
        12: {"level": "light"},
        13: {"level": "moderate"},
        14: {"level": "light"},
        
        # Afternoon (3-5 PM): Building up
        15: {"level": "moderate"},
        16: {"level": "heavy"},
        17: {"level": "heavy"},
        
        # Evening (6-8 PM): Peak
        18: {"level": "heavy"},
        19: {"level": "heavy"},
        20: {"level": "moderate"},
        
        # Night (9 PM - 5 AM): Clear
        21: {"level": "light"},
        22: {"level": "clear"},
        23: {"level": "clear"},
        0: {"level": "clear"},
        1: {"level": "clear"},
        2: {"level": "clear"},
        3: {"level": "clear"},
        4: {"level": "clear"},
        5: {"level": "light"},
    }
    
    for hour_offset in range(1, 4):  # Predict next 3 hours
        target_hour = (current_hour + hour_offset) % 24
        
        # Try to get historical data for this specific hour
        hour_data = segment_data[segment_data['hour'] == target_hour]
        
        if len(hour_data) >= 3:  # We have enough historical data
            avg_congestion = hour_data['congestion_ratio'].mean()
            confidence = "high" if len(hour_data) >= 8 else "medium"
            
            # Determine level from actual data
            if avg_congestion >= 0.8:
                level = "clear"
            elif avg_congestion >= 0.6:
                level = "light"
            elif avg_congestion >= 0.4:
                level = "moderate"
            elif avg_congestion >= 0.2:
                level = "heavy"
            else:
                level = "severe"
                
        else:  # Use pattern-based prediction
            pattern = lagos_patterns.get(target_hour, {"level": "moderate"})
            level = pattern["level"]
            confidence = "medium"
        
        historical_patterns[target_hour] = {
            "level": level,
            "confidence": confidence,
            "data_points": len(hour_data)
        }
    
    return historical_patterns

# Weather integration functions (keep the same)
WEATHER_API_KEY = "2fae322e4a2bd69e8a0f394339de3207"

async def get_weather_forecast():
    """Fetch current weather and 4-hour forecast for Lagos"""
    try:
        lat, lon = 6.5244, 3.3792
        current_hour = datetime.now().hour
        
        # Get current weather
        current_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
        current_response = requests.get(current_url, timeout=10)
        current_response.raise_for_status()
        current_data = current_response.json()
        
        # Get hourly forecast
        forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=metric"
        forecast_response = requests.get(forecast_url, timeout=10)
        forecast_response.raise_for_status()
        forecast_data = forecast_response.json()
        
        # Process current weather
        current_condition = current_data['weather'][0]['main'].lower()
        current_weather = WeatherInfo(
            condition=current_data['weather'][0]['description'].title(),
            temperature=round(current_data['main']['temp'], 1),
            humidity=current_data['main'].get('humidity', 0),
            visibility=round(current_data.get('visibility', 10000) / 1000, 1),
            weather_impact=get_weather_impact(current_condition, current_data)
        )
        
        # Process hourly forecast (next 4 hours)
        hourly_forecast = []
        weather_alerts = []
        
        for i in range(1, 5):  # Next 4 hours
            target_hour = (current_hour + i) % 24
            
            # Find the closest forecast entry (OpenWeather gives 3-hour intervals)
            forecast_entry = None
            for entry in forecast_data['list'][:8]:  # Next 24 hours
                entry_hour = datetime.fromtimestamp(entry['dt']).hour
                if abs(entry_hour - target_hour) <= 1:  # Within 1 hour
                    forecast_entry = entry
                    break
            
            if forecast_entry:
                condition = forecast_entry['weather'][0]['main'].lower()
                weather_impact = get_weather_impact(condition, forecast_entry)
                
                # Generate traffic warning
                traffic_warning = generate_traffic_warning(condition, weather_impact, i)
                if traffic_warning:
                    weather_alerts.append(f"In {i} hour{'s' if i > 1 else ''}: {traffic_warning}")
                
                hourly_item = WeatherForecastItem(
                    hour=target_hour,
                    condition=forecast_entry['weather'][0]['description'].title(),
                    temperature=round(forecast_entry['main']['temp'], 1),
                    weather_impact=weather_impact,
                    traffic_warning=traffic_warning
                )
                hourly_forecast.append(hourly_item)
        
        return WeatherForecast(
            current_weather=current_weather,
            hourly_forecast=hourly_forecast,
            weather_alerts=weather_alerts
        )
        
    except Exception as e:
        print(f"Weather forecast error: {e}")
        return WeatherForecast(
            current_weather=WeatherInfo(
                condition="Clear Sky",
                temperature=28.0,
                humidity=75,
                visibility=10.0,
                weather_impact="none"
            ),
            hourly_forecast=[],
            weather_alerts=[]
        )

def get_weather_impact(condition, weather_data):
    """Determine weather impact on traffic"""
    impact = "none"
    
    if condition in ['rain', 'drizzle', 'thunderstorm']:
        rain_amount = weather_data.get('rain', {}).get('1h', 0) or weather_data.get('rain', {}).get('3h', 0)
        if condition == 'thunderstorm' or rain_amount > 5:
            impact = "severe"
        elif rain_amount > 1:
            impact = "moderate"
        else:
            impact = "light"
    elif condition in ['fog', 'mist', 'haze']:
        impact = "moderate"
    elif condition in ['dust', 'sand', 'smoke']:
        impact = "moderate"
    
    return impact

def generate_traffic_warning(condition, weather_impact, hours_ahead):
    """Generate human-readable traffic warnings"""
    
    if weather_impact == "severe":
        if condition == 'thunderstorm':
            return f"⛈️ Thunderstorm expected - traffic will be severely impacted"
        elif condition in ['rain']:
            return f"🌧️ Heavy rain expected - expect major delays"
    
    elif weather_impact == "moderate":
        if condition in ['rain', 'drizzle']:
            return f"🌦️ Rain expected - traffic will slow down"
        elif condition in ['fog', 'mist']:
            return f"🌫️ Foggy conditions expected - reduced visibility"
        elif condition in ['dust', 'haze']:
            return f"🌪️ Dusty conditions expected - traffic may slow"
    
    elif weather_impact == "light":
        if condition in ['rain', 'drizzle']:
            return f"🌦️ Light rain expected - minor traffic impact"
    
    return None

@app.on_event("startup")
async def load_models():
    """Load model, scaler, and data on startup"""
    global model, feature_scaler, target_scaler, df
    
    try:
        # Update these paths to your actual file paths
        MODEL_PATH = "lstm_model.keras"
        FEATURE_SCALER_PATH = "feature_scaler.pkl"
        TARGET_SCALER_PATH = "target_scaler.pkl"
        DATA_PATH = "combined.csv"
        
        # Check if files exist
        for path, name in [(MODEL_PATH, "Model"), (FEATURE_SCALER_PATH, "Feature Scaler"), 
                          (TARGET_SCALER_PATH, "Target Scaler"), (DATA_PATH, "Data")]:
            if not os.path.exists(path):
                print(f"❌ {name} file not found at: {path}")
                return
            else:
                print(f"✅ {name} file found at: {path}")
        
        # Load model
        model = load_model(MODEL_PATH)
        print("✅ Model loaded successfully")
        
        # Load scalers
        feature_scaler = joblib.load(FEATURE_SCALER_PATH)
        print("✅ Feature scaler loaded successfully")
        
        target_scaler = joblib.load(TARGET_SCALER_PATH)
        print("✅ Target scaler loaded successfully")
        
        # Load latest data
        df = pd.read_csv(DATA_PATH)
        print(f"✅ Data loaded successfully - {len(df)} records")
        
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        import traceback
        traceback.print_exc()

@app.get("/")
async def root():
    return {
        "message": "Lagos Traffic Congestion Intelligence API",
        "status": "running",
        "endpoints": {
            "congestion": "/congestion",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "feature_scaler_loaded": feature_scaler is not None,
        "target_scaler_loaded": target_scaler is not None,
        "data_loaded": df is not None,
        "data_records": len(df) if df is not None else 0
    }

# UPDATED: Renamed from /predict to /congestion to avoid conflicts
@app.post("/congestion", response_model=CongestionResponse)
async def analyze_congestion(request: RouteRequest):
    """Analyze congestion conditions for a route (does not predict travel time)"""
    
    if model is None or feature_scaler is None or target_scaler is None or df is None:
        raise HTTPException(status_code=500, detail="Models not loaded properly")
    
    # Fetch weather forecast
    weather_forecast = await get_weather_forecast()
    
    # Parse coordinates
    try:
        start_coords = [float(x) for x in request.start.split(',')]
        end_coords = [float(x) for x in request.end.split(',')]
    except:
        raise HTTPException(status_code=400, detail="Invalid coordinate format")
    
    # Find nearest bottleneck to the route
    def distance(coord1, coord2):
        """Calculate simple distance between two coordinates"""
        return ((coord1[0] - coord2[0])**2 + (coord1[1] - coord2[1])**2)**0.5
    
    # Bottleneck coordinates (approximate Lagos locations)
    bottleneck_coords = {
        "Third_Mainland_Bridge": [6.5000, 3.4025],
        "Carter_Bridge": [6.4669, 3.3850],
        "Eko_Bridge": [6.4641, 3.3803],
        "CMS_Junction": [6.4500, 3.4000],
        "Marina_Road": [6.4500, 3.4000],
        "Obalende": [6.4447, 3.4175],
        "Adeniji_Adele": [6.4743, 3.3904],
        "Falomo_Roundabout": [6.4444, 3.4272],
        "Awolowo_Road": [6.4419, 3.4190]
    }
    
    # Find closest bottleneck to the route midpoint
    route_midpoint = [(start_coords[0] + end_coords[0])/2, (start_coords[1] + end_coords[1])/2]
    
    closest_bottleneck = None
    min_distance = float('inf')
    
    for bottleneck_name, bottleneck_coord in bottleneck_coords.items():
        dist = distance(route_midpoint, bottleneck_coord)
        if dist < min_distance:
            min_distance = dist
            closest_bottleneck = bottleneck_name
    
    # If no bottleneck is reasonably close
    if min_distance > 0.1:
        return CongestionResponse(
            status="info",
            message="No known bottlenecks near this route",
            congestion_level="clear",
            weather_forecast=weather_forecast,
            ai_recommendation="Route appears to avoid major congestion points"
        )
    
    # Get recent data for the closest bottleneck
    segment_data = df[df["collection_location"] == closest_bottleneck].sort_values(
        by="timestamp", ascending=False
    ).head(6)
    
    if len(segment_data) < 6:
        return CongestionResponse(
            status="info",
            message=f"Limited data for bottleneck {closest_bottleneck}",
            congestion_level="unknown",
            weather_forecast=weather_forecast,
            ai_recommendation="Consider alternative routes due to limited traffic data"
        )
    
    try:
        # Calculate current congestion ratio from recent data
        latest_data = segment_data.iloc[0]
        current_speed = latest_data.get('current_speed', 0)
        free_flow_speed = latest_data.get('free_flow_speed', 1)
        congestion_ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 1
        
        # Determine base congestion level
        if congestion_ratio >= 0.8:
            base_congestion_level = "clear"
        elif congestion_ratio >= 0.6:
            base_congestion_level = "light"
        elif congestion_ratio >= 0.4:
            base_congestion_level = "moderate"
        elif congestion_ratio >= 0.2:
            base_congestion_level = "heavy"
        else:
            base_congestion_level = "severe"
        
        # Adjust congestion level based on weather
        current_weather_impact = weather_forecast.current_weather.weather_impact
        if current_weather_impact == "severe" and base_congestion_level in ["clear", "light"]:
            congestion_level = "moderate"
        elif current_weather_impact == "moderate" and base_congestion_level == "clear":
            congestion_level = "light"
        else:
            congestion_level = base_congestion_level
        
        # Determine status and message
        if congestion_level in ["heavy", "severe"] or current_weather_impact in ["moderate", "severe"]:
            if current_weather_impact in ["moderate", "severe"]:
                status = "warning"
                message = f"Weather affecting traffic conditions near {closest_bottleneck}"
            else:
                status = "warning"
                message = f"Heavy congestion detected at {closest_bottleneck}"
        else:
            status = "info"
            message = f"Traffic conditions near {closest_bottleneck}"
        
        # Generate hourly congestion forecast (no travel times)
        current_hour = datetime.now().hour
        hourly_patterns = predict_hourly_congestion(segment_data, current_hour)

        hourly_forecast = []
        high_congestion_hours = []

        for hour_offset in range(1, 4):
            target_hour = (current_hour + hour_offset) % 24
            pattern = hourly_patterns.get(target_hour, {})
            
            level = pattern.get("level", "moderate")
            confidence = pattern.get("confidence", "medium")
            
            forecast_item = HourlyForecast(
                hour=target_hour,
                predicted_congestion_level=level,
                confidence=confidence
            )
            hourly_forecast.append(forecast_item)
            
            # Track high congestion hours
            if level in ["heavy", "severe"]:
                hour_12 = target_hour if target_hour <= 12 else target_hour - 12
                period = "AM" if target_hour < 12 else "PM"
                if target_hour == 0:
                    hour_12 = 12
                    period = "AM"
                elif target_hour == 12:
                    hour_12 = 12
                    period = "PM"
                high_congestion_hours.append(f"{hour_12}:00 {period}")

        # Generate forecast summary
        weather_note = ""
        if current_weather_impact != "none":
            weather_note = f" (Weather may worsen conditions)"
        
        if high_congestion_hours:
            forecast_summary = f"⚠️ Heavy congestion expected at {', '.join(high_congestion_hours)}{weather_note}"
        else:
            moderate_hours = [f for f in hourly_forecast if f.predicted_congestion_level == "moderate"]
            if moderate_hours:
                forecast_summary = f"ℹ️ Moderate traffic conditions expected ahead{weather_note}"
            else:
                forecast_summary = f"✅ Good traffic conditions expected{weather_note}"
        
        # Generate AI recommendation
        ai_recommendation = generate_ai_recommendation(congestion_level, high_congestion_hours, current_weather_impact)
        
        return CongestionResponse(
            status=status,
            message=message,
            bottleneck_location=closest_bottleneck,
            congestion_level=congestion_level,
            congestion_ratio=round(congestion_ratio, 2),
            hourly_forecast=hourly_forecast,
            forecast_summary=forecast_summary,
            weather_forecast=weather_forecast,
            ai_recommendation=ai_recommendation
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Congestion analysis error: {str(e)}")

def generate_ai_recommendation(congestion_level, high_congestion_hours, weather_impact):
    """Generate AI-powered recommendations"""
    
    recommendations = []
    
    if congestion_level in ["heavy", "severe"]:
        recommendations.append("🚨 Consider alternative routes")
        
    if high_congestion_hours:
        recommendations.append(f"⏰ Avoid traveling during {', '.join(high_congestion_hours)}")
        
    if weather_impact in ["moderate", "severe"]:
        recommendations.append("🌧️ Allow extra time due to weather conditions")
        
    if congestion_level == "clear" and not high_congestion_hours:
        recommendations.append("✅ Good time to travel - conditions are favorable")
        
    return " | ".join(recommendations) if recommendations else "No specific recommendations at this time"

@app.get("/locations")
async def get_available_locations():
    """Get list of available bottleneck locations"""
    return {
        "bottlenecks": list(BOTTLENECKS),
        "message": "These are the bottleneck locations monitored by our AI system"
    }

if __name__ == "__main__":
    print("🚀 Starting Lagos Traffic Congestion Intelligence API...")
    print("ℹ️  This API provides congestion warnings, not travel time calculations")
    
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8000,
        reload=True
    )
