const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 5000;

const FIRMWARE_DIR = path.join(__dirname, "firmwares");

app.use(express.json());
app.use(cors());

let bridgeState = {
  command: "idle",
  unit_id: null,
  metadata: null,
  status: null,
  firmware_file: null,
  pcan_connected: false,
  frontend_firmware_selected: false,
  flashing_progress: null,
  ping_active: false
};

const VALID_UNIT_IDS = {
  4387: "My Unit 1",
  65535: "My Unit 2",
  1024: "My Unit 3",
  2: "My Unit 4",
  1: "My Unit 5"
};

const COMMON_SECURITY_KEY = [255, 255, 0, 0, 0, 0, 0, 0];

// Client polls this endpoint to get the next command
app.get("/next-command", (req, res) => {
  console.log(`📡 Client polling for command. Current command: ${bridgeState.command}`);
  res.json({ 
    command: bridgeState.command,
    ping_active: bridgeState.ping_active
  });
});

// Trigger full handshake sequence from frontend
app.post("/api/initiate-handshake", (req, res) => {
  if (bridgeState.command === "idle" || bridgeState.command === "scan_unit") {
    // Clear metadata when starting a new handshake
    bridgeState.metadata = null;
    bridgeState.unit_id = null;
    bridgeState.command = "scan_unit";
    bridgeState.ping_active = true; // Start ping messages
    console.log("🟢 Handshake initiated by frontend.");
    console.log("📡 Ping messages activated to keep unit in bootloader state.");
    res.json({ success: true, message: "Handshake started." });
  } else {
    res.json({ success: false, message: "Handshake already in progress." });
  }
});

// Receives unit ID from client and validates it
app.post("/unit-id", (req, res) => {
  const { unit_id } = req.body;
  if (!unit_id) return res.status(400).json({ error: "Missing unit_id" });

  if (!(unit_id in VALID_UNIT_IDS)) {
    console.log(`Invalid Unit ID: ${unit_id}`);
    bridgeState.command = "shutdown";
    return res.status(403).json({ valid: false });
  }

  console.log(`Valid Unit Detected: ${unit_id} (${VALID_UNIT_IDS[unit_id]})`);
  bridgeState.unit_id = unit_id;
  bridgeState.command = "send_security_key";
  res.json({ valid: true, unit_name: VALID_UNIT_IDS[unit_id] });
});

// Sends security key to client for the given unit
app.get("/security-key/:unit_id", (req, res) => {
  const unitId = parseInt(req.params.unit_id, 10);
  if (!(unitId in VALID_UNIT_IDS)) return res.status(403).json({ error: "Invalid unit ID" });

  console.log(`Sending shared security key for Unit ID ${unitId}`);
  res.json({ key: COMMON_SECURITY_KEY });
});

// Receives metadata from client and lets user select firmware file
app.post("/unit-metadata", async (req, res) => {
  const { unit_id, metadata } = req.body;
  if (!unit_id || !metadata) return res.status(400).json({ error: "Missing unit_id or metadata" });

  console.log(`📩 Metadata received for Unit ID ${unit_id} (${VALID_UNIT_IDS[unit_id]})`);
  console.dir(metadata, { depth: null });

  bridgeState.metadata = metadata;

  if (bridgeState.frontend_firmware_selected && bridgeState.firmware_file) {
    console.log(`✅ Firmware already selected via frontend: ${bridgeState.firmware_file}`);
    bridgeState.command = "download_firmware";
    return res.json({ received: true, firmware_selected: bridgeState.firmware_file });
  }

  // NEW: prevent client from re-sending key again
  bridgeState.command = "wait_for_firmware";
  console.log("🛑 Waiting for firmware to be selected via frontend...");
  res.json({ received: true, waiting_for_frontend: true });
});


// Sends the firmware file to the client
app.get("/firmware/:unit_id", (req, res) => {
  const { unit_id } = req.params;
  const fname = bridgeState.firmware_file;
  if (!fname) return res.status(404).json({ error: "No firmware selected." });

  const fullPath = path.join(FIRMWARE_DIR, fname);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File not found." });

  console.log(`📤 Sending firmware ${fname} to Unit ID ${unit_id}`);
  
  // Clear firmware selection after sending
  const currentFirmware = bridgeState.firmware_file;
  bridgeState.firmware_file = null;
  bridgeState.frontend_firmware_selected = false;
  console.log(`🧹 Firmware selection cleared after sending: ${currentFirmware}`);
  
  res.sendFile(fullPath);
});

// Endpoint for client to report its status
app.post("/status", (req, res) => {
  const { status, detail } = req.body;
  console.log(`Client Status: ${status} ${detail || ""}`);
  bridgeState.status = status;
  
  // Update PCAN connection status
  if (status === "pcan_connected") {
    bridgeState.pcan_connected = true;
  } else if (status === "pcan_failed") {
    bridgeState.pcan_connected = false;
  }
  
  res.send({ ok: true });
});

// Endpoint for client to report flashing progress
app.post("/flashing-progress", (req, res) => {
  const { status, percentage, frames, total_frames } = req.body;
  bridgeState.flashing_progress = { status, percentage, frames, total_frames };
  console.log(`📊 Flashing Progress: ${status} - ${percentage}% (${frames}/${total_frames} frames)`);
  res.send({ ok: true });
});

// Frontend endpoints
app.get("/api/pcan-status", (req, res) => {
  res.json({ connected: bridgeState.pcan_connected });
});

app.get("/api/metadata", (req, res) => {
  res.json({ metadata: bridgeState.metadata });
});

app.get("/api/bridge-status", (req, res) => {
  res.json({ 
    command: bridgeState.command,
    unit_id: bridgeState.unit_id,
    firmware_file: bridgeState.firmware_file,
    pcan_connected: bridgeState.pcan_connected,
    frontend_firmware_selected: bridgeState.frontend_firmware_selected,
    metadata: bridgeState.metadata ? true : false,
    waiting_for_frontend: bridgeState.metadata && !bridgeState.firmware_file,
    ping_active: bridgeState.ping_active
  });
});

app.get("/api/flashing-progress", (req, res) => {
  res.json({ progress: bridgeState.flashing_progress });
});

app.get("/api/firmwares", (req, res) => {
  try {
    const files = fs.readdirSync(FIRMWARE_DIR).filter(fname => /^firmware_package.*\.ergon$/.test(fname));
    res.json({ firmwares: files });
  } catch (error) {
    res.status(500).json({ error: "Failed to read firmware directory" });
  }
});

app.post("/api/update-firmware", (req, res) => {
  const { firmware_file } = req.body;
  if (!firmware_file) {
    return res.status(400).json({ error: "Missing firmware_file" });
  }
  
  const fullPath = path.join(FIRMWARE_DIR, firmware_file);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Firmware file not found" });
  }
  
  bridgeState.firmware_file = firmware_file;
  bridgeState.frontend_firmware_selected = true;
  bridgeState.command = "download_firmware";
  bridgeState.flashing_progress = null;
  console.log(`✅ Firmware selected via frontend: ${firmware_file}`);
  console.log(`🔄 Bridge command set to: ${bridgeState.command}`);
  console.log(`📋 Waiting for client to poll /next-command...`);
  res.json({ success: true, message: "Firmware update initiated" });
});

// Resets the bridge state
app.post("/reset", (req, res) => {
  bridgeState = { 
    command: "idle", 
    unit_id: null, 
    metadata: null, 
    status: null, 
    firmware_file: null, 
    pcan_connected: false, 
    frontend_firmware_selected: false, 
    flashing_progress: null,
    ping_active: false
  };
  console.log("Bridge state reset.");
  res.json({ reset: true });
});

// Soft reset that preserves metadata and unit info
app.post("/soft-reset", (req, res) => {
  const preservedMetadata = bridgeState.metadata;
  const preservedUnitId = bridgeState.unit_id;
  const preservedPcanStatus = bridgeState.pcan_connected;
  const preservedPingStatus = bridgeState.ping_active;
  
  bridgeState = { 
    command: "idle", 
    unit_id: preservedUnitId, 
    metadata: preservedMetadata, 
    status: null, 
    firmware_file: null, 
    pcan_connected: preservedPcanStatus, 
    frontend_firmware_selected: false, 
    flashing_progress: null,
    ping_active: preservedPingStatus
  };
  console.log("Bridge soft reset - metadata and unit info preserved.");
  res.json({ reset: true, preserved: true });
});

// Clear firmware selection (useful after firmware update)
app.post("/api/clear-firmware", (req, res) => {
  bridgeState.firmware_file = null;
  bridgeState.frontend_firmware_selected = false;
  console.log("Firmware selection cleared.");
  res.json({ cleared: true });
});

// Clear metadata (useful for starting fresh)
app.post("/api/clear-metadata", (req, res) => {
  bridgeState.metadata = null;
  bridgeState.unit_id = null;
  console.log("Metadata cleared.");
  res.json({ cleared: true });
});

// Control ping messages
app.post("/api/ping-control", (req, res) => {
  const { active } = req.body;
  bridgeState.ping_active = active;
  console.log(`📡 Ping messages ${active ? 'activated' : 'deactivated'}.`);
  res.json({ success: true, ping_active: bridgeState.ping_active });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Bridge server running at http://localhost:${PORT}`);
});
