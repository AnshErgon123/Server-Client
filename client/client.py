import time, os, requests, can, zipfile, io, shutil, math, re, threading
from cryptography.fernet import Fernet
from can import CanError
from can.interfaces.pcan.basic import PCAN_ERROR_ILLHW

BRIDGE_URL = "http://localhost:5000"

bus = None
retry_count = 0
flag = 0
flashing_flag = [False]
ping_active_flag = [False]

class BootloaderData:
    def __init__(self, security_key, bootloader_version, hardware_version,
                 firmware_version, unit_no, appl_entry_addr, last_update, crc, appl_size):
        self.security_key = security_key
        self.bootloader_version = bootloader_version
        self.hardware_version = hardware_version
        self.firmware_version = firmware_version
        self.unit_no = unit_no
        self.appl_entry_addr = appl_entry_addr
        self.last_update = last_update
        self.crc = crc
        self.appl_size = appl_size

boot_data_obj = BootloaderData(0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x00000000, 0x00000000, 0x0000, 0x0000)
FIRMWARE_KEY = b"6y5ESYfQvdi4GJr42G0xyqMiAI4Qj8BYNUd3rfq-S8M="

def init_CAN_bus():
    try:
        print("Connecting to PEAK CAN...")
        bus = can.interface.Bus(interface='pcan', channel='PCAN_USBBUS1', bitrate=500000)
        print("PEAK CAN connected.")
        return bus
    except Exception as e:
        print(f"CAN init failed: {e}")
        return None

def poll_next_command():
    try:
        response = requests.get(f"{BRIDGE_URL}/next-command")
        data = response.json()
        return data.get("command"), data.get("ping_active", False)
    except:
        return None, False

def send_status(status, detail=""):
    try:
        requests.post(f"{BRIDGE_URL}/status", json={"status": status, "detail": detail})
    except:
        pass

def send_heartbeat():
    while flashing_flag[0]:
        send_status("pcan_connected")
        time.sleep(2)

def scan_for_unit_id(bus, timeout=5):
    start = time.time()
    while time.time() - start < timeout:
        try:
            msg = bus.recv(timeout=1)
        except can.CanError as e:
            print(f"⚠️ CAN error during scan: {e}")
            send_status("pcan_failed")
            global flag
            flag = 1
            return None

        if msg and len(msg.data) >= 2 and msg.arbitration_id != 0x8:
            unit_id = (msg.data[0] << 8) | msg.data[1]
            print(f"Unit ID: {unit_id}")
            try:
                requests.post(f"{BRIDGE_URL}/unit-id", json={"unit_id": unit_id})
                return unit_id
            except:
                return None
    return None

def fetch_security_key(unit_id):
    try:
        return requests.get(f"{BRIDGE_URL}/security-key/{unit_id}").json().get("key", [])
    except:
        return None

def receive_message(bus, receive_id, timeout=1):
    start = time.time()
    while time.time() - start < timeout:
        msg = bus.recv(timeout)
        if msg and msg.arbitration_id == receive_id:
            return True, msg
    return False, None

def decode_metadata(msg):
    enum_map = {
        0x01: "Security_key", 0x02: "Bootloader_version", 0x03: "Hardware_version",
        0x04: "Firmware_version", 0x05: "Unit_number", 0x06: "Application_entry_addr",
        0x07: "Last_Update", 0x08: "CRC_value", 0x09: "Application_Size", 0x0A: "Calculated_CRC"
    }
    tag = msg.data[7]
    value = int.from_bytes(msg.data[0:4] if tag in [0x06, 0x07] else msg.data[0:2], 'little')
    return {"tag": tag, "tag_name": enum_map.get(tag, f"Unknown_{tag:02X}"), "value": value, "raw_bytes": msg.data.hex()}

def send_metadata(unit_id, metadata):
    try:
        requests.post(f"{BRIDGE_URL}/unit-metadata", json={"unit_id": unit_id, "metadata": metadata})
    except:
        pass

def send_security_key(bus, key_bytes, unit_id):
    for attempt in range(1, 4):
        try:
            msg = can.Message(arbitration_id=0x14444444, data=bytes(key_bytes), is_extended_id=False)
            bus.send(msg)
        except:
            return False

        received, ack_msg = receive_message(bus, 0x12222222, timeout=2)
        if received:
            if ack_msg.data[0] == 0x08:
                print("Key accepted. Receiving metadata...")
                metadata = []
                start = time.time()
                while time.time() - start < 2:
                    received, msg = receive_message(bus, 0x1B000000, timeout=0.5)
                    if received:
                        decoded = decode_metadata(msg)
                        print(f"{decoded['tag_name']}: {decoded['value']}")
                        metadata.append(decoded)
                send_metadata(unit_id, metadata)
                return True
            elif ack_msg.data[0] == 0x07:
                print("NACK received. Retrying...")
        else:
            print("No response from unit.")
        time.sleep(1)
    return False

def handle_firmware_download(unit_id):
    firmware_url = f"{BRIDGE_URL}/firmware/{unit_id}"
    local_path = f"./temp_firmware/received_{unit_id}.ergon"
    try:
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        r = requests.get(firmware_url)
        if r.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(r.content)
            print("✅ Firmware downloaded.")
            decrypt_firmware_package(local_path, FIRMWARE_KEY, output_folder="./decrypted")
            return True
        else:
            print("❌ Download failed.")
            return False
    except Exception as e:
        print(f"Error: {e}")

def decrypt_firmware_package(ergon_path, key, output_folder):
    if os.path.exists(output_folder):
        shutil.rmtree(output_folder)
    os.makedirs(output_folder, exist_ok=True)
    with open(ergon_path, 'rb') as f:
        encrypted_data = f.read()
    fernet = Fernet(key)
    decrypted_zip_data = fernet.decrypt(encrypted_data)
    with zipfile.ZipFile(io.BytesIO(decrypted_zip_data)) as zipf:
        zipf.extractall(output_folder)
    print(f"✅ Extracted to {output_folder}")
    print("📂 Decrypted contents:", os.listdir(output_folder))
    requests.post(f"{BRIDGE_URL}/soft-reset")

def calc_CRC(data):
    block_size = (data[22] + (data[23] << 8)) * 2
    data_size, sum_data, block_pad, ctr = 0, 0, 0, 22
    data_entry_pt, size = 6, 2
    while ctr < len(data):
        if block_size == 0:
            break
        data_start_cnt = ctr + data_entry_pt
        data_end_cnt = data_start_cnt + block_size
        for cnt in range(data_start_cnt, data_end_cnt, size):
            sum_data += data[cnt] + (data[cnt + 1] << 8)
        if ((int(block_size / 2) % 8) != 0):
            block_pad += (8 - int(block_size / 2) % 8) * 2
        data_size += block_size
        block_size = (data[data_end_cnt] + (data[data_end_cnt + 1] << 8)) * 2
        ctr = data_end_cnt
    sum_data += (int(block_pad / 2) * 0xFFFF)
    data_size += block_pad
    crc, poly = 0xFFFF, 0x8005
    for i in range(4):
        crc ^= ((sum_data >> (8 * (3 - i))) & 0xFF) << 8
        for _ in range(8):
            crc = (crc << 1) ^ poly if crc & 0x8000 else crc << 1
    return crc, int(data_size / 2)

def send_bytes(bus, data, size, delay_t, total, crc, data_size):
    global flag
    total_frames = 0
    i = 0
    while i < len(data):
        try:
            if bus.status() == PCAN_ERROR_ILLHW:
                print("\n❌ PCAN disconnected during flashing!")
                send_status("pcan_failed")
                flashing_flag[0] = False
                requests.post(f"{BRIDGE_URL}/soft-reset")
                flag = 1
                return
        except Exception as e:
            print(f"Error during status check: {e}")
            send_status("pcan_failed")
            flashing_flag[0] = False
            requests.post(f"{BRIDGE_URL}/soft-reset")
            flag = 1
            return

        chunk = data[i:i + size]
        while len(chunk) < size:
            chunk.append(0)

        msg = can.Message(arbitration_id=0x55555555, data=bytes(chunk), is_extended_id=False)
        try:
            bus.send(msg)
            total_frames += 1
            percentage = round((total_frames / total) * 100, 2)
            print(f"Updating.... : {percentage}%  Frames : {total_frames}", end='\r')
            
            # Send progress update to bridge
            try:
                requests.post(f"{BRIDGE_URL}/flashing-progress", json={
                    "status": "flashing",
                    "percentage": percentage,
                    "frames": total_frames,
                    "total_frames": total
                })
            except:
                pass  # Don't fail if bridge is not available
                
            if percentage == 100.0:
                print("\n✅ Update completed successfully")
                # Send completion status
                try:
                    requests.post(f"{BRIDGE_URL}/flashing-progress", json={
                        "status": "completed",
                        "percentage": 100.0,
                        "frames": total_frames,
                        "total_frames": total
                    })
                except:
                    pass
            time.sleep(delay_t)
        except CanError:
            print("\n❌ CAN send failed — aborting")
            send_status("pcan_failed")
            flashing_flag[0] = False
            requests.post(f"{BRIDGE_URL}/soft-reset")
            flag = 1
            return

        i += size


def clean_hex_data(data):
    return re.sub(r'[^0-9A-Fa-f]', '', data)

def retry_connection():
    global bus, retry_count, ping_active_flag
    print("\nPCAN hardware disconnected!")
    while True:
        print(f"Attempting to reconnect PCAN hardware... (Attempt {retry_count + 1})")
        if bus:
            try:
                bus.shutdown()
            except:
                pass
        bus = init_CAN_bus()
        if bus:
            print("PCAN reconnection successful!")
            send_status("pcan_connected")
            retry_count = 0
            # Restart ping thread with new bus
            threading.Thread(target=ping_thread, args=(bus,), daemon=True).start()
            return True
        else:
            retry_count += 1
            send_status("pcan_failed")
            time.sleep(2)

def check_connection():
    global bus, flag
    while True:
        try:
            if not bus:
                continue
            status = bus.status()
            if status == PCAN_ERROR_ILLHW:
                flag = 1
                print("PCAN disconnection detected...")
                send_status("pcan_failed")
                break
            elif status == 0x4000000:
                pass
            time.sleep(1)
        except Exception as e:
            print(f"Error checking connection: {e}")
            flag = 1
            send_status("pcan_failed")
            break

def send_ping(bus):
    """Send ping message to keep unit in bootloader state"""
    try:
        # Using a different CAN ID for ping messages (0x19999999)
        ping_msg = can.Message(arbitration_id=0x19999999, data=[0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], is_extended_id=True)
        bus.send(ping_msg)
        print("📡 Ping sent to keep unit in bootloader state", end='\r')
    except Exception as e:
        print(f"Error sending ping: {e}")

def ping_thread(bus):
    """Separate thread for sending ping messages continuously"""
    global ping_active_flag
    while True:
        try:
            if ping_active_flag[0] and bus:
                # Check if bus is still valid before sending
                try:
                    bus.status()
                    send_ping(bus)
                except:
                    # Bus is no longer valid, wait for reconnection
                    pass
            time.sleep(0.5)
        except Exception as e:
            print(f"Error in ping thread: {e}")
            time.sleep(1)

def main():
    global bus, flag, flashing_flag, ping_active_flag
    bus = init_CAN_bus()
    if not bus:
        send_status("pcan_failed")
        return
    send_status("pcan_connected")
    unit_id = None
    idle_counter = 0
    threading.Thread(target=check_connection, daemon=True).start()
    threading.Thread(target=ping_thread, args=(bus,), daemon=True).start()
    while True:
        if flag == 1:
            if retry_connection():
                flag = 0
                threading.Thread(target=check_connection, daemon=True).start()
                threading.Thread(target=ping_thread, args=(bus,), daemon=True).start()
                continue
            else:
                continue
        cmd, ping_active = poll_next_command()
        
        # Update ping flag based on bridge status
        ping_active_flag[0] = ping_active
        
        if not cmd:
            idle_counter += 1
            if idle_counter % 30 == 0:
                print("🟡 Idle... waiting for command.")
            time.sleep(1)
            continue
        else:
            idle_counter = 0

        if cmd == "scan_unit":
            unit_id = scan_for_unit_id(bus)
            if not unit_id:
                send_status("unit_not_found")
        elif cmd == "idle":
            # Wait for user to initiate handshake from frontend
            time.sleep(1)
            continue
        elif cmd == "send_security_key" and unit_id:
            key_bytes = fetch_security_key(unit_id)
            if key_bytes:
                success = send_security_key(bus, key_bytes, unit_id)
                if not success:
                    print("❌ Security key handshake failed.")
        elif cmd == "download_firmware" and unit_id:
            status = handle_firmware_download(unit_id)
            if status:
                application_file_path = "decrypted/firmware.hex"
                print("📤 Flashing...")
                with open(application_file_path, "rt") as application_file:
                    application_data_str = application_file.read().replace(" ", "").strip()
                    cleaned_data_str = clean_hex_data(application_data_str)
                if cleaned_data_str.startswith("02") and cleaned_data_str.endswith("03"):
                    cleaned_data_str = cleaned_data_str[2:-2]
                application_data = [int(cleaned_data_str[i:i+2], 16) for i in range(0, len(cleaned_data_str), 2)]
                crc, data_size = calc_CRC(application_data)
                total = math.ceil(len(application_data) / 8)
                flashing_flag[0] = True
                threading.Thread(target=send_heartbeat, daemon=True).start()
                send_bytes(bus, application_data, 8, 0.030, total, crc, data_size)
                flashing_flag[0] = False
                print("✅ Firmware update complete. Cooling down before scanning...")
                time.sleep(3)
        elif cmd == "wait_for_firmware":
            time.sleep(2)
            continue
        elif cmd == "shutdown":
            print("Ignoring shutdown and staying alive...")
            continue
        time.sleep(1)

if __name__ == "__main__":
    main()
