import math

class DroneState:
    def __init__(self):
        # Initial Position (Chengdu)
        self.lat = 30.598
        self.lon = 103.991
        self.alt = 100.0
        self.heading = 0.0
        
        # Navigation Target
        self.target_lat = None
        self.target_lon = None
        
        # Physics Constants
        self.speed = 0.00005       # Speed per tick
        self.max_radius = 0.005    # Start spiraling from ~550m
        self.min_radius = 0.001    # Final hold distance ~110m
        self.spiral_decay = 0.00002 # How fast the circle tightens
        
        # Dynamic State
        self.current_radius = self.max_radius
        self.tick = 0

    def update_position(self):
        self.tick += 0.1
        
        # Mode 1: No Target -> Idle (Hover in place or circle locally)
        if self.target_lat is None:
            self.heading = (self.heading + 1) % 360
            return

        # Calculate distance to target
        lat_diff = self.target_lat - self.lat
        lon_diff = self.target_lon - self.lon
        distance_to_center = math.sqrt(lat_diff**2 + lon_diff**2)

        # Mode 2: Transit (Fly to the outer edge of the spiral)
        # We fly until we hit the max_radius edge
        if distance_to_center > self.max_radius:
            # Reset spiral state for next arrival
            self.current_radius = self.max_radius 
            
            # Move linearly towards target
            angle = math.atan2(lon_diff, lat_diff)
            self.lat += self.speed * math.cos(angle)
            self.lon += self.speed * math.sin(angle)
            self.heading = math.degrees(angle) % 360
            
        else:
            # Mode 3: Spiral-In Loiter (The Fun Part)
            
            # 1. Decay the radius until it hits minimum
            if self.current_radius > self.min_radius:
                self.current_radius -= self.spiral_decay
            else:
                self.current_radius = self.min_radius # Hold at 100m
            
            # 2. Calculate position on the circle
            # We use offset from target based on current dynamic radius
            self.lat = self.target_lat + (self.current_radius * math.sin(self.tick))
            self.lon = self.target_lon + (self.current_radius * math.cos(self.tick))
            
            # 3. Update heading (tangent to circle)
            self.heading = (self.heading + 5) % 360

    def set_speed(self, factor: float):
        """
        Update speed based on a factor (1-100).
        Base speed is approx 0.00001.
        """
        # Clamp factor between 1 and 100
        factor = max(1.0, min(100.0, factor))
        self.speed = factor * 0.00001


# Global Singleton Instance
drone_state = DroneState()
