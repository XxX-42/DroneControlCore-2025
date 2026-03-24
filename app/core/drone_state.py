import math
from datetime import datetime
from typing import List, Dict

class DroneState:
    # --- Config Constants ---
    SPEED = 0.0004              # Linear Flight Speed (8x original default)
    SPIRAL_SPEED_DEG = 2.0      # Angular velocity (deg/tick)
    
    # Distances (Approx. 1 deg lat = 111km)
    # 100m ~= 0.0009 deg. Let's round to 0.001
    DIST_CAPTURE_RADIUS = 0.001  # 100m (Trigger Spiral)
    DIST_FINAL_RADIUS = 0.0002   # 20m (End Spiral)
    DIST_WAYPOINT_PASS = 0.00005 # 5m (Street node pass-through)
    
    SPIRAL_DECAY = 0.000003      # How fast it shrinks per tick
    
    # --- Validation Limits ---
    MAX_SPEED_MPS = 20.0       # Max Speed (m/s) (approx check)
    MAX_ALT_M = 500.0          # Ceiling
    MIN_ALT_M = 0.0            # Ground
    CLAMP_LAT_BOUNDS = (-90, 90)
    CLAMP_LON_BOUNDS = (-180, 180)
    
    def __init__(self):
        # Initial State (Chengdu)
        self.lat = 30.598
        self.lon = 103.991
        self.alt = 100.0
        self.heading = 0.0
        self.pitch = 0.0
        self.roll = 0.0
        self.yaw = 0.0      # Redundant with heading, but standard convention
        
        # Navigation Data
        self.waypoint_queue: List[Dict] = []
        self.state = "IDLE" # IDLE, NAVIGATING, SPIRALING
        self.trace_points: List[Dict] = []
        
        # Spiral Mechanics
        self.spiral_center = (0, 0)
        self.current_radius = 0.0
        self.spiral_angle_rad = 0.0 # Current angle on the circle (radians)
        
        # User Controls
        self.sim_speed_factor = 1.0
        self.is_paused = False
        self._paused_state = "IDLE"
        
        # Internal Loop Control
        self._running = False

    def set_speed(self, factor: float):
        self.sim_speed_factor = factor

    def set_spiral_speed(self, val: float):
        self.SPIRAL_SPEED_DEG = val

    def set_mission(self, full_route: List[Dict]):
        self.waypoint_queue = full_route
        self.state = "NAVIGATING"
        self.is_paused = False
        self._paused_state = "NAVIGATING"
        self.trace_points = []
        self.record_trace_point()
        print(f"[DEBUG] Mission Set. {len(full_route)} waypoints.")

    def pause_mission(self):
        if self.state != "IDLE" and not self.is_paused:
            self._paused_state = self.state
            self.is_paused = True
            self.state = "PAUSED"

    def resume_mission(self):
        if self.is_paused:
            self.is_paused = False
            self.state = self._paused_state if self._paused_state != "IDLE" else "NAVIGATING"

    def cancel_mission(self):
        self.waypoint_queue = []
        self.is_paused = False
        self._paused_state = "IDLE"
        self.state = "IDLE"
        self.pitch = 0.0
        self.roll = 0.0
        self.record_trace_point()

    def record_trace_point(self):
        point = {
            "timestamp": datetime.utcnow().isoformat(),
            "latitude": self.lat,
            "longitude": self.lon,
            "altitude": self.alt,
            "heading": self.heading,
            "state": self.state,
        }
        last_point = self.trace_points[-1] if self.trace_points else None
        if last_point:
            same_position = (
                abs(last_point["latitude"] - point["latitude"]) < 1e-7
                and abs(last_point["longitude"] - point["longitude"]) < 1e-7
                and abs(last_point["altitude"] - point["altitude"]) < 1e-7
            )
            if same_position and last_point["state"] == point["state"]:
                return
        self.trace_points.append(point)
        if len(self.trace_points) > 5000:
            self.trace_points = self.trace_points[-5000:]

    def get_trace_snapshot(self):
        return list(self.trace_points)

    async def start_physics_loop(self):
        """
        Runs the physics simulation at ~20Hz (50ms).
        This decouples the simulation from the WebSocket connection.
        """
        import asyncio
        print("[PHYSICS] Engine Started.")
        self._running = True
        try:
            while self._running:
                self.update_position()
                await asyncio.sleep(0.05) # 20Hz
        except asyncio.CancelledError:
            print("[PHYSICS] Engine Stopping...")
            self._running = False
            raise

    def update_position(self):
        # Apply speed factor
        current_speed = self.SPEED * self.sim_speed_factor

        if self.is_paused or self.state == "PAUSED":
            self.pitch = 0.0
            self.roll = 0.0
            self.record_trace_point()
            return
        
        if this_is_idle := (not self.waypoint_queue and self.state != "SPIRALING"):
            self.state = "IDLE"
            self.pitch = 0.0
            self.roll = 0.0
            self.record_trace_point()
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
                    print("[DEBUG] Final target reached. Mission segment done.")
                    self.lat = t_lat
                    self.lon = t_lon
                    self.waypoint_queue.pop(0)
                    self.state = "NAVIGATING" if self.waypoint_queue else "IDLE"
                    self.pitch = 0.0
                    self.roll = 0.0
                    self.record_trace_point()
                    return
                else:
                    # Street Node: Just pop and keep flying
                    self.waypoint_queue.pop(0)
            
            else:
                # Move Linearly
                angle = math.atan2(dx, dy) # Bearing
                self.lat += current_speed * math.cos(angle)
                self.lon += current_speed * math.sin(angle)
                
                target_heading = (math.degrees(angle) + 360) % 360
                
                # --- ATTITUDE SIMULATION ---
                # Calculate turn rate (diff between current heading and target)
                heading_diff = (target_heading - self.heading + 180) % 360 - 180
                # Bank angle proportional to turn rate (clamped)
                self.roll = max(-30, min(30, heading_diff * 2.0))
                # Pitch down slightly when moving fast, pitch up (negative) to brake? 
                # Let's say pitch = -5 deg (nose down) constant when moving
                self.pitch = -5.0
                
                self.heading = target_heading
                self.yaw = self.heading

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
                self.record_trace_point()
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
            target_heading = (math.degrees(self.spiral_angle_rad) + 90) % 360
            
            # --- ATTITUDE SIMULATION (Banking) ---
            # Bank into the turn. Constant turn rate = constant bank angle.
            # V = r * omega. tan(bank) = v^2 / (r*g) or just proportional to turn rate.
            # Simple Hack: Bank 20 degrees for spiral
            self.roll = 20.0 
            self.heading = target_heading

        # --- VALIDATION CLAMP ---
        # Ensure we don't go underground or to space
        if self.alt < self.MIN_ALT_M:
            self.alt = self.MIN_ALT_M
            # print("⚠️ [PHYSICS] Clamp: Altitude cannot be negative.")
        elif self.alt > self.MAX_ALT_M:
            self.alt = self.MAX_ALT_M
            
        # Basic Lat/Lon bounds
        self.lat = max(self.CLAMP_LAT_BOUNDS[0], min(self.CLAMP_LAT_BOUNDS[1], self.lat))
        self.lon = max(self.CLAMP_LON_BOUNDS[0], min(self.CLAMP_LON_BOUNDS[1], self.lon))
        self.record_trace_point()

# Singleton
drone_state = DroneState()
