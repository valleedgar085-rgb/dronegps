import { DroneTelemetryPoint, FlightSummary } from '../types/droneTelemetry';

export function parseRukoLog(fileContent: string, fileName: string): {
  points: DroneTelemetryPoint[];
  summary: FlightSummary;
} {
  const lines = fileContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('Invalid flight log: File must contain headers and data rows.');
  }

  // Find header row and clean column names
  const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));

  const findCol = (...aliases: string[]) => 
    headers.findIndex(h => aliases.some(alias => h === alias || h.includes(alias)));

  const latIdx = findCol('lat', 'latitude', 'gps_lat');
  const lonIdx = findCol('lon', 'lng', 'longitude', 'gps_lon');
  const altIdx = findCol('height', 'altitude', 'alt_rel', 'relative_alt', 'rel_height');
  const mslIdx = findCol('gps_height', 'alt_msl', 'msl');
  const pitchIdx = findCol('pitch', 'drone_pitch', 'pitch_angle');
  const rollIdx = findCol('roll', 'drone_roll', 'roll_angle');
  const yawIdx = findCol('yaw', 'heading', 'direction', 'drone_yaw', 'compass');
  const speedIdx = findCol('speed', 'h_speed', 'groundspeed', 'horizontal_speed');
  const vSpeedIdx = findCol('v_speed', 'climb', 'vertical_speed', 'vspeed');
  const battIdx = findCol('battery', 'batt', 'battery_percent', 'battery_val', 'power');
  const voltIdx = findCol('voltage', 'batt_vol', 'volts');
  const satIdx = findCol('satellites', 'gps_count', 'sats', 'gps_num');
  const distIdx = findCol('distance', 'dist_home', 'distance_from_home', 'home_distance');
  const timeIdx = findCol('time', 'timestamp', 'datetime', 'offset', 'flight_time');

  if (latIdx === -1 || lonIdx === -1) {
    throw new Error('Log parsing failed: Could not find Latitude and Longitude columns.');
  }

  const points: DroneTelemetryPoint[] = [];
  let homeLat = 0;
  let homeLon = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map(c => c.trim());
    if (cols.length <= Math.max(latIdx, lonIdx)) continue;

    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) continue;

    if (homeLat === 0 && homeLon === 0) {
      homeLat = lat;
      homeLon = lon;
    }

    const altAGL = altIdx !== -1 ? Math.max(0, parseFloat(cols[altIdx]) || 0) : 0;
    const pitch = pitchIdx !== -1 ? parseFloat(cols[pitchIdx]) || 0 : 0;
    const roll = rollIdx !== -1 ? parseFloat(cols[rollIdx]) || 0 : 0;
    const yaw = yawIdx !== -1 ? (parseFloat(cols[yawIdx]) + 360) % 360 : 0;
    const speed = speedIdx !== -1 ? Math.abs(parseFloat(cols[speedIdx]) || 0) : 0;
    const vSpeed = vSpeedIdx !== -1 ? parseFloat(cols[vSpeedIdx]) || 0 : 0;
    const battery = battIdx !== -1 ? Math.min(100, Math.max(0, parseFloat(cols[battIdx]) || 100)) : 100;
    const voltage = voltIdx !== -1 ? parseFloat(cols[voltIdx]) || 7.4 : 7.4;
    const sats = satIdx !== -1 ? parseInt(cols[satIdx], 10) || 12 : 14;

    // Calculate distance from home if missing
    let dist = distIdx !== -1 ? parseFloat(cols[distIdx]) || 0 : 0;
    if (dist === 0 && homeLat !== 0) {
      dist = calculateHaversineDistance(homeLat, homeLon, lat, lon);
    }

    const timestamp = timeIdx !== -1 ? parseTimeValue(cols[timeIdx], i) : i * 1000;
    const minutes = Math.floor(i / 60);
    const seconds = i % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    points.push({
      timestamp,
      timeString,
      latitude: lat,
      longitude: lon,
      altitudeAGL: parseFloat(altAGL.toFixed(1)),
      altitudeMSL: mslIdx !== -1 ? parseFloat(cols[mslIdx]) : undefined,
      pitch: parseFloat(pitch.toFixed(1)),
      roll: parseFloat(roll.toFixed(1)),
      yaw: parseFloat(yaw.toFixed(1)),
      speedHorizontal: parseFloat(speed.toFixed(1)),
      speedVertical: parseFloat(vSpeed.toFixed(1)),
      batteryPercent: Math.round(battery),
      batteryVoltage: parseFloat(voltage.toFixed(2)),
      satellites: sats,
      distanceFromHome: parseFloat(dist.toFixed(1)),
    });
  }

  const summary: FlightSummary = {
    fileName,
    totalDurationSeconds: points.length,
    maxAltitude: Math.max(...points.map(p => p.altitudeAGL), 0),
    maxDistance: Math.max(...points.map(p => p.distanceFromHome), 0),
    maxSpeed: Math.max(...points.map(p => p.speedHorizontal), 0),
    startLat: points[0]?.latitude || 0,
    startLon: points[0]?.longitude || 0,
  };

  return { points, summary };
}

function parseTimeValue(val: string, index: number): number {
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) return parsed;
  const num = parseFloat(val);
  return !isNaN(num) ? num : index * 1000;
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
