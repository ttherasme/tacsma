from flask import Blueprint, render_template, session, redirect, url_for

index_bp = Blueprint('index_bp', __name__)

@index_bp.route('/index')
def index():
    if 'username' not in session:
        return redirect(url_for('auth_bp.login'))
    return render_template('index.html')
