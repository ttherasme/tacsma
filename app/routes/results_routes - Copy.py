# app/routes/results/results_routes.py (Corrected)
from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify, current_app
from app import db
import logging

# Import the analysis function
from .results.main import run_analysis, graph_results_single

logging.basicConfig(level=logging.DEBUG)

results_bp = Blueprint('results_bp', __name__)


@results_bp.route('/results')
def results():
    # Check if user is logged in
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('result/results.html')

@results_bp.route('/graph_results', methods=['POST'])
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
        # run_analysis now returns a dictionary: 
        # { "individual_results": [...], "combined_contribution_table": [...] }
        analysis_output = run_analysis(rows) 
    except Exception as e:
        current_app.logger.error(f"Error in run_analysis: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

    # Check for analysis-level error (e.g., if run_analysis failed before the loop)
    # The new return format makes this check slightly different, but checking if results is a list
    # and if the combined table is present is usually sufficient.

    if not isinstance(analysis_output, dict) or 'individual_results' not in analysis_output:
        # Fallback for unexpected return format or early error handling inside run_analysis
        # (though better handled within run_analysis for individual rows)
        return jsonify({"error": "Analysis returned an invalid format or encountered a critical error."}), 500


    # --- The Core Fix ---
    # Return the full dictionary structure so the frontend can display all results.
    return jsonify({
        "individual_results": analysis_output['individual_results'],
        "combined_contribution_table": analysis_output['combined_contribution_table']
    })

# --- Route: Generate Single Task Graph ---
@results_bp.route('/graph_results_single', methods=['POST'])
def graph_results_single_route():
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 403

    payload = request.get_json()
    logging.debug("Payload : %s", payload)
    task_name = payload.get('task_name', 'Task')
    task_id = payload.get('task_id', '0')
    process_contribution = payload.get('process_contribution', [])
    chart_type = payload.get('chart_type', 'pie')
    theme = payload.get('theme', 'vibrant')

    if not process_contribution:
        return jsonify({"error": "No contribution data provided"}), 400

    try:
        chart_base64 = graph_results_single(chart_type, theme, task_name, task_id) 
        if chart_base64 is None:
            return jsonify({"error": "No data available"}), 400
        return jsonify({"chart_base64": chart_base64})
    except Exception as e:
        current_app.logger.error(f"Error generating single chart: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500