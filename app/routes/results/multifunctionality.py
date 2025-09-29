
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
        total_output = np.sum(A[positive_values, process_idx])  # Total of all positive outputs
        allocation_factors = A[positive_values, process_idx] / total_output  # Proportion for each output
        
        # Get the row indices of the positive outputs
        output_rows = np.where(positive_values)[0]
        
        return allocation_factors, output_rows
    else:
        return [1], np.where(positive_values)[0]  # If there's only one positive value, no allocation needed




def adjust_matrix_for_multiple_outputs(Aa, Bb):



     """
     This function processes the technology matrix A and emissions matrix B by:
     - Identifying columns that do not require allocation and keeping them in the new dataset.
     - For columns that require allocation (multiple positive values in a column),
       it calculates the allocation factors and creates new columns for each output.
    
     The function then returns the adjusted matrices A and B with the appropriate columns,
     along with process names/IDs embedded as column names in the new matrices.
     """
     # Extract values in the first two rows starting from the fourth column
     Aa = Aa
     
     #print("The matrix A provided for multifunctionality check is", Aa)
    
     # Extract the first three columns (which we want to retain) from both Aa and Bb
     retained_columns_Aa = Aa.iloc[1:, :3]  # Keep the first three columns of Aa
     retained_columns_Bb = Bb.iloc[1:, :3]  # Keep the first three columns of Bb
    
     # Extract process names and process IDs from the rest of the matrix
     Process_Name_id = pd.DataFrame([Aa.columns.tolist(), Aa.iloc[0].tolist()])
     Process_Name_id = Process_Name_id.iloc[0:, 3:]
    
     #print("Process names in function adjust_matrix_for_multiple_outputs:\n", Process_Name_id)
    
     Aa = Aa.iloc[1:, 3:]  # Drop the first row (assumed to be headers or IDs)
     Aa = Aa.reset_index(drop=True)
     A = Aa.values  # Convert to NumPy array for easier numerical operations
     A = A.astype(float)
    # print("Matrix A as numpy array:\n", A)
    
     Bb = Bb.iloc[1:, 3:]  # Drop the first row from matrix B as well
     Bb = Bb.reset_index(drop=True)
     B = Bb.values  # Convert to NumPy array for easier numerical operations
     B = B.astype(float)
    # print("Matrix B as numpy array:\n", B)
    
     # Preserve the row names for Aa and Bb (flows)
     row_names_Aa = Aa.index.tolist()  # Flow names for Aa
     row_names_Bb = Bb.index.tolist()  # Flow names for Bb
    
     num_rows, num_columns = A.shape
     num_rowsB, num_columnsB = B.shape
    
     # Create a new dataset to hold the adjusted values
     new_A = []  # Will store the adjusted columns of A
     new_B = []  # Will store the adjusted columns of B
     new_column_names = []  # Will store the new process names/IDs for each column
     new_column_id=[]
    
     # Iterate through each column
     for col in range(num_columns):
         positive_values=0
         flow_unit=[]
         for row in range(num_rows):
             if A[row,col]>0:
                 positive_values=positive_values+1
                 flow_unit.append(retained_columns_Aa.iloc[row,2])
         
         if all(x==flow_unit[0] for x in flow_unit):
             print("Allocation to be performed")
         
 # need to work with this in the future. to give user the option to enter their own allocation factor as an option.            
         else:
             raise ValueError("Flows have different properties -- Allocation not performed")
                 
 
        #positive_values = A[:, col] > 0
        
         if np.sum(positive_values) == 1:  # No allocation required, just keep the column as is
             # Append the original column to the new datasets (both A and B)
             new_A.append(A[:, col])
             new_B.append(B[:, col])
             new_column_names.append(Process_Name_id.iloc[0, col])  # Add the corresponding process name/ID
             new_column_id.append(Process_Name_id.iloc[1, col])
             print ("new column not created\n", new_column_names)
         elif np.sum(positive_values) > 1:  # Allocation is required
             # Call the allocation function to calculate factors and output row indices
             allocation_factors, output_rows = calculate_allocation_factors(A, col)
            
             # For each allocation factor, create a new column for A and B
             for i, factor in enumerate(allocation_factors):
                 new_column_A = np.zeros(num_rows)  # New column for A (adjusted)
                 new_column_B = np.zeros(num_rowsB)  # New column for B (adjusted)

                 # Apply the allocation factor to the inputs (negative values in A)
                 new_column_A[A[:, col] < 0] = A[A[:, col] < 0, col] * factor
                
                 # Apply the allocation factor to the outputs in matrix B
                 new_column_B = B[:, col] * factor

                 # Set the corresponding output value in the new column of A (if needed)
                 if i == 0:
                     new_column_A[output_rows[0]] = A[output_rows[0], col]  # First output remains unchanged
                 else:
                     new_column_A[output_rows[i]] = A[output_rows[i], col]  # Subsequent outputs remain unchanged

                 # Add the new columns to the new datasets
                 new_A.append(new_column_A)
                 new_B.append(new_column_B)
                
                 # Add the process name and ID for the new output
                 new_column_names.append(f"{Process_Name_id.iloc[0, col]}_output_{i+1}")
                 new_column_id.append(f"{Process_Name_id.iloc[1, col]}_{i+1}")
    
     # Convert lists to numpy arrays to match the original matrix shapes
     new_A = np.column_stack(new_A)
     new_B = np.column_stack(new_B)
    
     # Padding to match row numbers before concatenation (adjust based on retained columns)
     if len(retained_columns_Aa) != new_A.shape[0]:
         print(f"Padding new_A from {new_A.shape[0]} to {len(retained_columns_Aa)} rows with zeros.")
         row_diff_A = len(retained_columns_Aa) - new_A.shape[0]
         new_A = np.pad(new_A, ((0, row_diff_A), (0, 0)), mode='constant', constant_values=0)
    
     if len(retained_columns_Bb) != new_B.shape[0]:
         print(f"Padding new_B from {new_B.shape[0]} to {len(retained_columns_Bb)} rows with zeros.")
         row_diff_B = len(retained_columns_Bb) - new_B.shape[0]
         new_B = np.pad(new_B, ((0, row_diff_B), (0, 0)), mode='constant', constant_values=0)
    
    # concatenate the new columns with the original ones
     final_A = np.column_stack([retained_columns_Aa.values, new_A])
     final_B = np.column_stack([retained_columns_Bb.values, new_B])
    
     # Pad row names to match the final number of rows
     if len(row_names_Aa) < final_A.shape[0]:
         print(f"Padding row names for A to match {final_A.shape[0]} rows.")
         row_names_Aa += [''] * (final_A.shape[0] - len(row_names_Aa))  # Pad with empty strings
     if len(row_names_Bb) < final_B.shape[0]:
         print(f"Padding row names for B to match {final_B.shape[0]} rows.")
         row_names_Bb += [''] * (final_B.shape[0] - len(row_names_Bb))  # Pad with empty strings
    
     # Assign row names to the final matrices
     final_A_df = pd.DataFrame(final_A, columns=[*retained_columns_Aa.columns.tolist(), *new_column_names])
     final_B_df = pd.DataFrame(final_B, columns=[*retained_columns_Bb.columns.tolist(), *new_column_names])
    
     final_A_df.index = row_names_Aa
     final_B_df.index = row_names_Bb
    
     # Print the final matrices
     print("Final A Matrix with Process Names/IDs and Flow Names:")
     print(final_A_df)
    
     print("\nFinal B Matrix with Process Names/IDs and Flow Names:")
     print(final_B_df)
    
     return final_A_df, final_B_df
