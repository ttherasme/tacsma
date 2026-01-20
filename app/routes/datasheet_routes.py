from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from sqlalchemy import func
from app import db
from app.models import Datasheet, Element, Step, UOM, Tasks, Item, UserParameterValue


import logging
logging.basicConfig(level=logging.DEBUG)

datasheet_bp = Blueprint('datasheet_bp', __name__)


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
            .filter(UOM.IDU == datasheet.IDU1)
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
    query = db.session.query(Element)

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
                    Element.EName,
                    Datasheet.IDE,
                    Datasheet.ValueD,
                    Datasheet.IDU,
                    UOM.UName,
                    UOM.Unit,
                    Item.IDI,
                    Item.IName
                ).join(Item, Item.IDI == Element.IDI
                ).join(Datasheet, Element.IDE == Datasheet.IDE
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

    item = Item.query.filter(Item.IName == category_name).first()
    if not item:
        return jsonify(success=False, message="Category not found", elements=[])

    query = Element.query.filter(Element.IDI == item.IDI)

    if category_name == 'Co-Products':
        query = query.filter(Element.Global_Val == ischk)

    if not is_admin:
        query = query.filter(Element.user_id == user_id)

        if category_name == 'Input Materials and Energy':
        
            global_items = Item.query.filter(
                Item.IName.in_(['Input Materials and Energy'])
            ).all()

            for g_item in global_items:
                query = query.union(
                    Element.query.filter(
                        Element.IDI == g_item.IDI,
                        Element.Global_Val.in_([1, 2])
                    )
                ) 

        if category_name == 'Co-Products':
        
            global_items = Item.query.filter(
                Item.IName.in_(['Co-Products'])
            ).all()

            for g_item in global_items:
                query = query.union(
                    Element.query.filter(
                        Element.IDI == g_item.IDI,
                        Element.Global_Val == ischk
                    )
                ) 

    elements = query.order_by(Element.EName.asc()).all()

    return jsonify(
        success=True,
        elements=[{
            "IDE": e.IDE,
            "EName": e.EName,
            "IDI": e.IDI,
            "Category": e.item.IName
        } for e in elements]
    )


@datasheet_bp.route('/get_elements_info_by_category/<category_name>')
def get_elements_info_by_category(category_name):
    if 'username' not in session:
        return jsonify({"success": False, "elements": []}), 401

    username = session['username']
    user_id = session.get('user_id')
    name = category_name.lower()

    if 'product' in name:
        items = Item.query.filter(Item.IName.ilike('%product%')).all()
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
            Element.EName,
            Element.IDI,
            Item.IName
        )
        .join(Item, Element.IDI == Item.IDI)
        .filter(Element.IDI.in_(item_ids))
    )

    if username.lower() != "admin":
        elements_query = elements_query.filter(Element.user_id == user_id)

    elements = elements_query.order_by(Element.EName.asc()).all()

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
        return jsonify({"success": False, "message": "Invalid data format. Missing rows, step_id, or task_id."}), 400

    step_id = data.get('step_id')
    task_id = data.get('task_id')
    form_rows = data.get('rows')
    
    if not step_id or not task_id:
        return jsonify({"success": False, "message": "Step or Task not selected."}), 400

    try:
        current_user = session['username']
        user_id = session.get('user_id')
        
       # Datasheet.query.filter_by(IDT=task_id, IDS=step_id).delete()
       # db.session.commit()
        
        new_entries = []
        for row in form_rows:
            ide = row.get('IDE')
            idu1 = row.get('IDU1')
            value_d1 = row.get('ValueD1')
            chk = row.get('CHK', 0)  # Default to 0 if not provided
            idm = row.get('IDM')
            
            if ide is not None and idu1 is not None and value_d1 is not None:
                new_datasheet_entry = Datasheet(
                    IDE=ide,
                    IDS=step_id,
                    IDT=task_id,
                    IDU=idu1,
                    ValueD=value_d1,
                    IDM=idm,
                    CHK=chk,
                    user_id=user_id
                )
                new_entries.append(new_datasheet_entry)
            else:
                return jsonify({"success": False, "message": "Invalid data in a row."}), 400
        
        if not new_entries:
            return jsonify({"success": False, "message": "No valid data to save."}), 400
            
        db.session.add_all(new_entries)
        db.session.commit()
        
        return jsonify({"success": True, "message": f"{len(new_entries)} rows saved successfully."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving datasheet: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    
# ----------- API: Update datasheet -----------
@datasheet_bp.route('/save_datasheet', methods=['POST'])
def save_datasheet():
    if 'username' not in session:
        return jsonify({"success": False, "message": "User not authenticated."}), 401

    data = request.get_json()
    step_id = data.get('step_id')
    task_id = data.get('task_id')
    form_rows = data.get('rows')

    if not step_id or not task_id or not form_rows:
        return jsonify({"success": False, "message": "Missing data"}), 400

    try:
        current_user = session['username']
        user_id = session.get('user_id')
        changes = 0
        rows_status = []  

        for row in form_rows:
            idd = row.get('IDD')
            ide = row.get('IDE')
            idu1 = row.get('IDU1')
            value_d1 = row.get('ValueD1')
            idm = row.get('IDM')
            chk = row.get('CHK',None)

            if ide is None or idu1 is None or value_d1 is None:
                rows_status.append("❌")  
                continue

            if idd:  
                existing = Datasheet.query.get(idd)
                if existing:
                    
                    if existing.IDE != ide or existing.IDU1 != idu1 or existing.ValueD1 != value_d1:
                        existing.IDE = ide
                        existing.IDU = idu1
                        existing.ValueD = value_d1
                        existing.UpdateBy = current_user
                        existing.CHK = chk
                        existing.IDM=idm
                        rows_status.append("success")  
                        changes += 1
                    else:
                        rows_status.append("❌")  
                else:
                    rows_status.append("❌") 
            else:  
                new_ds = Datasheet(
                    IDE=ide,
                    IDS=step_id,
                    IDT=task_id,
                    IDU=idu1,
                    ValueD=value_d1,
                    user_id=user_id,
                    CHK=chk,
                    IDM=idm
                )
                db.session.add(new_ds)
                rows_status.append("success") 
                changes += 1

        db.session.commit()
        return jsonify({"success": True, "message": f"{changes} row(s) saved.", "rowsStatus": rows_status}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving datasheet: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

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
