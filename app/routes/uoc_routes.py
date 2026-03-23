from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from datetime import datetime, timezone
from sqlalchemy import or_, cast, String
from app import db
from app.models import UnitConversion, UnitAlias

uoc_bp = Blueprint('uoc_bp', __name__)

# Helper function for consistent UTC timestamps
def get_utcnow():
    return datetime.now(timezone.utc)

# ------------------------------------------
# Route: Display Units
# ------------------------------------------
@uoc_bp.route('/uoc')
def uoc():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    uoc_list = UnitConversion.query.order_by(UnitConversion.unit_name.desc()).limit(20).all()
    return render_template('uoc/uoc.html', uocs=uoc_list)

# ------------------------------------------
# Route: Registration Page + Submission
# ------------------------------------------
@uoc_bp.route('/registeruoc', methods=['GET', 'POST'])
def registeruoc():
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
                u_name = str(item.get("UName", "")).strip()
                u_alias = str(item.get("UAlias", "")).strip()
                u_factor_raw = str(item.get("UFactor", "")).strip()
                u_si = str(item.get("USI", "")).strip()
                u_category = str(item.get("UCategory", "")).strip()

                if not u_name or not u_factor_raw or not u_si or not u_category:
                    print(f"Skipping Unit Conversion registration for missing data: {item}")
                    continue

                try:
                    u_factor = float(u_factor_raw)
                except (ValueError, TypeError):
                    print(f"Skipping Unit Conversion registration for invalid factor: {item}")
                    continue

                new_uoc = UnitConversion(
                    id=added_count,
                    unit_name=u_name,
                    factor_to_si=u_factor,
                    si_unit=u_si,
                    category=u_category,
                    is_active=True
                )

                db.session.add(new_uoc)

                if u_alias:
                    new_auoc = UnitAlias(
                        id=added_count,
                        alias_name=u_alias,
                        canonical_unit=u_name,
                        is_active=True
                    )
                    db.session.add(new_auoc)
                    
                added_count += 1

            if added_count == 0:
                return jsonify({"success": False, "message": "No valid Units of Conversion to insert."}), 400

            db.session.commit()
            return jsonify({"success": True, "message": f"{added_count} Unit(s) of Conversion registered successfully."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    return render_template('uoc/uocregister.html')

# ------------------------------------------
# Route: Unit of Conversion Update Page + Submission
# ------------------------------------------
@uoc_bp.route('/updateuoc', methods=['GET', 'POST'])
def updateuoc():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid data."}), 400

        try:
            uoc_id = int(data.get("IDU"))
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid Unit Conversion ID."}), 400

        u_name = str(data.get("UName", "")).strip()
        si_unit = str(data.get("Unit", "")).strip()

        try:
            factor = float(str(data.get("UFactor", "")).strip())
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid factor value."}), 400

        category = str(data.get("UCategory", "")).strip()

        try:
            isactive = bool(int(data.get("State", 1)))
        except (ValueError, TypeError):
            isactive = True

        try:
            uoc_to_update = db.session.get(UnitConversion, uoc_id)
            if not uoc_to_update:
                return jsonify({"success": False, "message": "Unit of Conversion not found."}), 404

            if not u_name:
                return jsonify({"success": False, "message": "Unit Name cannot be empty."}), 400
            if not si_unit:
                return jsonify({"success": False, "message": "SI Unit cannot be empty."}), 400
            if not category:
                return jsonify({"success": False, "message": "Category cannot be empty."}), 400

            uoc_to_update.unit_name = u_name
            uoc_to_update.factor_to_si = factor
            uoc_to_update.si_unit = si_unit
            uoc_to_update.category = category
            uoc_to_update.is_active = isactive

            db.session.commit()
            return jsonify({"success": True, "message": "Unit of Conversion updated successfully."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    uoc_id_param = request.args.get("idu", type=int)
    uoc_data = db.session.get(UnitConversion, uoc_id_param) if uoc_id_param else None
    return render_template("uoc/uocupdate.html", uoc=uoc_data)

# ------------------------------------------
# Route: Search Units of Conversion
# ------------------------------------------
@uoc_bp.route('/searchuocs', methods=['GET'])
def search_uocs():
    if 'username' not in session:
        return jsonify([])

    query = request.args.get('q', '').strip().lower()

    if not query:
        uocs = UnitConversion.query.order_by(UnitConversion.unit_name.desc()).limit(20).all()
    else:
        like_query = f"%{query}%"

        state_filter = None
        if "active".startswith(query):
            state_filter = UnitConversion.is_active.is_(True)
        elif "inactive".startswith(query):
            state_filter = UnitConversion.is_active.is_(False)

        filters = [
            UnitConversion.unit_name.ilike(like_query),
            cast(UnitConversion.factor_to_si, String).ilike(like_query),
            UnitConversion.si_unit.ilike(like_query),
            UnitConversion.category.ilike(like_query),
        ]

        if state_filter is not None:
            filters.append(state_filter)
        else:
            filters.append(cast(UnitConversion.is_active, String).ilike(like_query))

        uocs = UnitConversion.query.filter(
            or_(*filters)
        ).order_by(UnitConversion.unit_name.desc()).limit(20).all()

    result = [{
        "IDU": uoc.id,
        "UName": uoc.unit_name,
        "UFactor": uoc.factor_to_si,
        "Unit": uoc.si_unit,
        "UCategory": uoc.category,
        "State": "Active" if uoc.is_active else "Inactive"
    } for uoc in uocs]

    return jsonify(result)

# ------------------------------------------
# Route: Delete Unit Conversion by ID
# ------------------------------------------
@uoc_bp.route('/delete_uoc/<int:uoc_id>', methods=['DELETE'])
def delete_uoc(uoc_id):
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    uoc = db.session.get(UnitConversion, uoc_id)

    if not uoc:
        return jsonify({"success": False, "message": "Unit of conversion not found"}), 404

    try:
        db.session.delete(uoc)
        db.session.commit()
        return jsonify({"success": True, "message": "Unit of conversion deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error deleting unit of conversion: {str(e)}"}), 500

@uoc_bp.route('/delete_uocs', methods=['DELETE'])
def delete_uocs():
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    uoc_ids = request.json.get("uoc_ids", [])
    if not uoc_ids:
        return jsonify({"success": False, "message": "No unit of conversion IDs provided"}), 400

    results = []

    try:
        for uoc_id in uoc_ids:
            try:
                uoc_id = int(uoc_id)
            except (ValueError, TypeError):
                results.append({"id": str(uoc_id), "status": "invalid_id"})
                continue

            uoc = db.session.get(UnitConversion, uoc_id)

            if not uoc:
                results.append({"id": uoc_id, "status": "not_found"})
                continue

            db.session.delete(uoc)
            results.append({"id": uoc_id, "status": "deleted"})

        db.session.commit()

    except Exception:
        db.session.rollback()
        results = [{"id": str(uid), "status": "error"} for uid in uoc_ids]

    return jsonify({"success": True, "results": results})