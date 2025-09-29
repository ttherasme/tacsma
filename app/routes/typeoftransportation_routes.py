from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from datetime import datetime, timezone # Import timezone for UTC handling
from app import db
from app.models import MTransp

typeoftransportation_bp = Blueprint('typeoftransportation_bp', __name__)

# Helper function for consistent UTC timestamps
def get_utcnow():
    return datetime.now(timezone.utc)

# ------------------------------------------
# Route: Display MTransp
# ------------------------------------------
@typeoftransportation_bp.route('/typeoftransportation')
def typeoftransportation():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    modetransportation_list = MTransp.query.order_by(MTransp.EntryDate.desc()).limit(20).all()
    return render_template('modetransportation/typeoftransportation.html', modetransportions=modetransportation_list)

# ------------------------------------------
# Route: MTransp Registration Page + Submission
# ------------------------------------------
@typeoftransportation_bp.route('/registertot', methods=['GET', 'POST'])
def registertot():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data received."}), 400
        if not isinstance(data, list):
            return jsonify({"success": False, "message": "Invalid data format. Expected a list."}), 400

        try:
            added_count = 0
            for item in data:
                name = item.get("MTName", "").strip() # Ensure name is stripped of whitespace
                # Extract State; default to 1 if not provided or invalid
                try:
                    state = int(item.get("State", 1))
                except (ValueError, TypeError):
                    state = 1 # Fallback to default if conversion fails

                if not name:
                    print(f"Skipping Transportation Mode registration for item due to missing name: {item}")
                    continue

                mtransp = MTransp(
                    IDM='M1',
                    MTName=name,
                    State=state, # Added State field
                    EntryDate=get_utcnow(), # Use helper for UTC
                    EnterBy=session.get('username')
                )
                db.session.add(mtransp)
                added_count += 1

            if added_count == 0:
                return jsonify({"success": False, "message": "No valid Transportation Mode(s) to insert."}), 400

            db.session.commit()
            return jsonify({"success": True, "message": f"{added_count} Transportation Mode(s) registered successfully."}), 200

        except Exception as e:
            db.session.rollback()
            print(f"Error during Transportation Mode registration: {e}") # Log error
            return jsonify({"success": False, "message": str(e)}), 500
    return render_template('modetransportation/totregister.html')


# ------------------------------------------
# Route: MTransp Update Page + Submission
# ------------------------------------------
@typeoftransportation_bp.route('/updatetot', methods=['GET', 'POST'])
def updatetot():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid data."}), 400

        idm = data.get("IDM")
        name = data.get("MTName", "").strip() # Ensure name is stripped
        try:
            state = int(data.get("State", 1)) # Default to 1 if missing or invalid
        except (ValueError, TypeError):
            state = 1 # Fallback

        try:
            mtransp = MTransp.query.get(idm)
            if not mtransp:
                return jsonify({"success": False, "message": "Mode transportation not found."}), 404

            if not name: # Validation for MTName
                return jsonify({"success": False, "message": "Transportation Mode Name cannot be empty."}), 400

            mtransp.MTName = name
            mtransp.State = state
            mtransp.UpdateDate = get_utcnow() # Use helper for UTC
            mtransp.UpdateBy = session.get('username')
            db.session.commit()

            return jsonify({"success": True, "message": "Transportation Mode updated successfully."}), 200
        except Exception as e:
            db.session.rollback()
            print(f"Error during Transportation Mode update: {e}") # Log error
            return jsonify({"success": False, "message": str(e)}), 500

    # Handle GET
    mtransp_id = request.args.get("id")
    mtrans = MTransp.query.get(mtransp_id) if mtransp_id else None
    return render_template("modetransportation/totupdate.html", mtransp=mtrans)


# ------------------------------------------
# Route: Search MTransp
# ------------------------------------------
@typeoftransportation_bp.route('/searchtots', methods=['GET'])
def search_tots():
    if 'username' not in session:
        return jsonify([])

    query = request.args.get('q', '').strip().lower()

    if not query:
        mtransps = MTransp.query.order_by(MTransp.EntryDate.desc()).limit(20).all()
    else:
        like_query = f"%{query}%"

        # Partial matching for 'active' and 'inactive'
        state_filter = None
        if "active".startswith(query):
            state_filter = MTransp.State == 1
        elif "inactive".startswith(query):
            state_filter = MTransp.State == 0

        filters = [
            MTransp.MTName.ilike(like_query),
            db.cast(MTransp.IDM, db.String).ilike(like_query),
            db.cast(MTransp.EntryDate, db.String).ilike(like_query),
        ]

        if state_filter is not None:
            filters.append(state_filter)
        else:
            filters.append(db.cast(MTransp.State, db.String).ilike(like_query))

        mtransps = MTransp.query.filter(db.or_(*filters)).order_by(MTransp.EntryDate.desc()).limit(20).all()

    result = [{
        "IDM": mtransp.IDM,
        "MTName": mtransp.MTName,
        "State": "Active" if mtransp.State == 1 else "Inactive",
        "EntryDate": mtransp.EntryDate.strftime('%Y-%m-%d %H:%M') if mtransp.EntryDate else ""
    } for mtransp in mtransps]

    return jsonify(result)
