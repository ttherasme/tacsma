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
