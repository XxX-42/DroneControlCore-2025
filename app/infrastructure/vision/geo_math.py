import math


class GeoLocator:
    def __init__(
        self,
        camera_fov_h=80.0,
        camera_fov_v=60.0,
        image_width=640,
        image_height=480,
    ):
        self.camera_fov_h = camera_fov_h
        self.camera_fov_v = camera_fov_v
        self.image_width = image_width
        self.image_height = image_height
        self.earth_radius = 6371000.0

    def pixel_to_angle(self, u, v):
        center_u = self.image_width / 2.0
        center_v = self.image_height / 2.0

        alpha_x = (u - center_u) / center_u * (self.camera_fov_h / 2.0)
        alpha_y = (center_v - v) / center_v * (self.camera_fov_v / 2.0)
        return alpha_x, alpha_y

    def calculate_gps_location(
        self,
        drone_lat,
        drone_lon,
        drone_alt,
        drone_heading,
        object_u,
        object_v,
        pitch_deg=0.0,
        roll_deg=0.0,
    ):
        if drone_alt <= 0:
            return None

        alpha_x, alpha_y = self.pixel_to_angle(object_u, object_v)

        east_body = drone_alt * math.tan(math.radians(alpha_x + roll_deg))
        north_body = drone_alt * math.tan(math.radians(alpha_y + pitch_deg))

        heading_rad = math.radians(drone_heading)
        dn = (north_body * math.cos(heading_rad)) - (east_body * math.sin(heading_rad))
        de = (north_body * math.sin(heading_rad)) + (east_body * math.cos(heading_rad))
        distance = math.sqrt((dn ** 2) + (de ** 2))

        d_lat_rad = dn / self.earth_radius
        d_lon_rad = de / (self.earth_radius * math.cos(math.radians(drone_lat)))

        new_lat = drone_lat + math.degrees(d_lat_rad)
        new_lon = drone_lon + math.degrees(d_lon_rad)
        bearing_deg = (math.degrees(math.atan2(de, dn)) + 360) % 360

        return {
            "lat": new_lat,
            "lon": new_lon,
            "distance_m": distance,
            "bearing_deg": bearing_deg,
        }
