from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from sqlalchemy import or_, cast, String
from app import db
from app.models import UnitConversion, UnitAlias

auoc_bp = Blueprint('auoc_bp', __name__)

# ------------------------------------------
# Route: Display Aliases for a Unit
# ------------------------------------------
@auoc_bp.route('/auoc')
def auoc():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    id = request.args.get("id", type=int)
    uoc = db.session.get(UnitConversion, id)
    if not uoc:
        return render_template('auoc/auoc.html', auocs=[], uoc=None)

    auoc_list = (
        UnitAlias.query
        .filter_by(canonical_unit=uoc.unit_name)
        .order_by(UnitAlias.alias_name.desc())
        .limit(20)
        .all()
    )

    return render_template('auoc/auoc.html', auocs=auoc_list, uoc=uoc)

# ------------------------------------------
# Route: Registration Page + Submission
# ------------------------------------------
@auoc_bp.route('/registerauoc', methods=['GET', 'POST'])
def registerauoc():
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
                alias_name = str(item.get("UAlias", "")).strip()
                canonical_unit = str(item.get("CanonicalUnit", "")).strip()
                state_raw = item.get("State", 1)

                if not alias_name or not canonical_unit:
                    print(f"Skipping Unit Alias registration for missing data: {item}")
                    continue

                canonical = UnitConversion.query.filter_by(unit_name=canonical_unit).first()
                if not canonical:
                    print(f"Skipping Unit Alias registration for invalid canonical unit: {item}")
                    continue

                try:
                    is_active = bool(int(state_raw))
                except (ValueError, TypeError):
                    is_active = True

                new_auoc = UnitAlias(
                    id=added_count,
                    alias_name=alias_name,
                    canonical_unit=canonical_unit,
                    is_active=is_active
                )

                db.session.add(new_auoc)
                added_count += 1

            if added_count == 0:
                return jsonify({"success": False, "message": "No valid Unit Aliases to insert."}), 400

            db.session.commit()
            return jsonify({"success": True, "message": f"{added_count} Unit Alias(es) registered successfully."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    return render_template('auoc/auocregister.html')

# ------------------------------------------
# Route: Unit Alias Update Page + Submission
# ------------------------------------------
@auoc_bp.route('/updateauoc', methods=['GET', 'POST'])
def updateauoc():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid data."}), 400

        try:
            auoc_id = int(data.get("IDU"))
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid Unit Alias ID."}), 400

        alias_name = str(data.get("UAlias", "")).strip()
        canonical_unit = str(data.get("CanonicalUnit", "")).strip()

        try:
            is_active = bool(int(data.get("State", 1)))
        except (ValueError, TypeError):
            is_active = True

        try:
            auoc_to_update = db.session.get(UnitAlias, auoc_id)
            if not auoc_to_update:
                return jsonify({"success": False, "message": "Unit Alias not found."}), 404

            if not alias_name:
                return jsonify({"success": False, "message": "Alias Name cannot be empty."}), 400

            if not canonical_unit:
                return jsonify({"success": False, "message": "Canonical Unit cannot be empty."}), 400

            canonical = UnitConversion.query.filter_by(unit_name=canonical_unit).first()
            if not canonical:
                return jsonify({"success": False, "message": "Canonical Unit does not exist."}), 400

            auoc_to_update.alias_name = alias_name
            auoc_to_update.canonical_unit = canonical_unit
            auoc_to_update.is_active = is_active

            db.session.commit()
            return jsonify({"success": True, "message": "Unit Alias updated successfully."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    auoc_id_param = request.args.get("idu", type=int)
    idd = request.args.get("id2", type=int)
    auoc_data = db.session.get(UnitAlias, auoc_id_param) if auoc_id_param else None
    return render_template("auoc/auocupdate.html", auoc=auoc_data, idd=idd)

# ------------------------------------------
# Route: Search Unit Aliases
# ------------------------------------------
@auoc_bp.route('/searchauocs', methods=['GET'])
def search_auocs():
    if 'username' not in session:
        return jsonify([])

    query = request.args.get('q', '').strip().lower()
    uoc_id = request.args.get("id", type=int)

    # If id is required, return JSON, not render_template
    if not uoc_id:
        return jsonify([])

    uoc = db.session.get(UnitConversion, uoc_id)
    if not uoc:
        return jsonify([])

    auoc_list = UnitAlias.query.filter_by(canonical_unit=uoc.unit_name)

    if not query:
        auocs = (
            auoc_list
            .order_by(UnitAlias.alias_name.desc())
            .limit(20)
            .all()
        )
    else:
        like_query = f"%{query}%"

        state_filter = None
        if "active".startswith(query):
            state_filter = UnitAlias.is_active.is_(True)
        elif "inactive".startswith(query):
            state_filter = UnitAlias.is_active.is_(False)

        filters = [
            UnitAlias.alias_name.ilike(like_query),
            UnitAlias.canonical_unit.ilike(like_query),
        ]

        if state_filter is not None:
            filters.append(state_filter)

        auocs = (
            auoc_list
            .filter(or_(*filters))
            .order_by(UnitAlias.alias_name.desc())
            .limit(20)
            .all()
        )

    result = [{
        "IDU": auoc.id,
        "UAlias": auoc.alias_name,
        "CanonicalUnit": auoc.canonical_unit,
        "State": "Active" if auoc.is_active else "Inactive"
    } for auoc in auocs]

    return jsonify(result)
# ------------------------------------------
# Route: Delete Unit Alias by ID
# ------------------------------------------
@auoc_bp.route('/delete_auoc/<int:auoc_id>', methods=['DELETE'])
def delete_auoc(auoc_id):
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    auoc = db.session.get(UnitAlias, auoc_id)

    if not auoc:
        return jsonify({"success": False, "message": "Unit alias not found"}), 404

    try:
        db.session.delete(auoc)
        db.session.commit()
        return jsonify({"success": True, "message": "Unit alias deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error deleting unit alias: {str(e)}"}), 500

@auoc_bp.route('/delete_auocs', methods=['DELETE'])
def delete_auocs():
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    auoc_ids = request.json.get("uoc_ids", [])
    if not auoc_ids:
        return jsonify({"success": False, "message": "No unit alias IDs provided"}), 400

    results = []

    try:
        for auoc_id in auoc_ids:
            try:
                auoc_id = int(auoc_id)
            except (ValueError, TypeError):
                results.append({"id": str(auoc_id), "status": "invalid_id"})
                continue

            auoc = db.session.get(UnitAlias, auoc_id)

            if not auoc:
                results.append({"id": auoc_id, "status": "not_found"})
                continue

            db.session.delete(auoc)
            results.append({"id": auoc_id, "status": "deleted"})

        db.session.commit()

    except Exception:
        db.session.rollback()
        results = [{"id": str(uid), "status": "error"} for uid in auoc_ids]

    return jsonify({"success": True, "results": results})

# ------------------------------------------
# Route: List Units for dropdown/select
# ------------------------------------------
@auoc_bp.route('/list_uocs/<int:is_active>', methods=['GET'])
def list_uoc(is_active):
    if 'username' not in session:
        return jsonify([])

    if is_active == 2:
        uocs = UnitConversion.query.order_by(UnitConversion.unit_name).all()
    else:
        active_flag = bool(is_active)
        uocs = UnitConversion.query.filter_by(is_active=active_flag).order_by(UnitConversion.unit_name).all()

    result = [{
        "IDU": uoc.id,
        "Unit": uoc.unit_name
    } for uoc in uocs]

    return jsonify(result)