import { ref, onMounted, onUnmounted } from 'vue';

export function useTelemetry() {
    const telemetryBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8080';
    const droneState = ref({
        lat: 30.598,
        lon: 103.991,
        alt: 100.0,
        heading: 0.0,
        pitch: 0.0,
        roll: 0.0,
        yaw: 0.0
    });

    const isConnected = ref(false);
    let socket = null;
    let reconnectInterval = null;

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
                    droneState.value = { ...droneState.value, ...data };
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
        connect();
    });

    onUnmounted(() => {
        if (socket) {
            socket.close();
        }
        if (reconnectInterval) {
            clearTimeout(reconnectInterval);
        }
    });

    return {
        droneState,
        isConnected
    };
}
