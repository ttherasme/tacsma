import os
import pymysql
from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv
# For executing raw SQL for triggers
from sqlalchemy import text # Import text for raw SQL execution

# Load environment variables from .env
load_dotenv()

# Global SQLAlchemy instance (exposed at module level)
db = SQLAlchemy()
migrate = Migrate() # Initialize Migrate globally or within create_app

def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = (
        f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@"
        f"{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'fallback-secret-key')

    # Initialize SQLAlchemy and Flask-Migrate
    db.init_app(app)
    migrate.init_app(app, db) # Initialize Flask-Migrate (after db.init_app)

    # Import and register blueprints
    from .routes import register_blueprints
    register_blueprints(app)

    # Context for database operations
    with app.app_context():
        # Ensure the database and tables are initialized using init_db.sql
        # This will create tables AND triggers.
        ensure_database_initialized(app)

        # 🛑 Deferred model imports for the User query
        from .models import User, Tasks, Item, Step, UOM, MTransp # Keep this for User query

        # Insert default user if none exists
        try:
            if not User.query.first():
                from werkzeug.security import generate_password_hash
                hashed_password = generate_password_hash("123456")
                admin = User(
                    username='admin',
                    password=hashed_password,
                    state=1,
                    level=1,
                    change=0
                )
                db.session.add(admin)
                db.session.commit()
                print("[INIT] Default admin user created.")
            else:
                print("[INIT] Admin user already exists.")
        except OperationalError as e:
            print(f"[ERROR] Could not check/create default user: {e}")
            # This might happen if the 'User' table wasn't created for some reason
        except Exception as e:
            # Catch other potential errors during user creation
            print(f"[ERROR] An unexpected error occurred during admin user setup: {e}")


    return app

# --- Helper functions for database initialization ---

def ensure_database_initialized(app):
    """
    Ensure the MySQL database and all tables are created using init_db.sql if necessary.
    This function handles executing the full init_db.sql including DELIMITER statements.
    """
    db_name = os.getenv("DB_NAME", "tacsma")
    sql_file_path = os.path.join(os.path.dirname(app.root_path), 'init_db.sql')

    connection = None # Initialize connection to None
    try:
        # Connect without specifying a database initially to check for database existence
        connection = pymysql.connect(
            host=os.getenv("DB_HOST", "mysql-tacsma.alwaysdata.net"),
            user=os.getenv("DB_USER", "tacsma"),
            password=os.getenv("DB_PASSWORD", "HDEV2025dev"),
            charset='utf8mb4',
            autocommit=True # Ensure commands are committed immediately
        )

        with connection.cursor() as cursor:
            # Check if the database exists
            cursor.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = %s;", (db_name,))
            db_exists = cursor.fetchone()

            if not db_exists:
                print(f"[INIT] Database '{db_name}' not found. Attempting to create and initialize it.")
                # Execute the entire SQL script
                run_sql_script(connection, sql_file_path, db_name)
                print(f"[INIT] Database '{db_name}' initialized successfully.")
            else:
                print(f"[INIT] Database '{db_name}' already exists.")
                # Optional: If you want to ensure tables are always there even if DB exists but tables aren't
                # You could connect to the DB directly now and check for a specific table.
                # For simplicity, assuming if DB exists, tables are managed by init_db.sql or migrations.

    except OperationalError as e:
        print(f"[ERROR] Database connection or operation failed during initialization: {e}")
        # Consider re-raising or exiting if connection is critical
    except Exception as e:
        print(f"[ERROR] An unexpected error occurred during database initialization: {e}")
    finally:
        if connection:
            connection.close()

def run_sql_script(connection, path, db_name_to_use=None):
    """
    Execute the init_db.sql script, handling DELIMITER statements.
    This version reads the file and executes commands while respecting DELIMITER.
    """
    print(f"Executing SQL script: {path}")
    current_delimiter = ';'
    sql_buffer = []

    with open(path, 'r', encoding='utf-8') as file:
        for line in file:
            line = line.strip()

            if line.upper().startswith('DELIMITER'):
                parts = line.split()
                if len(parts) > 1:
                    current_delimiter = parts[1]
                continue # Skip the DELIMITER line itself

            sql_buffer.append(line)

            if line.endswith(current_delimiter):
                command = "\n".join(sql_buffer).strip()
                # Remove the delimiter from the end of the command
                command = command[:-len(current_delimiter)].strip()

                if command:
                    # Special handling for USE statement if we need to ensure the DB is selected
                    # Note: init_db.sql starts with CREATE DATABASE IF NOT EXISTS tacsma; USE tacsma;
                    # So the initial connection doesn't need to specify the DB.
                    # The USE command within the script will handle it.
                    if command.upper().startswith('USE '):
                        db_to_use_in_script = command.split(' ')[1].strip(';').strip()
                        print(f"Switching to database: {db_to_use_in_script}")
                        # PyMySQL doesn't support changing database via execute for consistency
                        # Instead, ensure the connection is to the correct DB if possible,
                        # or just rely on the USE statement in the script.
                        # For a single init script, this is usually fine.
                        pass # Let the script's USE command handle it

                    try:
                        with connection.cursor() as cursor:
                            # It's important to execute commands against the connection that
                            # was established without a specific DB if creating the DB first,
                            # and then letting the script's USE command switch context.
                            # Or, if DB already exists, establish connection with DB_NAME.
                            cursor.execute(command)
                            connection.commit() # Commit after each command if not autocommiting
                    except Exception as e:
                        print(f"[ERROR] Failed to execute SQL command: '{command}'\n  -> {e}")
                        # Optionally, re-raise the exception to stop initialization if critical
                        # raise # Uncomment to stop on first SQL error
                sql_buffer = [] # Reset buffer

    # Handle any remaining command if file doesn't end with a delimiter
    if sql_buffer:
        command = "\n".join(sql_buffer).strip()
        if command:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(command)
                    connection.commit()
            except Exception as e:
                print(f"[ERROR] Failed to execute final SQL command: '{command}'\n  -> {e}")