from app.core.drone_state import drone_state
import math

class TargetTrackingService:
    """
    Service responsible for converting visual detections into navigation commands.
    """
    def __init__(self):
        print("[TRACKING] Service initialized.")

    async def update_target(self, detection: dict, image_width=640, image_height=480):
        """
        Called when a valid target is detected by YOLO.
        Calculates GPS coordinates and could optionally send a command.
        """
        bbox = detection.get("bbox") # [x1, y1, x2, y2]
        if not bbox: return None
        
        # Calculate center
        u = (bbox[0] + bbox[2]) / 2.0
        v = (bbox[1] + bbox[3]) / 2.0
        
        # 1. Get current state (Atomic snapshot ideally)
        lat = drone_state.lat
        lon = drone_state.lon
        alt = drone_state.alt
        heading = drone_state.heading
        pitch = drone_state.pitch
        roll = drone_state.roll
        
        # 2. Lazy Import to avoid circular dep issues if any
        # (Though yolo_service imports geo_locator, we should probably inject it or import it)
        from app.infrastructure.vision.yolo_service import yolo_service
        geo_locator = yolo_service.geo_locator
        
        # 3. Calculate Target GPS
        target_geo = geo_locator.calculate_gps_location(
            drone_lat=lat,
            drone_lon=lon,
            drone_alt=alt,
            drone_heading=heading,
            object_u=u,
            object_v=v,
            pitch_deg=pitch,
            roll_deg=roll
        )
        
        if target_geo:
            # print(f"[TRACKING] Target Lock: {target_geo['lat']:.6f}, {target_geo['lon']:.6f}")
            detection['geo_location'] = target_geo
            return target_geo
            
        return None

target_tracking_service = TargetTrackingService()
