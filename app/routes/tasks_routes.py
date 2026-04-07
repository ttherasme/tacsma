from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from datetime import datetime
from app import db
from app.models import Tasks

tasks_bp = Blueprint('tasks_bp', __name__)

# ----------------------------------------------------------------
# Helper Function: Check Authentication
# ----------------------------------------------------------------
def get_current_user():
    if 'user_id' not in session:
        return None
    return session.get('user_id')

# ----------------------------------------------------------------
# Route: Display Tasks (Dashboard View)
# ----------------------------------------------------------------
@tasks_bp.route('/tasks')
def tasks():
    user_id = get_current_user()
    if not user_id:
        return redirect(url_for('auth_bp.login'))

    username = session.get('username', '')

    page = request.args.get('page', 1, type=int)
    per_page = 10
    if page < 1:
        page = 1

    # Base query
    if username.lower() == "admin":
        task_query = Tasks.query
    else:
        task_query = Tasks.query.filter_by(user_id=user_id)

    total_count = task_query.count()
    offset = (page - 1) * per_page

    task_list = (
        task_query
        .order_by(Tasks.EntryDate.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return render_template(
        'tasks/tasks.html',
        tasks=task_list,
        page=page,
        per_page=per_page,
        total_count=total_count,
        has_prev=page > 1,
        has_next=offset + per_page < total_count
    )


# ----------------------------------------------------------------
# Route: Search/Filter Tasks (JSON)
# ----------------------------------------------------------------
@tasks_bp.route('/searchtasks', methods=['GET'])
def search_tasks():
    user_id = get_current_user()
    if not user_id:
        return jsonify({
            "tasks": [],
            "page": 1,
            "per_page": 10,
            "total_count": 0,
            "has_prev": False,
            "has_next": False
        })

    query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = 10

    username = session.get('username', '')

    if username.lower() == "admin":
        base_query = Tasks.query
    else:
        base_query = Tasks.query.filter_by(user_id=user_id)

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
        ).order_by(Tasks.EntryDate.desc())
    else:
        base_query = base_query.order_by(Tasks.EntryDate.desc())

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

# ----------------------------------------------------------------
# Route: Task Registration (AJAX/JSON)
# ----------------------------------------------------------------
@tasks_bp.route('/registertask', methods=['GET', 'POST'])
def registertask():
    user_id = get_current_user()
    if not user_id:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data received."}), 400

        try:
            added_count = 0
            # Expecting a list of tasks from the frontend
            for item in data:
                name = item.get("TName")
                if not name:
                    continue 

                new_task = Tasks(
                    IDT=added_count,
                    TName=name,
                    Region=item.get("Region", ""),
                    Description=item.get("Description", ""),
                    EntryDate=datetime.utcnow(),
                    user_id=user_id  
                )
                db.session.add(new_task)
                added_count += 1

            if added_count == 0:
                return jsonify({"success": False, "message": "No valid tasks to insert."}), 400

            db.session.commit()
            return jsonify({"success": True, "message": f"{added_count} task(s) registered."}), 200

        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": f"Database error: {str(e)}"}), 500

    return render_template('tasks/taskregister.html')

# ----------------------------------------------------------------
# Route: Update Existing Task
# ----------------------------------------------------------------
@tasks_bp.route('/updatetask', methods=['GET', 'POST'])
def updatetask():
    user_id = get_current_user()
    if not user_id:
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        data = request.get_json()
        task_id = data.get("IDT")
        
        task = Tasks.query.get(task_id)
        if not task:
            return jsonify({"success": False, "message": "Task not found."}), 404

        # Security check: Only owner or admin can update
        if session.get('username').lower() != "admin" and task.user_id != user_id:
            return jsonify({"success": False, "message": "Unauthorized action."}), 403

        try:
            task.TName = data.get("TName")
            task.Region = data.get("Region")
            task.Description = data.get("Description")
            # We keep the original EntryDate but could add an UpdateDate if needed
            db.session.commit()
            return jsonify({"success": True, "message": "Task updated successfully."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    task_id = request.args.get("id")
    task = Tasks.query.get(task_id) if task_id else None
    return render_template("tasks/taskupdate.html", task=task)


# ------------------------------------------
# Route: list tasks
# ------------------------------------------
@tasks_bp.route('/listtasks', methods=['GET'])
def listtasks():
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
        if username and username.lower() == "admin":
            # Admin retrieves all tasks ordered alphabetically
            tasks_query = Tasks.query.order_by(Tasks.TName.asc()).all()
        else:
            # Regular users only retrieve tasks linked to their user_id
            tasks_query = Tasks.query.filter_by(user_id=user_id).order_by(Tasks.TName.asc()).all()

        # 3. Serialize data into JSON format
        result = [{
            "IDT": task.IDT,
            "TName": task.TName,
            "Region": task.Region,
            "Description": task.Description,
            "EntryDate": task.EntryDate.strftime('%Y-%m-%d %H:%M') if task.EntryDate else ""
        } for task in tasks_query]

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


# ----------------------------------------------------------------
# Route: Delete a Task by ID
# ----------------------------------------------------------------
@tasks_bp.route('/delete_task/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    user_id = get_current_user()
    if not user_id:
        return jsonify({"success": False, "message": "Session expired"}), 401

    task = Tasks.query.get(task_id)
    if not task:
        return jsonify({"success": False, "message": "Task not found"}), 404

    # Security check
    if session.get('username').lower() != "admin" and task.user_id != user_id:
        return jsonify({"success": False, "message": "Access denied"}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"success": True, "message": "Task permanently deleted"})
    except Exception:
        db.session.rollback()
        return jsonify({"success": False, "message": "Integrity error: Task is linked to data sheets"}), 500
    

# ----------------------------------------------------------------
# Route: Delete multiple Tasks by ID
# ----------------------------------------------------------------
@tasks_bp.route('/delete_tasks', methods=['DELETE'])
def delete_tasks():
    """
    Bulk delete tasks based on a list of IDs.
    Ensures users can only delete their own tasks unless they are Admin.
    """
    # 1. Authentication check
    user_id = session.get('user_id')
    username = session.get('username')

    if not user_id:
        return jsonify({"success": False, "message": "Authentication required."}), 401

    # 2. Data validation
    task_ids = request.json.get("task_ids", [])
    if not task_ids:
        return jsonify({"success": False, "message": "No task IDs provided."}), 400

    results = []
    try:
        for task_id in task_ids:
            task = Tasks.query.get(task_id)

            # Check if task exists
            if not task:
                results.append({"id": task_id, "status": "not_found"})
                continue

            # Security: Verify ownership (Admin bypasses this)
            is_admin = username and username.lower() == "admin"
            if not is_admin and task.user_id != user_id:
                results.append({"id": task_id, "status": "unauthorized"})
                continue

            # Add to deletion queue
            db.session.delete(task)
            results.append({"id": task_id, "status": "pending_deletion"})

        # 3. Finalize transaction
        db.session.commit()
        
        # Update status to deleted for all pending items
        for res in results:
            if res["status"] == "pending_deletion":
                res["status"] = "deleted"

        return jsonify({
            "success": True, 
            "message": "Bulk deletion process completed.",
            "results": results
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False, 
            "message": f"Critical database error: {str(e)}"
        }), 500


