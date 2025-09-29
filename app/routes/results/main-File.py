# -*- coding: utf-8 -*-
"""
Created on Thu Dec 19 22:31:41 2024

@author: otherasm
"""
import os
import pandas as pd
import numpy as np
from directory import directory
from import_rawdata import import_Matrix_csv, format_rawdata
from calculate import calculate_impact_score,calculate_inventory_impact, calculate_scaling_vector, diagonal_vector, calculate_inventory_matrix, calculate_process_contribution
from export_data import export_pd_to_csv
from multifunctionality import adjust_matrix_for_multiple_outputs
from create_graph import create_graph

working_folder_path = directory()


# def check_flow_property(flow):
#     unit='kg'
#     return unit
 
# Main function to control the flow
def main():
    # Input Technology Matrix A (user is prompted to enter rows)
    #A = input_matrix("Technology matrix A")
    # Import the Matrix A
    try:
        
        
        file_path_rawA = os.path.join(working_folder_path, "Matrix_A_raw.csv") #obtain the path of the starting/raw matrix A then will be fortmated
        A=format_rawdata(file_path_rawA,'A')
        # file_path_A = os.path.join(working_folder_path, "Matrix_A.csv")
        # print ("The file A is :",file_path_A)
        # A = import_Matrix_csv(file_path_A)
        #print(A.iloc[:3,3:])
        print("Matrix A")
        with pd.option_context('display.max_columns', None):
            print(A)
        #print("Matrix A : \n {A}")

    except FileNotFoundError:
        print("File Matrix A not found")

    # FIA=unit_conversion_FIA (value=5, input_unit='cubic_meters', output_unit='mbf_international')
    # print(FIA)

    # # Import the Matrix B
    try:
        file_path_B = os.path.join(working_folder_path, "Matrix_B.csv")
        B = import_Matrix_csv(file_path_B)
        print("Matrix B")
        with pd.option_context('display.max_columns', None):
            print(B)
        lci_flow=B.iloc[1:,0]
        print("lCI flow is:",lci_flow)

    except FileNotFoundError:
        print("File matrix B not found")
    
    # Adjust the matrix A and B for multiple outputs
    #adjusted_A, adjusted_B = adjust_matrix_for_multiple_outputs(A,B)
    
#    adjusted_A, adjusted_B = adjust_matrix_for_multiple_outputs(np_A,np_B)
    #print(f"Adjusted Technology Matrix A and B after handling multiple outputs:\n{adjusted_A}")
    
    #print(f"Adjusted Technology Matrix B after handling multiple outputs:\n{adjusted_B}")
    
    #save matrix A and B to csv
    adjusted_B_pd=pd.DataFrame(adjusted_B)
    export_pd_to_csv (adjusted_B_pd,'Matrix_B_adjusted.csv',working_folder_path)
    adjusted_A=pd.DataFrame(adjusted_A)
    export_pd_to_csv (adjusted_A,'Matrix_A_adjusted.csv',working_folder_path)
    
   # Process_names=adjusted_A.iloc[0,0:]
    
    Process_Names = pd.DataFrame([adjusted_A.columns.tolist(), adjusted_A.columns.tolist()])
    Process_Names = Process_Names.iloc[0:1, 3:]
    
    #print ("process name is\n", Process_Names)
    
    
    adjusted_A=adjusted_A.iloc[0:,3:]
    adjusted_A_np = np.array(adjusted_A)
    
    adjusted_B=adjusted_B.iloc[0:,3:]
    adjusted_B_np = np.array(adjusted_B)
    
    #print (adjusted_A)
    
   # print ("adjusted A np\n", adjusted_A_np)
    
    
    # export_np_to_csv (adjusted_A_np,'Matrix_A_adjusted.csv',working_folder_path)

    # Ask the user for the final demand (output required) #need to change the way the user enter this info in the future
    final_demand = input("Enter the final demand vector (space-separated values for products): ").split()
    final_demand = np.array([float(x) for x in final_demand])  # Convert to float
    
    # Calculate the scaling vector s based on the final demand f
    
    scaling_vector = calculate_scaling_vector(adjusted_A_np, final_demand)
    print(f"Calculated scaling vector (s): {scaling_vector}")

    
    # Calculate the inventory impact
    g = calculate_inventory_impact(adjusted_B, scaling_vector)
    

    
    #category = input("Enter the name of the impact category for this calculation eg., GWP, or Eutrophication separated by space:").split()
    #category=['GWP']
    total_impact=calculate_impact_score(g, lci_flow,'GWP')
    
    
    
    #calculate the contribution of each process 
    Contribution_analysis = input("Please enter 1 if you would like to perform a co tribution analysis, 0 to skip:").split()
    print (f" you entered the value: {Contribution_analysis}, will calculted if 1 or not if 0.")
    


    if Contribution_analysis == ['1']:
    # Create diagonal matrix from scaling vector
        diag_s = diagonal_vector(scaling_vector)
        print(diag_s)
        print(*diag_s.shape)
    
        # Calculate inventory matrix
        G = calculate_inventory_matrix(adjusted_B_np, diag_s)
        print(G)
        print(*G.shape)
    
        # Calculate process contributions
        Process_contribution = calculate_process_contribution(G, lci_flow, 'GWP')
        print("Process contribution\n", Process_contribution)
    
        # Flatten and convert arrays to proper types
        Process_Names = np.array(Process_Names).flatten().astype(str)
        Process_contribution = np.array(Process_contribution).flatten().astype(float)
    
        # Filter out zero or near-zero contributions
        non_zero_mask = Process_contribution != 0  # Or use: np.abs(Process_contribution) > 1e-6
        Process_Names = Process_Names[non_zero_mask]
        Process_contribution = Process_contribution[non_zero_mask]
    
        # Check for mismatched lengths (just in case)
        if len(Process_Names) != len(Process_contribution):
            print("Error: Mismatched lengths after filtering.")
            return
    
        # Combine into 2D array
        data_for_graph = np.column_stack((Process_Names, Process_contribution))
        print("Data for graph:", data_for_graph)
    
        # Export to CSV
        data_for_graph_pd = pd.DataFrame(data_for_graph, columns=["Process", "Contribution"])
        export_pd_to_csv(data_for_graph_pd, 'Process_contribution.csv', working_folder_path)
    
        # Create graph (only non-zero values included)
        create_graph(
            data_for_graph,
            graph_type='pie', #'pie','bar', 'line', or 'scatter'
            x_column=0,
            y_column=1,
            has_header=False,
            xlabel="Process",
            ylabel="Impact",
            title="Contribution Analysis"
        )
    
    else:
        print("Contribution analysis not computed")
        return None
  

    
    
    return None
        
        
        
        
# Run the program
if __name__ == "__main__":
    main()
 