import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { DroneTelemetryPoint } from '../types/droneTelemetry';

interface Cesium3DViewerProps {
  telemetry: DroneTelemetryPoint[];
  currentIndex: number;
  cameraMode: 'chase' | 'orbit' | 'fpv' | 'topDown';
  showAltitudeCurtain: boolean;
  googleApiKey?: string;
}

export const Cesium3DViewer: React.FC<Cesium3DViewerProps> = ({
  telemetry,
  currentIndex,
  cameraMode,
  showAltitudeCurtain,
  googleApiKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const droneEntityRef = useRef<Cesium.Entity | null>(null);
  const wallEntityRef = useRef<Cesium.Entity | null>(null);

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;

    // Use Cesium default access token or Google 3D Tiles API
    Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrainProvider: undefined,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewerRef.current = viewer;

    // Load Google Photorealistic 3D Tiles
    const load3DTiles = async () => {
      try {
        if (googleApiKey) {
          const tileset = await Cesium.createGooglePhotorealistic3DTileset({ key: googleApiKey });
          viewer.scene.primitives.add(tileset);
        } else {
          // Fallback to Cesium ion Photorealistic 3D Tiles (Asset 2275207)
          const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);
          viewer.scene.primitives.add(tileset);
        }
      } catch (err) {
        console.warn('3D Tiles loader falling back to standard globe imagery:', err);
      }
    };

    load3DTiles();

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, [googleApiKey]);

  // Update Flight Path, 3D Drone Model, and Altitude Curtain
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || telemetry.length === 0) return;

    viewer.entities.removeAll();

    const wallPositions: Cesium.Cartesian3[] = [];
    const minHeights: number[] = [];
    const maxHeights: number[] = [];
    const pathPositions: Cesium.Cartesian3[] = [];

    telemetry.forEach(pt => {
      const pos = Cesium.Cartesian3.fromDegrees(pt.longitude, pt.latitude, pt.altitudeAGL);
      pathPositions.push(pos);
      wallPositions.push(pos);
      minHeights.push(0);
      maxHeights.push(pt.altitudeAGL);
    });

    // 1. Altitude Curtain (Wall Extrusion)
    wallEntityRef.current = viewer.entities.add({
      show: showAltitudeCurtain,
      wall: {
        positions: wallPositions,
        minimumHeights: minHeights,
        material: Cesium.Color.CYAN.withAlpha(0.25),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.8),
      },
    });

    // 2. 3D Flight Trail Path
    viewer.entities.add({
      polyline: {
        positions: pathPositions,
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.YELLOW,
        }),
      },
    });

    // 3. 3D Drone Entity (Uses 3D model or styled marker)
    const initialPos = pathPositions[0];
    droneEntityRef.current = viewer.entities.add({
      position: initialPos,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        initialPos,
        new Cesium.HeadingPitchRoll(0, 0, 0)
      ),
      model: {
        uri: '/models/drone.glb',
        minimumPixelSize: 48,
        maximumScale: 150,
      },
      point: {
        pixelSize: 12,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
    });

    // Zoom camera to flight area
    viewer.camera.flyToBoundingSphere(Cesium.BoundingSphere.fromPoints(pathPositions), {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 250),
    });
  }, [telemetry]);

  // Update Altitude Curtain visibility toggle
  useEffect(() => {
    if (wallEntityRef.current) {
      wallEntityRef.current.show = showAltitudeCurtain;
    }
  }, [showAltitudeCurtain]);

  // Update Drone 3D Position, Attitude, and Camera View on timeline scrub
  useEffect(() => {
    const viewer = viewerRef.current;
    const drone = droneEntityRef.current;
    if (!viewer || !drone || !telemetry[currentIndex]) return;

    const pt = telemetry[currentIndex];
    const position = Cesium.Cartesian3.fromDegrees(pt.longitude, pt.latitude, pt.altitudeAGL);

    // Compute 6-DOF quaternion from Pitch, Roll, Yaw
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(pt.yaw),
      Cesium.Math.toRadians(pt.pitch),
      Cesium.Math.toRadians(pt.roll)
    );
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

    // Update 3D drone transform
    drone.position = new Cesium.ConstantPositionProperty(position);
    drone.orientation = new Cesium.ConstantProperty(orientation);

    // Update Camera Mode
    if (cameraMode === 'chase') {
      viewer.trackedEntity = drone;
    } else if (cameraMode === 'topDown') {
      viewer.trackedEntity = undefined;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(pt.longitude, pt.latitude, pt.altitudeAGL + 300),
        orientation: {
          heading: Cesium.Math.toRadians(pt.yaw),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });
    } else if (cameraMode === 'fpv') {
      viewer.trackedEntity = undefined;
      viewer.camera.setView({
        destination: position,
        orientation: {
          heading: Cesium.Math.toRadians(pt.yaw),
          pitch: Cesium.Math.toRadians(pt.pitch),
          roll: Cesium.Math.toRadians(pt.roll),
        },
      });
    } else {
      // Free Orbit
      viewer.trackedEntity = undefined;
    }
  }, [currentIndex, telemetry, cameraMode]);

  return <div ref={containerRef} className="w-full h-full" />;
};
