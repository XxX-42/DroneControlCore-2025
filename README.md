# DroneControlCore (2025)

![Python](https://img.shields.io/badge/Python-3.10-blue)
![Vue](https://img.shields.io/badge/Vue.js-3.0-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.95-teal)
![YOLOv8](https://img.shields.io/badge/AI-YOLOv8-purple)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## Introduction

**DroneControlCore** is a next-generation, full-stack drone command and control system designed for autonomous operations. It integrates real-time telemetry visualization, AI-powered reconnaissance using computer vision, and intuitive mission planning into a unified interface. Built with a modern tech stack, it provides a robust foundation for both simulation and hardware deployment.

## Key Features

*   **Real-time Telemetry Visualization**: Live tracking of drone position, heading, and altitude via high-performance WebSocket streams.
*   **AI Reconnaissance**: Integrated **YOLOv8** object detection service to identify targets (people, vehicles, etc.) from aerial imagery in real-time.
*   **Click-to-Strike Navigation**: Advanced **Monoplotting Algorithm** calculates the precise GPS coordinates of detected objects from pixel data, allowing users to instantly plan missions to intercept targets.
*   **Interactive Mission Planner**: Drag-and-drop waypoint planning on a reactive Leaflet map.
*   **Mission History Persistence**: SQLite-backed database stores all mission data for post-operation review and analysis.
*   **Simulation Mode**: Built-in backend simulation for development and testing without physical hardware.

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
    ```bash
   venv\Scripts\python -m uvicorn app.main:app --reload --port 8080
    ```
    *API will be available at `http://127.0.0.1:8080`*

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
*   **Infrastructure Layer**: Handles external interfaces like MAVSDK (Drone Control), SQLite (Database), and YOLOv8 (Computer Vision).
*   **API Layer**: FastAPI routers that expose functionality to the frontend via REST and WebSockets.
*   **Frontend**: A Vue 3 + Pinia application that interacts with the API layer to provide a reactive user experience.
