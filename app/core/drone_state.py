import math
from typing import List, Dict

class DroneState:
    # --- Config Constants ---
    SPEED = 0.00005             # Linear Flight Speed
    SPIRAL_SPEED_DEG = 2.0      # Angular velocity (deg/tick)
    
    # Distances (Approx. 1 deg lat = 111km)
    # 100m ~= 0.0009 deg. Let's round to 0.001
    DIST_CAPTURE_RADIUS = 0.001  # 100m (Trigger Spiral)
    DIST_FINAL_RADIUS = 0.0002   # 20m (End Spiral)
    DIST_WAYPOINT_PASS = 0.00005 # 5m (Street node pass-through)
    
    SPIRAL_DECAY = 0.000003      # How fast it shrinks per tick
    
    def __init__(self):
        # Initial State (Chengdu)
        self.lat = 30.598
        self.lon = 103.991
        self.alt = 100.0
        self.heading = 0.0
        
        # Navigation Data
        self.waypoint_queue: List[Dict] = []
        self.state = "IDLE" # IDLE, NAVIGATING, SPIRALING
        
        # Spiral Mechanics
        self.spiral_center = (0, 0)
        self.current_radius = 0.0
        self.spiral_angle_rad = 0.0 # Current angle on the circle (radians)
        
        # User Controls
        self.sim_speed_factor = 1.0

    def set_speed(self, factor: float):
        self.sim_speed_factor = factor

    def set_spiral_speed(self, val: float):
        self.SPIRAL_SPEED_DEG = val

    def set_mission(self, full_route: List[Dict]):
        self.waypoint_queue = full_route
        self.state = "NAVIGATING"
        print(f"[DEBUG] Mission Set. {len(full_route)} waypoints.")

    def update_position(self):
        # Apply speed factor
        current_speed = self.SPEED * self.sim_speed_factor
        
        if this_is_idle := (not self.waypoint_queue and self.state != "SPIRALING"):
            self.state = "IDLE"
            return

        # --- STATE: NAVIGATING (Flying to target) ---
        if self.state == "NAVIGATING":
            if not self.waypoint_queue:
                self.state = "IDLE"
                return

            target = self.waypoint_queue[0]
            t_lat, t_lon = target['latitude'], target['longitude']
            is_final_target = target.get('is_user_target', False)

            # Calculate Vector to Target
            dy = t_lat - self.lat
            dx = t_lon - self.lon
            dist = math.sqrt(dy**2 + dx**2)
            
            # Determine Threshold: 100m for User Targets, 5m for Street Nodes
            threshold = self.DIST_CAPTURE_RADIUS if is_final_target else self.DIST_WAYPOINT_PASS

            # Check Arrival
            if dist <= threshold:
                if is_final_target:
                    # >>> CAPTURE EVENT: Smooth Injection into Spiral <<<
                    print(f"[DEBUG] Captured by Target Gravity Well (100m). Entering Spiral.")
                    self.state = "SPIRALING"
                    self.spiral_center = (t_lat, t_lon)
                    self.current_radius = dist # Start exactly where we entered
                    
                    # Calculate Entry Angle (atan2) so we don't jump
                    # drone = center + r * sin(angle) -> dy = r * sin, dx = r * cos
                    # angle = atan2(dy, dx) (Note: typical math is atan2(y, x))
                    self.spiral_angle_rad = math.atan2(dy, dx)
                    
                else:
                    # Street Node: Just pop and keep flying
                    self.waypoint_queue.pop(0)
            
            else:
                # Move Linearly
                angle = math.atan2(dx, dy) # Bearing
                self.lat += current_speed * math.cos(angle)
                self.lon += current_speed * math.sin(angle)
                self.heading = (math.degrees(angle) + 360) % 360

        # --- STATE: SPIRALING ( shrinking orbit ) ---
        elif self.state == "SPIRALING":
            # 1. Shrink Radius
            if self.current_radius > self.DIST_FINAL_RADIUS:
                self.current_radius -= self.SPIRAL_DECAY * self.sim_speed_factor
            
            # 2. Exit Condition (Reached 20m)
            if self.current_radius <= self.DIST_FINAL_RADIUS:
                print("[DEBUG] Spiral Complete (20m). Mission segment done.")
                if self.waypoint_queue:
                    self.waypoint_queue.pop(0) # Remove the finished target
                
                if self.waypoint_queue:
                    self.state = "NAVIGATING" # Go to next target
                else:
                    self.state = "IDLE" # All done
                return

            # 3. Orbital Mechanics
            # Update angle
            rad_change = math.radians(self.SPIRAL_SPEED_DEG) * self.sim_speed_factor
            self.spiral_angle_rad = (self.spiral_angle_rad + rad_change) % (2 * math.pi)
            
            # Update Position (Polar to Cartesian)
            c_lat, c_lon = self.spiral_center
            # Using (sin, cos) for (lat, lon) mapping
            self.lat = c_lat - (self.current_radius * math.sin(self.spiral_angle_rad))
            self.lon = c_lon - (self.current_radius * math.cos(self.spiral_angle_rad))
            
            # Heading is tangent (perpendicular to radius)
            self.heading = (math.degrees(self.spiral_angle_rad) + 90) % 360

# Singleton
drone_state = DroneState()
