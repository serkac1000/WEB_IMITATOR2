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
    try:
        with socketserver.TCPServer(("", port), None) as temp_server:
            print(f"Port {port} is free and usable.")
            return True
    except OSError:
        try:
            subprocess.run(f"fuser -k {port}/tcp", shell=True, check=True)
            time.sleep(1)
            print(f"Killed process using port {port}")
            return True
        except:
            print(f"Failed to free port {port}. It may still be in use.")
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
        httpd = socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler)
        print("Welcome to the Yoga Pose Recognition Server")
        print("Your server is running successfully!")
        print(f"Serving on port {PORT} from {web_dir}")
        print("Visit http://0.0.0.0:81/ to access the app.")
        print("Visit http://0.0.0.0:81/shutdown to stop the server.")
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