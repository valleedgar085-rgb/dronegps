export interface DroneTelemetryPoint {
  timestamp: number;        // Milliseconds timestamp
  timeString: string;       // Formatted mm:ss
  latitude: number;         // Decimal degrees (e.g. 29.7604)
  longitude: number;        // Decimal degrees (e.g. -95.3698)
  altitudeAGL: number;      // Height above takeoff (meters)
  altitudeMSL?: number;     // Absolute sea-level altitude (meters)
  pitch: number;            // Tilt forward/backward (-90° to +90°)
  roll: number;             // Tilt left/right (-180° to +180°)
  yaw: number;              // Heading (0° to 360°)
  speedHorizontal: number;  // Ground speed (m/s)
  speedVertical: number;    // Vertical speed / climb rate (m/s)
  batteryPercent: number;   // 0 - 100%
  batteryVoltage: number;   // Volts (e.g. 7.4V - 8.4V)
  satellites: number;       // GPS count
  distanceFromHome: number; // Distance in meters
}

export interface FlightSummary {
  fileName: string;
  totalDurationSeconds: number;
  maxAltitude: number;
  maxDistance: number;
  maxSpeed: number;
  startLat: number;
  startLon: number;
}
