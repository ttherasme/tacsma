from flask import Blueprint, render_template, request, redirect, url_for, session, flash, current_app
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import timedelta
from app.models import User
from app import db

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        remember = request.form.get('remember') == 'on'  # 'on' if checkbox is checked

        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password, password) and user.state:
            session['username'] = user.username
            session.permanent = remember  # Keep session alive across browser restarts if checked

            # Optional: control lifetime via config
            current_app.permanent_session_lifetime = timedelta(days=30)

            if user.change == 1:
                flash('You need to change your password before continuing.')
                return redirect(url_for('auth_bp.change_password')) 

            flash(f'Welcome, {user.username}!')
            return redirect(url_for('index_bp.index'))

        # Generic error message
        flash('Invalid credentials or inactive user.')

    return render_template('login.html')


@auth_bp.route('/accept_change_password', methods=['POST'])
def accept_change_password():
    if 'username' not in session:
        flash('Session expired. Please log in again.')
        return redirect(url_for('auth_bp.login'))

    if request.form.get('change_password') == 'yes':
        return redirect(url_for('auth_bp.change_password'))

    session.clear()
    flash('Password change declined. You have been logged out.')
    return redirect(url_for('auth_bp.login'))


@auth_bp.route('/change_password', methods=['GET', 'POST'])
def change_password():
    if 'username' not in session:
        flash('Session expired. Please log in again.')
        return redirect(url_for('auth_bp.login'))

    user = User.query.filter_by(username=session.get('username')).first()
    if not user:
        session.clear()
        flash("User not found or session invalid. Please log in again.")
        return redirect(url_for('auth_bp.login'))

    if request.method == 'POST':
        current_password = request.form.get('current_password', '').strip()
        new_password = request.form.get('new_password', '').strip()
        confirm_new_password = request.form.get('confirm_new_password', '').strip()

        # Validate current password
        if not check_password_hash(user.password, current_password):
            flash("Current password is incorrect.")
            return render_template('changepassword.html')

        # Ensure new password and confirm new password match
        if new_password != confirm_new_password:
            flash("New password and confirmation do not match.")
            return render_template('changepassword.html')

        # Validate new password length
        if len(new_password) < 6:
            flash("Password must be at least 6 characters long.")
            return render_template('changepassword.html')

        # Hash the new password and update the user's 'change' status
        user.password = generate_password_hash(new_password)
        user.change = 0  # Mark that the user has changed their initial password

        try:
            db.session.commit()  # Commit changes to the database
            flash('Password changed successfully.')
            return redirect(url_for('index_bp.index'))  # Redirect to the main application index
        except Exception as e:
            db.session.rollback()
            flash(f'An error occurred while changing password. Please try again. ({e})')
            return render_template('changepassword.html')

    return render_template('changepassword.html')


@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.')
    return redirect(url_for('auth_bp.login'))
