from ultralytics import YOLO
import concurrent.futures
import asyncio
import io
from PIL import Image
from app.infrastructure.vision.geo_math import GeoLocator

class YoloService:
    def __init__(self):
        print("Initializing YOLOv8 model...")
        # Initialize YOLOv8 nano model (auto-downloads if needed)
        self.model = YOLO('yolov8n.pt')
        # Thread pool for CPU-bound inference tasks
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        self.geo_locator = GeoLocator()
        print("YOLOv8 model initialized.")

    def _predict_sync(self, image_bytes: bytes):
        """
        Synchronous helper to run inference on image bytes.
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Run prediction
            results = self.model.predict(image, verbose=False)
            
            detections = []
            for result in results:
                for box in result.boxes:
                    detections.append({
                        "label": result.names[int(box.cls)],
                        "confidence": float(box.conf),
                        "bbox": box.xyxy[0].tolist() # [x1, y1, x2, y2]
                    })
            return detections
        except Exception as e:
            print(f"Error in YOLO prediction: {e}")
            return []

    async def analyze_image(self, image_bytes: bytes):
        """
        Asynchronous wrapper to run inference in a separate thread.
        """
        loop = asyncio.get_running_loop()
        detections = await loop.run_in_executor(
            self.executor, 
            self._predict_sync, 
            image_bytes
        )
        
        # Mock Drone State (Chengdu)
        drone_lat = 30.598
        drone_lon = 103.991
        drone_alt = 100.0 # Meters
        drone_heading = 0.0 # North
        
        # Enrich with Geolocation
        for d in detections:
            bbox = d["bbox"] # [x1, y1, x2, y2]
            center_u = (bbox[0] + bbox[2]) / 2
            center_v = (bbox[1] + bbox[3]) / 2
            
            geo = self.geo_locator.calculate_gps_location(
                drone_lat, drone_lon, drone_alt, drone_heading,
                center_u, center_v
            )
            d["geo_location"] = geo
            
        return detections

# Global instance
yolo_service = YoloService()
