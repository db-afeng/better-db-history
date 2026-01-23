from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
import os

from backend.history import get_table_history

# subprocess.run(["bash", "entrypoint.sh"], check=True)
app = Flask(__name__, static_folder="frontend/dist")
# --- CORS Configuration ---
# This will allow requests to any /api/* route from any origin.
# For production, you might want to restrict the origins to your specific frontend URL.
# Example: CORS(app, resources={r"/api/*": {"origins": "https://your-frontend-domain.com"}})
CORS(app, resources={r"/api/*": {"origins": "*"}})
# Load configuration from environment variables


@app.route("/api/history/<path:table_name>")
def get_history(table_name):
    """
    Fetch table history from Databricks.
    
    Args:
        table_name: Full table name (e.g., "catalog.schema.table")
        
    Returns:
        JSON array of TableHistoryRecord objects
    """
    try:
        history = get_table_history(table_name)
        return jsonify(history)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to fetch table history: {str(e)}"}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(debug=False)
