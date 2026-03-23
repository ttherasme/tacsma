-- Optional: create database
-- CREATE DATABASE your_database_name;
-- USE your_database_name;

DROP TABLE IF EXISTS unit_alias;
DROP TABLE IF EXISTS unit_conversion;

CREATE TABLE unit_conversion (
    id INT PRIMARY KEY,
    unit_name VARCHAR(50) NOT NULL UNIQUE,
    factor_to_si DOUBLE NOT NULL,
    si_unit VARCHAR(20) NOT NULL,
    category VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE unit_alias (
    id INT PRIMARY KEY,
    alias_name VARCHAR(50) NOT NULL UNIQUE,
    canonical_unit VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_unit_alias_canonical_unit
        FOREIGN KEY (canonical_unit)
        REFERENCES unit_conversion(unit_name)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional helpful index
CREATE INDEX idx_unit_conversion_category ON unit_conversion(category);
CREATE INDEX idx_unit_alias_canonical_unit ON unit_alias(canonical_unit);

-- Insert unit_conversion data
INSERT INTO unit_conversion (unit_name, factor_to_si, si_unit, category, is_active) VALUES
    -- Mass
    ('lb', 0.453592, 'kg', 'mass', TRUE),
    ('ton', 907.18474, 'kg', 'mass', TRUE),
    ('metric_ton', 1000.0, 'kg', 'mass', TRUE),
    ('mg', 0.000001, 'kg', 'mass', TRUE),
    ('g', 0.001, 'kg', 'mass', TRUE),
    ('kg', 1.0, 'kg', 'mass', TRUE),
    ('oz', 0.0283495, 'kg', 'mass', TRUE),

    -- Volume
    ('ft3', 0.0283168, 'm3', 'volume', TRUE),
    ('m3', 1.0, 'm3', 'volume', TRUE),
    ('gal', 0.00378541, 'm3', 'volume', TRUE),
    ('liter', 0.001, 'm3', 'volume', TRUE),
    ('barrel', 0.158987, 'm3', 'volume', TRUE),
    ('yd3', 0.7646, 'm3', 'volume', TRUE),
    ('cm3', 0.000001, 'm3', 'volume', TRUE),

    -- Area
    ('ft2', 0.092903, 'm2', 'area', TRUE),
    ('m2', 1.0, 'm2', 'area', TRUE),
    ('km2', 1000000.0, 'm2', 'area', TRUE),
    ('acre', 4046.86, 'm2', 'area', TRUE),
    ('ha', 10000.0, 'm2', 'area', TRUE),
    ('yd2', 0.836127, 'm2', 'area', TRUE),

    -- Length
    ('ft', 0.3048, 'm', 'length', TRUE),
    ('m', 1.0, 'm', 'length', TRUE),
    ('inch', 0.0254, 'm', 'length', TRUE),
    ('yard', 0.9144, 'm', 'length', TRUE),
    ('mile', 1609.34, 'm', 'length', TRUE),
    ('km', 1000.0, 'm', 'length', TRUE),

    -- Energy
    ('kwh', 1.0, 'kwh', 'energy', TRUE),
    ('btu', 0.000293071, 'kwh', 'energy', TRUE),
    ('kcal', 0.000001163, 'kwh', 'energy', TRUE),
    ('joule', 0.00000027778, 'kwh', 'energy', TRUE),
    ('mbtu', 0.293071, 'kwh', 'energy', TRUE),
    ('mmbtu', 293.071, 'kwh', 'energy', TRUE),

    -- Transport
    ('tkm', 1000.0, 'kgkm', 'transport', TRUE),
    ('tmi', 1609.34, 'kgkm', 'transport', TRUE),
    ('kgkm', 1.0, 'kgkm', 'transport', TRUE),

    -- Forestry
    ('cord', 3.62456, 'm3', 'volume', TRUE),
    ('mbf', 2.362, 'm3', 'volume', TRUE);

-- Insert unit_alias data
INSERT INTO unit_alias (alias_name, canonical_unit, is_active) VALUES
    ('cubic_meters', 'm3', TRUE),
    ('cubic_feet', 'ft3', TRUE),
    ('dry_tons', 'ton', TRUE),
    ('green_metric_tonnes', 'metric_ton', TRUE),
    ('dry_metric_tonnes', 'metric_ton', TRUE),
    ('gallon', 'gal', TRUE),
    ('litre', 'liter', TRUE),
    ('mbf_international', 'mbf', TRUE),
    ('mt', 'metric_ton', TRUE),
    ('feet', 'ft', TRUE),
    ('in', 'inch', TRUE),
    ('j', 'joule', TRUE),
    ('lbs', 'lb', TRUE),
    ('pound', 'lb', TRUE);