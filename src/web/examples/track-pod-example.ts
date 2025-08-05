// Example of how to use the track-pod functionality
// This demonstrates the integration between SettingsPanel and track-pod.ts

import { trackPod } from "../openlayers/controls/track-pod";

// Example usage:

// 1. Start tracking the pod (first available bot)
trackPod.startTracking("pod");

// 2. Start tracking a specific bot ID
trackPod.startTracking(123);

// 3. Stop tracking
trackPod.stopTracking();

// 4. Check what's currently being tracked
const currentTarget = trackPod.getTrackingTarget();
console.log("Currently tracking:", currentTarget);

// The SettingsPanel component automatically integrates with this:
// - When the toggle is turned ON, it calls trackPod.startTracking("pod")
// - When the toggle is turned OFF, it calls trackPod.stopTracking()
// - The tracking runs at 10Hz (100ms intervals) when active
// - It automatically centers the map on the tracked bot's location
