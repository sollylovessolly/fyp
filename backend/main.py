from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler
import joblib
import random

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow requests from your frontend (React dev server runs on localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["*"] for all origins (use with caution)
    allow_credentials=True,
    allow_methods=["*"],  # Or ["POST", "GET"]
    allow_headers=["*"],
)


# Load model and scaler
model = load_model("lstm_model.keras")
scaler = joblib.load("scaler.pkl")

# Toggle for simulating congestion during testing
SIMULATE_CONGESTION = False

class TrafficData(BaseModel):
    current_speed: float
    free_flow_speed: float
    delay_seconds: float
    hour: int
    day_of_week: int
    is_rush_hour: int
    is_weekend: int
    is_lagos_hotspot: int

@app.post("/predict")
def predict_travel_time(data: TrafficData):
    try:
        features = np.array([[
            data.current_speed,
            data.free_flow_speed,
            data.delay_seconds,
            data.hour,
            data.day_of_week,
            data.is_rush_hour,
            data.is_weekend,
            data.is_lagos_hotspot
        ]])

        # Scale and reshape input
        scaled = scaler.transform(features)
        input_seq = np.repeat(scaled, 6, axis=0).reshape(1, 6, 8)

        # Predict travel time
        pred = model.predict(input_seq)[0][0]

        # OPTIONAL: simulate congestion for testing
        if SIMULATE_CONGESTION:
            if random.random() < 0.3:  # 30% chance
                pred += random.randint(180, 600)  # add 3-10 mins

        # Use free flow travel time as baseline (if known), or estimate
        free_flow_time = data.free_flow_speed / data.current_speed * pred if data.current_speed else pred
        delay = pred - free_flow_time

        # Categorize congestion warning
        if delay > 300:
            warning_msg = "🚨 Severe congestion expected in ~5 minutes. Consider alternate routes!"
        elif delay > 180:
            warning_msg = "⚠️ Moderate congestion expected in a few minutes."
        else:
            warning_msg = "✅ Route is mostly clear."

        return {
            "predicted_travel_time": float(pred),
            "delay_seconds": float(delay),
            "message": warning_msg
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
