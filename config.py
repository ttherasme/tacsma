import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

DB_USER = os.getenv("DB_USER", "tacsma") 
DB_PASSWORD = os.getenv("DB_PASSWORD", "HDEV2025dev") 
DB_HOST = os.getenv("DB_HOST", "mysql-tacsma.alwaysdata.net")
DB_NAME = os.getenv("DB_NAME", "tacsma_db")

SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
SQLALCHEMY_TRACK_MODIFICATIONS = False
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")

# 1. List of Pages
PAGES = [
    'parameters', 
    'results', 
    'reports', 
    'user_levels', 
    'data_sheet'
]

# 2. List of page element
ELEMENTS_MAP = {
    # --- Standard Page Elements ---
    'parameters': [
        {'id': 'parameters', 'type': 'page', 'desc': 'Access to the Parameters Page'},
        {'id': 'reset-to-default', 'type': 'button', 'desc': 'Reset to Default button'},
        {'id': 'save-row', 'type': 'button', 'desc': 'Save Parameter Changes'},
        {'id': 'add-row', 'type': 'button', 'desc': 'Add New Parameter Button'},
        {'id': 'regeneration_radio', 'type': 'radio', 'desc': 'Regeneration Mode Radio Buttons'},
        {'id': 'editable-value', 'type': 'cell', 'desc': 'Parameter Value Input Cell'}
    ],
    
    'results': [
        {'id': 'results', 'type': 'page', 'desc': 'Access to the Results Page'},
        {'id': 'view_all_scenarios', 'type': 'button', 'desc': 'View All Scenarios Button'}
    ],
    
    'reports': [
        {'id': 'reports', 'type': 'page', 'desc': 'Access to the Reports Page'},
        {'id': 'report_generator', 'type': 'form', 'desc': 'Report Generation Form'}
    ]
    # You will need to add mappings for 'user_levels' and 'data_sheet' elements as well.
} 


# 3. List of actions that can be controlled
ACTIONS = [
    'view',       # Can the element/page be seen?
    'click',      # Can a button be pressed?
    'enable',     # Can an input/select/radio be used?
    'editable'    # Can an input/text area be modified?
]

# 4. List of User Levels
LEVELS = {
    1: 'ReadOnly User',
    2: 'Standard User (Save/Edit Values)',
    3: 'Advanced User (Data Entry/Limited Admin)',
    4: 'Manager/Supervisor',
    5: 'Full Access (Non-Superuser Admin)'
}
