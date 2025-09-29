
import os
import pandas as pd
from app import db
from app.models import ForestryConversionFactorsFIA

# Function to convert unit-- given the value with unit and the desired (final) unit.
def unit_conversion(value, unit, final_unit='SI'):
    r"""
    Converts a given value with a specific unit to the SI unit (kg, m, m², kWh, etc.).

    :param value: The numerical value of the item.
    :param unit: The unit of the value (e.g., 'lb', 'kg', 'ton', 'ft3', etc.)
    :param final_unit: 'SI' for standard output, or any other valid unit to convert to.
    :return: The converted value.
    """
    
    # Function to convert unit-- given the value with unit and the desired (final) unit.
    
    conversion_dict = {
        # Mass (kg)
        'lb': 0.453592, 'ton': 907.18474, 'metric_ton': 1000.0, 'Mg': 1000.0,
        'g': 0.001, 'kg': 1.0, 'mg': 0.000001, 'oz': 0.0283495, 'short_ton': 907.18474,

        # Volume (m³)
        'ft3': 0.0283168, 'm3': 1.0, 'gal': 0.00378541, 'liter': 0.001, 
        'barrel': 0.158987, 'yd3': 0.7646,'cm3':	0.000001,

        # Area (m²)
        'ft2': 0.092903, 'm2': 1.0, 'km2': 1_000_000.0, 'acre': 4046.86, 
        'ha': 10000, 'yd2': 0.836127,

        # Length (m)
        'ft': 0.3048, 'm': 1.0, 'inch': 0.0254, 'yard': 0.9144, 'mile': 1609.34,

        # Electricity (kWh), Energy
        'kWh': 1.0, 'BTU': 0.000293071, 'kcal': 0.000001163, 'joule': 2.7778e-7,

        # Transport (kg·km)
        'tkm': 1000.0, 'tmi': 1600.0, 'kgkm': 1.0,

        # Forestry Specific Units (Volume)
        'cord': 3.62456, 'MBF': 2.362, 'Mbf': 2.362,

        # Energy (kWh)
        'MBTU': 0.000293071, 'MMBTU': 0.000293071,
    }

    # Mapping of alternative unit names to canonical ones
    unit_aliases = {
        'cubic_meters': 'm3',
        'cubic_feet': 'ft3',
        'green_tons': 'ton',
        'dry_tons': 'ton',
        'dry_metric_tonnes': 'metric_ton',
        'green_metric_tonnes': 'metric_ton'
    }

    # Normalize unit using alias mapping
    unit = unit_aliases.get(unit, unit)

    if unit not in conversion_dict:
        raise ValueError(f"Unit '{unit}' not recognized for conversion.")

    if final_unit == 'SI':
        converted_value = float(value) * conversion_dict[unit]
    else:
        final_unit = unit_aliases.get(final_unit, final_unit)  # normalize final_unit too
        if final_unit not in conversion_dict:
            raise ValueError(f"Final unit '{final_unit}' not recognized.")
        converted_value = (float(value) * conversion_dict[unit]) / conversion_dict[final_unit]

   # print(f"{value} {unit} is equivalent to: {converted_value} {final_unit}")
    return converted_value

def clean_dataframe(df):
    # Strip whitespace and lowercase column names
    df.columns = df.columns.str.strip().str.lower()
    
    # Apply string cleanup only to object (string) columns
    for col in df.select_dtypes(include='object').columns:
        df[col] = df[col].map(lambda x: x.strip().lower() if isinstance(x, str) else x)

    return df

def unit_conversion_FIA(value, input_unit, output_unit, materials='roundwood', species_class='undefined', species_name='undefined'):
    # Define path to CSV
    all_factors = ForestryConversionFactorsFIA.query.all()
    df = pd.DataFrame([{
        'materials': row.materials,
        'species_class': row.species_class,
        'species_name': row.species_name,
        'input_unit': row.input_unit,
        'output_unit': row.output_unit,
        'factor': row.factor,
    } for row in all_factors])
    
    # Clean the dataframe (convert everything to lowercase and strip whitespace)
    df = clean_dataframe(df)
    
    #print("CSV Data Preview (cleaned):")
    #print(df.head())  # Preview the cleaned data
    
    # Check what parameters are being passed for filtering
    #print(f"Filtering with: materials={materials}, species_class={species_class}, species_name={species_name}, input_unit={input_unit}, output_unit={output_unit}")
    
    # Apply filtering based on the cleaned parameters
    conversion_row = df[(df['input_unit'] == input_unit) & (df['output_unit'] == output_unit)]
    
    #print("Filtered Data based on input_unit and output_unit:")
    #print(conversion_row)
    
    if conversion_row.empty:
        # Try reverse direction
        conversion_row = df[(df['input_unit'] == output_unit) & (df['output_unit'] == input_unit)]
        if conversion_row.empty:
            raise ValueError("No matching conversion found in the CSV for the provided parameters.")
        
        factor_value = conversion_row['factor'].values[0]
    
        if factor_value == 0:
            print("[Warning] Conversion factor is 0. Returning converted value as 0.")
            conversion_factor = 0
        else:
            conversion_factor = 1 / factor_value  # Reverse the factor
    else:
        factor_value = conversion_row['factor'].values[0]
    
        if factor_value == 0:
            print("[Warning] Conversion factor is 0. Returning converted value as 0.")
            conversion_factor = 0
        else:
            conversion_factor = factor_value  # Use as-is

    
    # Perform the conversion
    value=float(value)
    converted_value = value * conversion_factor
    
    #print(f"{value} {input_unit} is equivalent to {converted_value} {output_unit}")
    
    return converted_value, output_unit


##the goal for this function is to check the property of the flow and return the SI unit. will get back to this.



def get_si_unit(unit):
    """
    Returns the corresponding SI unit for a given input unit.
    
    :param unit: The input unit (e.g., 'lb', 'ft3', 'g', 'ton', etc.)
    :return: The equivalent SI unit (e.g., 'kg', 'm3', etc.)
    """
    unit = unit.strip().lower()

    # Map of units to their SI equivalents
    si_unit_map = {
        # Mass
        'lb': 'kg',
        'pound': 'kg',
        'lbs': 'kg',
        'ton': 'kg',
        'short_ton': 'kg',
        'metric_ton': 'kg',
        'dry_tons': 'kg',
        'green_tons': 'kg',
        'mg': 'kg',
        'g': 'kg',
        'kg': 'kg',
        'oz': 'kg',
        'mg': 'kg',
        'mg.': 'kg',
        'mgm': 'kg',
        'mt': 'kg',
        'mg': 'kg',
        'Mg': 'kg',

        # Volume
        'ft3': 'm3',
        'cubic_feet': 'm3',
        'cubic_meters': 'm3',
        'm3': 'm3',
        'cm3':'m3',
        'gal': 'm3',
        'gallon': 'm3',
        'liter': 'm3',
        'litre': 'm3',
        'barrel': 'm3',
        'board_foot': 'm3',
        'cord': 'm3',
        'mbf': 'kg',#prefered to convert the volume of log into Mass
        'mbf_international': 'kg',#prefered to convert the volume of log into Mass
        'yd3': 'm3',

        # Area
        'ft2': 'm2',
        'm2': 'm2',
        'km2': 'm2',
        'acre': 'm2',
        'ha': 'm2',
        'yd2': 'm2',

        # Length
        'ft': 'm',
        'feet': 'm',
        'm': 'm',
        'inch': 'm',
        'in': 'm',
        'yard': 'm',
        'mile': 'm',

        # Energy
        'kwh': 'kwh',
        'btu': 'kwh',
        'mbtu': 'kwh',
        'mmbtu': 'kwh',
        'kcal': 'kwh',
        'joule': 'kwh',
        'j': 'kwh',

        # Transport
        'tkm': 'kgkm',
        'tmi': 'kgkm',
        'kgkm': 'kgkm',
    }

    # Normalize the unit key
    unit_normalized = unit.lower().strip()

    # Lookup
    si_unit = si_unit_map.get(unit_normalized)
    
    if not si_unit:
        raise ValueError(f"SI equivalent not found for unit: '{unit}'")
    
    return si_unit
