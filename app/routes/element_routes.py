# element_routes.py

from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from app import db
from app.models import Element, Item

element_bp = Blueprint('element_bp', __name__)


@element_bp.route('/get_elements_by_item/<item_name>', methods=['GET'])
def get_elements_by_item(item_name):
    if 'username' not in session:
        return jsonify([])
    try:
        
        elements = db.session.query(Element).join(Item).filter(
            db.func.lower(Item.IName) == db.func.lower(item_name)
        ).all()
        
        result = [{"IDE": element.IDE, "EName": element.EName} for element in elements]
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching elements for {item_name}: {e}")
        return jsonify({"error": "Failed to load elements."}), 500

# Route: Display the element registration page (inchangée)
@element_bp.route('/registerelement/<elementname>', methods=['GET'])
def registerelement(elementname):
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('element/elementregister.html', elementname=elementname)

# Route: Handle the submission of new elements (inchangée)
@element_bp.route('/register_element_post', methods=['POST'])
def register_element_post():
    if 'username' not in session:
        return jsonify({"success": False, "message": "User not authenticated."}), 401

    data = request.get_json()
    if not data or 'elements' not in data or not isinstance(data['elements'], list) or 'elementname' not in data:
        return jsonify({"success": False, "message": "Invalid data format."}), 400

    elementname = data['elementname'].strip() # Ajout de .strip() pour la robustesse
    elements_to_add = data['elements']
    
    try:
        item = db.session.query(Item).filter(db.func.lower(Item.IName) == db.func.lower(elementname)).first()
        if not item:
            return jsonify({"success": False, "message": f"Item '{elementname}' not found."}), 404

        added_count = 0
        for element_data in elements_to_add:
            e_name = element_data.get("EName", "").strip()
            if not e_name:
                continue

            existing_element = db.session.query(Element).filter(
                Element.EName == e_name,
                Element.IDI == item.IDI
            ).first()
            
            if existing_element:
                continue
            
            new_element = Element(EName=e_name, IDI=item.IDI)
            db.session.add(new_element)
            added_count += 1
            
        if added_count == 0:
            return jsonify({"success": False, "message": "No new valid elements to insert."}), 400

        db.session.commit()
        return jsonify({"success": True, "message": f"{added_count} element(s) registered successfully."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error during element registration: {e}")
        return jsonify({"success": False, "message": str(e)}), 500