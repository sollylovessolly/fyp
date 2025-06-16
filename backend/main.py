from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or specify frontend URL: ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Load your trained model
model = load_model("lstm_model.keras")

# Dummy scaler (replace with real scaler values if you saved them)
scaler = MinMaxScaler()
scaler.fit(np.random.rand(100, 8))  # Replace with actual fit data from training

# Define request body
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
        # Convert to numpy
        features = np.array([
            [
                data.current_speed,
                data.free_flow_speed,
                data.delay_seconds,
                data.hour,
                data.day_of_week,
                data.is_rush_hour,
                data.is_weekend,
                data.is_lagos_hotspot
            ]
        ])

        # Scale features
        scaled = scaler.transform(features)

        # Reshape for LSTM: (1, window_size, num_features)
        input_seq = np.repeat(scaled, 6, axis=0).reshape(1, 6, 8)

        # Predict
        pred = model.predict(input_seq)[0][0]

        # Optionally inverse scale (if you saved original scaler)
        return {"predicted_travel_time": float(pred)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
