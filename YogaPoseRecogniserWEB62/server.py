import http.server
import socketserver
import os
import sys
import webbrowser
import threading
import subprocess
import time

PORT = 81
httpd = None

def free_port(port):
    for attempt in range(3):
        try:
            result = subprocess.check_output(
                f"netstat -aon | findstr :{port}", shell=True, text=True
            )
            lines = result.strip().split("\n")
            for line in lines:
                if line and "LISTENING" in line:
                    pid = line.split()[-1]
                    print(f"Port {port} is in use by PID {pid}. Terminating it...")
                    subprocess.run(f"taskkill /PID {pid} /F", shell=True, check=True)
                    print(f"Process {pid} terminated.")
                    time.sleep(3)  # Increased delay to ensure port is released
                    return
        except subprocess.CalledProcessError:
            print(f"No process found using port {port} on attempt {attempt + 1}")
            # Check if port is still in use (e.g., TIME_WAIT)
            time.sleep(1)
            continue
        except Exception as e:
            print(f"Error checking port {port}: {e}")
            time.sleep(1)
    # Final check before giving up
    try:
        with socketserver.TCPServer(("", port), None) as temp_server:
            print(f"Port {port} is free and usable.")
        return
    except OSError:
        print(f"Failed to free port {port} after 3 attempts. It may still be in use.")
        sys.exit(1)

if getattr(sys, 'frozen', False):
    basedir = sys._MEIPASS
else:
    basedir = os.path.dirname(__file__)

web_dir = os.path.join(basedir, 'web')
try:
    os.chdir(web_dir)
    print(f"Changed working directory to: {os.getcwd()}")
except FileNotFoundError:
    print(f"Error: 'web' directory not found at {web_dir}")
    sys.exit(1)

print(f"Found files in 'web' directory: {os.listdir(web_dir)}")

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/shutdown':
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Server is shutting down...")
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            super().do_GET()

def open_browser():
    try:
        print("Attempting to open browser...")
        webbrowser.open(f"http://localhost:{PORT}")
        print("Browser opened successfully.")
    except Exception as e:
        print(f"Failed to open browser: {e}")

def start_server():
    global httpd
    try:
        httpd = socketserver.TCPServer(("", PORT), CustomHandler)
        print("Welcome to the Yoga Pose Recognition Server")
        print("Your server is running successfully!")
        print(f"Serving on port {PORT} from {web_dir}")
        print("Visit http://localhost:81/ to access the app.")
        print("Visit http://localhost:81/shutdown to stop the server.")
        threading.Thread(target=open_browser, daemon=True).start()
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user (Ctrl+C).")
        httpd.server_close()
        sys.exit(0)
    except OSError as e:
        print(f"Server failed to start: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        if httpd:
            httpd.server_close()
            print("Server closed.")

if __name__ == "__main__":
    free_port(PORT)
    start_server()