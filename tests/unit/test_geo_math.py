import pytest
from app.infrastructure.vision.geo_math import GeoLocator

def test_pixel_to_angle_center():
    """Verify that the center pixel returns 0 degrees offset."""
    locator = GeoLocator(image_width=640, image_height=480)
    alpha_x, alpha_y = locator.pixel_to_angle(320, 240)
    assert alpha_x == 0.0
    assert alpha_y == 0.0

def test_gps_calculation_basic():
    """
    Mock a drone at (Lat=0, Lon=0, Alt=100). 
    Verify that an object directly below (offset=0) returns the same coordinates.
    """
    locator = GeoLocator(image_width=640, image_height=480)
    
    # Center pixel -> 0 offset
    result = locator.calculate_gps_location(
        drone_lat=0.0,
        drone_lon=0.0,
        drone_alt=100.0,
        drone_heading=0.0,
        object_u=320,
        object_v=240
    )
    
    # Should be very close to 0,0
    assert result["lat"] == pytest.approx(0.0, abs=1e-5)
    assert result["lon"] == pytest.approx(0.0, abs=1e-5)
    assert result["distance_m"] == pytest.approx(0.0, abs=1e-1)
