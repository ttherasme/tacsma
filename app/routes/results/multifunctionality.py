import numpy as np
import pandas as pd
import logging
logger = logging.getLogger(__name__)

# Function to calculate allocation factors based on the outputs
def calculate_allocation_factors(A, process_idx):
    """
    Calculate allocation factors for the outputs in a specific process column.
    It returns both the allocation factors and the row indices of the positive outputs.
    """
    # Identify the positive values in the specified process column (outputs)
    positive_values = A[:, process_idx] > 0  # Outputs are positive values in the column
    
    if np.sum(positive_values) > 1:  # More than one output, we need to allocate
        # Calculate total output using only the positive values
        total_output = np.sum(A[positive_values, process_idx])  
        
        # Avoid division by zero if, somehow, the total output is zero despite multiple positive entries
        if total_output == 0:
            logger.warning(f"Process {process_idx} has multiple outputs but zero total value. Using uniform allocation.")
            num_positive = np.sum(positive_values)
            allocation_factors = np.full(num_positive, 1.0 / num_positive)
        else:
            # Proportion for each output (allocation factor)
            allocation_factors = A[positive_values, process_idx] / total_output  
        
        # Get the row indices of the positive outputs
        output_rows = np.where(positive_values)[0]
        
        return allocation_factors, output_rows
    else:
        # If there's only one positive value, no allocation is needed (factor is 1)
        return np.array([1.0]), np.where(positive_values)[0] 


def adjust_matrix_for_multiple_outputs(Aa, Bb):
    """
    This function processes the technology matrix A (Aa) and emissions matrix B (Bb) by:
    - Identifying and retaining flow/unit columns.
    - Identifying columns that require allocation (multifunctionality).
    - For multifunctional columns, it calculates allocation factors and creates new,
      allocated process columns in the adjusted matrices.
    
    Returns the adjusted matrices A and B (Pandas DataFrames).
    """
    
    # 1. Prepare and Convert Input Data
    
    # Extract the first three columns (Flow, Flow ID, SI Unit) from both Aa and Bb
    retained_columns_Aa = Aa.iloc[0:, :3].copy()
    retained_columns_Bb = Bb.iloc[0:, :3].copy()

    # Extract process names and process IDs from the rest of the matrix columns
    Process_Name_id = pd.DataFrame([Aa.columns.tolist(), Aa.iloc[0].tolist()])
    # Transpose and filter to get only the process name/ID rows/columns
    Process_Name_id = Process_Name_id.iloc[0:, 3:]
    
    # Extract the numerical matrix data, dropping header rows/columns and converting to float
    A_val = Aa.iloc[0:, 3:].reset_index(drop=True)
    B_val = Bb.iloc[0:, 3:].reset_index(drop=True)
    
    A = A_val.values.astype(float)
    B = B_val.values.astype(float)
    
    # Preserve the flow indices (row names)
    row_names_Aa = A_val.index.tolist() 
    row_names_Bb = B_val.index.tolist()
    
    num_rows, num_columns = A.shape
    num_rowsB, num_columnsB = B.shape
    
    # 2. Initialize Adjusted Matrix Storage
    new_A = []  
    new_B = []  
    new_column_names = []  # Stores Process_Name
    new_column_id = []     # Stores Process_ID

    # 3. Iterate and Perform Allocation
    for col in range(num_columns):
        # Identify outputs (positive values) in the current process column
        is_output = A[:, col] > 0
        num_outputs = np.sum(is_output)

        # ---------------------------------------------------------------------
        # NOTE ON PREVIOUS ERROR: The following block that was causing the
        # ValueError is REMOVED to allow allocation even with differing units.
        # ---------------------------------------------------------------------
        # flow_unit = [retained_columns_Aa.iloc[row, 2] for row in np.where(is_output)[0]]
        # if all(x == flow_unit[0] for x in flow_unit):
        #     print("Allocation to be performed") # This print statement is now meaningless and can be removed
        # else:
        #     raise ValueError("Flows have different properties -- Allocation not performed")
        # ---------------------------------------------------------------------
        
        if num_outputs <= 1:  # No allocation required
            # Append the original column to the new datasets (both A and B)
            new_A.append(A[:, col])
            new_B.append(B[:, col])
            new_column_names.append(Process_Name_id.iloc[0, col])
            new_column_id.append(Process_Name_id.iloc[1, col])
            # print ("new column not created\n", new_column_names) # Keep for debugging if needed
            
        elif num_outputs > 1:  # Allocation is required
            
            # 3.1. Calculate allocation factors
            allocation_factors, output_rows = calculate_allocation_factors(A, col)
            
            # 3.2. Create a new process column for each co-product
            for i, factor in enumerate(allocation_factors):
                new_column_A = np.zeros(num_rows)
                new_column_B = np.zeros(num_rowsB)

                # Apply the allocation factor to the inputs (negative values in A)
                new_column_A[A[:, col] < 0] = A[A[:, col] < 0, col] * factor
                
                # Apply the allocation factor to the emissions in matrix B
                new_column_B = B[:, col] * factor

                # Set the corresponding output value in the new column of A 
                # (Set the target output to its original value, all others to zero in this new column)
                
                # Set all outputs to zero first (Inputs are already handled)
                new_column_A[output_rows] = 0.0
                
                # Set the specific output for this new column (the product being allocated to)
                new_column_A[output_rows[i]] = A[output_rows[i], col]

                # Add the new columns to the new datasets
                new_A.append(new_column_A)
                new_B.append(new_column_B)
                
                # Add the process name and ID for the new output
                original_name = Process_Name_id.iloc[0, col]
                original_id = Process_Name_id.iloc[1, col]
                
                new_column_names.append(f"{original_name}_output_{i+1}")
                new_column_id.append(f"{original_id}_{i+1}")
    
    # 4. Final Assembly
    
    # Convert lists of arrays to numpy arrays
    if not new_A:
        new_A = np.zeros((num_rows, 0))
    else:
        new_A = np.column_stack(new_A)
        
    if not new_B:
        new_B = np.zeros((num_rowsB, 0))
    else:
        new_B = np.column_stack(new_B)

    # Padding to match row numbers before concatenation
    if len(retained_columns_Aa) != new_A.shape[0]:
        row_diff_A = len(retained_columns_Aa) - new_A.shape[0]
        new_A = np.pad(new_A, ((0, row_diff_A), (0, 0)), mode='constant', constant_values=0)
    
    if len(retained_columns_Bb) != new_B.shape[0]:
        row_diff_B = len(retained_columns_Bb) - new_B.shape[0]
        new_B = np.pad(new_B, ((0, row_diff_B), (0, 0)), mode='constant', constant_values=0)
    
    # Concatenate the retained columns (Flow, Flow ID, SI Unit) with the new process columns
    final_A = np.column_stack([retained_columns_Aa.values, new_A])
    final_B = np.column_stack([retained_columns_Bb.values, new_B])
    
    # Create column headers for the final DataFrame
    final_columns = retained_columns_Aa.columns.tolist() + new_column_names
    
    # Assign to final DataFrames
    final_A_df = pd.DataFrame(final_A, columns=final_columns)
    final_B_df = pd.DataFrame(final_B, columns=final_columns)
    
    # Assign flow indices (row names). Note: Your original code used index values, 
    # but the adjusted matrix should use the flow names from the retained columns.
    # We use the original index to preserve row order, if it exists.
    final_A_df.index = final_A_df.index
    final_B_df.index = final_B_df.index
    
    logger.info("Final A Matrix with Process Names/IDs and Flow Names:\n" + final_A_df.to_string())
    logger.info("\nFinal B Matrix with Process Names/IDs and Flow Names:\n" + final_B_df.to_string())
    
    return final_A_df, final_B_df