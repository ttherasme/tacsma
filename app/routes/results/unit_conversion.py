import pandas as pd
from app import db
from app.models import ForestryConversionFactorsFIA, UnitConversion, UnitAlias


def _normalize_unit(unit: str) -> str:
    """
    Normalize raw unit input: strip spaces and lowercase.
    """
    return str(unit).strip().lower()


def _get_alias_map():
    """
    Returns alias -> canonical mapping from DB.
    """
    aliases = UnitAlias.query.filter_by(is_active=True).all()
    return {
        row.alias_name.strip().lower(): row.canonical_unit.strip().lower()
        for row in aliases
    }


def _get_conversion_map():
    """
    Returns unit metadata from DB:
    {
        'kg': {'factor_to_si': 1.0, 'si_unit': 'kg', 'category': 'mass'},
        ...
    }
    """
    rows = UnitConversion.query.filter_by(is_active=True).all()
    return {
        row.unit_name.strip().lower(): {
            'factor_to_si': float(row.factor_to_si),
            'si_unit': row.si_unit.strip().lower(),
            'category': row.category.strip().lower()
        }
        for row in rows
    }


def _resolve_unit(unit: str) -> str:
    """
    Normalize input and resolve aliases to canonical unit.
    """
    unit = _normalize_unit(unit)
    alias_map = _get_alias_map()
    return alias_map.get(unit, unit)


# Function to convert unit-- given the value with unit and the desired (final) unit.
def unit_conversion(value, unit, final_unit='SI'):
    r"""
    Converts a given value with a specific unit to the SI unit (kg, m, m², kWh, etc.).

    :param value: The numerical value of the item.
    :param unit: The unit of the value (e.g., 'lb', 'kg', 'ton', 'ft3', etc.)
    :param final_unit: 'SI' for standard output, or any other valid unit to convert to.
    :return: The converted value.
    """
    conversion_map = _get_conversion_map()

    unit_normalized = _resolve_unit(unit)

    if unit_normalized not in conversion_map:
        raise ValueError(f"Unit '{unit}' not recognized for conversion.")

    source_factor = conversion_map[unit_normalized]['factor_to_si']
    source_si_unit = conversion_map[unit_normalized]['si_unit']
    source_category = conversion_map[unit_normalized]['category']

    if str(final_unit).strip().upper() == 'SI':
        if source_factor == 1.0 and unit_normalized == source_si_unit:
            return float(value)

        converted_value = float(value) * source_factor
        return converted_value

    final_unit_normalized = _resolve_unit(final_unit)

    if final_unit_normalized not in conversion_map:
        raise ValueError(
            f"Unit or Final unit ('{unit_normalized}' or '{final_unit_normalized}') not recognized."
        )

    target_factor = conversion_map[final_unit_normalized]['factor_to_si']
    target_si_unit = conversion_map[final_unit_normalized]['si_unit']
    target_category = conversion_map[final_unit_normalized]['category']

    if source_category != target_category or source_si_unit != target_si_unit:
        raise ValueError(
            f"Cannot convert from '{unit_normalized}' ({source_category}) "
            f"to '{final_unit_normalized}' ({target_category})."
        )

    converted_value = (float(value) * source_factor) / target_factor
    return converted_value


def clean_dataframe(df):
    # Strip whitespace and lowercase column names
    df.columns = df.columns.str.strip().str.lower()

    # Apply string cleanup only to object (string) columns
    for col in df.select_dtypes(include='object').columns:
        df[col] = df[col].map(lambda x: x.strip().lower() if isinstance(x, str) else x)

    return df


def unit_conversion_FIA(value, input_unit, output_unit, materials='roundwood', species_class='undefined', species_name='undefined'):
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

    input_unit = _normalize_unit(input_unit)
    output_unit = _normalize_unit(output_unit)
    materials = _normalize_unit(materials)
    species_class = _normalize_unit(species_class)
    species_name = _normalize_unit(species_name)

    # Optional: include material/species filtering if desired
    conversion_row = df[
        (df['input_unit'] == input_unit) &
        (df['output_unit'] == output_unit)
    ]

    if conversion_row.empty:
        conversion_row = df[
            (df['input_unit'] == output_unit) &
            (df['output_unit'] == input_unit)
        ]

        if conversion_row.empty:
            raise ValueError("No matching conversion found in FIA conversion table for the provided parameters.")

        factor_value = float(conversion_row['factor'].values[0])

        if factor_value == 0:
            print("[Warning] Conversion factor is 0. Returning converted value as 0.")
            conversion_factor = 0
        else:
            conversion_factor = 1 / factor_value
    else:
        factor_value = float(conversion_row['factor'].values[0])

        if factor_value == 0:
            print("[Warning] Conversion factor is 0. Returning converted value as 0.")
            conversion_factor = 0
        else:
            conversion_factor = factor_value

    value = float(value)
    converted_value = value * conversion_factor

    return converted_value, output_unit


def get_si_unit(unit):
    """
    Returns the corresponding SI unit for a given input unit.

    :param unit: The input unit (e.g., 'lb', 'ft3', 'g', 'ton', etc.)
    :return: The equivalent SI unit (e.g., 'kg', 'm3', etc.)
    """
    conversion_map = _get_conversion_map()

    unit_normalized = _resolve_unit(unit)

    if unit_normalized not in conversion_map:
        raise ValueError(f"SI equivalent not found for unit: '{unit}'")

    return conversion_map[unit_normalized]['si_unit']