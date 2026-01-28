from app import db
from datetime import datetime
from sqlalchemy.schema import UniqueConstraint

# ----------------------------------------------------------------
# USER AND SYSTEM PARAMETERS MODELS
# ----------------------------------------------------------------

class Parameter(db.Model):
    """Stores global LCA parameters and their default values."""
    __tablename__ = 'parameter'
    id = db.Column(db.Integer, primary_key=True)
    parameter_name = db.Column(db.String(100), unique=True, nullable=False)
    parameter_default = db.Column(db.Float, default=0)
    parameter_unit = db.Column(db.String(20), nullable=False)
    
    # Relationship to user-specific overrides
    user_values = db.relationship('UserParameterValue', backref='parameter', lazy=True)


class User(db.Model):
    """User management and access control."""
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    state = db.Column(db.Boolean, default=True)
    level = db.Column(db.Integer, default=0)
    change = db.Column(db.Integer, default=1)
    # 0 = Use Defaults, 1 = Use User-Defined Values
    regeneration_mode = db.Column(db.Integer, default=0) 

    # Relationships to track user-created content
    param_values = db.relationship('UserParameterValue', backref='user', lazy=True)
    tasks = db.relationship('Tasks', backref='user', lazy=True)
    elements = db.relationship('Element', backref='user', lazy=True)
    datasheets = db.relationship('Datasheet', backref='user', lazy=True)


class UserParameterValue(db.Model):
    """Stores custom parameter values defined by specific users for specific tasks."""
    __tablename__ = 'user_parameter_value'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey('parameter.id'), nullable=False)
    IDT = db.Column(db.Integer, db.ForeignKey('tasks.IDT'), nullable=False)
    value = db.Column(db.Float, default=0)

    __table_args__ = (UniqueConstraint('user_id', 'parameter_id', 'IDT', name='_user_parameter_uc'),)


class PermissionRule(db.Model):
    """Defines UI permissions based on user access levels."""
    __tablename__ = 'permission_rule'
    id = db.Column(db.Integer, primary_key=True)
    access_level = db.Column(db.Integer, nullable=False)
    page_name = db.Column(db.String(50), nullable=False)
    element_id = db.Column(db.String(100), nullable=False)
    action_type = db.Column(db.String(20), nullable=False)
    
    __table_args__ = (UniqueConstraint('access_level', 'page_name', 'element_id', 'action_type', 
                                       name='_unique_permission_rule'),)

# ----------------------------------------------------------------
# LCA CORE MODELS (PROCESSES AND INVENTORY)
# ----------------------------------------------------------------

class Tasks(db.Model):
    """Specific LCA project or case study."""
    __tablename__ = 'tasks'
    IDT = db.Column(db.Integer, primary_key=True, autoincrement=False)
    TName = db.Column(db.String(150), nullable=False)
    Region = db.Column(db.String(8))
    Description = db.Column(db.String(250))
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    datasheets = db.relationship('Datasheet', backref='task', lazy=True)


class Item(db.Model):
    """Categorization of elements (e.g., Raw Materials, Energy)."""
    __tablename__ = 'item'
    IDI = db.Column(db.String(6), primary_key=True, autoincrement=False)
    IName = db.Column(db.String(100), unique=True, nullable=False)

    elements = db.relationship('Element', backref='item', lazy=True)


class Step(db.Model):
    """Life cycle stages (e.g., Production, Transport, End-of-Life)."""
    __tablename__ = 'step'
    IDS = db.Column(db.String(6), primary_key=True, autoincrement=False)
    SName = db.Column(db.String(50), unique=True, nullable=False)
    State = db.Column(db.Integer, default=1)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    UpdateBy = db.Column(db.String(25))

    datasheets = db.relationship('Datasheet', backref='step', lazy=True)


class UOM(db.Model):
    """Units of Measure (e.g., kg, kWh, tkm)."""
    __tablename__ = 'uom'
    IDU = db.Column(db.String(6), primary_key=True, autoincrement=False)
    UName = db.Column(db.String(20), nullable=False)
    Unit = db.Column(db.String(5), nullable=False)
    State = db.Column(db.Integer, default=1)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))

    datasheets = db.relationship('Datasheet', backref='uom', lazy=True)


class MTransp(db.Model):
    """Modes of Transportation."""
    __tablename__ = 'mtransp'
    IDM = db.Column(db.String(6), primary_key=True, autoincrement=False)
    MTName = db.Column(db.String(50), nullable=False)
    State = db.Column(db.Integer, default=1)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(50))

    datasheets = db.relationship('Datasheet', backref='mtransp', lazy=True)

class BElement(db.Model):
    """Inventory items belonging to a specific Task and Category (Item)."""
    __tablename__ = 'b_element'
    IDBE = db.Column(db.Integer, primary_key=True, autoincrement=False)
    EName = db.Column(db.String(48), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    
    # CONSTRAINT FIXED: Changed 'Enterby' to 'user_id'
    __table_args__ = (UniqueConstraint('EName', 'user_id', 
                                       name='_unique_belement_constraint'),)
    elements = db.relationship('Element', backref='b_element', lazy=True)


class Element(db.Model):
    """Inventory items belonging to a specific Task and Category (Item)."""
    __tablename__ = 'element'
    IDE = db.Column(db.Integer, primary_key=True, autoincrement=False)
    IDBE = db.Column(db.Integer, db.ForeignKey('b_element.IDBE'), nullable=False)
    IDI = db.Column(db.String(6), db.ForeignKey('item.IDI'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    Global_Val = db.Column(db.Integer, default=0)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    
    # CONSTRAINT FIXED: Changed 'Enterby' to 'user_id'
    __table_args__ = (UniqueConstraint('IDBE', 'IDI', 'user_id', 
                                       name='_unique_element_constraint'),)
    
    datasheets = db.relationship('Datasheet', backref='element', lazy=True)

""" class Element(db.Model):
    
    __tablename__ = 'element'
    IDE = db.Column(db.Integer, primary_key=True, autoincrement=False)
    EName = db.Column(db.String(48), nullable=False)
    IDI = db.Column(db.String(6), db.ForeignKey('item.IDI'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    Global_Val = db.Column(db.Integer, default=0)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    
    # CONSTRAINT FIXED: Changed 'Enterby' to 'user_id'
    __table_args__ = (UniqueConstraint('EName', 'IDI', 'user_id', 
                                       name='_unique_element_constraint'),)
    
    datasheets = db.relationship('Datasheet', backref='element', lazy=True) """

class Datasheet(db.Model):
    """Primary data entry table linking elements to quantities and processes."""
    __tablename__ = 'datasheet'
    IDD = db.Column(db.Integer, primary_key=True, autoincrement=True)
    IDT = db.Column(db.Integer, db.ForeignKey('tasks.IDT'), nullable=False)
    IDE = db.Column(db.Integer, db.ForeignKey('element.IDE'), nullable=False) 
    IDS = db.Column(db.String(6), db.ForeignKey('step.IDS'), nullable=False) 
    IDU = db.Column(db.String(6), db.ForeignKey('uom.IDU'), nullable=False) 
    ValueD = db.Column(db.Float, default=0)
    IDM = db.Column(db.String(6), db.ForeignKey('mtransp.IDM'))  
    CHK = db.Column(db.Integer, default=0)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint('IDT', 'IDE', 'IDS', 'IDD',
                                      name='_unique_datasheet_constraint'),)

# ----------------------------------------------------------------
# LIFE CYCLE INVENTORY (LCI) BACKGROUND DATA
# ----------------------------------------------------------------
class ForestryConversionFactorsFIA(db.Model):
    __tablename__ = 'forestry_conversion_factors_fia'

    materials = db.Column(db.String(17))
    species_class = db.Column(db.String(9))
    species_name = db.Column(db.String(12))
    input_unit = db.Column(db.String(26))
    output_unit = db.Column(db.String(17))
    factor = db.Column(db.Numeric(10, 9))
    ID = db.Column(db.Integer, primary_key=True, autoincrement=True)

class LCI(db.Model):
    """Standardized environmental impact factors (TRACI or similar)."""
    __tablename__ = 'lci'

    Background_process = db.Column(db.String(48), primary_key=True)
    Code = db.Column(db.String(5), primary_key=True)
    Unit = db.Column(db.String(4))
    
    # HIGH PRECISION: Numeric(16, 10) ensures small and large values are stored correctly
    GWP = db.Column(db.Numeric(16, 10))
    Smog = db.Column(db.Numeric(16, 10))
    Acidification = db.Column(db.Numeric(16, 10))
    Eutrophication = db.Column(db.Numeric(16, 10))
    Carcinogenics = db.Column(db.Numeric(16, 10))
    Non_carcinogenics = db.Column(db.Numeric(16, 10))
    Respiratory_effects = db.Column(db.Numeric(16, 10))
    Ecotoxicity = db.Column(db.Numeric(16, 10))
    Fossil_fuel_depletion = db.Column(db.Numeric(16, 10))
    Ozone_depletion = db.Column(db.Numeric(16, 10))
    Type_LCI = db.Column(db.String(15))