# Quick Setup Guide

## Prerequisites
- Node.js (v14 or higher)
- Python 3.7+
- PCAN hardware and drivers
- Python CAN library

## Installation Steps

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   pip install python-can
   ```

## Running the Application

Open **three separate terminal windows** and run these commands:

### Terminal 1: React Frontend
```bash
npm start
```
- Opens http://localhost:3000 in your browser
- Shows the real-time CAN monitoring interface

### Terminal 2: Bridge Server
```bash
npm run bridge
```
- Runs the Node.js bridge server on port 5000
- Handles communication between Python client and React frontend

### Terminal 3: Python CAN Client
```bash
python client/client.py
```
- Connects to PCAN hardware
- Processes CAN messages and sends data to bridge server

## What You'll See

1. **Connection Status**: Green dot = connected, Red dot = disconnected
2. **Unit Information**: Detected unit ID and details
3. **Security Events**: Real-time security key exchange status
4. **Decoded Messages**: Table showing decoded CAN data with tags
5. **Raw Messages**: Table showing all raw CAN messages

## Troubleshooting

- **Port conflicts**: Make sure ports 3000 and 5000 are available
- **PCAN issues**: Verify hardware connection and drivers
- **Python errors**: Check python-can installation
- **Network issues**: Ensure firewall allows local connections

## File Structure
```
ergon/
├── src/App.js          # React frontend
├── src/App.css         # Styling
├── bridge.js           # Node.js bridge server
├── client/client.py    # Python CAN client
├── package.json        # Node.js dependencies
└── README.md          # Detailed documentation
``` 