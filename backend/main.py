from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
from tensorflow.keras.models import load_model
import os
from datetime import datetime
import uvicorn

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

ROUTE_MAP = {
    ("6.4743,3.3904", "6.4419,3.4190"): ["Adeniji_Adele", "Falomo_Roundabout", "Awolowo_Road"],
    ("6.5000,3.4025", "6.4447,3.4175"): ["Third_Mainland_Bridge", "Obalende"],
    ("6.4669,3.3850", "6.4444,3.4272"): ["Carter_Bridge", "Falomo_Roundabout"],
  
}

FEATURES = [
    "current_speed", "free_flow_speed", "delay_seconds",
    "hour", "day_of_week", "is_rush_hour", "is_weekend", "is_lagos_hotspot"
]

class RouteRequest(BaseModel):
    start: str
    end: str

class PredictionResponse(BaseModel):
    status: str
    message: str
    predicted_travel_time: float = None
    bottleneck_location: str = None
# Load both scalers
feature_scaler = None
target_scaler = None

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
        "message": "Lagos Traffic Prediction API",
        "status": "running",
        "endpoints": {
            "predict": "/predict",
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

@app.post("/predict", response_model=PredictionResponse)
async def predict_travel_time(request: RouteRequest):
    """Predict travel time for a route"""
    
    if model is None or feature_scaler is None or target_scaler is None or df is None:
        raise HTTPException(status_code=500, detail="Models not loaded properly")
    
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
    
    # If no bottleneck is reasonably close (> 0.1 degrees ~= 11km), no congestion predicted
    if min_distance > 0.1:
        return PredictionResponse(
            status="ok",
            message="No known bottlenecks near this route - expect normal travel time",
            predicted_travel_time=None
        )
    
    # Get recent data for the closest bottleneck
    segment_data = df[df["collection_location"] == closest_bottleneck].sort_values(
        by="timestamp", ascending=False
    ).head(6)
    
    if len(segment_data) < 6:
        return PredictionResponse(
            status="ok",
            message=f"Insufficient data for nearby bottleneck {closest_bottleneck}",
            predicted_travel_time=None
        )
    
    try:
        features_matrix = segment_data[FEATURES].values
        
        # Use feature_scaler for features
        scaled_features = feature_scaler.transform(features_matrix)
        
        X_input = np.expand_dims(scaled_features, axis=0)
        prediction_scaled = model.predict(X_input, verbose=0)
        
        # Use target_scaler for inverse transform
        predicted_time = target_scaler.inverse_transform(prediction_scaled)[0][0]
        
        return PredictionResponse(
            status="warning",
            message=f"Route passes near bottleneck: {closest_bottleneck}",
            predicted_travel_time=round(float(predicted_time), 2),
            bottleneck_location=closest_bottleneck
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/locations")
async def get_available_locations():
    """Get list of available locations and routes"""
    return {
        "bottlenecks": list(BOTTLENECKS),
        "available_routes": [{"start": start, "end": end, "segments": segments} 
                           for (start, end), segments in ROUTE_MAP.items()]
    }

if __name__ == "__main__":
    # Update these file paths before running
    print("🚀 Starting Lagos Traffic Prediction API...")
    print("⚠️  Make sure to update the file paths in the load_models() function!")
    
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8000,
        reload=True
    )
