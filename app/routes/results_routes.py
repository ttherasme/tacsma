# app/routes/results/results_routes.py
from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify, current_app
from app import db
import logging

# Import the analysis function
from .results.main import run_analysis

logging.basicConfig(level=logging.DEBUG)

results_bp = Blueprint('results_bp', __name__)


@results_bp.route('/results')
def results():
    # Check if user is logged in
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('result/results.html')

@results_bp.route('/results/graph', methods=['POST'])
def graph_results():
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 403

    payload = request.get_json()
    current_app.logger.debug(f"Received payload: {payload}")

    if not payload:
        return jsonify({"error": "No input data provided"}), 400

    rows = payload.get('rows')
    if not rows:
        return jsonify({"error": "No rows data provided"}), 400

    try:
        results = run_analysis(rows)
    except Exception as e:
        current_app.logger.error(f"Error in run_analysis: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

    if "error" in results:
        return jsonify(results), 500

    return jsonify({
        "total_impact": results['total_impact'],
        "chart_base64": results['chart_base64'],
        "contribution_table": results['contribution_table']
    })
