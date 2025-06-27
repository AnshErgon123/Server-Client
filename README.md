# PeakCAN Monitor

A real-time CAN bus monitoring application with a React frontend that displays connection status, decoded messages, and security events.

## Features

- **Real-time CAN Connection Status**: Visual indicator showing PeakCAN connection state
- **Unit Detection**: Displays detected unit information including Unit ID and name
- **Security Events**: Real-time tracking of security key exchange events
- **Decoded Messages Table**: Tabular display of decoded CAN messages with tag information
- **Raw Messages Table**: Display of all raw CAN messages
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- Python 3.7+
- PCAN hardware and drivers
- Python CAN library: `pip install python-can`

## Installation

1. Clone the repository
2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Install Python dependencies:
   ```bash
   pip install python-can
   ```

## Running the Application

The application consists of three components that need to be run in separate terminals:

### Terminal 1: React Frontend
```bash
npm start
```
This starts the React development server on http://localhost:3000

### Terminal 2: Bridge Server
```bash
npm run bridge
```
This starts the Node.js bridge server that handles communication between the Python client and React frontend

### Terminal 3: Python CAN Client
```bash
python client/client.py
```
This starts the Python client that connects to the PCAN hardware and processes CAN messages

## Application Flow

1. **Python Client** connects to PCAN hardware and scans for known unit IDs
2. **Bridge Server** receives data from Python client via TCP and forwards it to React frontend via WebSocket
3. **React Frontend** displays real-time updates of:
   - Connection status
   - Detected unit information
   - Security key exchange events
   - Decoded CAN messages
   - Raw CAN messages

## Data Display

### Connection Status
- **Green**: Connected to PCAN hardware
- **Red**: Disconnected from PCAN hardware
- **Orange**: Connection in progress

### Decoded Messages
The application decodes messages with arbitration ID `0x1B000000` and displays:
- Timestamp
- Arbitration ID
- DLC (Data Length Code)
- Tag (message type)
- Tag Name (human-readable description)
- Value in hexadecimal and decimal
- Raw data bytes

### Security Events
Tracks the security key exchange process:
- Security key sent
- Security key accepted/rejected
- Timeout events
- Error conditions

## Known Unit IDs

The application recognizes these unit IDs:
- `4387` (0x1123): "My Unit 1"
- `65535`: "My Unit 2"

## Troubleshooting

1. **PCAN Connection Issues**: Ensure PCAN hardware is properly connected and drivers are installed
2. **Port Conflicts**: Make sure ports 3000 and 5001 are available
3. **Python Dependencies**: Verify python-can library is installed correctly
4. **Network Issues**: Check firewall settings if running on different machines

## Development

- Frontend: React with Socket.IO client
- Backend: Node.js with Express and Socket.IO
- CAN Client: Python with python-can library
- Communication: TCP between Python and Node.js, WebSocket between Node.js and React
