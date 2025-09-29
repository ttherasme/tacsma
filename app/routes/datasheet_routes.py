from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from app import db
from app.models import Datasheet, Element, Step, UOM, Tasks, Item

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
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('datasheet/datasheetupdate.html')


# ----------- API: Get Data -----------
@datasheet_bp.route('/get_all_tasks')
def get_all_tasks():
    tasks = Tasks.query.order_by(Tasks.TName).all()
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


@datasheet_bp.route('/get_all_elements')
def get_all_elements():
    elements = Element.query.order_by(Element.EName).all()
    return jsonify({
        "success": True,
        "elements": [{
            "IDE": e.IDE,
            "EName": e.EName
        } for e in elements]
    })

@datasheet_bp.route('/get_elements_by_category/<category_name>')
def get_elements_by_category(category_name):
    item = Item.query.filter(Item.IName.ilike(category_name)).first()
    if not item:
        return jsonify({"success": False, "message": "Category not found", "elements": []})

    elements = Element.query.filter(Element.IDI == item.IDI).order_by(Element.EName).all()
    
    element_list = [{
        "IDE": e.IDE,
        "EName": e.EName,
        "IDI": e.IDI,
        "Category": item.IName
    } for e in elements]
    
    return jsonify({
        "success": True,
        "elements": element_list
    })


@datasheet_bp.route('/get_datasheet_by_task/<int:task_id>', methods=['GET'])
def get_datasheet_by_task(task_id):
    if 'username' not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    try:
        results = db.session.query(
            Datasheet.IDD,
            Datasheet.IDT,
            Datasheet.IDE,
            Datasheet.IDS,
            Datasheet.IDU1,
            Datasheet.ValueD1,
            Datasheet.CHK,
            UOM.UName
        ).join(UOM, Datasheet.IDU1 == UOM.IDU)\
         .filter(Datasheet.IDT == task_id).all()

        data = [{
            'IDD': r.IDD,
            'IDT': r.IDT,
            'IDE': r.IDE,
            'IDS': r.IDS,
            'IDU1': r.IDU1,
            'ValueD1': r.ValueD1,
            'CHK': r.CHK,
            'UName': r.UName
        } for r in results]

        return jsonify({"success": True, "data": data}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error fetching datasheet data for task {task_id}: {e}")
        return jsonify({"success": False, "message": "Internal server error"}), 500


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
        
       # Datasheet.query.filter_by(IDT=task_id, IDS=step_id).delete()
       # db.session.commit()
        
        new_entries = []
        for row in form_rows:
            ide = row.get('IDE')
            idu1 = row.get('IDU1')
            value_d1 = row.get('ValueD1')
            chk = row.get('CHK', 0)  # Default to 0 if not provided
            
            if ide is not None and idu1 is not None and value_d1 is not None:
                new_datasheet_entry = Datasheet(
                    IDE=ide,
                    IDS=step_id,
                    IDT=task_id,
                    IDU1=idu1,
                    ValueD1=value_d1,
                    CHK=chk,
                    EnterBy=current_user
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
        changes = 0
        rows_status = []  

        for row in form_rows:
            idd = row.get('IDD')
            ide = row.get('IDE')
            idu1 = row.get('IDU1')
            value_d1 = row.get('ValueD1')
            chk = row.get('CHK',None)

            if ide is None or idu1 is None or value_d1 is None:
                rows_status.append("❌")  
                continue

            if idd:  
                existing = Datasheet.query.get(idd)
                if existing:
                    
                    if existing.IDE != ide or existing.IDU1 != idu1 or existing.ValueD1 != value_d1:
                        existing.IDE = ide
                        existing.IDU1 = idu1
                        existing.ValueD1 = value_d1
                        existing.UpdateBy = current_user
                        existing.CHK = chk
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
                    IDU1=idu1,
                    ValueD1=value_d1,
                    EnterBy=current_user,
                    CHK=chk
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
