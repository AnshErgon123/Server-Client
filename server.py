import socket

HOST = '0.0.0.0'  # Listen on all interfaces
PORT = 5001       

def start_server():
    print(f"Starting server on {HOST}:{PORT}...")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, PORT))
        s.listen()
        print("Waiting for client to connect...")

        conn, addr = s.accept()
        with conn:
            print(f"Connected by {addr}")
            while True:
                try:
                    data = conn.recv(1024).decode()
                    if not data:
                        print("Client disconnected.")
                        break
                    print(f"[CAN STATUS]: {data}")
                except Exception as e:
                    print(f"Error receiving data: {e}")
                    break

if __name__ == "__main__":
    start_server()