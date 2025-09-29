from app import db
from datetime import datetime


class User(db.Model):
    __tablename__ = 'user'  # Required because `User` is a reserved SQL keyword
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    state = db.Column(db.Boolean, default=True)  # TINYINT(1)
    level = db.Column(db.Integer, default=0)
    change = db.Column(db.Integer, default=1)


class Tasks(db.Model):
    __tablename__ = 'tasks'
    IDT = db.Column(db.Integer, primary_key=True)
    TName = db.Column(db.String(150), nullable=False)
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
    IDI = db.Column(db.String(6), db.ForeignKey('item.IDI'), nullable=False)  # fixed FK table name here

    datasheets = db.relationship('Datasheet', backref='element', lazy=True)


class Datasheet(db.Model):
    __tablename__ = 'datasheet'
    IDD = db.Column(db.Integer, primary_key=True, autoincrement=True)
    IDT = db.Column(db.Integer, db.ForeignKey('tasks.IDT'), nullable=False)
    IDE = db.Column(db.Integer, db.ForeignKey('element.IDE'), nullable=False)  # fixed FK table name here
    IDS = db.Column(db.String(6), db.ForeignKey('step.IDS'), nullable=False)  # fixed FK table name here
    IDU1 = db.Column(db.String(6), db.ForeignKey('uom.IDU'), nullable=False)  # fixed FK table name here
    ValueD1 = db.Column(db.Float, default=0)
    IDU2 = db.Column(db.String(6), db.ForeignKey('uom.IDU'))  # fixed FK table name here
    ValueD2 = db.Column(db.Float, default=0)
    IDM = db.Column(db.String(6), db.ForeignKey('mtransp.IDM'))  # fixed FK table name here
    CHK = db.Column(db.Integer, default=0)
    EntryDate = db.Column(db.DateTime, default=datetime.utcnow)
    EnterBy = db.Column(db.String(25))
    UpdateDate = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    UpdateBy = db.Column(db.String(25))

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

