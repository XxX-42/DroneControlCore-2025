from ultralytics import YOLO
import concurrent.futures
import asyncio
import io
from PIL import Image
from app.infrastructure.vision.geo_math import GeoLocator

class YoloService:
    # Config
    MAX_QUEUE_SIZE = 1 # Drop everything if we can't keep up
    
    def __init__(self):
        print("Initializing YOLOv8 model...")
        # Initialize YOLOv8 nano model (auto-downloads if needed)
        self.model = YOLO('yolov8n.pt')
        
        # Dynamic ThreadPool
        import os
        workers = min(32, (os.cpu_count() or 1) + 4)
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=workers)
        
        self.geo_locator = GeoLocator()
        self.inference_queue = asyncio.Queue(maxsize=self.MAX_QUEUE_SIZE)
        print(f"YOLOv8 initialized with {workers} workers.")

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
        Asynchronous wrapper with FRAME DROPPING.
        If the queue is full, we don't even start processing this frame.
        This prevents 'lag buildup' where we show results from 5s ago.
        """
        # 1. Circuit Breaker / Frame Drop
        # If we have too many pending tasks, we assume the system is overloaded.
        # Ideally, we'd drop the *oldest* from the queue, but here we just likely reject the new one 
        # or implement a "latest only" pattern.
        # Simpler approach: If the executor has too many items, skip.
        
        # Ideally, we want to run the prediction in the executor.
        loop = asyncio.get_running_loop()
        
        # Check if we are overwhelmed (heuristic)
        if self.executor._work_queue.qsize() > 2:
            print("[YOLO] Dropping frame - worker pool overloaded.")
            return []

        try:
            detections = await loop.run_in_executor(
                self.executor, 
                self._predict_sync, 
                image_bytes
            )
        except Exception:
            return []
        
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
