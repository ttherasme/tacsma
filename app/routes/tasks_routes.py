from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from datetime import datetime
from app import db
from app.models import Tasks

tasks_bp = Blueprint('tasks_bp', __name__)

# ------------------------------------------
# Route: Display tasks (first 10)
# ------------------------------------------
@tasks_bp.route('/tasks')
def tasks():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    task_list = Tasks.query.order_by(Tasks.EntryDate.desc()).limit(10).all()
    return render_template('tasks/tasks.html', tasks=task_list)


# ------------------------------------------
# Route: Task Registration Page + Submission
# ------------------------------------------
@tasks_bp.route('/registertask', methods=['GET', 'POST'])
def registertask():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data received."}), 400

        try:
            added_count = 0
            for item in data:
                name = item.get("TName")
                region = item.get("Region", "")
                desc = item.get("Description", "")

                if not name:
                    continue  # skip if name is missing

                task = Tasks(
                    TName=name,
                    Region=region,
                    Description=desc,
                    EntryDate=datetime.now(),
                    EnterBy=session.get('username')
                )
                db.session.add(task)
                added_count += 1

            if added_count == 0:
                return jsonify({"success": False, "message": "No valid tasks to insert."}), 400

            db.session.commit()
            return jsonify({"success": True}), 200

            # Optionally: For per-task result tracking:
            # return jsonify({
            #     "success": True,
            #     "results": [{"TName": item.get("TName"), "status": "ok"} for item in data]
            # })

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    return render_template('tasks/taskregister.html')


# ------------------------------------------
# Route: Task Update Page + Submission
# ------------------------------------------
@tasks_bp.route('/updatetask', methods=['GET', 'POST'])
def updatetask():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid data."}), 400

        task_id = data.get("IDT")
        name = data.get("TName")
        desc = data.get("Description", "")
        region = data.get("Region")

        try:
            task = Tasks.query.get(task_id)
            if not task:
                return jsonify({"success": False, "message": "Task not found."}), 404

            task.TName = name
            task.Region = region
            task.Description = desc
            task.EntryDate = datetime.now()
            db.session.commit()

            return jsonify({"success": True}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    task_id = request.args.get("id")
    task = Tasks.query.get(task_id) if task_id else None
    return render_template("tasks/taskupdate.html", task=task)


# ------------------------------------------
# Route: Search tasks by name
# ------------------------------------------
@tasks_bp.route('/searchtasks', methods=['GET'])
def search_tasks():
    if 'username' not in session:
        return jsonify([])

    username = session['username']
    query = request.args.get('q', '').strip()
    like_query = f"%{query}%"

    # --- Base query: Admin sees all, others only see their own ---
    if username.lower() == "admin":
        base_query = Tasks.query
    else:
        base_query = Tasks.query.filter(Tasks.EnterBy == username)

    # --- Apply search filter---
    if not query:
        tasks = base_query.order_by(Tasks.EntryDate.desc()).limit(10).all()
    else:
        tasks = base_query.filter(
            db.or_(
                Tasks.TName.ilike(like_query),
                Tasks.Region.ilike(like_query),
                Tasks.Description.ilike(like_query),
                db.cast(Tasks.IDT, db.String).ilike(like_query),
                db.cast(Tasks.EntryDate, db.String).ilike(like_query),
            )
        ).order_by(Tasks.EntryDate.desc()).limit(10).all()

    result = [{
        "IDT": task.IDT,
        "TName": task.TName,
        "Region": task.Region,
        "Description": task.Description,
        "EntryDate": task.EntryDate.strftime('%Y-%m-%d %H:%M') if task.EntryDate else ""
    } for task in tasks]

    return jsonify(result)


# ------------------------------------------
# Route: list tasks
# ------------------------------------------

@tasks_bp.route('/listtasks', methods=['GET'])
def listtasks():
    if 'username' not in session:
        return jsonify({"success": False, "tasks": []})

    username = session['username']

    # Admin sees everything
    if username.lower() == "admin":
        tasks = Tasks.query.order_by(Tasks.TName.asc()).all()
    else:
        # Others only see their own tasks
        tasks = Tasks.query.filter(Tasks.EnterBy == username).order_by(Tasks.TName.asc()).all()

    result = [{
        "IDT": task.IDT,
        "TName": task.TName,
        "Region": task.Region,
        "Description": task.Description,
        "EntryDate": task.EntryDate.strftime('%Y-%m-%d %H:%M') if task.EntryDate else ""
    } for task in tasks]

    return jsonify({"success": True, "tasks": result})

# ------------------------------------------
# Route: Delete a task by IDT
# ------------------------------------------
@tasks_bp.route('/delete_task/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    username = session['username']

    # Fetch the task
    task = Tasks.query.get(task_id)
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404

    # Admin can delete anything, other users only their own
    #if username != "Admin" and task.EnterBy != username:
    #    return jsonify({"success": False, "message": "Not authorized"}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"success": True, "message": "Task deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": "Error deleting task"}), 500
    

@tasks_bp.route('/delete_tasks', methods=['DELETE'])
def delete_tasks():
    if 'username' not in session:
        return jsonify({"success": False, "message": "Not authenticated"}), 401

    task_ids = request.json.get("task_ids", [])
    if not task_ids:
        return jsonify({"success": False, "message": "No task IDs provided"}), 400

    results = []
    for task_id in task_ids:
        task = Tasks.query.get(task_id)

        if not task:
            results.append({"id": task_id, "status": "not_found"})
            continue

        try:
            db.session.delete(task)
            db.session.commit()
            results.append({"id": task_id, "status": "deleted"})
        except:
            db.session.rollback()
            results.append({"id": task_id, "status": "error"})

    return jsonify({"success": True, "results": results})


