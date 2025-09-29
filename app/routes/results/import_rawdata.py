
import os
import pandas as pd
from .unit_conversion import unit_conversion, unit_conversion_FIA, get_si_unit 
from app.models import MatrixARaw, MatrixB, LCI
import logging
logger = logging.getLogger(__name__)


# Function to import the CSV, check shape, and return dataframe
def import_matrix_b(sort='yes', sort_row=1, sort_column=3):
    df=[]
    
    #get the row and column to start sorting
    start_sorting_row=sort_row
    start_sorting_col=sort_column
    
    # Import the CSV file using pandas
    all_matrix_b = MatrixB.query.all()
    df = pd.DataFrame([{
        'Background_process': row.Background_process,
        'Code': row.Code,
        'Unit': row.Unit,
        'Process_1': row.Process_1,
        'Process_2': row.Process_2,
        'Process_3': row.Process_3,
        'Process_4': row.Process_4,
        'Process_5': row.Process_5,
        'Process_6': row.Process_6
    } for row in all_matrix_b])
    
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
def format_rawdata_a (A='A'):

#     # Import the CSV file using pandas
    all_matrix_a = MatrixARaw.query.all()
    df_raw = pd.DataFrame([{
        'Flow': row.Flow,
        'Flow_id': row.Flow_id,
        'Process_1': row.Process_1,
        'Unit_1': row.Unit_1,
        'Process_2': row.Process_2,
        'Unit_2': row.Unit_2,
        'Process_3': row.Process_3,
        'Unit_3': row.Unit_3,
        'Process_4': row.Process_4,
        'Unit_4': row.Unit_4,
        'Process_5': row.Process_5,
        'Unit_5': row.Unit_5,
        'Process_6': row.Process_6,
        'Unit_6': row.Unit_6,
    } for row in all_matrix_a])
    
    df_raw.columns = df_raw.columns.str.strip()


    # Fix potential duplicate 'Unit' column names (e.g., 'Unit.1')
    unit_columns = [col for col in df_raw.columns if 'Unit' in col]
    process_columns = [col for col in df_raw.columns if col not in ['Flow', 'Flow_id'] + unit_columns]

    # Confirm column pairing
    if len(process_columns) != len(unit_columns):
        raise ValueError("Mismatch between process columns and unit columns.")

    process_unit_pairs = list(zip(process_columns, unit_columns))

    # Initialize new dataframe
    new_data = {
        'Flow': df_raw['Flow'],
        'flow ID': df_raw['Flow_id'],
        'SI Unit': [None] * len(df_raw)
    }

    for process_col, _ in process_unit_pairs:
        new_data[process_col] = [None] * len(df_raw)

    New_A = pd.DataFrame(new_data)

    for idx, row in df_raw.iterrows():
        if idx == 0:
            # First row = process IDs
            for process_col, _ in process_unit_pairs:
                New_A.at[idx, process_col] = row[process_col]
            continue

        si_unit = None

        for process_col, unit_col in process_unit_pairs:
            value = row[process_col]
            unit = row[unit_col]

            # Skip if value or unit is missing
            if pd.isna(value) or pd.isna(unit):
                continue

            # Normalize unit
            raw_unit = str(unit).strip().lower()
            #print("raw unit is:", raw_unit)

            # Handle distinct units using unit_conversion_FIA
            if raw_unit in ['mbf_international', 'mbf', 'MBF_international', 'mbf_International', 
                             'standard_cords', 'Standard_cords', 'Standard_Cords', 'standard_Cords']:
                # Call unit_conversion_FIA before proceeding with SI conversion
                output_un = None
                try:
                    if raw_unit in ['mbf', 'mbf_international', 'MBF_international', 'mbf_International']:
                        print(f"Converting {raw_unit} to green_tons")
                        raw_unit = 'mbf_international'
                        output_un = 'green_tons'
                        #print(f"Converting {raw_unit} to {output_un}")
                        value,raw_unit = unit_conversion_FIA(value, raw_unit, output_un)
                        #print ("a moisture content of 50% was assume to change the green ton to dry ton, this value can be changed later:")
                        value=float(value)*0.5   #TO CHANCHE LATER---THIS ACCOUNT TO CHANGE GREEN TON to DRY TON assuming 50% moinsture
                        #raw_unit=output_un
                    
                    if raw_unit in ['standard_cords', 'Standard_cords', 'Standard_Cords', 'standard_Cords']:
                        #print(f"Converting {raw_unit} to dry_metric_tonnes")
                        raw_unit = 'standard_cords'
                        output_un = 'dry_metric_tonnes'
                        #print(f"Converting {raw_unit} to {output_un}")
                        value,raw_unit = unit_conversion_FIA(value, raw_unit, output_un)
                        #raw_unit=output_un

                        
                    
                except Exception as e:
                    logger.warning(f"Error in unit_conversion_FIA: {e}")
                    continue

            # Try to get SI unit
            try:
                si_unit = get_si_unit(raw_unit)
            except ValueError as e:
                logger.warning(f"[Warning] Could not determine SI unit for Flow ID {row['flow ID']} (unit: '{raw_unit}'): {e}")
                si_unit = None

            # Try to convert using the SI conversion
            try:
                converted = unit_conversion(value, raw_unit, 'SI') if si_unit else value
            except Exception as e:
                logger.warning(f"[Warning] Could not convert value for Flow ID {row['flow ID']}, value: {value}, unit: {raw_unit}: {e}")
                converted = value

            # Assign the converted value to the DataFrame
            New_A.at[idx, process_col] = converted

        # Assign the first successfully retrieved SI unit
        if si_unit:
            New_A.at[idx, 'SI Unit'] = si_unit

    
    #remove rows with all zero for the A matrix---This is step is necessary for the A matrix but optional for the B matrix.
  
    numeric_col=New_A.columns[3:]
    rows_all_zero=(New_A[numeric_col]==0).all(axis=1)
    New_A=New_A[~rows_all_zero].reset_index(drop=True)

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
    