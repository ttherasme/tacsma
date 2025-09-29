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
from .create_graph import create_graph
import base64
import io
import matplotlib.pyplot as plt
from app.models import MatrixARaw, MatrixB 


def run_analysis(rows):
    try:
        # 1. Import Data
        A_raw = format_rawdata_a(A='A')
        logger.warning(f"Matrix A \n {A_raw}")
        B_raw = import_matrix_b(sort='yes', sort_row=1, sort_column=3)
        logger.warning(f"Matrix B \n {B_raw}")
        lci_flow = B_raw.iloc[1:, 0].reset_index(drop=True)
        logger.warning(f"LCI FLOW \n {lci_flow}")
        # 2. Multifunctionality Adjustment
        try:
            adjusted_A, adjusted_B = adjust_matrix_for_multiple_outputs(A_raw, B_raw)
            logger.warning(f"Adjusted B\n{adjusted_B}")
            logger.warning(f"Adjusted A\n{adjusted_A}")
        except Exception as e:
            logger.error(f"Error during matrix adjustment: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())

        adjusted_B_pd=pd.DataFrame(adjusted_B)
        adjusted_A=pd.DataFrame(adjusted_A)

        # 3. Process names
        Process_Names = pd.DataFrame([adjusted_A.columns.tolist(), adjusted_A.columns.tolist()])
        Process_Names = Process_Names.iloc[0:1, 3:]
        logger.warning(f"Process Names \n {Process_Names}")

        adjusted_A=adjusted_A.iloc[0:,3:]
        #adjusted_A_np = np.array(adjusted_A)
        adjusted_A_np = np.nan_to_num(np.array(adjusted_A, dtype=float), nan=0.0)
        logger.warning(f"A array \n {adjusted_A_np.size}")
        #A_nan = np.isnan(adjusted_A_np).any()
        #logger.warning(f"A contains NaN:", A_nan)

        
        adjusted_B=adjusted_B.iloc[0:,3:]
        #adjusted_B_np = np.array(adjusted_B)
        adjusted_B_np = np.nan_to_num(np.array(adjusted_B, dtype=float), nan=0.0)
        logger.warning(f"B Array \n {adjusted_B_np.size}")
        #B_nan = np.isnan(adjusted_B_np).any()
        #logger.warning(f"B contains NaN:", B_nan)


        # 3. Final Demand Vector
        #flow_id_to_value = {row['task']: row['functional_unit'] for row in rows}
        #logger.warning(f"Flow ID : \n {flow_id_to_value}")
        final_demand = next(iter({row['functional_unit'] for row in rows}))
        impact_category = next((row['impact_category'] for row in rows if 'impact_category' in row), 'GWP')
        logger.warning(f"Impact category : {impact_category}")
        #flow_id_list = A_raw.iloc[1:, 1].tolist()
        #logger.warning(f"Flow ID list (length {len(flow_id_list)}): {flow_id_list}")
        #final_demand = np.array([float(flow_id_to_value.get(fid, 0)) for fid in flow_id_list])
        for i in range(12):
            final_demand = final_demand +" 0"

        final_demand = final_demand.split()
        final_demand = np.array([float(x) for x in final_demand])
        logger.warning(f"Final demand")
        logger.warning(f" {final_demand}")

        
        # Call the function
        try:
            scaling_vector = calculate_scaling_vector(adjusted_A_np, final_demand)
            logger.warning(f"Scaling vector: {scaling_vector}")
        except np.linalg.LinAlgError as e:
            logger.warning(f"Scaling vector error: {e}")
            return {"error": f"Cannot solve linear system: {e}"}

        # 5. Inventory Impact
        g = calculate_inventory_impact(adjusted_B, scaling_vector)
        logger.warning(f"g : {g}")

        g = np.array(g).flatten()  # Ensure shape is (n,)
        total_impact = calculate_impact_score(g, lci_flow, impact_category)
        logger.warning(f"Total impact: {total_impact}")

        # 6. Process Contribution
        diag_s = diagonal_vector(scaling_vector)
        logger.warning(f"Shape Diag S: {diag_s.shape}")
        G = calculate_inventory_matrix(adjusted_B_np, diag_s)
        logger.warning(f"Shape inventory matrix: {G.shape}")
        Process_contribution = calculate_process_contribution(G, lci_flow, impact_category)
        logger.warning(f"Process contribution : {Process_contribution}")

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
        
        contribution_table = pd.DataFrame({
            "Process": Process_Names,
            "Contribution": Process_contribution
        }).query("Contribution != 0")
        logger.warning(f"Process name : {Process_Names}")
        logger.warning(f"contibution table: {contribution_table}")

        # 7. Chart
        chart_base64 = create_graph(
            contribution_table.values,
            graph_type='pie',
            x_column=0,
            y_column=1,
            has_header=False,
            xlabel="Process",
            ylabel="Contribution",
            title="Contribution Analysis"
        )

        return {
            "total_impact": total_impact,
            "chart_base64": chart_base64,
            "contribution_table": contribution_table.to_dict('records')
        }

    except Exception as e:
        return {"error": f"Unexpected error: {e}"}
