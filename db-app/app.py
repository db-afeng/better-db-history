import os

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

from backend.history import get_table_history

app = Flask(__name__, static_folder="frontend/dist")
CORS(app, resources={r"/api/*": {"origins": "*"}})


@app.route("/api/history/<path:table_name>")
def get_history(table_name):
    """Fetch table history from Databricks."""
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
