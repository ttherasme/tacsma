from app import db
from datetime import datetime


# app/models.py (Updated)
from app import db
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.orm import aliased


class Parameter(db.Model):
    __tablename__ = 'parameter'
    id = db.Column(db.Integer, primary_key=True)
    parameter_name = db.Column(db.String(100), unique=True, nullable=False)
    parameter_default = db.Column(db.Float, default=0)
    parameter_unit = db.Column(db.String(20), nullable=False)
    
    user_values = db.relationship('UserParameterValue', backref='parameter', lazy=True)


class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    state = db.Column(db.Boolean, default=True)
    level = db.Column(db.Integer, default=0)
    change = db.Column(db.Integer, default=1)
    # True = Yes (use Value), False = No (use Default)
    regeneration_mode = db.Column(db.Boolean, default=False) 

    # Define a relationship to the per-user parameter values
    param_values = db.relationship('UserParameterValue', backref='user', lazy=True)


class UserParameterValue(db.Model):
    __tablename__ = 'user_parameter_value'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey('parameter.id'), nullable=False)
    IDT = db.Column(db.Integer, db.ForeignKey('tasks.IDT'), nullable=False)
    value = db.Column(db.Float, default=0)

    __table_args__ = (UniqueConstraint('user_id', 'parameter_id', 'IDT', name='_user_parameter_uc'),)

class PermissionRule(db.Model):
    __tablename__ = 'permission_rule'
    id = db.Column(db.Integer, primary_key=True)
    
    # The Level this rule applies to (1, 2, 3, 4, 5)
    access_level = db.Column(db.Integer, nullable=False)
    
    # The page the rule applies to (e.g., 'parameters', 'results', 'user_levels')
    page_name = db.Column(db.String(50), nullable=False)
    
    # The specific element/field ID on that page (e.g., 'reset-to-default', 'editable-value')
    element_id = db.Column(db.String(100), nullable=False)
    
    # The type of action granted: 'view', 'click', 'enable', 'dropdown'
    action_type = db.Column(db.String(20), nullable=False)
    
    # Ensures no duplicate rule exists for the same combination
    __table_args__ = (UniqueConstraint('access_level', 'page_name', 'element_id', 'action_type', 
                                       name='_unique_permission_rule'),)

class Tasks(db.Model):
    __tablename__ = 'tasks'
    IDT = db.Column(db.Integer, primary_key=True)
    TName = db.Column(db.String(150), nullable=False)
    Region = db.Column(db.String(8))
    Description = db.Column(db.String(250))
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))

    datasheets = db.relationship('Datasheet', backref='tasks', lazy=True)


class Item(db.Model):
    __tablename__ = 'item'
    IDI = db.Column(db.String(6), primary_key=True)
    IName = db.Column(db.String(100), unique=True, nullable=False)

    # Relationships
    elements = db.relationship('Element', backref='item', lazy=True)


class Step(db.Model):
    __tablename__ = 'step'
    IDS = db.Column(db.String(6), primary_key=True)
    SName = db.Column(db.String(50), unique=True, nullable=False)
    State = db.Column(db.Integer, default=1)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    UpdateBy = db.Column(db.String(25))

    datasheets = db.relationship('Datasheet', backref='step', lazy=True)


class UOM(db.Model):
    __tablename__ = 'uom'
    IDU = db.Column(db.String(6), primary_key=True)
    UName = db.Column(db.String(20), nullable=False)
    Unit = db.Column(db.String(5), nullable=False)
    State = db.Column(db.Integer, default=1)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    UpdateBy = db.Column(db.String(25))

    datasheets_u1 = db.relationship('Datasheet', foreign_keys='Datasheet.IDU1', backref='uom1', lazy=True)
    datasheets_u2 = db.relationship('Datasheet', foreign_keys='Datasheet.IDU2', backref='uom2', lazy=True)


class MTransp(db.Model):
    __tablename__ = 'mtransp'
    IDM = db.Column(db.String(6), primary_key=True)
    MTName = db.Column(db.String(50), nullable=False)
    State = db.Column(db.Integer, default=1)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(50))
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    UpdateBy = db.Column(db.String(50))

    datasheets = db.relationship('Datasheet', backref='mtransp', lazy=True)


class Element(db.Model):
    __tablename__ = 'element'
    IDE = db.Column(db.Integer, primary_key=True)
    EName = db.Column(db.String(30), nullable=False)
    IDI = db.Column(db.String(6), db.ForeignKey('item.IDI'), nullable=False)
    Enterby = db.Column(db.String(25))

    __table_args__ = (UniqueConstraint('EName', 'IDI', 'Enterby', 
                                       name='_unique_element_constraint'),)
    datasheets = db.relationship('Datasheet', backref='element', lazy=True)


class Datasheet(db.Model):
    __tablename__ = 'datasheet'
    IDD = db.Column(db.Integer, primary_key=True, autoincrement=True)
    IDT = db.Column(db.Integer, db.ForeignKey('tasks.IDT'), nullable=False)
    IDE = db.Column(db.Integer, db.ForeignKey('element.IDE'), nullable=False) 
    IDS = db.Column(db.String(6), db.ForeignKey('step.IDS'), nullable=False) 
    IDU1 = db.Column(db.String(6), db.ForeignKey('uom.IDU'), nullable=False) 
    ValueD1 = db.Column(db.Float, default=0)
    IDU2 = db.Column(db.String(6), db.ForeignKey('uom.IDU'))
    ValueD2 = db.Column(db.Float, default=0)
    IDM = db.Column(db.String(6), db.ForeignKey('mtransp.IDM'))  
    CHK = db.Column(db.Integer, default=0)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    UpdateBy = db.Column(db.String(25))
    __table_args__ = (UniqueConstraint('IDT', 'IDE', 'IDS', 
                                       name='_unique_datasheet_constraint'),)

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
    __tablename__ = 'lci'

    Background_process = db.Column(db.String(48))
    Code = db.Column(db.String(5), primary_key=True)
    Unit = db.Column(db.String(4))
    GWP = db.Column(db.Numeric(10, 9))
    Smog = db.Column(db.Numeric(10, 9))
    Acidification = db.Column(db.Numeric(10, 9))
    Eutrophication = db.Column(db.Numeric(10, 9))
    Carcinogenics = db.Column(db.Numeric(7, 6))
    Non_carcinogenics = db.Column(db.Numeric(7, 6))
    Respiratory_effects = db.Column(db.Numeric(10, 9))
    Ecotoxicity = db.Column(db.Numeric(10, 9))
    Fossil_fuel_depletion = db.Column(db.Numeric(10, 9))
    Ozone_depletion = db.Column(db.Numeric(7, 6))

class MatrixARaw(db.Model):
    __tablename__ = 'matrix_a_raw'

    Flow = db.Column(db.String(26))
    Flow_id = db.Column(db.String(5))
    Process_1 = db.Column(db.String(5))
    Unit_1 = db.Column(db.String(3))
    Process_2 = db.Column(db.String(5))
    Unit_2 = db.Column(db.String(3))
    Process_3 = db.Column(db.String(5))
    Unit_3 = db.Column(db.String(3))
    Process_4 = db.Column(db.String(5))
    Unit_4 = db.Column(db.String(3))
    Process_5 = db.Column(db.String(5))
    Unit_5 = db.Column(db.String(3))
    Process_6 = db.Column(db.String(5))
    Unit_6 = db.Column(db.String(3))
    ID = db.Column(db.Integer, primary_key=True, autoincrement=True)

class MatrixB(db.Model):
    __tablename__ = 'matrix_b'

    Background_process = db.Column(db.String(48))
    Code = db.Column(db.String(5))
    Unit = db.Column(db.String(3))
    Process_1 = db.Column(db.String(5))
    Process_2 = db.Column(db.String(5))
    Process_3 = db.Column(db.String(5))
    Process_4 = db.Column(db.String(5))
    Process_6 = db.Column(db.String(5))
    Process_5 = db.Column(db.String(5))
    ID = db.Column(db.Integer, primary_key=True, autoincrement=True)


# Defining aliases needed for distinct joins in data_import.py
UOM1 = aliased(UOM, name='UOM1')
UOM2 = aliased(UOM, name='UOM2')