from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from sqlalchemy import func, or_
from app import db
from app.models import Datasheet, Element, Step, UOM, Tasks, Item, UserParameterValue, BElement
from app.routes.results.unit_conversion import get_si_unit


import logging
logging.basicConfig(level=logging.DEBUG)

datasheet_bp = Blueprint('datasheet_bp', __name__)

# ----------------------------------------------------------------
# Helper Functions
# ----------------------------------------------------------------
def get_current_user():
    if 'user_id' not in session:
        return None
    return session.get('user_id')


def normalize_existing_rows_for_task_step(task_id, step_id):
    existing_rows = (
        db.session.query(
            Datasheet.IDD,
            Datasheet.IDE,
            Datasheet.IDU,
            Datasheet.ValueD,
            Datasheet.CHK,
            Datasheet.ManualAllocation,
            Item.IName.label("Category"),
            BElement.EName.label("FlowName"),
            UOM.Unit.label("UnitText")
        )
        .join(Element, Datasheet.IDE == Element.IDE)
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
        .join(UOM, Datasheet.IDU == UOM.IDU)
        .filter(Datasheet.IDT == task_id, Datasheet.IDS == step_id)
        .all()
    )

    normalized = []
    for r in existing_rows:
        normalized.append({
            "IDD": r.IDD,
            "IDE": r.IDE,
            "IDU1": r.IDU,
            "ValueD1": float(r.ValueD),
            "CHK": int(r.CHK or 0),
            "Category": r.Category,
            "FlowName": r.FlowName,
            "UnitText": r.UnitText,
            "ManualAllocation": float(r.ManualAllocation or 0)
        })

    return normalized


def normalize_incoming_rows(valid_rows):
    normalized = []

    for r in valid_rows:
        info = (
            db.session.query(
                BElement.EName,
                UOM.Unit,
                Datasheet.ManualAllocation
            )
            .join(Element, Element.IDBE == BElement.IDBE)
            .join(UOM, UOM.IDU == r["IDU1"])
            .outerjoin(Datasheet, Datasheet.IDD == r.get("IDD"))
            .filter(Element.IDE == r["IDE"])
            .first()
        )

        flow_name = info.EName if info else f"Flow {r['IDE']}"
        unit_text = info.Unit if info else ""
        manual_allocation = float(info.ManualAllocation or 0) if info else 0.0

        normalized.append({
            **r,
            "FlowName": flow_name,
            "UnitText": unit_text,
            "ManualAllocation": manual_allocation
        })

    return normalized


def get_relevant_outputs(rows):
    return [
        r for r in rows
        if r.get("Category") == "Product"
        or (r.get("Category") == "Co-Products" and int(r.get("CHK", 0)) == 0)
    ]


def outputs_need_manual_allocation(rows):
    """
    Relevant outputs:
      - Product
      - Co-Products with CHK == 0

    Rules:
      - if <= 1 relevant output: no popup
      - if > 1 relevant outputs:
          * same SI property -> no popup
          * different SI properties -> popup
    """
    relevant_rows = get_relevant_outputs(rows)

    if len(relevant_rows) <= 1:
        return False, relevant_rows, "Single output"

    try:
        si_units = [get_si_unit(str(r.get("UnitText", "")).strip()) for r in relevant_rows]
    except Exception:
        return True, relevant_rows, "Unknown unit"

    if all(u == si_units[0] for u in si_units):
        return False, relevant_rows, "Same property"

    return True, relevant_rows, "Different properties"


def build_popup_flows(relevant_rows):
    dedup = {}

    for r in relevant_rows:
        ide_str = str(r["IDE"])
        current_alloc = float(r.get("ManualAllocation", 0) or 0)

        if ide_str not in dedup:
            dedup[ide_str] = {
                "IDE": ide_str,
                "name": r.get("FlowName") or f"Flow {ide_str}",
                "category": r.get("Category"),
                "chk": int(r.get("CHK", 0)),
                "unit": r.get("UnitText", ""),
                "manual_allocation": current_alloc
            }
        else:
            if current_alloc > 0:
                dedup[ide_str]["manual_allocation"] = current_alloc

    return list(dedup.values())


def validate_allocation_payload(allocation):
    allocation_clean = {}

    if not allocation:
        return allocation_clean, None

    total_percentage = 0.0

    for ide_key, alloc_value in allocation.items():
        try:
            alloc_value = float(alloc_value)
        except (TypeError, ValueError):
            return None, f"Invalid allocation value for IDE {ide_key}."

        if alloc_value < 0 or alloc_value > 100:
            return None, f"Allocation for IDE {ide_key} must be between 0 and 100."

        allocation_clean[str(ide_key)] = alloc_value / 100.0
        total_percentage += alloc_value

    if total_percentage > 100.0000001:
        return None, "Total allocation percentage cannot exceed 100."

    return allocation_clean, None

def apply_manual_allocation_to_existing_rows(task_id, step_id, allocation_clean):
    """
    Update ManualAllocation for existing relevant rows in DB
    for the same task and step, based on IDE.
    """
    if not allocation_clean:
        return

    existing_rows = (
        Datasheet.query
        .filter(Datasheet.IDT == task_id, Datasheet.IDS == step_id)
        .all()
    )

    for row in existing_rows:
        ide_str = str(row.IDE)
        if ide_str in allocation_clean:
            row.ManualAllocation = allocation_clean[ide_str]

# ----------- Pages HTML -----------
@datasheet_bp.route('/datasheet')
def datasheet():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('datasheet/datasheet.html')


@datasheet_bp.route('/datasheetregister')
def datasheetregister():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('datasheet/datasheetregister.html')


@datasheet_bp.route('/datasheetupdate')
def datasheetupdate():
    # 1. Retrieve the parameters from the URL
    task_id = request.args.get('id', type=int)
    task_name = request.args.get('name')
    
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    
    
    # 2. Use the ID to fetch all data for the Task (e.g., datasheet entries)
    if task_id is None or task_name is None:
        # Handle case where parameters are missing
        return redirect(url_for('datasheet_bp.datasheet')) 
        pass 

    # Example: Query the datasheet entries for this specific task
    # datasheet_entries = Datasheet.query.filter_by(IDT=task_id).all() 
    
    return render_template('datasheet/datasheetupdate.html', 
                           task_id=task_id, 
                           task_name=task_name,
                           # datasheet_entries=datasheet_entries # pass the data to the template
                           )


@datasheet_bp.route('/datasheetview')
def datasheetview():
    # 1. Retrieve the parameters from the URL
    task_id = request.args.get('id', type=int)
    task_name = request.args.get('name')
    
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    
     # 2. Use the ID to fetch all data for the Task (e.g., datasheet entries)
    if task_id is None or task_name is None:
        # Handle case where parameters are missing
        return redirect(url_for('datasheet_bp.datasheet')) 
        pass 
    
    return render_template('datasheet/datasheetview.html', 
                           task_id=task_id, 
                           task_name=task_name,
                           # datasheet_entries=datasheet_entries # pass the data to the template
                           )


# ----------- API: Get Data -----------
@datasheet_bp.route('/get_all_tasks')
def get_all_tasks():
    if 'username' not in session:
        return jsonify({"success": False, "tasks": []})

    username = session['username']
    user_id = session.get('user_id')

    # Base query for tasks without datasheet
    query = db.session.query(Tasks)

    # Apply visibility rules
    if username.lower() != "admin":
        query = query.filter(Tasks.user_id == user_id)

    tasks = query.order_by(Tasks.TName.asc()).all()

    return jsonify({
        "success": True,
        "tasks": [{"IDT": t.IDT, "TName": t.TName} for t in tasks]
    })


@datasheet_bp.route('/get_all_steps')
def get_all_steps():
    steps = Step.query.filter(Step.State == 1).order_by(Step.SName).all()
    return jsonify({
        "success": True,
        "steps": [{"IDS": s.IDS, "SName": s.SName} for s in steps]
    })


@datasheet_bp.route('/get_all_uoms')
def get_all_uoms():
    uoms = UOM.query.order_by(UOM.Unit).all()
    return jsonify({
        "success": True,
        "uoms": [{"IDU": u.IDU, "Unit": u.Unit, "UName": u.UName} for u in uoms]
    })

@datasheet_bp.route('/get_all_uoms_by_element/<string:ide>')
def get_all_uoms_by_element(ide):
    # Check if Datasheet exists for this element
    datasheet = Datasheet.query.filter_by(IDE=ide).first()

    if not datasheet:
        # No datasheet → return all UOMs
        uoms = UOM.query.order_by(UOM.Unit).all()
    else:
        # Datasheet exists → return only linked UOM(s)
        uoms = (
            UOM.query
            .filter(UOM.IDU == datasheet.IDU)
            .order_by(UOM.Unit)
            .all()
        )

    return jsonify({
        "success": True,
        "uoms": [
            {
                "IDU": u.IDU,
                "Unit": u.Unit,
                "UName": u.UName
            }
            for u in uoms
        ]
    })

@datasheet_bp.route('/get_all_uoms_by_flow/<string:idbe>')
def get_all_uoms_by_flow(idbe):
    # Check if Datasheet exists for this element
    #datasheet = Datasheet.query.filter_by(IDE=ide).first()
    datasheet = db.session.query(Element.IDBE,
            BElement.EName,
            Datasheet.IDU
            ).join(Datasheet, Element.IDE == Datasheet.IDE
            ).join(BElement, Element.IDBE == BElement.IDBE
            ).filter(Element.IDBE==idbe).first()

    if not datasheet:
        # No datasheet → return all UOMs
        uoms = UOM.query.order_by(UOM.Unit).all()
    else:
        # Datasheet exists → return only linked UOM(s)
        uoms = (
            UOM.query
            .filter(UOM.IDU == datasheet.IDU)
            .order_by(UOM.Unit)
            .all()
        )

    return jsonify({
        "success": True,
        "uoms": [
            {
                "IDU": u.IDU,
                "Unit": u.Unit,
                "UName": u.UName
            }
            for u in uoms
        ]
    })


@datasheet_bp.route('/get_all_elements')
def get_all_elements():
    if 'username' not in session:
        return jsonify({"success": False, "elements": []})

    username = session['username']
    user_id = session.get('user_id')

    # Base query for tasks without datasheet
    query = db.session.query(Element.IDE,
            BElement.EName
            ).join(BElement, Element.IDBE == BElement.IDBE)

    # Apply visibility rules
    if username.lower() != "admin":
        query = query.filter(Element.user_id == user_id)

    elements = query.order_by(Element.EName.asc()).all()
    
    return jsonify({
        "success": True,
        "elements": [{
            "IDE": e.IDE,
            "EName": e.EName
        } for e in elements]
    })



@datasheet_bp.route('/get_in_datasheet/<int:idtask>/<category_name>/<module_name>')
def get_in_datasheet(idtask, category_name, module_name):
    if 'username' in session:
        user_id = session.get('user_id')
        moduleQuery = module_name
        
        # Logic for module mapping
        if module_name == 'Transportation':
            moduleQuery = 'Forest Operation'
        elif module_name == 'Wood Processing':
            moduleQuery = 'Transportation'
        elif module_name != 'Forest Operation':
            moduleQuery = 'Wood Processing'
        
        # DEBUG LOGS: Check incoming parameters and the mapped moduleQuery
        #logging.debug(f"DEBUG: Fetching data for Task: {idtask}, User: {user_id}")
        #logging.debug(f"DEBUG: Category: {category_name}, Original Module: {module_name}")
        #logging.debug(f"DEBUG: Mapped moduleQuery: {moduleQuery}")

        if category_name == 'Input Materials and Energy':
            result = db.session.query(
                    BElement.EName,
                    Datasheet.IDE,
                    Datasheet.ValueD,
                    Datasheet.IDU,
                    UOM.UName,
                    UOM.Unit,
                    Item.IDI,
                    Item.IName
                ).join(Item, Item.IDI == Element.IDI
                ).join(Datasheet, Element.IDE == Datasheet.IDE
                ).join(Element, BElement.IDBE == Element.IDBE
                ).join(Step, Datasheet.IDS == Step.IDS
                ).join(UOM, Datasheet.IDU == UOM.IDU
                ).filter(
                    Item.IName == 'Product',
                    Step.SName == moduleQuery,
                    Datasheet.IDT == idtask,
                    Datasheet.user_id == user_id
                ).first()
        
            if result:
                logging.debug(f"DEBUG: Database Result Found - EName: {result.EName}, Value: {result.ValueD}")
                return jsonify(
                    success=True,
                    result=[{
                        "IDE": result.IDE,
                        "EName": result.EName,
                        "IDI": result.IDI,
                        "UName" : result.UName,
                        "Unit": result.Unit,
                        "ValueD": result.ValueD,
                        "Category": result.IName 
                    }]
                )
            else:
                logging.warning(f"DEBUG: No record found for Task {idtask} in module {moduleQuery}")
                return jsonify(success=False, message="No data found"), 404

    return jsonify(success=False, message="Unauthorized"), 401



@datasheet_bp.route('/get_elements_by_category_for_datasheet/<category_name>/<int:ischk>')
def get_elements_by_category_for_datasheet(category_name, ischk):
    if 'username' not in session:
        return jsonify(success=False, elements=[]), 401

    user_id = session.get('user_id')
    is_admin = session.get('is_admin', False)

    item = Item.query.filter_by(IName=category_name).first()
    if not item:
        return jsonify(success=False, message="Category not found", elements=[]), 404

    # ------------------------------------------------------------
    # Build element visibility rule once
    # ------------------------------------------------------------
    filters = [Element.IDI == item.IDI]

    if category_name == 'Co-Products':
        filters.append(Element.Global_Val == ischk)

    if not is_admin:
        if category_name == 'Input Materials and Energy':
            # user-owned OR global shared values
            filters.append(
                or_(
                    Element.user_id == user_id,
                    Element.Global_Val.in_([1, 2])
                )
            )
        elif category_name == 'Co-Products':
            # user-owned OR global coproducts matching ischk
            filters.append(
                or_(
                    Element.user_id == user_id,
                    Element.Global_Val == ischk
                )
            )
        else:
            filters.append(Element.user_id == user_id)

    # ------------------------------------------------------------
    # Query elements + optional datasheet/task/step info
    # ------------------------------------------------------------
    rows = (
        db.session.query(
            Element.IDE,
            Element.IDI,
            Element.Global_Val,
            Element.user_id,
            BElement.EName,
            Datasheet.IDD,
            Datasheet.IDT,
            Datasheet.IDS,
            Tasks.TName,
            Step.SName
        )
        .join(BElement, Element.IDBE == BElement.IDBE)
        .outerjoin(Datasheet, Datasheet.IDE == Element.IDE)
        .outerjoin(Tasks, Tasks.IDT == Datasheet.IDT)
        .outerjoin(Step, Step.IDS == Datasheet.IDS)
        .filter(*filters)
        .order_by(BElement.EName.asc(), Datasheet.IDD.asc())
        .all()
    )

    # ------------------------------------------------------------
    # Group repeated rows caused by multiple datasheet matches
    # ------------------------------------------------------------
    elements_map = {}

    for row in rows:
        if row.IDE not in elements_map:
            elements_map[row.IDE] = {
                "IDE": row.IDE,
                "EName": row.EName,
                "IDI": row.IDI,
                "Category": item.IName,
                "datasheets": []
            }

        if row.IDD is not None:
            elements_map[row.IDE]["datasheets"].append({
                "IDD": row.IDD,
                "IDT": row.IDT,
                "IDS": row.IDS,
                "TName": row.TName,
                "SName": row.SName
            })

    elements = []

    for ide, data in elements_map.items():
        entry = {
            "IDE": data["IDE"],
            "EName": data["EName"],
            "IDI": data["IDI"],
            "Category": data["Category"],
            "SName": None,
            "TName": None
        }

        # Only attach Step/Task info for Product / Co-Products
        if data["Category"] in ["Product", "Co-Products"] and data["datasheets"]:
            # Take the FIRST datasheet (or customize if needed)
            entry["SName"] = data["datasheets"][0]["SName"]
            entry["TName"] = data["datasheets"][0]["TName"]

        elements.append(entry)

    return jsonify(
        success=True,
        elements=elements
    )


@datasheet_bp.route('/get_elements_info_by_category/<category_name>')
def get_elements_info_by_category(category_name):
    if 'username' not in session:
        return jsonify({"success": False, "elements": []}), 401

    username = session['username']
    user_id = session.get('user_id')
    name = category_name.lower()

    if name =='Product':
        items = Item.query.filter(Item.IName=='Product').all()
    elif name =='Co-Products':
        items = Item.query.filter(Item.IName=='Co-Products').all()
    else:
        items = Item.query.filter(Item.IName.ilike(f'%{name}%')).all()

    if not items:
        return jsonify({
            "success": False,
            "message": "Category not found",
            "elements": []
        }), 404

    item_ids = [item.IDI for item in items]

    #elements_query = Element.query.filter(Element.IDI.in_(item_ids))
    elements_query = (
        db.session.query(
            Element.IDE,
            BElement.EName,
            Element.IDI,
            Item.IName
        )
        .join(Datasheet, Element.IDE == Datasheet.IDE)
        .join(Item, Element.IDI == Item.IDI)
        .join(BElement, Element.IDBE == BElement.IDBE)
        .filter(Element.IDI.in_(item_ids))
    )

    if username.lower() != "admin":
        elements_query = elements_query.filter(Element.user_id == user_id)

    elements = elements_query.order_by(BElement.EName.asc()).all()

    element_list = [{
        "IDE": e.IDE,
        "EName": e.EName,
        "IDI": e.IDI,
        "IName": e.IName,
        "Category": category_name
    } for e in elements]

    return jsonify({
        "success": True,
        "elements": element_list
    })



@datasheet_bp.route('/get_datasheet_by_task/<int:task_id>', methods=['GET'])
def get_datasheet_by_task(task_id):
    # Authorization check
    username = session.get('username')
    user_id = session.get('user_id')
    if not username:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        # Base query
        query = db.session.query(
            Datasheet.IDD,
            Datasheet.IDT,
            Datasheet.IDE,
            Datasheet.IDS,
            Datasheet.IDU,
            Datasheet.ValueD,
            Datasheet.IDM,
            Datasheet.CHK,
            UOM.UName
        ).outerjoin(
            UOM, Datasheet.IDU == UOM.IDU
        ).filter(
            Datasheet.IDT == task_id
        )

        # Non-admin users only see their own entries
        if username.lower() != "admin":
            query = query.filter(Datasheet.user_id == user_id)

        results = query.all()

        data = [{
            "IDD": r.IDD,
            "IDT": r.IDT,
            "IDE": r.IDE,
            "IDS": r.IDS,
            "IDU1": r.IDU,
            "ValueD1": r.ValueD,
            "IDM": r.IDM,
            "CHK": r.CHK,
            "UName": r.UName
        } for r in results]

        return jsonify({"success": True, "data": data}), 200

    except Exception as e:
        # Prefer logger.exception(...) in production
        print(f"Error fetching datasheet data for task {task_id}: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500



@datasheet_bp.route('/listtasks_with_out_datasheet', methods=['GET'])
def listtasks_with_out_datasheet():
    if 'username' not in session:
        return jsonify({"success": False, "tasks": []})

    username = session['username']
    user_id = session.get('user_id')

    # Base query for tasks without datasheet
    query = db.session.query(Tasks).outerjoin(Datasheet, Tasks.IDT == Datasheet.IDT)\
                .filter(Datasheet.IDT == None)  # Only tasks with no datasheet

    # Apply visibility rules
    if username.lower() != "admin":
        query = query.filter(Tasks.user_id == user_id)

    tasks = query.order_by(Tasks.TName.asc()).all()

    result = [{
        "IDT": task.IDT,
        "TName": task.TName,
        "Region": task.Region,
        "Description": task.Description,
        "EntryDate": task.EntryDate.strftime('%Y-%m-%d %H:%M') if task.EntryDate else ""
    } for task in tasks]

    return jsonify({"success": True, "tasks": result})

# ------------------------------------------
# Route: Delete Datasheet by IDD
# ------------------------------------------
@datasheet_bp.route('/delete_datasheet/<int:task_id>', methods=['DELETE'])
def delete_datasheet(task_id):
    """
    Deletes a Task and its associated Datasheet and UserParameterValue entries 
    by deleting child records first.
    """
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    task = Tasks.query.get(task_id)
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404

    try:
        # 1. Delete associated UserParameterValue entries
        # These reference the Task via IDT
        UserParameterValue.query.filter_by(IDT=task_id).delete()

        # 2. Delete associated Datasheet entries
        # These reference the Task via IDT
        Datasheet.query.filter_by(IDT=task_id).delete()
        
        # 3. Delete the parent Task itself
        db.session.delete(task)
        
        db.session.commit()
        return jsonify({"success": True, "message": "Task and related data deleted successfully"})
    except Exception as e:
        db.session.rollback()
        # Log the error for debugging
        print(f"Error during single task deletion for ID {task_id}: {e}") 
        return jsonify({"success": False, "message": "Error deleting task and data"}), 500
    

@datasheet_bp.route('/delete_datasheets', methods=['DELETE'])
def delete_datasheets():
    """
    Deletes a batch of Tasks and their associated data with manual cascading.
    """
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    # Expecting 'task_ids' from the JavaScript client
    task_ids = request.json.get("task_ids", [])
    if not task_ids:
        return jsonify({"success": False, "message": "No Task IDs provided"}), 400

    results = []
    
    # Process the list of IDs
    int_task_ids = [int(tid) for tid in task_ids if str(tid).isdigit()]

    for task_id in int_task_ids:
        task = Tasks.query.get(task_id)

        if not task:
            results.append({"id": task_id, "status": "not_found"})
            continue

        try:
            # 1. Delete associated UserParameterValue entries
            UserParameterValue.query.filter_by(IDT=task_id).delete()

            # 2. Delete associated Datasheet entries
            Datasheet.query.filter_by(IDT=task_id).delete()
            
            # 3. Delete the parent Task itself
            db.session.delete(task)
            db.session.commit()
            results.append({"id": task_id, "status": "deleted"})
        except Exception as e:
            db.session.rollback()
            print(f"Error deleting Task ID {task_id}: {e}")
            results.append({"id": task_id, "status": "error", "message": str(e)})

    return jsonify({"success": True, "results": results})


# ----------- API: Get step/item by name -----------
@datasheet_bp.route('/get_step_id/<step_name>', methods=['GET'])
def get_step_id(step_name):
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        step = Step.query.filter_by(SName=step_name).first()
        if step:
            return jsonify({"success": True, "ids": step.IDS})
        else:
            return jsonify({"success": False, "message": "Step not found."}), 404
    except Exception as e:
        print(f"Error fetching step ID: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500

@datasheet_bp.route('/get_step_id_by_name/<module_name>', methods=['GET'])
def get_step_id_by_name(module_name):
    step = Step.query.filter(Step.SName.ilike(f"%{module_name}%")).first()
    if step:
        return jsonify({"success": True, "IDS": step.IDS})
    return jsonify({"success": False, "message": "Step not found"}), 404


@datasheet_bp.route('/get_item_id_by_name/<category_name>', methods=['GET'])
def get_item_id_by_name(category_name):
    item = Item.query.filter(Item.IName.ilike(f"%{category_name}%")).first()
    if item:
        return jsonify({"success": True, "IDI": item.IDI})
    return jsonify({"success": False, "message": "Item not found"}), 404


@datasheet_bp.route('/get_uname_by_unit_id/<unit_id>', methods=['GET'])
def get_uname_by_unit_id(unit_id):
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        uom = UOM.query.filter_by(IDU=unit_id).first()
        if uom:
            return jsonify({"success": True, "uName": uom.UName})
        return jsonify({"success": False, "message": "Unit not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ------------ API: Save datasheet -------------
@datasheet_bp.route('/save_datasheetregister', methods=['POST'])
def save_datasheetregister():
    if 'username' not in session:
        return jsonify({"success": False, "message": "User not authenticated."}), 401

    data = request.get_json()

    if not data or 'rows' not in data or 'step_id' not in data or 'task_id' not in data:
        return jsonify({
            "success": False,
            "message": "Invalid data format. Missing rows, step_id, or task_id."
        }), 400

    step_id = data.get('step_id')
    task_id = data.get('task_id')
    form_rows = data.get('rows', [])
    allocation = data.get('allocation', {})

    if not step_id or not task_id:
        return jsonify({
            "success": False,
            "message": "Step or Task not selected."
        }), 400

    try:
        user_id = session.get('user_id')

        # 1. Validate incoming rows
        valid_rows = []

        for row in form_rows:
            ide = row.get('IDE')
            idu1 = row.get('IDU1')
            value_d1 = row.get('ValueD1')
            chk = row.get('CHK', 0)
            idm = row.get('IDM')
            category = row.get('Category')

            if ide is None or idu1 is None or value_d1 is None or not category:
                return jsonify({
                    "success": False,
                    "message": "Invalid data in one or more rows. Missing IDE, IDU1, ValueD1, or Category."
                }), 400

            try:
                value_d1 = float(value_d1)
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "message": f"Invalid quantity for IDE {ide}."
                }), 400

            try:
                chk = int(chk) if chk is not None else 0
            except (TypeError, ValueError):
                chk = 0

            valid_rows.append({
                "IDE": ide,
                "IDU1": idu1,
                "ValueD1": value_d1,
                "CHK": chk,
                "IDM": idm,
                "Category": str(category).strip()
            })

        if not valid_rows:
            return jsonify({
                "success": False,
                "message": "No valid data to save."
            }), 400

        # 2. Combine DB rows + incoming rows for same task/process
        existing_normalized = normalize_existing_rows_for_task_step(task_id, step_id)
        incoming_normalized = normalize_incoming_rows(valid_rows)

        combined_rows = existing_normalized + incoming_normalized

        needs_popup, relevant_rows, reason = outputs_need_manual_allocation(combined_rows)

        # 3. Return popup if needed and allocation not yet provided
        if needs_popup and not allocation:
            return jsonify({
                "success": False,
                "requires_allocation": True,
                "message": (
                    "Manual allocation is required because multiple outputs with "
                    "different unit properties exist for this task and process."
                ),
                "reason": reason,
                "flows": build_popup_flows(relevant_rows)
            }), 200

        # 4. Validate allocation if provided
        allocation_clean, allocation_error = validate_allocation_payload(allocation)
        if allocation_error:
            return jsonify({
                "success": False,
                "message": allocation_error
            }), 400
        
        # 5. Save only incoming rows
        # Update already-existing rows in DB
        apply_manual_allocation_to_existing_rows(task_id, step_id, allocation_clean)

        # Save only incoming rows
        new_entries = []

        for row in valid_rows:
            ide = row["IDE"]
            idu1 = row["IDU1"]
            value_d1 = row["ValueD1"]
            chk = row["CHK"]
            idm = row["IDM"]

            manual_alloc = 0.0
            if str(ide) in allocation_clean:
                manual_alloc = allocation_clean[str(ide)]

            new_entry = Datasheet(
                IDE=ide,
                IDS=step_id,
                IDT=task_id,
                IDU=idu1,
                ValueD=value_d1,
                IDM=idm,
                CHK=chk,
                user_id=user_id,
                ManualAllocation=manual_alloc
            )
            new_entries.append(new_entry)

        db.session.add_all(new_entries)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"{len(new_entries)} rows saved successfully."
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving datasheet register: {e}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500
            
# ----------- API: Update datasheet -----------

@datasheet_bp.route('/save_datasheet', methods=['POST'])
def save_datasheet():
    if 'username' not in session:
        return jsonify({"success": False, "message": "User not authenticated."}), 401

    data = request.get_json()

    if not data or 'rows' not in data or 'step_id' not in data or 'task_id' not in data:
        return jsonify({
            "success": False,
            "message": "Invalid data format. Missing rows, step_id, or task_id."
        }), 400

    task_id = data.get('task_id')
    step_id = data.get('step_id')
    form_rows = data.get('rows', [])
    allocation = data.get('allocation', {})

    if not task_id or not step_id:
        return jsonify({
            "success": False,
            "message": "Task or Step not selected."
        }), 400

    try:
        user_id = session.get('user_id')

        # ---------------------------------------------------------
        # 1. Validate incoming rows
        # ---------------------------------------------------------
        valid_rows = []

        for row in form_rows:
            ide = row.get('IDE')
            idu1 = row.get('IDU1')
            value_d1 = row.get('ValueD1')
            idd = row.get('IDD')
            chk = row.get('CHK', 0)
            category = row.get('Category')
            idm = row.get('IDM')

            if ide is None or idu1 is None or value_d1 is None or not category:
                return jsonify({
                    "success": False,
                    "message": "Invalid data in one or more rows. Missing IDE, IDU1, ValueD1, or Category."
                }), 400

            try:
                value_d1 = float(value_d1)
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "message": f"Invalid quantity for IDE {ide}."
                }), 400

            try:
                chk = int(chk) if chk is not None else 0
            except (TypeError, ValueError):
                chk = 0

            valid_rows.append({
                "IDD": idd,
                "IDE": ide,
                "IDU1": idu1,
                "ValueD1": value_d1,
                "CHK": chk,
                "Category": str(category).strip(),
                "IDM": idm
            })

        if not valid_rows:
            return jsonify({
                "success": False,
                "message": "No valid rows to save."
            }), 400

        # ---------------------------------------------------------
        # 2. Build combined rows for allocation check
        # Exclude DB rows being updated now, then add incoming versions
        # ---------------------------------------------------------
        incoming_idds = {str(r["IDD"]) for r in valid_rows if r.get("IDD")}
        existing_normalized_all = normalize_existing_rows_for_task_step(task_id, step_id)

        existing_normalized = [
            r for r in existing_normalized_all
            if str(r.get("IDD")) not in incoming_idds
        ]

        incoming_normalized = normalize_incoming_rows(valid_rows)
        combined_rows = existing_normalized + incoming_normalized

        needs_popup, relevant_rows, reason = outputs_need_manual_allocation(combined_rows)

        # ---------------------------------------------------------
        # 3. If popup needed and no allocation yet, return popup payload
        # ---------------------------------------------------------
        if needs_popup and not allocation:
            return jsonify({
                "success": False,
                "requires_allocation": True,
                "message": (
                    "Manual allocation is required because multiple outputs with "
                    "different unit properties exist for this task and process."
                ),
                "reason": reason,
                "flows": build_popup_flows(relevant_rows)
            }), 200

        # ---------------------------------------------------------
        # 4. Validate allocation payload
        # ---------------------------------------------------------
        allocation_clean, allocation_error = validate_allocation_payload(allocation)
        if allocation_error:
            return jsonify({
                "success": False,
                "message": allocation_error
            }), 400

        # ---------------------------------------------------------
        # 5. If allocation provided, update ALL relevant existing rows
        # for the same task + step + IDE
        # ---------------------------------------------------------
        if allocation_clean:
            for r in relevant_rows:
                ide_str = str(r["IDE"])

                if ide_str not in allocation_clean:
                    continue

                matching_rows = Datasheet.query.filter_by(
                    IDT=task_id,
                    IDS=step_id,
                    IDE=r["IDE"]
                ).all()

                for db_row in matching_rows:
                    db_row.ManualAllocation = allocation_clean[ide_str]

        # ---------------------------------------------------------
        # 6. Update existing rows / insert new rows
        # IMPORTANT:
        # - preserve existing ManualAllocation if no new allocation was sent
        # - only overwrite ManualAllocation when IDE exists in allocation_clean
        # ---------------------------------------------------------
        rows_status = []

        for row in valid_rows:
            idd = row.get("IDD")
            ide = row["IDE"]
            idu1 = row["IDU1"]
            value_d1 = row["ValueD1"]
            chk = row["CHK"]
            idm = row["IDM"]

            if idd:
                entry = Datasheet.query.filter_by(IDD=idd).first()

                if not entry:
                    rows_status.append("error")
                    continue

                entry.IDE = ide
                entry.IDU = idu1
                entry.ValueD = value_d1
                entry.CHK = chk
                entry.IDM = idm
                entry.IDT = task_id
                entry.IDS = step_id
                entry.user_id = user_id

                # Only overwrite if user supplied new allocation for this IDE
                if str(ide) in allocation_clean:
                    entry.ManualAllocation = allocation_clean[str(ide)]

                rows_status.append("success")

            else:
                manual_alloc = 0.0
                if str(ide) in allocation_clean:
                    manual_alloc = allocation_clean[str(ide)]

                new_entry = Datasheet(
                    IDE=ide,
                    IDU=idu1,
                    ValueD=value_d1,
                    CHK=chk,
                    IDM=idm,
                    IDT=task_id,
                    IDS=step_id,
                    user_id=user_id,
                    ManualAllocation=manual_alloc
                )
                db.session.add(new_entry)
                rows_status.append("success")

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Datasheet updated successfully.",
            "rowsStatus": rows_status
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving datasheet update: {e}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500
    
    
@datasheet_bp.route('/delete_datasheet_row/<int:idd>', methods=['DELETE'])
def delete_datasheet_row(idd):
    if 'username' not in session:
        return jsonify({"success": False, "message": "User not authenticated."}), 401

    try:
        # Find the datasheet by IDD
        datasheet = Datasheet.query.get(idd)
        if datasheet:
            db.session.delete(datasheet)
            db.session.commit()
            return jsonify({"success": True, "message": "Row deleted successfully."}), 200
        else:
            return jsonify({"success": False, "message": "Row not found."}), 404
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting datasheet with IDD {idd}: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500


@datasheet_bp.route('/searchtasks_with_datasheet', methods=['GET'])
def search_tasks_with_datasheet():
    user_id = get_current_user()
    if not user_id:
        return jsonify({
            "tasks": [], "page": 1, "per_page": 10,
            "total_count": 0, "has_prev": False, "has_next": False
        })

    query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = 10
    username = session.get('username', '')

    # 1. Start with a query on Tasks joined with Datasheet
    # This ensures only tasks with datasheets are returned
    base_query = db.session.query(Tasks).join(Datasheet, Tasks.IDT == Datasheet.IDT)

    # 2. Apply User/Admin filters
    if username.lower() != "admin":
        base_query = base_query.filter(Tasks.user_id == user_id)

    # 3. Apply Search Filters
    if query:
        like_query = f"%{query}%"
        base_query = base_query.filter(
            db.or_(
                Tasks.TName.ilike(like_query),
                Tasks.Region.ilike(like_query),
                Tasks.Description.ilike(like_query),
                db.cast(Tasks.IDT, db.String).ilike(like_query),
                db.cast(Tasks.EntryDate, db.String).ilike(like_query),
            )
        )

    # 4. Make it DISTINCT and Sort
    # We use distinct(Tasks.IDT) if your DB supports it, or just .distinct()
    base_query = base_query.distinct().order_by(Tasks.EntryDate.desc())

    # 5. Pagination Logic
    total_count = base_query.count()
    offset = (page - 1) * per_page
    tasks = base_query.offset(offset).limit(per_page).all()

    result = [{
        "IDT": t.IDT,
        "TName": t.TName,
        "Region": t.Region,
        "Description": t.Description,
        "EntryDate": t.EntryDate.strftime('%Y-%m-%d %H:%M') if t.EntryDate else ""
    } for t in tasks]

    return jsonify({
        "tasks": result,
        "page": page,
        "per_page": per_page,
        "total_count": total_count,
        "has_prev": page > 1,
        "has_next": offset + per_page < total_count
    })

@datasheet_bp.route('/listtasks_with_datasheet', methods=['GET'])
def listtasks_with_datasheet():
    """
    Fetch a full list of tasks. 
    Admin sees all tasks; regular users see only theirs.
    """
    # 1. Check if user is authenticated
    user_id = session.get('user_id')
    username = session.get('username')

    if not user_id:
        return jsonify({
            "success": False, 
            "message": "User session not found. Please log in.",
            "tasks": []
        }), 401

    try:
        # 2. Define logic based on user role (Admin vs Regular User)
        query = (
            db.session.query(
                Tasks.IDT,
                Tasks.TName,
                Tasks.Region,
                Tasks.Description,
                Tasks.EntryDate
            )
            .join(Datasheet, Datasheet.IDT == Tasks.IDT)
            .distinct()
        )

        # Admin sees all, others only their own records
        if username.lower() != "admin":
            query = query.filter(Tasks.user_id == user_id)

        # 3. Serialize data into JSON format
        result = [{
            "IDT": task.IDT,
            "TName": task.TName,
            "Region": task.Region,
            "Description": task.Description,
            "EntryDate": task.EntryDate.strftime('%Y-%m-%d %H:%M') if task.EntryDate else ""
        } for task in query]

        return jsonify({
            "success": True, 
            "count": len(result),
            "tasks": result
        }), 200

    except Exception as e:
        # Log error if something goes wrong with the database
        return jsonify({
            "success": False, 
            "message": f"An error occurred while fetching tasks: {str(e)}"
        }), 500