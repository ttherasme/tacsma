-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS tacsma;
USE tacsma;

CREATE TABLE `parameter` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `parameter_name` VARCHAR(100) NOT NULL UNIQUE,
    `parameter_default` FLOAT DEFAULT 0,
    `parameter_unit` VARCHAR(20) NOT NULL
);

CREATE TABLE `user` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(25) NOT NULL UNIQUE,
    `password` VARCHAR(256) NOT NULL,
    `state` BOOLEAN DEFAULT TRUE,
    `level` INT DEFAULT 0,
    `change` INT DEFAULT 1,
    `regeneration_mode` Int DEFAULT 0
);

CREATE TABLE `permission_rule` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `access_level` INT NOT NULL,
    `page_name` VARCHAR(50) NOT NULL,
    `element_id` VARCHAR(100) NOT NULL,
    `action_type` VARCHAR(20) NOT NULL,

    CONSTRAINT `_unique_permission_rule` UNIQUE (`access_level`, `page_name`, `element_id`, `action_type`)
);

CREATE TABLE tasks (
    IDT INT PRIMARY KEY,
    TName VARCHAR(150) NOT NULL,
    Region VARCHAR(8),
    Description VARCHAR(250),
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    CONSTRAINT fk_tasks_user
        FOREIGN KEY (user_id) REFERENCES user(id)
        ON DELETE CASCADE
);

CREATE TABLE `user_parameter_value` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `parameter_id` INT NOT NULL,
    `IDT` Int NOT NULL,
    `value` FLOAT DEFAULT 0,

    CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
    CONSTRAINT `fk_parameter` FOREIGN KEY (`parameter_id`) REFERENCES `parameter` (`id`),
    CONSTRAINT `fk_task` FOREIGN KEY (`IDT`) REFERENCES `tasks` (`IDT`),

    CONSTRAINT `_user_parameter_uc` UNIQUE (`user_id`, `parameter_id`, `IDT`)
);


CREATE TABLE IF NOT EXISTS item (
    IDI CHAR(6) PRIMARY KEY,
    IName VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS step (
    IDS CHAR(6) PRIMARY KEY,
    SName VARCHAR(50) UNIQUE NOT NULL,
    State INT DEFAULT 1,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    UpdateDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdateBy VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS uom (
    IDU CHAR(6) PRIMARY KEY,
    UName VARCHAR(20) NOT NULL,
    Unit CHAR(5) NOT NULL,
    `State` INT DEFAULT 1,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25),
    INDEX idx_uname_unit (UName, Unit)
);


CREATE TABLE IF NOT EXISTS mtransp (
    IDM CHAR(6) PRIMARY KEY,
    MTName VARCHAR(50) NOT NULL,
    State INT DEFAULT 1,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    EnterBy VARCHAR(25)
);

CREATE TABLE IF NOT EXISTS element (
    IDE INT PRIMARY KEY,
    EName VARCHAR(30) NOT NULL,
    IDI VARCHAR(6) NOT NULL,
    user_id INT NOT NULL,
    Global_Val INT, default=0,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT _unique_element_constraint
        UNIQUE (EName, IDI, user_id),
    CONSTRAINT fk_element_item
        FOREIGN KEY (IDI) REFERENCES item(IDI),
    CONSTRAINT fk_element_user
        FOREIGN KEY (user_id) REFERENCES `user` (`id`)
); 


CREATE TABLE datasheet (
    IDD INT AUTO_INCREMENT PRIMARY KEY,
    IDT INT NOT NULL,
    IDE INT NOT NULL,
    IDS VARCHAR(6) NOT NULL,
    IDU VARCHAR(6) NOT NULL,
    ValueD FLOAT DEFAULT 0,
    IDM VARCHAR(6),
    CHK INT DEFAULT 0,
    EntryDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    UpdateDate DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT _unique_datasheet_constraint
        UNIQUE (IDT, IDE, IDS),
    CONSTRAINT fk_ds_task
        FOREIGN KEY (IDT) REFERENCES tasks(IDT),
    CONSTRAINT fk_ds_element
        FOREIGN KEY (IDE) REFERENCES element(IDE),
    CONSTRAINT fk_ds_step
        FOREIGN KEY (IDS) REFERENCES step(IDS),
    CONSTRAINT fk_ds_uom
        FOREIGN KEY (IDU) REFERENCES uom(IDU),
    CONSTRAINT fk_ds_mtransp
        FOREIGN KEY (IDM) REFERENCES mtransp(IDM),
    CONSTRAINT fk_ds_user
        FOREIGN KEY (user_id) REFERENCES user(id)
);


CREATE TABLE forestry_conversion_factors_fia (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    materials VARCHAR(17),
    species_class VARCHAR(9),
    species_name VARCHAR(12),
    input_unit VARCHAR(26),
    output_unit VARCHAR(17),
    factor DECIMAL(10,9)
) ENGINE=InnoDB;

CREATE TABLE lci (
    Background_process VARCHAR(48) NOT NULL,
    Code VARCHAR(5) NOT NULL,
    Unit VARCHAR(4),
    GWP DECIMAL(16,10),
    Smog DECIMAL(16,10),
    Acidification DECIMAL(16,10),
    Eutrophication DECIMAL(16,10),
    Carcinogenics DECIMAL(16,10),
    Non_carcinogenics DECIMAL(16,10),
    Respiratory_effects DECIMAL(16,10),
    Ecotoxicity DECIMAL(16,10),
    Fossil_fuel_depletion DECIMAL(16,10),
    Ozone_depletion DECIMAL(16,10),
    PRIMARY KEY (Background_process, Code)
) ENGINE=InnoDB;


-- Trigger: Auto-generate IDI for Item
DELIMITER $$

CREATE TRIGGER before_insert_item
BEFORE INSERT ON item
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('I', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDI, 2) AS UNSIGNED)), 0) + 1 FROM item), 4, '0'));
    SET NEW.IDI = new_id;
END $$

DELIMITER ;

-- Trigger: Auto-generate IDS for Step
DELIMITER $$

CREATE TRIGGER before_insert_step
BEFORE INSERT ON step
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('S', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDS, 2) AS UNSIGNED)), 0) + 1 FROM step), 4, '0'));
    SET NEW.IDS = new_id;
END $$

DELIMITER ;

-- Trigger: Auto-generate IDU for UOM
DELIMITER $$

CREATE TRIGGER before_insert_uom
BEFORE INSERT ON uom
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('U', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDU, 2) AS UNSIGNED)), 0) + 1 FROM uom), 4, '0'));
    SET NEW.IDU = new_id;
END $$

DELIMITER ;

-- Trigger: Auto-generate IDM for MTransp
DELIMITER $$

CREATE TRIGGER before_insert_mtransp
BEFORE INSERT ON mtransp
FOR EACH ROW
BEGIN
    DECLARE new_id VARCHAR(6);
    SET new_id = CONCAT('M', LPAD((SELECT IFNULL(MAX(CAST(SUBSTRING(IDM, 2) AS UNSIGNED)), 0) + 1 FROM mtransp), 4, '0'));
    SET NEW.IDM = new_id;
END $$

DELIMITER ;

-- Trigger: Custom ID generation for Tasks.IDT (no three consecutive identical digits)
DELIMITER $$

CREATE TRIGGER before_insert_task
BEFORE INSERT ON tasks
FOR EACH ROW
BEGIN
    DECLARE new_id INT;
    DECLARE id_str VARCHAR(10);
    SET new_id = (SELECT IFNULL(MAX(IDT), 99) + 1 FROM tasks);
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
BEFORE INSERT ON element
FOR EACH ROW
BEGIN
    DECLARE new_id INT;
    DECLARE id_str VARCHAR(10);
    SET new_id = (SELECT IFNULL(MAX(IDE), 99) + 1 FROM element);
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
INSERT INTO item (IName) VALUES
('Product'),
('Co-Products'),
('Input Materials and Energy'),
('Emissions'),
('Waste Treatment'),
('Results'),
('LCI');

-- Insert data into Step table
INSERT INTO step (SName, State) VALUES
('Forest Operation', 1),
('Transportation', 1),
('Wood Processing', 1);
