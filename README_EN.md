# DroneControlCore (2025)

[中文 README](./README.md)

![Python](https://img.shields.io/badge/Python-3.10-blue)
![Vue](https://img.shields.io/badge/Vue.js-3.0-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95-teal)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## Overview

**DroneControlCore** is a full-stack drone command-and-control system focused on autonomous navigation workflows. The current project emphasizes:

- live telemetry
- OSM-based route planning
- mixed task-mode and realtime-mode queue orchestration
- mission history and replay
- full simulation-based development and testing

## Current Capabilities

- **Realtime Telemetry Visualization**: Displays position, heading, altitude, pitch, and roll over WebSocket telemetry.
- **Task Mode / Realtime Mode**: Supports queued mission planning plus realtime point insertion without losing the original task order.
- **OSM Route Planning**: Click and hover interactions use OpenStreetMap road-network planning, including corridor planning for distant targets.
- **Task Hover OSM**: In task mode, hover preview always starts from the last queued task point.
- **Editable Mission Queue**: Users can add, remove, renumber, and rebuild mission points directly on the map.
- **Mission History and Replay**: Mission and execution records are stored in SQLite and can be replayed in the UI.
- **Simulation Mode**: The system can be fully exercised without physical drone hardware.
- **OSM Segment Cache**: The backend caches repeated route segments to reduce stalls during queue rebuilds.

## Current Planning Rules

### Task Mode

- Each click appends a new task point to the end of the queue.
- Hover OSM preview starts from the current last task point.
- Deleting any point rebuilds the route from the remaining queue.
- After a browser refresh, the start-point focus action defaults back to the current live drone position.

### Realtime Mode

- Realtime clicks do not discard the existing task queue.
- A new realtime point is inserted at the front of the queue and becomes the new `Task 1`.
- Existing task-mode points shift back while preserving their relative order.
- If another realtime point is added before reaching the original `Task 1`, the newest realtime point still becomes the new `Task 1`.

## Development Startup

### Backend

1. Go to the project root.
2. Activate the virtual environment:

```powershell
venv\Scripts\activate
```

3. Install dependencies:

```powershell
pip install -r requirements.txt
```

4. Start FastAPI:

```powershell
venv\Scripts\python -m uvicorn app.main:app --reload --port 8090
```

Backend endpoints:

- [http://127.0.0.1:8090](http://127.0.0.1:8090)
- Docs: [http://127.0.0.1:8090/docs](http://127.0.0.1:8090/docs)

### Frontend

1. Enter the frontend directory:

```powershell
cd frontend
```

2. Install dependencies:

```powershell
npm install
```

3. Start the dev server:

```powershell
npm run dev
```

Frontend URL:

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Test Commands

### Backend navigation tests

```powershell
venv\Scripts\python -m pytest tests\integration\test_navigation_flow.py tests\integration\test_path_planner.py -q
```

### Frontend tests

```powershell
cd frontend
npm test
```

### Frontend build

```powershell
cd frontend
npm run build
```

## Docker Deployment

```powershell
docker-compose up --build
```

The default access point is `http://localhost`.

## Project Structure

- **Domain Layer**: Core entities and business state definitions such as `Mission` and `Waypoint`
- **Infrastructure Layer**: MAVSDK, SQLite, and OSM planning/caching
- **API Layer**: FastAPI routers for mission, execution, navigation, and telemetry
- **Frontend**: Vue 3 map console for mission queue editing, mode switching, replay, and map interaction
