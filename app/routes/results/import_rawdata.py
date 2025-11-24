
import os
import pandas as pd
import numpy as np
from .unit_conversion import unit_conversion, unit_conversion_FIA, get_si_unit 
from app.models import LCI
from .getdata import get_matrix_b, get_matrix_a
import logging
logger = logging.getLogger(__name__)


# Function to import the CSV, check shape, and return dataframe
def import_matrix_b(idt_param: int, sort='yes', sort_row=1, sort_column=3):
    df=[]
    
    #get the row and column to start sorting
    start_sorting_row=sort_row
    start_sorting_col=sort_column
    
    # Import the CSV file using pandas
    #all_matrix_b = MatrixB.query.all()
    df = get_matrix_b(idt_param)
    if sort=='yes':
        
        #print (df.iloc[0:2,3:])
        # Get the number of rows and columns
        rows, cols = df.shape
     
        #sorting the data by process id 
        first_two_columns = df.iloc[:, :start_sorting_col]
    #    columns_to_sort = df.iloc[1, 2:].values  # Values from the second row (index 1)
        sorted_columns = sorted(df.columns[start_sorting_col:], key=lambda col: df.at[0, col])
     
        # Reorder the DataFrame columns
        df_sorted_columns = pd.concat([first_two_columns, df[sorted_columns]], axis=1)
       # print("sorted by column", df_sorted_columns)
        #Sorting by flow ids (3nd column)
        first_two_rows = df_sorted_columns.iloc[:start_sorting_row, :]
        
        # Extract the data part (starting from the third row onward)
        data_to_sort = df_sorted_columns.iloc[start_sorting_row:, :]
        
        # Sort the rows based on the values in the second row (index 1) of the data
        sorted_row_indices = data_to_sort.iloc[:, 1].argsort()  # Sort based on the second column (ID or value)
        
        # Reorder the DataFrame rows based on sorted indices
        df_sorted_row = pd.concat([first_two_rows, data_to_sort.iloc[sorted_row_indices]], axis=0)
    
        # Return the matrix (as a numpy array)
        #print("sorted by row", df_sorted_row)
       
        return  df_sorted_row
    else:
        return df
    

#function to read a read raw data, check unit set to SI, return the data with SI unit
def format_rawdata_a (idt_param: int, A='A'):

    df_raw = get_matrix_a(idt_param)
    
    df_raw.columns = df_raw.columns.str.strip()

    unit_columns = [col for col in df_raw.columns if col.startswith('Unit_')]
    process_columns = [col for col in df_raw.columns if col not in ['Flow', 'Flow_id'] + unit_columns]

    if len(process_columns) != len(unit_columns):
        raise ValueError("Mismatch between process columns and unit columns.")

    process_unit_pairs = list(zip(process_columns, unit_columns))

    # Initialize the final output DataFrame (New_A) structure
    new_data = {
        'Flow': df_raw['Flow'],
        'flow ID': df_raw['Flow_id'],
        'SI Unit': [None] * len(df_raw)
    }

    for process_col in process_columns:
        new_data[process_col] = np.nan

    New_A = pd.DataFrame(new_data)
    New_A = New_A.set_index(df_raw.index)

    # Loop through rows to apply unit conversion and assign values/SI Unit
    for idx, row in df_raw.iterrows():
        si_unit_found = None

        for process_col, unit_col in process_unit_pairs:
            value = row[process_col]
            unit = row[unit_col]

            # Assign 0.0 if value is missing/zero, and skip conversion logic
            if pd.isna(value) or value == 0.0:
                New_A.at[idx, process_col] = 0.0
                continue
            
            # Skip if unit is missing
            if pd.isna(unit):
                New_A.at[idx, process_col] = value
                continue

            raw_unit = str(unit).strip()
            converted_value = value
            final_unit = raw_unit 
            
            # Standardize unit for checking
            raw_unit_lower = raw_unit.lower()
            
            # --- FIA Unit Conversion ---
            # NOTE: You must ensure unit_conversion_FIA is correctly defined
            if raw_unit_lower in ['mbf_international', 'mbf', 'mbf_international', 'mbf_international']:
                raw_unit_fia = 'mbf_international'
                output_un = 'green_tons'
                converted_value, final_unit = unit_conversion_FIA(value, raw_unit_fia, output_un)
                converted_value = float(converted_value) * 0.5
                final_unit = 'dry_metric_tonnes' 
            elif raw_unit_lower in ['standard_cords', 'standard_cords', 'standard_cords', 'standard_cords']:
                raw_unit_fia = 'standard_cords'
                output_un = 'dry_metric_tonnes'
                converted_value, final_unit = unit_conversion_FIA(value, raw_unit_fia, output_un)
            
            # --- SI Unit Determination & Conversion ---
            try:
                # 1. Get the SI unit 
                si_unit_for_flow = get_si_unit(final_unit) if final_unit else get_si_unit(raw_unit)
                
                # 2. Perform the SI conversion (using the unit that came out of FIA conversion)
                converted_value = unit_conversion(converted_value, final_unit, 'SI')
                
                # 3. Record the first SI unit found for the flow
                if not si_unit_found:
                    si_unit_found = si_unit_for_flow
                    
            except Exception as e:
                logger.warning(f"[Warning] Conversion error for Flow ID {row['Flow_id']} ({raw_unit} -> SI): {e}")
                # If conversion fails, use the latest value and unit, and fallback to using the unit directly
                if not si_unit_found:
                    si_unit_found = raw_unit # Fallback to the raw unit string

            New_A.at[idx, process_col] = converted_value

        # Assign the final SI unit for the flow
        if si_unit_found:
            New_A.at[idx, 'SI Unit'] = si_unit_found
        else:
            # Final fallback to try and capture the unit from the first unit column
            for _, unit_col in process_unit_pairs:
                if row[unit_col]:
                    New_A.at[idx, 'SI Unit'] = str(row[unit_col]).strip()
                    break

    # 5. Final Filtering and Reordering
    
    # *** FIX: REMOVE THE FILTERING STEP TO RETAIN ALL 4 ROWS ***
    # # numeric_col = New_A.columns[3:]
    # # rows_all_zero = (New_A[numeric_col] == 0.0).all(axis=1)
    # # New_A = New_A[~rows_all_zero]
    
    # Sort the remaining data by 'flow ID' to ensure consistent order
    New_A = New_A.sort_values(by='flow ID', ascending=True)

    # Reset the index
    New_A = New_A.reset_index(drop=True)
    
    #logger.info(f"Matrix A (Formatted) : \n {New_A.to_string()}")
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
    