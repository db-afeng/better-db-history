from flask import Flask, send_from_directory
from flask_cors import CORS
import os

# subprocess.run(["bash", "entrypoint.sh"], check=True)
app = Flask(__name__, static_folder="frontend/dist")
# --- CORS Configuration ---
# This will allow requests to any /api/* route from any origin.
# For production, you might want to restrict the origins to your specific frontend URL.
# Example: CORS(app, resources={r"/api/*": {"origins": "https://your-frontend-domain.com"}})
CORS(app, resources={r"/api/*": {"origins": "*"}})
# Load configuration from environment variables

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(debug=False)
