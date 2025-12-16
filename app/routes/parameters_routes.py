from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from app import db
from flask import current_app # Needed if config is loaded via current_app.config
from app.models import PermissionRule, User
from config import PAGES, ACTIONS, LEVELS, ELEMENTS_MAP # Import your config data
from app.models import Parameter, User, UserParameterValue 
import logging
logger = logging.getLogger(__name__)

parameters_bp = Blueprint('parameters_bp', __name__)

# Helper function to get the current user object and ID
def get_current_user_data():
    """Retrieves the current User object and user_id from the session username."""
    if 'username' not in session:
        return None, None
        
    username = session['username']
    current_user = User.query.filter_by(username=username).first()
    
    if current_user:
        return current_user, current_user.id
    
    # If username is in session but user isn't found (e.g., deleted user)
    session.pop('username', None)
    return None, None


def get_user_parameter_data(user_id):
    # Get all global parameters in a map for quick access
    global_params = Parameter.query.order_by(Parameter.id).all()
    global_param_map = {p.id: p for p in global_params}

    # Get all user-specific parameter values for this user
    user_values = UserParameterValue.query.filter_by(user_id=user_id).all()

    # Track which (parameter_id, IDT) combinations are present for the user
    user_param_idt_set = set((upv.parameter_id, upv.IDT) for upv in user_values)

    parameter_list = []

    # 1. Add all user-specific rows as they exist in the DB
    for upv in user_values:
        param = global_param_map.get(upv.parameter_id)
        if not param:
            # The global parameter was deleted or missing; skip this user value
            continue

        parameter_list.append({
            'id': param.id,
            'name': param.parameter_name,
            'idt': upv.IDT,
            'default': param.parameter_default,
            'unit': param.parameter_unit,
            'value': upv.value
        })

    # 2. Add any global parameters/IDTs that the user does not have yet
    # Since IDT can vary, and you want to return *all* existing data,
    # but for IDT variants user doesn't have, just add a default row with empty IDT

    # We don't know all possible IDT values globally, but per your data model,
    # If you want all possible IDTs, you'd have to fetch those from the Parameter table or somewhere else.
    # For now, we add one default row for parameters missing in user_values:

    for param in global_params:
        # Find if user has ANY record for this parameter_id (any IDT)
        has_any_user_value = any(upv.parameter_id == param.id for upv in user_values)
        if not has_any_user_value:
            # Add a default row with empty IDT and default value
            parameter_list.append({
                'id': param.id,
                'name': param.parameter_name,
                'idt': '',
                'default': param.parameter_default,
                'unit': param.parameter_unit,
                'value': param.parameter_default
            })

    # Return the full list of rows to be shown in the table
    return parameter_list


@parameters_bp.route('/get_regeneration_user')
def get_regeneration_user():
    logger.info("GET /get_regeneration_user called")
    logger.warning(f"Regeneration mode :")
    current_user, user_id = get_current_user_data()

    if not current_user:
        logger.warning("No current user found")
        return jsonify({"error": "not_authenticated"}), 401

    logger.warning(f"value : '{current_user.regeneration_mode}'")

    return jsonify({
        "value": current_user.regeneration_mode
    })


@parameters_bp.route('/listparameters')
def listparameters():
    # Get all global parameters
    global_params = Parameter.query.order_by(Parameter.id).all()

    # Merge global and user-specific data
    parameter_list = []
    for param in global_params:
        parameter_list.append({
            'id': param.id,
            'name': param.parameter_name,
            'default': param.parameter_default,
            'unit': param.parameter_unit
        })

    return jsonify({"success": True, "parameter_list": parameter_list})


# ------------------------------------------
# Route: Display parameters (GET /parameters)
# ------------------------------------------
@parameters_bp.route('/parameters')
def parameters():
    current_user, user_id = get_current_user_data()

    if not current_user:
        return redirect(url_for('auth_bp.login'))

    parameter_list = get_user_parameter_data(user_id)
    regeneration_mode = current_user.regeneration_mode
    logger.warning(f"regeneration mode: {regeneration_mode}")
    logger.warning(f"regeneration mode\n {parameter_list}")

    return render_template(
        'parameter/parameter.html',
        parameters=parameter_list,
        regeneration_mode=regeneration_mode
    )

# ------------------------------------------
# Route: Display parameters registration 
# ------------------------------------------
@parameters_bp.route('/parametersregistration')
def parametersregistration():
    current_user, user_id = get_current_user_data()

    if not current_user:
        return redirect(url_for('auth_bp.login'))

    regeneration_mode = current_user.regeneration_mode
    return render_template(
        'parameter/register.html',
        regeneration_mode=regeneration_mode
    )

# ------------------------------------------
# Route: Save Parameters (POST /save-parameters)
# Handles Insert & Update of the per-user 'value'
# ------------------------------------------
@parameters_bp.route('/save-parametersvalue', methods=['POST'])
def save_parametersvalue():
    # User auth check
    if 'username' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    current_user, user_id = get_current_user_data()
    if not current_user:
        return jsonify({'success': False, 'error': 'Unauthorized user data'}), 401

    data = request.get_json()
    updates = data.get("updates", [])

    try:
        for item in updates:
            param_id = int(item["parameter_id"])
            task_id = int(item["task_id"])
            value = float(item["parameter_value"])

            # Check if record already exists
            existing = UserParameterValue.query.filter_by(
                user_id=user_id,
                parameter_id=param_id,
                IDT=task_id
            ).first()

            if existing:
                # Update value
                existing.value = value
            else:
                # Create new record
                new_param = UserParameterValue(
                    user_id=user_id,
                    parameter_id=param_id,
                    IDT=task_id,
                    value=value
                )
                db.session.add(new_param)

        db.session.commit()
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})


@parameters_bp.route('/save-parameters', methods=['POST'])
def save_parameters():
    if 'username' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    current_user, user_id = get_current_user_data()
    if not current_user:
        return jsonify({'success': False, 'error': 'Unauthorized user data'}), 401
    
    data = request.get_json()
    updates = data.get('updates', [])
    new_ids = []

    try:
        for item in updates:
            param_id = item['id']
            new_value = item['parameter_value']
            new_idt = int(item.get('parameter_idt')) if item.get('parameter_idt') else None

            # ------------------------------------------
            # CASE A: NEW GLOBAL PARAMETER
            # ------------------------------------------
            if param_id == 'new':
                # Create global parameter
                new_param = Parameter(
                    parameter_name=item['parameter_name'],
                    parameter_default=item['parameter_default'],
                    parameter_unit=item['parameter_unit']
                )
                db.session.add(new_param)
                db.session.flush()      # obtain its new ID

                # Insert user value row
                new_upv = UserParameterValue(
                    user_id=user_id,
                    parameter_id=new_param.id,
                    value=new_value,
                    IDT=new_idt
                )
                db.session.add(new_upv)

                new_ids.append({'temp_id': 'new', 'id': new_param.id})
                continue

            # ------------------------------------------
            # CASE B: EXISTING PARAMETER
            # INSERT IF NOT EXISTS, UPDATE IF EXISTS
            # ------------------------------------------

            existing = UserParameterValue.query.filter_by(
                user_id=user_id,
                parameter_id=param_id,
                IDT=new_idt
            ).first()

            if existing:
                # UPDATE existing record
                existing.value = new_value

            else:
                # INSERT new record
                new_upv = UserParameterValue(
                    user_id=user_id,
                    parameter_id=param_id,
                    value=new_value,
                    IDT=new_idt
                )
                db.session.add(new_upv)

        db.session.commit()
        return jsonify({'success': True, 'new_ids': new_ids})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})

# ------------------------------------------
# Route: Reset Parameters (POST /reset-parameters)
# Sets the user's custom value back to the global default
# ------------------------------------------
@parameters_bp.route('/reset-parameters', methods=['POST'])
def reset_parameters():
    # Corrected session check
    if 'username' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    current_user, user_id = get_current_user_data()
    if not current_user:
        return jsonify({'success': False, 'error': 'Unauthorized user data'}), 401
    
    try:
        # Get all UserParameterValue entries for the current user
        user_values_to_reset = UserParameterValue.query.filter_by(user_id=user_id).all()

        for upv in user_values_to_reset:
            # Set the user's custom value (upv.value) to the parameter's global default
            upv.value = upv.parameter.parameter_default
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})

# ------------------------------------------
# Route: Delete Parameter (DELETE /delete-parameter/<int:param_id>)
# Deletes the GLOBAL Parameter definition (SUPERUSER ONLY)
# ------------------------------------------
@parameters_bp.route('/delete-parametervalue', methods=['DELETE'])
def delete_parametervalue():

    if 'username' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    current_user, user_id = get_current_user_data()
    if not current_user:
        return jsonify({'success': False, 'error': 'Unauthorized user data'}), 401

    # Read request args
    param_id = request.args.get("param_id")
    idt = request.args.get("idt")

    if not param_id or not idt:
        return jsonify({'success': False, 'error': 'Missing parameters'}), 400

    try:
        param = UserParameterValue.query.filter_by(
            parameter_id=param_id,
            IDT=idt,
            user_id=user_id
        ).first()

        if param:
            db.session.delete(param)   # delete the instance!
            db.session.commit()
            return jsonify({'success': True})

        return jsonify({'success': False, 'error': 'Parameter not found'}), 404

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})


@parameters_bp.route('/delete-parameter/<int:param_id>', methods=['DELETE'])
def delete_parameter(param_id):
    # Corrected session check
    if 'username' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    current_user, user_id = get_current_user_data()
    if not current_user:
        return jsonify({'success': False, 'error': 'Unauthorized user data'}), 401
        
    # Implement Superuser level check here!
    # if current_user.level < 10: 
    #     return jsonify({'success': False, 'error': 'Permission denied'}), 403

    try:
        param = Parameter.query.get(param_id)
        if param:
            # Cascading delete should handle UserParameterValue entries
            db.session.delete(param)
            db.session.commit()
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Parameter not found'}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})

# ------------------------------------------
# Route: Update Regeneration Mode (POST /update-regeneration-mode)
# Saves the user's Yes/No choice to the User table
# ------------------------------------------
@parameters_bp.route('/update-regeneration-mode', methods=['POST'])
def update_regeneration_mode():
    # Corrected session check
    if 'username' not in session:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    
    current_user, user_id = get_current_user_data()
    if not current_user:
        return jsonify({'success': False, 'error': 'Unauthorized user data'}), 401
    
    data = request.get_json()
    mode = data.get('mode') # 'yes' or 'no'
    
    is_active = (mode == 'yes')
    
    try:
        user = current_user # Already fetched
        user.regeneration_mode = is_active
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})
    

# ------------------------------------------
# Route: Permission Management Page (GET /permission-rules)
# ------------------------------------------
@parameters_bp.route('/users_management')
def users_management():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    current_user, _ = get_current_user_data()
    
    # Super User Access Check (Assuming level 10 is superuser, or adjust based on your admin level)
    if not current_user or current_user.level <5: 
        return render_template('index.html'), 403 

    return render_template('users/user_management.html')


@parameters_bp.route('/permission-rules')
def permission_rules():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))

    current_user, _ = get_current_user_data()
    
    # Super User Access Check (Assuming level 10 is superuser, or adjust based on your admin level)
    if not current_user or current_user.level < 5: 
        return render_template('index.html'), 403 

    # Fetch all existing rules
    rules = PermissionRule.query.all()
    
    # Prepare data for rendering
    rules_list = [{
        'id': r.id,
        'level': r.access_level,
        'page': r.page_name,
        'element': r.element_id,
        'action': r.action_type
    } for r in rules]
    return render_template('users/level.html', 
                           existing_rules=rules_list,
                           levels=LEVELS, # LEVELS is now a dictionary
                           pages=PAGES,
                           actions=ACTIONS,
                           elements_map=ELEMENTS_MAP)

# ------------------------------------------
# Route: AJAX Endpoint to Save ALL Rules (POST /save-permission-rules)
# ------------------------------------------
@parameters_bp.route('/save-permission-rules', methods=['POST'])
def save_permission_rules():
    # ... (auth and superuser check) ...

    data = request.get_json()
    new_rules = data.get('new_rules', [])
    deleted_ids = data.get('deleted_rules', [])
    updated_rules = data.get('updates', []) # NEW: Array of updated rules

    try:
        # 1. Handle Deletions
        if deleted_ids:
            PermissionRule.query.filter(PermissionRule.id.in_(deleted_ids)).delete(synchronize_session='fetch')

        # 2. Handle Insertions (New Rules)
        for rule_data in new_rules:
            new_rule = PermissionRule(
                access_level=int(rule_data['level']),
                page_name=rule_data['page'],
                element_id=rule_data['element'],
                action_type=rule_data['action']
            )
            db.session.add(new_rule)
            
        # 3. Handle Updates (Existing Rules)
        for update_data in updated_rules:
            rule_id = update_data.get('id')
            rule = PermissionRule.query.get(rule_id)
            
            if rule:
                # Update level if present in the payload
                if 'level' in update_data:
                    rule.access_level = int(update_data['level'])
                    
                # Update action if present in the payload
                if 'action' in update_data:
                    rule.action_type = update_data['action']
            
        db.session.commit()
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Failed to save rules: {str(e)}'}), 500