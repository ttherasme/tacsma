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
from .multifunctionality import adjust_matrix_for_multiple_outputs, ManualAllocationRequired
from .create_graph import create_graph, create_graph_wt
from .Forest_growth_model import forest_growth_newA, forest_growth_function, init_param_variable
from .unit_conversion import unit_conversion, get_si_unit

import matplotlib
matplotlib.use('Agg')

graph_data = {}  # dictionary indexed by task_id


def run_analysis(rows):
    """
    Runs LCI/LCA analysis for multiple input rows, calculates individual results,
    and generates a single pivoted contribution table comparing tasks.

    Returns:
    {
        "individual_results": [...],
        "combined_contribution_table": [...]
    }
    """
    results = []
    all_contributions_data = []

    logger.warning("--- STARTING run_analysis ---")

    for i, row in enumerate(rows):
        task_text = row.get('taskText', 'Unknown Task')
        logger.warning(f"--- Processing Row {i + 1} ({task_text}) ---")

        try:
            params = init_param_variable()
            growth_regrowth = params.get('regeneration_mode', False)

            task_id = row.get('task')
            functional_unit = row.get('functional_unit', 1.0)
            flow = row.get('flow')
            flow_text = row.get('flowText')
            flow_unit = row.get('unit')
            unit_text = row.get('unitText')
            impact_category = row.get('impact_category', 'GWP')
            manual_allocation = row.get('manual_allocation', {})

            logger.warning(
                f"Input :\n Task : {task_id}, Flow : {flow}, "
                f"Functional unit : {functional_unit}, Unit : {flow_unit}, "
                f"Impact category : {impact_category}"
            )

            try:
                functional_unit = float(functional_unit)
            except (ValueError, TypeError):
                logger.error(
                    f"Task {task_id}: Invalid functional unit '{functional_unit}'; defaulting to 1.0"
                )
                functional_unit = 1.0

            try:
                task_id = int(task_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid task_id '{task_id}'; skipping this row")
                results.append({
                    "error": f"Invalid task id: {task_id}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 1. Import Data
            # ---------------------------------------------------------
            A_raw = format_rawdata_a(task_id, A='A')

            if growth_regrowth is True:
                value_B, value_A = forest_growth_function()
                A_raw = forest_growth_newA(A_raw, value_A, 'A')
            else:
                logger.error("No growth regrowth model")

            B_raw = import_matrix_b(task_id, sort='yes', sort_row=1, sort_column=3)

            if growth_regrowth is True:
                B_raw = forest_growth_newA(B_raw, value_B, 'B')
            else:
                logger.error("No growth regrowth model")

            if A_raw is None or getattr(A_raw, "empty", True):
                results.append({
                    "error": "Matrix A is empty or could not be loaded.",
                    "task_name": task_text
                })
                continue

            if B_raw is None or getattr(B_raw, "empty", True):
                results.append({
                    "error": "Matrix B is empty or could not be loaded.",
                    "task_name": task_text
                })
                continue

            lci_flow = B_raw.iloc[:, 0].reset_index(drop=True)
            logger.warning(f"LCI Flow: \n {lci_flow}")

            # ---------------------------------------------------------
            # 2. Multifunctionality Adjustment
            # ---------------------------------------------------------
            try:
                adjusted_A, adjusted_B = adjust_matrix_for_multiple_outputs(
                    A_raw,
                    B_raw,
                    manual_allocation=manual_allocation
                )
            except ManualAllocationRequired as e:
                logger.warning(
                    f"Manual allocation required for task {task_text}, "
                    f"process {e.process_name} ({e.process_id})"
                )
                results.append({
                    "task_name": task_text,
                    "requires_manual_allocation": True,
                    "message": e.message,
                    "process_name": e.process_name,
                    "process_id": e.process_id,
                    "process_index": e.process_index,
                    "outputs": e.outputs
                })
                continue
            except Exception as e:
                logger.error(
                    f"Error during matrix adjustment for task {task_text}: {str(e)}",
                    exc_info=True
                )
                results.append({
                    "error": f"Error adjusting matrices: {str(e)}",
                    "task_name": task_text
                })
                continue

            adjusted_A = pd.DataFrame(adjusted_A)
            adjusted_B = pd.DataFrame(adjusted_B)

            logger.warning(f"Adjusted A:\n {adjusted_A}")
            logger.warning(f"Adjusted B:\n {adjusted_B}")

            # ---------------------------------------------------------
            # 3. Convert functional unit to SI BEFORE final demand
            # ---------------------------------------------------------
            try:
                functional_unit_si = unit_conversion(functional_unit, unit_text, 'SI')
                functional_unit_si_unit = get_si_unit(unit_text)
            except Exception as e:
                logger.error(
                    f"Unit conversion failed for task {task_text}: {e}",
                    exc_info=True
                )
                results.append({
                    "error": f"Unit conversion failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            logger.warning(
                f"Task {task_id}: functional unit entered={functional_unit} {unit_text}, "
                f"converted={functional_unit_si} {functional_unit_si_unit}"
            )

            flow_dict = {
                'flow': str(flow),
                'unit': functional_unit_si_unit,
                'functional_unit': functional_unit_si
            }
            flow_df = pd.DataFrame([flow_dict])

            flow_names = adjusted_A.iloc[:, :2].copy()
            flow_names.columns = ['flow', 'flow ID']
            flow_names['flow ID'] = flow_names['flow ID'].astype(str)

            flow_names['Amount'] = flow_names['flow ID'].map(
                flow_df.set_index('flow')['functional_unit']
            ).fillna(0)

            logger.warning(f"Flow name:\n {flow_names}")

            final_demand = flow_names['Amount'].values.astype(float)
            logger.warning(f"Final demand:\n {final_demand}")

            # ---------------------------------------------------------
            # 4. Extract process matrices and names
            # ---------------------------------------------------------
            if adjusted_A.shape[1] <= 3:
                results.append({
                    "error": "Adjusted A matrix has no process columns.",
                    "task_name": task_text
                })
                continue

            if adjusted_B.shape[1] <= 3:
                results.append({
                    "error": "Adjusted B matrix has no process columns.",
                    "task_name": task_text
                })
                continue

            process_names = adjusted_A.columns.tolist()[3:]
            logger.warning(f"Process name:\n {process_names}")

            adjusted_A_numeric = adjusted_A.iloc[:, 3:]
            adjusted_A_np = np.nan_to_num(np.array(adjusted_A_numeric, dtype=float), nan=0.0)

            adjusted_B_numeric = adjusted_B.iloc[:, 3:]
            adjusted_B_np = np.nan_to_num(np.array(adjusted_B_numeric, dtype=float), nan=0.0)

            # ---------------------------------------------------------
            # 5. Scaling Vector
            # ---------------------------------------------------------
            try:
                scaling_vector = calculate_scaling_vector(adjusted_A_np, final_demand)
                logger.warning(f"Scaling vector:\n {scaling_vector}")
            except np.linalg.LinAlgError as e:
                logger.error(f"Scaling vector error (singular matrix) for task {task_text}: {e}")
                results.append({
                    "error": f"Cannot solve linear system (singular matrix): {e}",
                    "task_name": task_text
                })
                continue
            except Exception as e:
                logger.error(f"Scaling vector error for task {task_text}: {e}", exc_info=True)
                results.append({
                    "error": f"Scaling vector calculation failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 6. Inventory Impact
            # ---------------------------------------------------------
            try:
                g = calculate_inventory_impact(adjusted_B_numeric, scaling_vector)
                g = np.array(g).flatten()
                total_impact = calculate_impact_score(g, lci_flow, impact_category)
                logger.warning(f"total impact:\n {total_impact}")
            except Exception as e:
                logger.error(f"Impact calculation error for task {task_text}: {e}", exc_info=True)
                results.append({
                    "error": f"Impact calculation failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 7. Process Contribution
            # ---------------------------------------------------------
            try:
                diag_s = diagonal_vector(scaling_vector)
                G = calculate_inventory_matrix(adjusted_B_np, diag_s)
                process_contribution = calculate_process_contribution(G, lci_flow, impact_category)

                process_names_np = np.array(process_names).flatten().astype(str)
                process_contribution = np.array(process_contribution).flatten().astype(float)

                non_zero_mask = process_contribution != 0
                process_names_filtered = process_names_np[non_zero_mask]
                process_contribution_filtered = process_contribution[non_zero_mask]

                contribution_table_df = pd.DataFrame({
                    "Process": process_names_filtered,
                    "Contribution": process_contribution_filtered
                }).query("Contribution != 0")

                logger.warning(f"Contribution table:\n {contribution_table_df}")

            except Exception as e:
                logger.error(f"Process contribution error for task {task_text}: {e}", exc_info=True)
                results.append({
                    "error": f"Process contribution calculation failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 8. Combined comparison table payload
            # ---------------------------------------------------------
            current_row_contributions = pd.DataFrame({
                "Process": process_names_np,
                "Task": task_text,
                "Contribution": process_contribution
            })
            all_contributions_data.extend(current_row_contributions.to_dict('records'))

            # ---------------------------------------------------------
            # 9. Chart cache
            # ---------------------------------------------------------
            graph_data[task_id] = {
                "task_name": task_text,
                "contribution_table_values": (
                    contribution_table_df.values if not contribution_table_df.empty else None
                )
            }

            # ---------------------------------------------------------
            # 10. Individual result payload
            # ---------------------------------------------------------
            chart_base64 = None
            chart_note = None

            if not contribution_table_df.empty:
                has_negative = (contribution_table_df["Contribution"] < 0).any()

                if has_negative:
                    chart_note = "Negative process contributions detected. Pie chart replaced with bar chart."
                    chart_base64 = create_graph(
                        contribution_table_df.values,
                        graph_type='bar',
                        x_column=0,
                        y_column=1,
                        has_header=False,
                        xlabel="Process",
                        ylabel="Contribution",
                        title=f"Contribution Analysis: {task_text}"
                    )
                else:
                    chart_base64 = create_graph(
                        contribution_table_df.values,
                        graph_type='pie',
                        x_column=0,
                        y_column=1,
                        has_header=False,
                        xlabel="Process",
                        ylabel="Contribution",
                        title=f"Contribution Analysis: {task_text}"
                    )

            results.append({
                "task_id": task_id,
                "task_name": task_text,
                "flow_name": str(flow_text).strip() if flow_text is not None else "",
                "entered_value": functional_unit,
                "entered_unit": unit_text,
                "calculation_value_si": functional_unit_si,
                "calculation_unit_si": functional_unit_si_unit,
                "product": f"{functional_unit} {unit_text} {str(flow_text).strip()}",
                "impact_category": impact_category,
                "total_impact": total_impact,
                "chart_base64": chart_base64,
                "chart_note": chart_note,
                "contribution_table": contribution_table_df.to_dict('records')
            })

        except Exception as e:
            logger.exception(f"Unexpected error for task {task_text}: {e}")
            results.append({
                "error": f"Unexpected error: {e}",
                "task_name": task_text
            })

    logger.warning("Starting final pivot table generation...")

    if all_contributions_data:
        try:
            df_all = pd.DataFrame(all_contributions_data)
            pivot_table = df_all.pivot_table(
                index='Process',
                columns='Task',
                values='Contribution',
                aggfunc='sum',
                fill_value=0
            )
            final_contribution_table = pivot_table.reset_index().to_dict('records')
        except Exception as e:
            logger.error(f"Error generating combined contribution table: {e}", exc_info=True)
            final_contribution_table = []
    else:
        final_contribution_table = []

    logger.warning("--- ENDING run_analysis ---")
    logging.debug("Returning from run_analysis(): %s", results)
    logging.debug("Returning from run_analysis(): %s", final_contribution_table)

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

    logging.debug(f"Data chart :\n {data_contribution}")

    graph = None
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

    return graph