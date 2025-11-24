-- Table: parameter
CREATE TABLE parameter (
    id SERIAL PRIMARY KEY,
    parameter_name VARCHAR(100) NOT NULL UNIQUE,
    parameter_default FLOAT DEFAULT 0,
    parameter_unit VARCHAR(20) NOT NULL
);

-- Table: user (quoted because it's a reserved word)
CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    username VARCHAR(25) NOT NULL UNIQUE,
    password VARCHAR(256) NOT NULL,
    state BOOLEAN DEFAULT TRUE,
    level INTEGER DEFAULT 0,
    change INTEGER DEFAULT 1,
    regeneration_mode BOOLEAN DEFAULT FALSE
);

-- Table: user_parameter_value
CREATE TABLE user_parameter_value (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    parameter_id INTEGER NOT NULL,
    value FLOAT DEFAULT 0,
    CONSTRAINT _user_parameter_uc UNIQUE (user_id, parameter_id),
    CONSTRAINT fk_user_param_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_param_param FOREIGN KEY (parameter_id) REFERENCES parameter(id) ON DELETE CASCADE
);

-- Table: permission_rule
CREATE TABLE permission_rule (
    id SERIAL PRIMARY KEY,
    access_level INTEGER NOT NULL,
    page_name VARCHAR(50) NOT NULL,
    element_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    CONSTRAINT _unique_permission_rule UNIQUE (access_level, page_name, element_id, action_type)
);

-- Table: tasks
CREATE TABLE tasks (
    IDT SERIAL PRIMARY KEY,
    TName VARCHAR(150) NOT NULL,
    Description VARCHAR(250),
    EntryDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25)
);

-- Table: item
CREATE TABLE item (
    IDI VARCHAR(6) PRIMARY KEY,
    IName VARCHAR(100) NOT NULL UNIQUE
);

-- Table: step
CREATE TABLE step (
    IDS VARCHAR(6) PRIMARY KEY,
    SName VARCHAR(50) NOT NULL UNIQUE,
    State INTEGER DEFAULT 1,
    EntryDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25)
);

-- Table: uom
CREATE TABLE uom (
    IDU VARCHAR(6) PRIMARY KEY,
    UName VARCHAR(20) NOT NULL,
    Unit VARCHAR(5) NOT NULL,
    State INTEGER DEFAULT 1,
    EntryDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25)
);

-- Table: mtransp
CREATE TABLE mtransp (
    IDM VARCHAR(6) PRIMARY KEY,
    MTName VARCHAR(50) NOT NULL,
    State INTEGER DEFAULT 1,
    EntryDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(50),
    UpdateDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(50)
);

-- Table: element
CREATE TABLE element (
    IDE SERIAL PRIMARY KEY,
    EName VARCHAR(30) NOT NULL,
    IDI VARCHAR(6) NOT NULL,
    CONSTRAINT fk_element_item FOREIGN KEY (IDI) REFERENCES item(IDI) ON DELETE CASCADE
);

-- Table: datasheet
CREATE TABLE datasheet (
    IDD SERIAL PRIMARY KEY,
    IDT INTEGER NOT NULL,
    IDE INTEGER NOT NULL,
    IDS VARCHAR(6) NOT NULL,
    IDU1 VARCHAR(6) NOT NULL,
    ValueD1 FLOAT DEFAULT 0,
    IDU2 VARCHAR(6),
    ValueD2 FLOAT DEFAULT 0,
    IDM VARCHAR(6),
    CHK INTEGER DEFAULT 0,
    EntryDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25),
    CONSTRAINT fk_datasheet_tasks FOREIGN KEY (IDT) REFERENCES tasks(IDT),
    CONSTRAINT fk_datasheet_element FOREIGN KEY (IDE) REFERENCES element(IDE),
    CONSTRAINT fk_datasheet_step FOREIGN KEY (IDS) REFERENCES step(IDS),
    CONSTRAINT fk_datasheet_uom1 FOREIGN KEY (IDU1) REFERENCES uom(IDU),
    CONSTRAINT fk_datasheet_uom2 FOREIGN KEY (IDU2) REFERENCES uom(IDU),
    CONSTRAINT fk_datasheet_mtransp FOREIGN KEY (IDM) REFERENCES mtransp(IDM)
);

-- Table: forestry_conversion_factors_fia
CREATE TABLE forestry_conversion_factors_fia (
    ID SERIAL PRIMARY KEY,
    materials VARCHAR(17),
    species_class VARCHAR(9),
    species_name VARCHAR(12),
    input_unit VARCHAR(26),
    output_unit VARCHAR(17),
    factor NUMERIC(10,9)
);

-- Table: lci
CREATE TABLE lci (
    Code VARCHAR(5) PRIMARY KEY,
    Background_process VARCHAR(48),
    Unit VARCHAR(4),
    GWP NUMERIC(10,9),
    Smog NUMERIC(10,9),
    Acidification NUMERIC(10,9),
    Eutrophication NUMERIC(10,9),
    Carcinogenics NUMERIC(7,6),
    Non_carcinogenics NUMERIC(7,6),
    Respiratory_effects NUMERIC(10,9),
    Ecotoxicity NUMERIC(10,9),
    Fossil_fuel_depletion NUMERIC(10,9),
    Ozone_depletion NUMERIC(7,6)
);

-- Table: matrix_a_raw
CREATE TABLE matrix_a_raw (
    ID SERIAL PRIMARY KEY,
    Flow VARCHAR(26),
    Flow_id VARCHAR(5),
    Process_1 VARCHAR(5),
    Unit_1 VARCHAR(3),
    Process_2 VARCHAR(5),
    Unit_2 VARCHAR(3),
    Process_3 VARCHAR(5),
    Unit_3 VARCHAR(3),
    Process_4 VARCHAR(5),
    Unit_4 VARCHAR(3),
    Process_5 VARCHAR(5),
    Unit_5 VARCHAR(3),
    Process_6 VARCHAR(5),
    Unit_6 VARCHAR(3)
);

-- Table: matrix_b
CREATE TABLE matrix_b (
    ID SERIAL PRIMARY KEY,
    Background_process VARCHAR(48),
    Code VARCHAR(5),
    Unit VARCHAR(3),
    Process_1 VARCHAR(5),
    Process_2 VARCHAR(5),
    Process_3 VARCHAR(5),
    Process_4 VARCHAR(5),
    Process_5 VARCHAR(5),
    Process_6 VARCHAR(5)
);
