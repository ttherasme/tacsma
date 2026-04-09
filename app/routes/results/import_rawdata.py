
import os
import pandas as pd
import numpy as np
from .unit_conversion import unit_conversion, unit_conversion_FIA, get_si_unit 
from app.models import LCI
from .getdata import get_matrix_b, get_matrix_a
import logging
logger = logging.getLogger(__name__)


# Function to import the CSV, check shape, and return dataframe
def import_matrix_b(idt_param: int, sort='yes'):
    """
    Import Matrix B while preserving the original process-column order.
    A and B must keep the same process order before multifunctionality.
    """
    df = get_matrix_b(idt_param).copy()

    if df.empty:
        return df

    fixed_cols = ['Flow', 'Flow_id', 'Unit']
    process_cols = [c for c in df.columns if c not in fixed_cols]

    # Preserve original process order from get_matrix_b()
    df = df[fixed_cols + process_cols]

    if sort == 'yes':
        df = df.sort_values(by='Flow_id').reset_index(drop=True)

    return df
    

#function to read a read raw data, check unit set to SI, return the data with SI unit
def format_rawdata_a(idt_param: int, A='A'):
    df_raw = get_matrix_a(idt_param).copy()
    df_raw.columns = df_raw.columns.str.strip()

    required_cols = ['Flow', 'Flow_id', 'Unit']
    missing = [c for c in required_cols if c not in df_raw.columns]
    if missing:
        raise ValueError(f"Missing required columns in Matrix A: {missing}")

    process_columns = [col for col in df_raw.columns if col not in required_cols]

    # Initialize output
    new_data = {
        'Flow': df_raw['Flow'],
        'flow ID': df_raw['Flow_id'],
        'SI Unit': [None] * len(df_raw)
    }

    for process_col in process_columns:
        new_data[process_col] = np.nan

    New_A = pd.DataFrame(new_data)
    New_A = New_A.set_index(df_raw.index)

    for idx, row in df_raw.iterrows():
        raw_unit = row['Unit']
        si_unit_found = None

        for process_col in process_columns:
            value = row[process_col]

            if pd.isna(value) or value == 0.0:
                New_A.at[idx, process_col] = 0.0
                continue

            if pd.isna(raw_unit) or str(raw_unit).strip() == "":
                New_A.at[idx, process_col] = value
                continue

            raw_unit = str(raw_unit).strip()
            converted_value = value
            final_unit = raw_unit
            raw_unit_lower = raw_unit.lower()

            try:
                # FIA special conversions
                if raw_unit_lower in ['mbf_international', 'mbf']:
                    converted_value, final_unit = unit_conversion_FIA(
                        value, 'mbf_international', 'green_tons'
                    )
                    converted_value = float(converted_value) * 0.5
                    final_unit = 'dry_metric_tonnes'

                elif raw_unit_lower in ['standard_cords']:
                    converted_value, final_unit = unit_conversion_FIA(
                        value, 'standard_cords', 'dry_metric_tonnes'
                    )

                si_unit_for_flow = get_si_unit(final_unit)
                converted_value = unit_conversion(converted_value, final_unit, 'SI')

                if not si_unit_found:
                    si_unit_found = si_unit_for_flow

            except Exception as e:
                logger.warning(
                    f"[Warning] Conversion error for Flow ID {row['Flow_id']} ({raw_unit} -> SI): {e}"
                )
                if not si_unit_found:
                    si_unit_found = raw_unit

            New_A.at[idx, process_col] = converted_value

        if si_unit_found:
            New_A.at[idx, 'SI Unit'] = si_unit_found
        else:
            New_A.at[idx, 'SI Unit'] = str(row['Unit']).strip() if pd.notna(row['Unit']) else None

    New_A = New_A.sort_values(by='flow ID', ascending=True).reset_index(drop=True)
    return New_A



   # Function to import the Matrix LCI
def import_lci(LCI_flow: str, category: str) -> float:
    """
    Retrieves a specific LCI impact value given a flow and category.

    Args:
        LCI_flow (str): The name of the background process.
        category (str): The environmental impact category (e.g., 'GWP', 'Smog').

    Returns:
        float: The selected LCI value, or None if not found.
    """
    try:
        all_lci = LCI.query.all()
        df_lci = pd.DataFrame([{
            'Background_process': row.Background_process,
            'Code': row.Code,
            'Unit': row.Unit,
            'GWP': row.GWP,
            'Smog': row.Smog,
            'Acidification': row.Acidification,
            'Eutrophication': row.Eutrophication,
            'Carcinogenics': row.Carcinogenics,
            'Non_carcinogenics': row.Non_carcinogenics,
            'Respiratory_effects': row.Respiratory_effects,
            'Ecotoxicity': row.Ecotoxicity,
            'Fossil_fuel_depletion': row.Fossil_fuel_depletion,
            'Ozone_depletion': row.Ozone_depletion,
        } for row in all_lci])

        df_lci.set_index('Background_process', inplace=True)

        if LCI_flow not in df_lci.index:
            logger.error(f"LCI_flow '{LCI_flow}' not found.")
            return None

        if category not in df_lci.columns:
            logger.error(f"Category '{category}' not found.")
            return None

        select_lci = df_lci.loc[LCI_flow, category]
        logger.info(f"Selected LCI value for flow '{LCI_flow}' and category '{category}': {select_lci}")
        return select_lci

    except KeyError as e:
        logger.error(f"Key error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in import_lci: {e}")
        return None
    