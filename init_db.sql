-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS tacsma;
USE tacsma;

-- Create Tasks table with custom IDT (no AUTO_INCREMENT)
CREATE TABLE IF NOT EXISTS Tasks (
    IDT INT PRIMARY KEY,
    TName VARCHAR(150) NOT NULL,
    Description VARCHAR(250),
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25)
);

-- Create Item table with IDI to be set by a trigger
CREATE TABLE IF NOT EXISTS Item (
    IDI CHAR(6) PRIMARY KEY,
    IName VARCHAR(100) UNIQUE NOT NULL
);

-- Create Step table
CREATE TABLE IF NOT EXISTS Step (
    IDS CHAR(6) PRIMARY KEY,
    SName VARCHAR(50) UNIQUE NOT NULL,
    State INT DEFAULT 1,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25)
);

-- Create UOM table
CREATE TABLE IF NOT EXISTS UOM (
    IDU CHAR(6) PRIMARY KEY,
    UName VARCHAR(20) NOT NULL,
    Unit CHAR(5) NOT NULL,
    `State` INT DEFAULT 1,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25),
    INDEX idx_uname_unit (UName, Unit)
);

-- Create MTransp table
CREATE TABLE IF NOT EXISTS MTransp (
    IDM CHAR(6) PRIMARY KEY,
    MTName VARCHAR(50) NOT NULL,
    State INT DEFAULT 1,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25)
);

-- Create user table (note: `User` is a reserved word)
CREATE TABLE IF NOT EXISTS `User` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(25) NOT NULL UNIQUE,
    password VARCHAR(256) NOT NULL,
    state TINYINT(1) NOT NULL DEFAULT 1,
    level INT NOT NULL DEFAULT 0,
    `change` INT NOT NULL DEFAULT 1
);

-- Create Element table
CREATE TABLE IF NOT EXISTS Element (
    IDE INT PRIMARY KEY,
    EName VARCHAR(30) NOT NULL,
    IDI CHAR(6) NOT NULL,
    FOREIGN KEY (IDI) REFERENCES Item (IDI),
    INDEX idx_ename_idi (EName, IDI)
);

-- Create Datasheet table
CREATE TABLE IF NOT EXISTS Datasheet (
    IDD INT AUTO_INCREMENT PRIMARY KEY,
    IDT Int NOT NULL,
    IDE INT NOT NULL,
    IDS CHAR(6) NOT NULL,
    IDU1 CHAR(6) NOT NULL,
    ValueD1 FLOAT DEFAULT 0,
    IDU2 CHAR(6),
    ValueD2 FLOAT DEFAULT 0,
    IDM CHAR(6),
    CHK INT DEFAULT 0,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25),
    FOREIGN KEY (IDE) REFERENCES Element (IDE),
    FOREIGN KEY (IDU1) REFERENCES UOM (IDU),
    FOREIGN KEY (IDU2) REFERENCES UOM (IDU),
    FOREIGN KEY (IDS) REFERENCES Step (IDS),
    FOREIGN KEY (IDM) REFERENCES MTransp (IDM),
    FOREIGN KEY (IDT) References Tasks (IDT)
);

CREATE TABLE IF NOT EXISTS `forestry_conversion_factors_fia` (
  ID INT AUTO_INCREMENT PRIMARY KEY,,
  `materials` varchar(17) DEFAULT NULL,
  `species_class` varchar(9) DEFAULT NULL,
  `species_name` varchar(12) DEFAULT NULL,
  `input_unit` varchar(26) DEFAULT NULL,
  `output_unit` varchar(17) DEFAULT NULL,
  `factor` decimal(10,9) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS `lci` (
  `Background_process` varchar(48) DEFAULT NULL,
  `Code` varchar(5) NOT NULL PRIMARY KEY,
  `Unit` varchar(4) DEFAULT NULL,
  `GWP` decimal(10,9) DEFAULT NULL,
  `Smog` decimal(10,9) DEFAULT NULL,
  `Acidification` decimal(10,9) DEFAULT NULL,
  `Eutrophication` decimal(10,9) DEFAULT NULL,
  `Carcinogenics` decimal(7,6) DEFAULT NULL,
  `Non_carcinogenics` decimal(7,6) DEFAULT NULL,
  `Respiratory_effects` decimal(10,9) DEFAULT NULL,
  `Ecotoxicity` decimal(10,9) DEFAULT NULL,
  `Fossil_fuel_depletion` decimal(10,9) DEFAULT NULL,
  `Ozone_depletion` decimal(7,6) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS `matrix_a_raw` (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  `Flow` varchar(26) DEFAULT NULL,
  `flow ID` varchar(5) DEFAULT NULL,
  `Process 1` varchar(5) DEFAULT NULL,
  `Unit 1` varchar(3) DEFAULT NULL,
  `Process 2` varchar(5) DEFAULT NULL,
  `Unit 2` varchar(3) DEFAULT NULL,
  `Process 3` varchar(5) DEFAULT NULL,
  `Unit 3` varchar(3) DEFAULT NULL,
  `Process 4` varchar(5) DEFAULT NULL,
  `Unit 4` varchar(3) DEFAULT NULL,
  `Process 5` varchar(5) DEFAULT NULL,
  `Unit 5` varchar(3) DEFAULT NULL,
  `Process 6` varchar(5) DEFAULT NULL,
  `Unit 6` varchar(3) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS `matrix_b` (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  `Background process` varchar(48) DEFAULT NULL,
  `Code` varchar(5) DEFAULT NULL,
  `Unit` varchar(3) DEFAULT NULL,
  `Process_1` varchar(5) DEFAULT NULL,
  `Process_2` varchar(5) DEFAULT NULL,
  `Process_3` varchar(5) DEFAULT NULL,
  `Process_4` varchar(5) DEFAULT NULL,
  `Process_6` varchar(5) DEFAULT NULL,
  `Process_5` varchar(5) DEFAULT NULL
);

-- Trigger: Auto-generate IDI for Item
DELIMITER $$

CREATE TRIGGER before_insert_item
BEFORE INSERT ON Item
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('I', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDI, 2) AS UNSIGNED)), 0) + 1 FROM Item), 4, '0'));
    SET NEW.IDI = new_id;
END $$

DELIMITER ;

-- Trigger: Auto-generate IDS for Step
DELIMITER $$

CREATE TRIGGER before_insert_step
BEFORE INSERT ON Step
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('S', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDS, 2) AS UNSIGNED)), 0) + 1 FROM Step), 4, '0'));
    SET NEW.IDS = new_id;
END $$

DELIMITER ;

-- Trigger: Auto-generate IDU for UOM
DELIMITER $$

CREATE TRIGGER before_insert_uom
BEFORE INSERT ON UOM
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('U', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDU, 2) AS UNSIGNED)), 0) + 1 FROM UOM), 4, '0'));
    SET NEW.IDU = new_id;
END $$

DELIMITER ;

-- Trigger: Auto-generate IDM for MTransp
DELIMITER $$

CREATE TRIGGER before_insert_mtransp
BEFORE INSERT ON MTransp
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('M', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDM, 2) AS UNSIGNED)), 0) + 1 FROM MTransp), 4, '0'));
    SET NEW.IDM = new_id;
END $$

DELIMITER ;

-- Trigger: Custom ID generation for Tasks.IDT (no three consecutive identical digits)
DELIMITER $$

CREATE TRIGGER before_insert_task
BEFORE INSERT ON Tasks
FOR EACH ROW
BEGIN
    DECLARE new_id INT;
    DECLARE id_str VARCHAR(10);
    SET new_id = (SELECT IFNULL(MAX(IDT), 99) + 1 FROM Tasks);
    SET id_str = CAST(new_id AS CHAR);

    WHILE LENGTH(id_str) < 3 OR id_str LIKE '%000%' OR id_str LIKE '%111%' OR id_str LIKE '%222%' OR
          id_str LIKE '%333%' OR id_str LIKE '%444%' OR id_str LIKE '%555%' OR id_str LIKE '%666%' OR
          id_str LIKE '%777%' OR id_str LIKE '%888%' OR id_str LIKE '%999%' DO
        SET new_id = new_id + 1;
        SET id_str = CAST(new_id AS CHAR);
    END WHILE;

    SET NEW.IDT = new_id;
END $$

DELIMITER ;

-- Trigger: Custom ID generation for Element.IDE (no three consecutive identical digits)
DELIMITER $$

CREATE TRIGGER before_insert_element
BEFORE INSERT ON Element
FOR EACH ROW
BEGIN
    DECLARE new_id INT;
    DECLARE id_str VARCHAR(10);
    SET new_id = (SELECT IFNULL(MAX(IDE), 99) + 1 FROM Element);
    SET id_str = CAST(new_id AS CHAR);

    WHILE LENGTH(id_str) < 3 OR id_str LIKE '%000%' OR id_str LIKE '%111%' OR id_str LIKE '%222%' OR
          id_str LIKE '%333%' OR id_str LIKE '%444%' OR id_str LIKE '%555%' OR id_str LIKE '%666%' OR
          id_str LIKE '%777%' OR id_str LIKE '%888%' OR id_str LIKE '%999%' DO
        SET new_id = new_id + 1;
        SET id_str = CAST(new_id AS CHAR);
    END WHILE;

    SET NEW.IDE = new_id;
END $$

DELIMITER ;

-- Insert data into Item table
INSERT INTO Item (IName) VALUES
('Product'),
('Co-Products'),
('Input Materials and Resources'),
('Input Energy'),
('Emissions'),
('Waste Treatment'),
('Results');

-- Insert data into Step table
INSERT INTO Step (SName, State) VALUES
('Forest Operation', 1),
('Transportation', 1),
('Wood Processing', 1);
