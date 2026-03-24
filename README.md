# DroneControlCore (2025)

![Python](https://img.shields.io/badge/Python-3.10-blue)
![Vue](https://img.shields.io/badge/Vue.js-3.0-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95-teal)
![YOLOv8](https://img.shields.io/badge/AI-YOLOv8-purple)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## Introduction

**DroneControlCore** is a next-generation, full-stack drone command and control system designed for autonomous operations. It integrates real-time telemetry visualization, AI-powered reconnaissance using computer vision, and intuitive mission planning into a unified interface. Built with a modern tech stack, it provides a robust foundation for both simulation and hardware deployment.

## Key Features

*   **Real-time Telemetry Visualization**: Live tracking of drone position, heading, altitude, pitch, and roll via WebSocket telemetry.
*   **Task Mode and Realtime Mode**: The frontend supports queued task planning and higher-priority realtime point insertion without losing the existing task order.
*   **OSM Route Planning**: Click and hover interactions use OpenStreetMap road-network planning, including long-distance corridor loading for distant targets.
*   **Hover OSM Preview**: In task mode, hover planning starts from the last queued task point; in realtime mode, it starts from the current drone position.
*   **Editable Mission Queue**: Users can add, remove, renumber, and rebuild task points directly on the map.
*   **Mission History Persistence**: SQLite-backed database stores missions and execution history for replay and review.
*   **Simulation Mode**: Built-in backend simulation supports development and testing without physical hardware.
*   **OSM Segment Cache**: Repeated planning of identical route segments is cached on the backend to reduce stalls during queue rebuilds.

## Current Planning Rules

### Task Mode

*   Each click appends a new task point to the queue.
*   Hover OSM preview starts from the last queued task point.
*   Deleting a point rebuilds the remaining route from the current drone position or active execution position as appropriate.

### Realtime Mode

*   A realtime click does not discard the queued task points.
*   The newest realtime point is inserted at the front of the queue and becomes the new `Task 1`.
*   Existing task-mode points keep their relative order behind the inserted realtime point.

### Refresh Behavior

*   After refreshing the browser, the start-point focus action uses the current drone position.
*   Active execution state is restored from mission history when available.

## Quick Start (Dev Mode)

### Backend

1.  Navigate to the project root.
2.  Activate the virtual environment:
    ```bash
    venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Start the API server:

    ```powershell
    venv\Scripts\python -m uvicorn app.main:app --reload --port 8090
    ```
    *API will be available at `http://127.0.0.1:8090`*

### Frontend

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    *Access the UI at `http://localhost:5173`*

### Run Tests

Backend integration tests:
```powershell
venv\Scripts\python -m pytest tests\integration\test_navigation_flow.py tests\integration\test_path_planner.py -q
```

Frontend tests:
```powershell
cd frontend
npm test
```

Frontend production build:
```powershell
cd frontend
npm run build
```

### Version Control

To force push changes to the main branch:
```bash
git push -u -f origin main
```

## Deployment (Docker)

The entire system is containerized for easy deployment.

1.  Ensure Docker and Docker Compose are installed.
2.  Run the following command in the root directory:
    ```bash
    docker-compose up --build
    ```
3.  The application will be available at `http://localhost` (port 80).

## Architecture

DroneControlCore follows a **Clean Architecture** principle to ensure scalability and maintainability:

*   **Domain Layer**: Defines core entities (`Mission`, `Waypoint`) and business logic, independent of external frameworks.
*   **Infrastructure Layer**: Handles MAVSDK, SQLite, and OSM path planning/caching.
*   **API Layer**: FastAPI routers expose mission, execution, navigation, and telemetry functionality via REST and WebSockets.
*   **Frontend**: A Vue 3 map UI that coordinates telemetry, mission queue editing, replay, task-mode planning, and realtime insertion behavior.
