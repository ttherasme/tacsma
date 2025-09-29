from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from sqlalchemy import distinct # Import the distinct function
from datetime import datetime, timezone # Import timezone for UTC handling
from app import db
from app.models import UOM # Correct model import

uom_bp = Blueprint('uom_bp', __name__)

# Helper function for consistent UTC timestamps
def get_utcnow():
    return datetime.now(timezone.utc)

# ------------------------------------------
# Route: Display Units of Measure
# ------------------------------------------
@uom_bp.route('/uom')
def uom():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    # Fetch the latest 20 Units of Measure (adjust limit as needed)
    uom_list = UOM.query.order_by(UOM.EntryDate.desc()).limit(20).all()
    # Pass data to the template
    return render_template('uom/unitofmeasure.html', uoms=uom_list)

# ------------------------------------------
# Route: Unit of Measure Registration Page + Submission
# ------------------------------------------
@uom_bp.route('/registeruom', methods=['GET', 'POST'])
def registeruom():
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
            added_count = 0 # To track how many valid UOMs were processed
            for item in data:
                u_name = item.get("UName", "").strip() # Use .strip() for consistency
                unit = item.get("Unit", "").strip()     # Use .strip() for consistency

                if not u_name or not unit:
                    # Log or handle invalid items if necessary
                    print(f"Skipping UOM registration for item due to missing name or unit: {item}")
                    continue # skip if name or unit is missing/empty

                new_uom = UOM(
                    IDU='U1',
                    UName=u_name,
                    Unit=unit,
                    State=1, # Default to 1 as per your model and client-side logic
                    EntryDate=get_utcnow(),
                    EnterBy=session.get('username')
                )
                db.session.add(new_uom)
                added_count += 1

            if added_count == 0:
                # If no valid items were found in the received data
                return jsonify({"success": False, "message": "No valid Units of Measure to insert."}), 400

            db.session.commit()
            return jsonify({"success": True, "message": f"{added_count} Unit(s) of Measure registered successfully."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    return render_template('uom/unitofmeasureregister.html') # Render the form template

# ------------------------------------------
# Route: Unit of Measure Update Page + Submission
# ------------------------------------------
@uom_bp.route('/updateuom', methods=['GET', 'POST'])
def updateuom():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid data."}), 400

        uom_id = data.get("IDU")
        u_name = data.get("UName", "").strip() # Strip whitespace
        unit = data.get("Unit", "").strip()     # Strip whitespace
        # Ensure State is an integer. Default to 1 if not provided or invalid.
        try:
            state = int(data.get("State", 1))
        except (ValueError, TypeError):
            state = 1 # Fallback to default if conversion fails

        try:
            uom_to_update = UOM.query.get(uom_id)
            if not uom_to_update:
                return jsonify({"success": False, "message": "Unit of Measure not found."}), 404

            if not u_name:
                return jsonify({"success": False, "message": "Unit Name cannot be empty."}), 400
            if not unit:
                return jsonify({"success": False, "message": "Unit cannot be empty."}), 400

            uom_to_update.UName = u_name
            uom_to_update.Unit = unit
            uom_to_update.State = state
            uom_to_update.UpdateDate = get_utcnow() 
            uom_to_update.UpdateBy = session.get('username') 
            db.session.commit()

            return jsonify({"success": True, "message": "Unit of Measure updated successfully."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    uom_id_param = request.args.get("id")
    uom_data = UOM.query.get(uom_id_param) if uom_id_param else None
    return render_template("uom/uomupdate.html", uom=uom_data)

# ------------------------------------------
# Route: Search Units of Measure
# ------------------------------------------
@uom_bp.route('/searchuoms', methods=['GET'])
def search_uoms():
    if 'username' not in session:
        return jsonify([])

    query = request.args.get('q', '').strip().lower()

    if not query:
        uoms = UOM.query.order_by(UOM.EntryDate.desc()).limit(20).all()
    else:
        like_query = f"%{query}%"

        # Detect partial inputs for 'active' and 'inactive'
        state_filter = None
        if "active".startswith(query):
            state_filter = UOM.State == 1
        elif "inactive".startswith(query):
            state_filter = UOM.State == 0

        filters = [
            UOM.UName.ilike(like_query),
            UOM.Unit.ilike(like_query),
            db.cast(UOM.IDU, db.String).ilike(like_query),
            db.cast(UOM.EntryDate, db.String).ilike(like_query),
        ]

        # Apply custom state filter if partial match found
        if state_filter is not None:
            filters.append(state_filter)
        else:
            filters.append(db.cast(UOM.State, db.String).ilike(like_query))

        uoms = UOM.query.filter(db.or_(*filters)).order_by(UOM.EntryDate.desc()).limit(20).all()

    result = [{
        "IDU": uom.IDU,
        "UName": uom.UName,
        "Unit": uom.Unit,
        "State": "Active" if uom.State == 1 else "Inactive",
        "EntryDate": uom.EntryDate.strftime('%Y-%m-%d %H:%M') if uom.EntryDate else ""
    } for uom in uoms]

    return jsonify(result)

# ------------------------------------------
# Route: list Units of Measure
# ------------------------------------------
@uom_bp.route('/distinct_unames', methods=['GET'])
def distinct_unames():
    if 'username' not in session:
        return jsonify([])

    # It returns a list of tuples, so we extract the first element of each tuple
    unames = [u[0] for u in db.session.query(UOM.UName).distinct().all()]

    result = [{"UName": uname} for uname in unames]
    return jsonify(result)

@uom_bp.route('/units_by_uname/<string:uname>', methods=['GET'])
def units_by_uname(uname):
    if 'username' not in session:
        return jsonify([])

    # Filter UOM table by UName and order by Unit
    units = UOM.query.filter_by(UName=uname).order_by(UOM.Unit).all()

    result = [{
        "IDU": unit.IDU,
        "Unit": unit.Unit
    } for unit in units]

    return jsonify(result)



