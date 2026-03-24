import { ref, onMounted, onUnmounted } from 'vue';

export function useTelemetry() {
    const telemetryBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8090';
    const createDefaultDroneState = () => ({
        lat: 30.598,
        lon: 103.991,
        alt: 100.0,
        heading: 0.0,
        pitch: 0.0,
        roll: 0.0,
        yaw: 0.0
    });
    const droneState = ref(createDefaultDroneState());
    const targetDroneState = ref(createDefaultDroneState());

    const isConnected = ref(false);
    let socket = null;
    let reconnectInterval = null;
    let animationFrame = null;

    const normalizeAngleDelta = (target, current) => ((target - current + 540) % 360) - 180;

    const animateTelemetry = () => {
        const current = droneState.value;
        const target = targetDroneState.value;
        const nextHeading = (current.heading + normalizeAngleDelta(target.heading, current.heading) * 0.22 + 360) % 360;
        const nextYaw = (current.yaw + normalizeAngleDelta(target.yaw, current.yaw) * 0.22 + 360) % 360;

        droneState.value = {
            lat: current.lat + (target.lat - current.lat) * 0.22,
            lon: current.lon + (target.lon - current.lon) * 0.22,
            alt: current.alt + (target.alt - current.alt) * 0.22,
            heading: nextHeading,
            pitch: current.pitch + (target.pitch - current.pitch) * 0.22,
            roll: current.roll + (target.roll - current.roll) * 0.22,
            yaw: nextYaw,
        };

        animationFrame = window.requestAnimationFrame(animateTelemetry);
    };

    const connect = () => {
        console.log(`[TELEMETRY] Connecting to ${telemetryBaseUrl}...`);
        const wsUrl = `${telemetryBaseUrl}/ws/telemetry`;

        try {
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("[TELEMETRY] Connected.");
                isConnected.value = true;
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    targetDroneState.value = { ...targetDroneState.value, ...data };
                } catch (e) {
                    console.error("Telemetry parse error", e);
                }
            };

            socket.onclose = () => {
                console.warn("[TELEMETRY] Disconnected. Reconnecting...");
                isConnected.value = false;
                scheduleReconnect();
            };

            socket.onerror = (err) => {
                console.error("[TELEMETRY] Error:", err);
                socket.close();
            };
        } catch (e) {
            console.error("WS Connection Failed", e);
            scheduleReconnect();
        }
    };

    const scheduleReconnect = () => {
        if (!reconnectInterval) {
            reconnectInterval = setTimeout(() => {
                reconnectInterval = null;
                connect();
            }, 2000);
        }
    };

    onMounted(() => {
        animationFrame = window.requestAnimationFrame(animateTelemetry);
        connect();
    });

    onUnmounted(() => {
        if (socket) {
            socket.close();
        }
        if (reconnectInterval) {
            clearTimeout(reconnectInterval);
        }
        if (animationFrame) {
            window.cancelAnimationFrame(animationFrame);
        }
    });

    return {
        droneState,
        isConnected
    };
}
