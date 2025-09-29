from .auth_routes import auth_bp
from .index_routes import index_bp
from .datasheet_routes import datasheet_bp
from .results_routes import results_bp
from .tasks_routes import tasks_bp
from .uom_routes import uom_bp
from .stepofprocess_routes import stepofprocess_bp
from .typeoftransportation_routes import typeoftransportation_bp
from .users_routes import user_bp
from .element_routes import element_bp

def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(index_bp)
    app.register_blueprint(datasheet_bp)
    app.register_blueprint(results_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(uom_bp)
    app.register_blueprint(stepofprocess_bp)
    app.register_blueprint(typeoftransportation_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(element_bp)
