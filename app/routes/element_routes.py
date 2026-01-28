# element_routes.py

from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from app import db
from app.models import Element, Item, Datasheet, BElement

element_bp = Blueprint('element_bp', __name__)

# ------------------------------------------
# Route: Display element
# ------------------------------------------
@element_bp.route('/elements')
def elements():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    username = session['username']
    user_id = session.get('user_id')

    # Build the query FIRST (do not call .all yet)
    query = (
        db.session.query(
            Element.IDE,
            BElement.EName,
            Item.IName,
            Element.user_id
        )
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
    )

    # Admin sees all, others only their own records
    if username.lower() != "admin":
        query = query.filter(Element.user_id == user_id)

    # Apply ordering & limit, THEN execute
    element_list = (
        query
        .order_by(BElement.EName.desc())
        .limit(10)
        .all()
    )

    return render_template('element/element.html', elements=element_list)


# ------------------------------------------
# Route: Search element
# ------------------------------------------
@element_bp.route('/search_elements', methods=['GET'])
def search_elements():
    if 'username' not in session:
        return jsonify([])

    username = session['username']
    user_id = session.get('user_id')
    query = request.args.get('q', '').strip()
    like_query = f"%{query}%"

    # Build base query (DO NOT call .all yet)
    base_query = (
        db.session.query(
            Element.IDE,
            BElement.EName,
            Item.IName,
            Element.user_id,
            Element.EntryDate
        )
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
    )

    # Admin sees all, others only their own
    if username.lower() != "admin":
        base_query = base_query.filter(Element.user_id == user_id)

    # Apply search filter
    if query:
        base_query = base_query.filter(
            db.or_(
                BElement.EName.ilike(like_query),
                Item.IName.ilike(like_query),
                db.cast(Element.IDE, db.String).ilike(like_query),
                db.cast(Element.EntryDate, db.String).ilike(like_query),
            )
        ).order_by(Element.EntryDate.desc())
    else:
        base_query = base_query.order_by(BElement.EName.desc())

    # Execute query
    elements = base_query.limit(10).all()

    # Build JSON response
    result = [
        {
            "IDE": e.IDE,
            "EName": e.EName,
            "IName": e.IName,
            "EntryDate": e.EntryDate.strftime('%Y-%m-%d %H:%M') if e.EntryDate else ""
        }
        for e in elements
    ]

    return jsonify(result)


@element_bp.route('/registerelement_global')
def registerelement_global():
    #code will come here
    return


@element_bp.route('/updateelement')
def updateelement():
    #code will come here
    return



@element_bp.route('/get_elements_by_item/<item_name>', methods=['GET'])
def get_elements_by_item(item_name):
    if 'username' not in session:
        return jsonify([])
    try:
        
        elements =( db.session.query(Element.IDE, BElement.EName)
             .join(BElement, Element.IDBE == BElement.IDBE)
            .join(Item, Element.IDI == Item.IDI)
            .filter(
            db.func.lower(Item.IName) == db.func.lower(item_name)
        ).all()
        )
        
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

    current_user = session['username']
    user_id = session.get('user_id')
    
    data = request.get_json()
    if not data or 'elements' not in data or not isinstance(data['elements'], list) or 'elementname' not in data:
        return jsonify({"success": False, "message": "Invalid data format."}), 400

    elementname = data['elementname'].strip() # Ajout de .strip() pour la robustesse
    elements_to_add = data['elements']
    
    try:
        # 1. Define the target items
        target_item_names = [elementname]
        # If it's Product or Co-Products, we want BOTH IDs
        if elementname.lower() in ['product', 'co-products']:
            target_item_names = ['Product', 'Co-Products', 'Input Materials and Energy', 'Wood Processing']

        #item = db.session.query(Item).filter(db.func.lower(Item.IName) == db.func.lower(elementname)).first()
        items = db.session.query(Item).filter(Item.IName.in_(target_item_names)).all()
        if not items:
            return jsonify({"success": False, "message": "Category items not found."}), 404

        added_count = 0
        added_element = 0
        for element_data in elements_to_add:
            e_name = element_data.get("EName", "").strip()
            if not e_name:
                continue

            for item in items:
                # Check if this specific name/IDI combo already exists
                existing_belement = db.session.query(BElement).filter(
                    BElement.EName == e_name,
                    BElement.user_id ==user_id
                ).first()

                if not existing_belement:
                    new_belement = BElement(
                        IDBE=added_count,
                        EName=e_name, 
                        user_id=user_id
                    )
                    db.session.add(new_belement) 

                    existing_ibelement = db.session.query(BElement).filter(
                        BElement.EName == e_name,
                        BElement.user_id ==user_id
                    ).first()
                    
                    new_element = Element(
                        IDE=added_count,
                        IDBE=existing_ibelement.IDBE, 
                        IDI=item.IDI, 
                        user_id=user_id
                    )
                    db.session.add(new_element) 

                    added_count += 1
                else:
                    existing_element = db.session.query(Element).filter(
                        Element.IDBE == existing_belement.IDBE,
                        Element.IDI == item.IDI,
                        Element.user_id ==user_id
                    ).first()
                    
                    if not existing_element:
                        new_element = Element(
                            IDE=added_count,
                            IDBE=existing_belement.IDBE, 
                            IDI=item.IDI, 
                            user_id=user_id
                        )
                        db.session.add(new_element)
                        
                        added_count += 1

            added_element += 1
        if added_count == 0:
            return jsonify({"success": False, "message": "No new valid elements to insert."}), 400

        db.session.commit()
        return jsonify({"success": True, "message": f"{added_element} element(s) registered successfully."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error during element registration: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    
# List Element by task
@element_bp.route('/listFlows/<int:idtask>', methods=['GET'])
def listFlows(idtask):
    if 'username' not in session:
        return jsonify({"success": False, "flows": []})

    flows = (
        db.session.query(
            Element.IDBE,
            BElement.EName,
            Item.IName
        )
        .join(Datasheet, Datasheet.IDE == Element.IDE)
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
        .filter(Datasheet.IDT == idtask)
        .distinct()
        .order_by(BElement.EName)
        .all()
    )

    result = [
        {
            "IDE": idbe,
            "EName": ename,
            "IName": iname
        }
        for idbe, ename, iname in flows
    ]

    return jsonify({"success": True, "flows": result})
