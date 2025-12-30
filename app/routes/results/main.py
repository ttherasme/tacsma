import numpy as np
import pandas as pd
import logging
logger = logging.getLogger(__name__)
from .import_rawdata import import_matrix_b, format_rawdata_a
from .calculate import (
    calculate_impact_score,
    calculate_inventory_impact,
    calculate_scaling_vector,
    diagonal_vector,
    calculate_inventory_matrix,
    calculate_process_contribution
)
from .multifunctionality import adjust_matrix_for_multiple_outputs
from .create_graph import create_graph, create_graph_wt
from .Forest_growth_model import forest_growth_newA, forest_growth_function
from .unit_conversion import unit_conversion
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from .Forest_growth_model import init_param_variable

graph_data ={}  # dictionary indexed by task_id

def run_analysis(rows):
    """
    Runs LCI/LCA analysis for multiple input rows, calculates individual results,
    and generates a single pivoted contribution table comparing tasks.
    Returns a dictionary: { "individual_results": [...], "combined_contribution_table": [...] }
    """
    results = [] 
    # List to collect contributions from ALL rows for final pivot table
    all_contributions_data = []

    logger.warning("--- STARTING run_analysis ---")

    for i, row in enumerate(rows):
        task_text = row.get('taskText', 'Unknown Task')
        logger.warning(f"--- Processing Row {i+1} ({task_text}) ---")
        
        try:
            params = init_param_variable()
            growth_regrowth = params.get('regeneration_mode', False)
            
            # --- Extract inputs ---
            task_id = row.get('task')
            functional_unit = row.get('functional_unit', 1.0)
            flow = row.get('flow')
            flow_text = row.get('flowText')
            flow_unit = row.get('unit')
            unit_text = row.get('unitText')
            impact_category = row.get('impact_category', 'GWP')

            logger.warning(f"Input :\n Task : {task_id}, Flow : {flow}, Functional unit : {functional_unit}, Unit : {flow_unit}, Impact category : {impact_category} ")

            # Ensure functional unit is float
            try:
                functional_unit = float(functional_unit)
            except (ValueError, TypeError):
                logger.error(f"Task {task_id}: Invalid functional unit '{functional_unit}'; defaulting to 1.0")
                functional_unit = 1.0

            # Ensure task_id is int
            try:
                task_id = int(task_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid task_id '{task_id}'; skipping this row")
                continue  # skip this row

            # 1. Import Data
            A_raw = format_rawdata_a(task_id, A='A')
            if growth_regrowth == True:
                value_B, value_A=forest_growth_function()
                A_raw=forest_growth_newA(A_raw, value_A, 'A')
                 
            else: 
                logger.error(f"No growth regrowth model")

            B_raw = import_matrix_b(task_id, sort='yes', sort_row=1, sort_column=3)
            if growth_regrowth == True:
                B_raw=forest_growth_newA(B_raw, value_B, 'B')
            else: 
                logger.error(f"No growth regrowth model")

            lci_flow = B_raw.iloc[0:, 0].reset_index(drop=True)

            # 2. Multifunctionality Adjustment
            try:
                adjusted_A, adjusted_B = adjust_matrix_for_multiple_outputs(A_raw, B_raw)
            except Exception as e:
                logger.error(f"Error during matrix adjustment for task {task_text}: {str(e)}", exc_info=True)
                results.append({"error": f"Error adjusting matrices: {str(e)}", "task_name": task_text})
                continue

            adjusted_B_pd=pd.DataFrame(adjusted_B)
            adjusted_A=pd.DataFrame(adjusted_A)

            flow_dict = {
                'flow': flow,
                'unit': flow_unit,
                'functional_unit': functional_unit
            }

            flow_df = pd.DataFrame([flow_dict])

            flow_names = adjusted_A.iloc[0:, :2].copy()
            flow_names['flow ID'] = flow_names['flow ID'].astype(str)
            flow_df['flow'] = flow_df['flow'].astype(str)

            functional_unit = unit_conversion(functional_unit, unit_text, 'SI')
            logger.error(f"Task {task_id}: last functional unit '{functional_unit}'; defaulting to 1.0")
            flow_names['Amount'] = flow_names['flow ID'].map(
                flow_df.set_index('flow')['functional_unit']
            ).fillna(0)

            # Convert to desired vector format (NumPy array or list)
            final_demand = flow_names['Amount'].values.astype(float)
            
            # 3. Process names
            Process_Names_df = adjusted_A.iloc[:0, 3:].copy() # Get header for process names
            Process_Names = Process_Names_df.columns.tolist()

            adjusted_A=adjusted_A.iloc[0:,3:]
            adjusted_A_np = np.nan_to_num(np.array(adjusted_A, dtype=float), nan=0.0)

            adjusted_B=adjusted_B.iloc[0:,3:]
            adjusted_B_np = np.nan_to_num(np.array(adjusted_B, dtype=float), nan=0.0)

            # 4. Scaling Vector
            try:
                scaling_vector = calculate_scaling_vector(adjusted_A_np, final_demand)
            except np.linalg.LinAlgError as e:
                logger.error(f"Scaling vector error (singular matrix) for task {task_text}: {e}")
                results.append({"error": f"Cannot solve linear system (singular matrix): {e}", "task_name": task_text})
                continue

            # 5. Inventory Impact
            g = calculate_inventory_impact(adjusted_B, scaling_vector)
            g = np.array(g).flatten() 
            total_impact = calculate_impact_score(g, lci_flow, impact_category)

            # 6. Process Contribution
            diag_s = diagonal_vector(scaling_vector)
            G = calculate_inventory_matrix(adjusted_B_np, diag_s)
            Process_contribution = calculate_process_contribution(G, lci_flow, impact_category)

            # Flatten and convert arrays to proper types
            Process_Names_np = np.array(Process_Names).flatten().astype(str)
            Process_contribution = np.array(Process_contribution).flatten().astype(float)
        
            # Filter out zero or near-zero contributions for individual table display
            non_zero_mask = Process_contribution != 0
            Process_Names_filtered = Process_Names_np[non_zero_mask]
            Process_contribution_filtered = Process_contribution[non_zero_mask]
        
            # Individual Contribution Table (for the frontend summary/chart)
            contribution_table_df = pd.DataFrame({
                "Process": Process_Names_filtered,
                "Contribution": Process_contribution_filtered
            }).query("Contribution != 0")

            # --- 1. Append data for the FINAL Pivot Table ---
            # Use ALL process contributions for the comparison table (including zeros)
            current_row_contributions = pd.DataFrame({
                "Process": Process_Names_np,
                "Task": task_text,
                "Contribution": Process_contribution
            })
            all_contributions_data.extend(current_row_contributions.to_dict('records'))
            
            # --- 2. Append result for individual row ---
            graph_data[task_id] = {
                "task_name": task_text,
                "contribution_table_values": (
                    contribution_table_df.values if not contribution_table_df.empty else None
                )
            }
            results.append({
                "task_id": task_id,
                "task_name": task_text,
                "product": str(functional_unit) + ' ' + unit_text + ' ' + flow_text,
                "impact_category": impact_category,
                "total_impact": total_impact,
                "chart_base64": create_graph(
                     contribution_table_df.values,
                     graph_type='pie',
                     x_column=0,
                     y_column=1,
                     has_header=False,
                     xlabel="Process",
                     ylabel="Contribution",
                     title=f"Contribution Analysis: {task_text}"
                 ) if not contribution_table_df.empty else None,
                "contribution_table": contribution_table_df.to_dict('records')
            })

        except Exception as e:
            logger.exception(f"Unexpected error for task {task_text}: {e}")
            results.append({"error": f"Unexpected error: {e}", "task_name": task_text})

    # --- FINAL STEP: CREATE THE UNIQUE PIVOT TABLE ---
    logger.warning("Starting final pivot table generation...")
    if all_contributions_data:
        df_all = pd.DataFrame(all_contributions_data)
        
        # Pivot the table: Process as index, Task as columns, Contribution as values
        pivot_table = df_all.pivot_table(
            index='Process', 
            columns='Task', 
            values='Contribution', 
            aggfunc='sum',
            fill_value=0
        )
        # Convert the pivoted DataFrame to a list of dicts (records) for JSON serialization
        final_contribution_table = pivot_table.reset_index().to_dict('records')
    else:
        final_contribution_table = []
    
    logger.warning("--- ENDING run_analysis ---")
    logging.debug("Returning from run_analysis(): %s", results)
    logging.debug("Returning from run_analysis(): %s", final_contribution_table)

    # Return both the individual results and the final comparison table
    return {
        "individual_results": results,
        "combined_contribution_table": final_contribution_table
    }

def graph_results_single(chart_type='pie', theme='vibrant', task_name=None, task_id=None):
    logging.debug("Task : %s", task_name)
    logging.debug("Chart type : %s", chart_type)
    task_id = int(task_id)
    data_contribution = graph_data[task_id]["contribution_table_values"]
    data_nameTask = graph_data[task_id]["task_name"]
    graph =None
    if data_contribution is not None:
       graph = create_graph_wt(
            data_contribution,
            graph_type=chart_type,
            x_column=0,
            y_column=1,
            has_header=False,
            xlabel="Process",
            ylabel="Contribution",
            title=f"Contribution Analysis: {data_nameTask}"
        )

       """ graph= create_graph(
                     data_contribution,
                     graph_type=chart_type,
                     x_column=0,
                     y_column=1,
                     has_header=False,
                     xlabel="Process",
                     ylabel="Contribution",
                     title=f"Contribution Analysis: {data_nameTask}"
                 ) """
    
    return graph
