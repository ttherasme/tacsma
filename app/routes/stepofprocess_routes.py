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

    page = request.args.get('page', 1, type=int)
    per_page = 10

    if page < 1:
        page = 1

    base_query = Step.query.order_by(Step.EntryDate.desc())

    total_count = base_query.count()
    offset = (page - 1) * per_page

    step_list = base_query.offset(offset).limit(per_page).all()

    return render_template(
        'stepofprocess/stepofprocess.html',
        steps=step_list,
        page=page,
        per_page=per_page,
        total_count=total_count,
        has_prev=page > 1,
        has_next=offset + per_page < total_count
    )


# ------------------------------------------
# Route: Search Steps of Process
# ------------------------------------------
@stepofprocess_bp.route('/searchsops', methods=['GET'])
def search_sops():
    if 'username' not in session:
        return jsonify({
            "steps": [],
            "page": 1,
            "per_page": 10,
            "total_count": 0,
            "has_prev": False,
            "has_next": False
        })

    query = request.args.get('q', '').strip().lower()
    page = request.args.get('page', 1, type=int)
    per_page = 10

    if page < 1:
        page = 1

    base_query = Step.query

    if not query:
        base_query = base_query.order_by(Step.EntryDate.desc())
    else:
        like_query = f"%{query}%"

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

        if state_filter is not None:
            filters.append(state_filter)
        else:
            filters.append(db.cast(Step.State, db.String).ilike(like_query))

        base_query = base_query.filter(db.or_(*filters)).order_by(Step.EntryDate.desc())

    total_count = base_query.count()
    offset = (page - 1) * per_page

    steps = base_query.offset(offset).limit(per_page).all()

    result = [{
        "IDS": step.IDS,
        "SName": step.SName,
        "State": "Active" if step.State == 1 else "Inactive",
        "EntryDate": step.EntryDate.strftime('%Y-%m-%d %H:%M') if step.EntryDate else ""
    } for step in steps]

    return jsonify({
        "steps": result,
        "page": page,
        "per_page": per_page,
        "total_count": total_count,
        "has_prev": page > 1,
        "has_next": offset + per_page < total_count
    })

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
# Route: Delete Steps of Process
# ------------------------------------------
@stepofprocess_bp.route('/delete_step/<string:step_id>', methods=['DELETE'])
def delete_step(step_id):
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    step = Step.query.get(step_id)

    if not step:
        return jsonify({"success": False, "message": "Process not found"}), 404

    try:
        db.session.delete(step)
        db.session.commit()
        return jsonify({"success": True, "message": "Process deleted successfully"})
    
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "message": "Error deleting the process"}), 500
    

@stepofprocess_bp.route('/delete_steps', methods=['DELETE'])
def delete_steps():
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    step_ids = request.json.get("step_ids", [])
    if not step_ids:
        return jsonify({"success": False, "message": "No process IDs provided"}), 400

    results = []

    try:
        for step_id in step_ids:
            step_id = str(step_id)  # ensure string
            step= Step.query.get(step_id)

            if not step:
                results.append({"id": step_id, "status": "not_found"})
                continue

            db.session.delete(step)
            results.append({"id": step_id, "status": "deleted"})

        db.session.commit()

    except Exception:
        db.session.rollback()
        # mark all as error for consistency
        results = [{"id": str(uid), "status": "error"} for uid in step_ids]

    return jsonify({"success": True, "results": results})

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
