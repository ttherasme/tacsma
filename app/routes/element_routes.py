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

    page = request.args.get('page', 1, type=int)
    per_page = 10

    if page < 1:
        page = 1

    # Build the query FIRST
    query = (
        db.session.query(
            Element.IDE,
            Element.IDBE,
            BElement.EName,
            Item.IName,
            Element.user_id,
            Element.EntryDate
        )
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
        .filter(Element.Initial_Val == 1)
    )

    # Admin sees all, others only their own records
    if username.lower() != "admin":
        query = query.filter(Element.user_id == user_id)

    total_count = query.count()
    offset = (page - 1) * per_page

    # Apply ordering, offset & limit, THEN execute
    element_list = (
        query
        .order_by(BElement.EName.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    has_prev = page > 1
    has_next = offset + per_page < total_count

    return render_template(
        'element/element.html',
        elements=element_list,
        page=page,
        per_page=per_page,
        total_count=total_count,
        has_prev=has_prev,
        has_next=has_next
    )


# ------------------------------------------
# Route: Search element
# ------------------------------------------
@element_bp.route('/search_elements', methods=['GET'])
def search_elements():
    if 'username' not in session:
        return jsonify({
            "elements": [],
            "page": 1,
            "per_page": 10,
            "total_count": 0,
            "has_prev": False,
            "has_next": False
        })

    username = session['username']
    user_id = session.get('user_id')
    query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = 10

    if page < 1:
        page = 1

    like_query = f"%{query}%"

    # Build base query (DO NOT call .all yet)
    base_query = (
        db.session.query(
            Element.IDE,
            Element.IDBE,
            BElement.EName,
            Item.IName,
            Element.user_id,
            Element.EntryDate
        )
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
        .filter(Element.Initial_Val == 1)
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
                db.cast(Element.IDBE, db.String).ilike(like_query),
                db.cast(Element.EntryDate, db.String).ilike(like_query),
            )
        ).order_by(Element.EntryDate.desc())
    else:
        base_query = base_query.order_by(BElement.EName.desc())

    total_count = base_query.count()
    offset = (page - 1) * per_page

    # Execute paginated query
    elements = base_query.offset(offset).limit(per_page).all()

    # Build JSON response
    result = [
        {
            "IDE": e.IDE,
            "IDBE": e.IDBE,
            "EName": e.EName,
            "IName": e.IName,
            "EntryDate": e.EntryDate.strftime('%Y-%m-%d %H:%M') if e.EntryDate else ""
        }
        for e in elements
    ]

    return jsonify({
        "elements": result,
        "page": page,
        "per_page": per_page,
        "total_count": total_count,
        "has_prev": page > 1,
        "has_next": offset + per_page < total_count
    })


@element_bp.route('/registerelement_global', methods=['GET', 'POST'])
def registerelement_global():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    user_id = session.get("user_id")

    # GET → load page
    if request.method == "GET":
        items = (
            Item.query
            .filter(~Item.IName.in_(['Results']))
            .order_by(Item.IName)
            .all()
        )
        return render_template(
            "element/registerelement_global.html",
            items=items
        )

    # POST → register elements
    data = request.get_json()

    if not data or "elements" not in data:
        return jsonify({"success": False, "message": "Invalid data"}), 400

    elements = data["elements"]

    try:
        inserted = 0
        elementadded = 0

        for el in elements:

            name = el.get("EName", "").strip()
            iname = el.get("IName","").strip()

            if not name:
                continue

            # -----------------------------
            # SPECIAL CASE
            # -----------------------------

            target_items = [iname]
            if iname.lower() in ['product', 'co-products']:

                target_items = [
                    'Product',
                    'Co-Products',
                    'Input Materials and Energy',
                    'Wood Processing'
                ]

            items = Item.query.filter(Item.IName.in_(target_items)).all()
            added_count =0
            # -----------------------------
            # BElement
            # -----------------------------
            existing_belement = BElement.query.filter_by(
                EName=name,
                user_id=user_id
            ).first()

            if not existing_belement:
                new_belement = BElement(
                    IDBE=inserted,
                    EName=name,
                    user_id=user_id
                )

                db.session.add(new_belement)

                existing_ibelement = BElement.query.filter_by(
                    EName=name,
                    user_id=user_id
                ).first()
                
                for item in items:
                    new_element = Element(
                        IDE=added_count,
                        IDBE=existing_ibelement.IDBE, 
                        IDI=item.IDI,
                        Initial_Val = 1 if iname == item.IName else 0, 
                        user_id=user_id
                    )
                    db.session.add(new_element)
                    added_count += 1
               
            else:
                for item in items:
                    existing_element = Element.query.filter_by(
                        IDBE = existing_belement.IDBE,
                        IDI = item.IDI,
                        user_id =user_id
                    ).first()
                    
                    if not existing_element:
                        new_element = Element(
                            IDE=added_count,
                            IDBE=existing_belement.IDBE, 
                            IDI=item.IDI,
                            Initial_Val = 1 if iname == item.IName else 0, 
                            user_id=user_id
                        )
                        db.session.add(new_element)
                        
                        added_count += 1

            elementadded = added_count
            inserted += 1

        if inserted == 0:
            return jsonify({
                "success": False,
                "message": f"No new elements inserted. And {elementadded} new record(s) created."
            })

        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"{inserted} element(s) registered."
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": str(e)
        })


@element_bp.route('/updateelement')
def updateelement():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    element_id = request.args.get("id")

    element = (
        db.session.query(
            Element.IDE,
            BElement.EName,
            Item.IName
        )
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
        .filter(Element.IDE == element_id)
        .first()
    )

    if not element:
        return "Element not found", 404

    return render_template(
        "element/updateelement.html",
        element=element
    )

@element_bp.route('/update_element_post', methods=['POST'])
def update_element_post():
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    data = request.get_json()

    element_id = data.get("IDE")
    new_name = data.get("EName", "").strip()

    if not element_id or not new_name:
        return jsonify({"success": False, "message": "Invalid data"}), 400

    try:
        element = Element.query.filter_by(IDE=element_id).first()

        if not element:
            return jsonify({"success": False, "message": "Element not found"}), 404

        # get related BElement
        belement = BElement.query.filter_by(IDBE=element.IDBE).first()

        if not belement:
            return jsonify({"success": False, "message": "BElement not found"}), 404

        belement.EName = new_name

        db.session.commit()

        return jsonify({"success": True})

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)})


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

    elementname = data['elementname'].strip() 
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
                        Initial_Val = 1 if elementname == item.IName else 0, 
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
                            Initial_Val = 1 if elementname == item.IName else 0, 
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
        .filter(Item.IName.in_(['Product', 'Co-Products']))
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


@element_bp.route('/delete_elements', methods=['DELETE'])
def delete_elements():
    if 'username' not in session:
        return jsonify({"success": False}), 401

    data = request.get_json()
    ids = data.get("element_ids", [])

    if not ids:
        return jsonify({"success": False, "message": "No elements selected."})

    try:
        belements = (
            db.session.query(BElement)
            .join(Element, Element.IDBE == BElement.IDBE)
            .filter(Element.IDE.in_(ids))
            .distinct()
            .all()
        )

        for belement in belements:
            db.session.delete(belement)

        db.session.commit()

        return jsonify({"success": True})

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)})
    
    
@element_bp.route('/delete_element/<int:id>', methods=['DELETE'])
def delete_element(id):
    if 'username' not in session:
        return jsonify({"success": False}), 401

    belement = (
        db.session.query(BElement)
        .join(Element, Element.IDBE == BElement.IDBE)
        .filter(Element.IDE == id)
        .first()
    )

    if not belement:
        return jsonify({"success": False, "message": "Element not found."})

    try:
        db.session.delete(belement)
        db.session.commit()

        return jsonify({"success": True})

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)})
