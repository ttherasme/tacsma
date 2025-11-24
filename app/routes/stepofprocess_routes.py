from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from datetime import datetime, timezone # Import timezone for UTC handling
from app import db
from app.models import Step # Correct model import

stepofprocess_bp = Blueprint('stepofprocess_bp', __name__)

# Helper function for consistent UTC timestamps
def get_utcnow():
    return datetime.now(timezone.utc)

# ------------------------------------------
# Route: Display Steps of Process
# ------------------------------------------
@stepofprocess_bp.route('/stepofprocess')
def stepofprocess():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    step_list = Step.query.order_by(Step.EntryDate.desc()).limit(20).all()
    return render_template('stepofprocess/stepofprocess.html', steps=step_list)

# ------------------------------------------
# Route: Step of Process Registration Page + Submission
# ------------------------------------------
@stepofprocess_bp.route('/registersop', methods=['GET', 'POST'])
def registersop():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data received."}), 400
        # Optional: Add an explicit check if data is not a list
        if not isinstance(data, list):
             return jsonify({"success": False, "message": "Invalid data format. Expected a list."}), 400

        try:
            added_count = 0 # To track how many valid steps were processed
            for item in data:
                s_name = item.get("SName", "").strip() # Use .strip() for consistency

                if not s_name:
                    print(f"Skipping Step registration for item due to missing name: {item}")
                    continue # skip if name is missing/empty

                new_step = Step(
                    IDS='S1',
                    SName=s_name,
                    State=1, # Default to 1 as per your model and client-side logic
                    EntryDate=get_utcnow(),
                    EnterBy=session.get('username')
                )
                db.session.add(new_step)
                added_count += 1

            if added_count == 0:
                # If no valid items were found in the received data
                return jsonify({"success": False, "message": "No valid Steps of Process to insert."}), 400

            db.session.commit()
            return jsonify({"success": True, "message": f"{added_count} Step(s) of Process registered successfully."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    return render_template('stepofprocess/sopregister.html') # Render the form template

# ------------------------------------------
# Route: Step of Process Update Page + Submission
# ------------------------------------------
@stepofprocess_bp.route('/updatesop', methods=['GET', 'POST'])
def updatesop():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid data."}), 400

        sop_id = data.get("IDS")
        s_name = data.get("SName", "").strip() # Strip whitespace
        try:
            state = int(data.get("State", 1))
        except (ValueError, TypeError):
            state = 1 # Fallback to default if conversion fails

        try:
            step_to_update = Step.query.get(sop_id)
            if not step_to_update:
                return jsonify({"success": False, "message": "Step of Process not found."}), 404

            if not s_name: # Added validation for SName
                return jsonify({"success": False, "message": "Step Name cannot be empty."}), 400

            step_to_update.SName = s_name
            step_to_update.State = state
            step_to_update.UpdateDate=get_utcnow()
            step_to_update.UpdateBy = session.get('username')
            db.session.commit()

            return jsonify({"success": True, "message": "Step updated successfully."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    sop_id_param = request.args.get("id")
    step_data = Step.query.get(sop_id_param) if sop_id_param else None
    return render_template("stepofprocess/sopupdate.html", step=step_data)

# ------------------------------------------
# Route: Search Steps of Process
# ------------------------------------------
@stepofprocess_bp.route('/searchsops', methods=['GET'])
def search_sops():
    if 'username' not in session:
        return jsonify([])

    query = request.args.get('q', '').strip().lower()

    if not query:
        steps = Step.query.order_by(Step.EntryDate.desc()).limit(20).all()
    else:
        like_query = f"%{query}%"

        # Detect partial inputs for 'active' and 'inactive'
        state_filter = None
        if "active".startswith(query):
            state_filter = Step.State == 1
        elif "inactive".startswith(query):
            state_filter = Step.State == 0

        filters = [
            Step.SName.ilike(like_query),
            db.cast(Step.IDS, db.String).ilike(like_query),
            db.cast(Step.EntryDate, db.String).ilike(like_query),
        ]

        # Apply custom state filter if partial match found
        if state_filter is not None:
            filters.append(state_filter)
        else:
            filters.append(db.cast(Step.State, db.String).ilike(like_query))

        steps = Step.query.filter(db.or_(*filters)).order_by(Step.EntryDate.desc()).limit(20).all()

    result = [{
        "IDS": step.IDS,
        "SName": step.SName,
        "State": "Active" if step.State == 1 else "Inactive",
        "EntryDate": step.EntryDate.strftime('%Y-%m-%d %H:%M') if step.EntryDate else ""
    } for step in steps]

    return jsonify(result)

# ------------------------------------------
# Route: Get Active Step Names (Excluding Specific Values)
# ------------------------------------------
# stepofprocess_routes.py
@stepofprocess_bp.route('/active_steps', methods=['GET'])
def active_steps():
    if 'username' not in session:
        return jsonify({"success": False, "steps": []})
    excluded_steps = ['Forest Operation', 'Transportation', 'Wood Processing']
    steps = Step.query.filter(Step.State == 1, ~Step.SName.in_(excluded_steps)).all()
    
    result = [{"IDS": step.IDS, "SName": step.SName} for step in steps]
    
    return jsonify({"success": True, "steps": result})
