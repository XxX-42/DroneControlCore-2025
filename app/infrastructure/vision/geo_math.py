import math

class GeoLocator:
    def __init__(self, camera_fov_h=80.0, camera_fov_v=60.0, image_width=640, image_height=480):
        self.camera_fov_h = camera_fov_h
        self.camera_fov_v = camera_fov_v
        self.image_width = image_width
        self.image_height = image_height
        self.earth_radius = 6371000.0 # Meters

    def pixel_to_angle(self, u, v):
        """
        Calculate angular offsets (alpha_x, alpha_y) from image center.
        u, v: Pixel coordinates (top-left origin)
        Returns: (alpha_x_deg, alpha_y_deg)
        """
        center_u = self.image_width / 2.0
        center_v = self.image_height / 2.0

        # Horizontal angle (positive right)
        alpha_x = (u - center_u) / center_u * (self.camera_fov_h / 2.0)
        
        # Vertical angle (positive down? Assuming standard convention where y increases down)
        # If pitch=0 means looking down (Nadir), then +y in image is +angle (forward/up from nadir?)
        # Let's stick to the prompt's likely intent: 
        # alpha_y is offset from the center ray.
        alpha_y = (center_v - v) / center_v * (self.camera_fov_v / 2.0)
        
        return alpha_x, alpha_y

    def calculate_gps_location(self, drone_lat, drone_lon, drone_alt, drone_heading, object_u, object_v):
        """
        Calculate the GPS location of an object in the image.
        Assumes Flat Earth projection for short distances.
        """
        # Step 1: Get angles
        alpha_x, alpha_y = self.pixel_to_angle(object_u, object_v)
        
        # Step 2: Calculate ground distance
        # Formula: D = drone_alt * tan(pitch + alpha_y)
        # Assuming pitch = 0 (Nadir/Down-facing for this formula to make sense with D ~ alt * tan(alpha))
        # If pitch=0 is horizontal, this formula is weird unless alpha_y is depression.
        # We use the prompt's exact formula.
        pitch = 0.0 # Mock pitch
        
        # Convert to radians
        angle_rad = math.radians(pitch + alpha_y)
        
        # Avoid tan(90)
        if abs(angle_rad - math.pi/2) < 0.001:
            distance = 10000.0 # Max range clamp
        else:
            distance = drone_alt * math.tan(angle_rad)
            
        # Clamp distance to avoid crazy values if looking at horizon
        if distance < 0: distance = 0 # Should not happen if looking down
        if distance > 1000: distance = 1000 # Max 1km range
        
        # Step 3: Calculate bearing
        # Target_Bearing = drone_heading + alpha_x
        bearing_deg = drone_heading + alpha_x
        bearing_rad = math.radians(bearing_deg)
        
        # Step 4: Calculate new Lat/Lon using Haversine destination formula
        lat_rad = math.radians(drone_lat)
        lon_rad = math.radians(drone_lon)
        angular_distance = distance / self.earth_radius
        
        new_lat_rad = math.asin(
            math.sin(lat_rad) * math.cos(angular_distance) +
            math.cos(lat_rad) * math.sin(angular_distance) * math.cos(bearing_rad)
        )
        
        new_lon_rad = lon_rad + math.atan2(
            math.sin(bearing_rad) * math.sin(angular_distance) * math.cos(lat_rad),
            math.cos(angular_distance) - math.sin(lat_rad) * math.sin(new_lat_rad)
        )
        
        return {
            "lat": math.degrees(new_lat_rad),
            "lon": math.degrees(new_lon_rad),
            "distance_m": distance,
            "bearing_deg": bearing_deg
        }
