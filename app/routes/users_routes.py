from flask import Blueprint, render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash
from app import db
from app.models import User

user_bp = Blueprint('user_bp', __name__, url_prefix='/users')

@user_bp.route('/list_users')
def list_users():
    users = User.query.all()
    return render_template('users/list.html', users=users)

@user_bp.route('/create_user', methods=['GET', 'POST'])
def create_user():
    if request.method == 'POST':
        username = request.form.get('username')
        password = generate_password_hash(request.form.get('password'))
        state = request.form.get('state') == '1'
        level = int(request.form.get('level') or 0)
        change = request.form.get('change') == '1'

        # Basic validation
        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('users/create.html')

        # Check if username exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            return render_template('users/create.html')

        new_user = User(username=username, password=password, state=state, level=level, change=change)
        db.session.add(new_user)
        db.session.commit()
        flash('User created successfully!', 'success')
        return redirect(url_for('user_bp.list_users'))
    return render_template('users/create.html')

@user_bp.route('/edit_user/<int:user_id>', methods=['GET', 'POST'])
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        state = request.form.get('state') == '1'
        level = int(request.form.get('level') or 0)
        change = request.form.get('change') == '1'

        if not username:
            flash('Username is required.', 'error')
            return render_template('users/edit.html', user=user)

        # Check if username exists for another user
        existing_user = User.query.filter(User.username == username, User.id != user.id).first()
        if existing_user:
            flash('Username already exists.', 'error')
            return render_template('users/edit.html', user=user)

        user.username = username
        if password:
            user.password = generate_password_hash(password)
        user.state = state
        user.level = level
        user.change = change

        db.session.commit()
        flash('User updated successfully!', 'success')
        return redirect(url_for('user_bp.list_users'))

    return render_template('users/edit.html', user=user)


@user_bp.route('/delete_user/<int:user_id>', methods=['POST'])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    flash('User deleted successfully!', 'success')
    return redirect(url_for('user_bp.list_users'))
