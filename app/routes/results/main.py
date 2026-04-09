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

graph_data = {}


def build_b_alignment(adjusted_B: pd.DataFrame):
    """
    Keep B metadata and numeric rows aligned.
    """
    b_meta = adjusted_B.iloc[:, :2].copy()
    b_meta.columns = ["Flow", "Flow_id"]
    b_meta["Flow"] = b_meta["Flow"].astype(str).str.strip()
    b_meta["Flow_id"] = b_meta["Flow_id"].astype(str).str.strip()

    logger.warning(
        "Adjusted B with labels:\n%s",
        pd.concat(
            [adjusted_B.iloc[:, :3].reset_index(drop=True),
             adjusted_B.iloc[:, 3:].reset_index(drop=True)],
            axis=1
        ).to_string()
    )

    adjusted_B_numeric = adjusted_B.iloc[:, 3:].copy()
    adjusted_B_np = np.nan_to_num(np.array(adjusted_B_numeric, dtype=float), nan=0.0)

    return b_meta.reset_index(drop=True), adjusted_B_np


def get_lci_flow_labels(b_meta: pd.DataFrame):
    return b_meta["Flow"].astype(str).reset_index(drop=True)


def run_analysis(rows):
    results = []
    all_contributions_data = []

    logger.warning("--- STARTING run_analysis ---")

    for i, row in enumerate(rows):
        task_text = row.get('taskText', 'Unknown Task')
        logger.warning("--- Processing Row %s (%s) ---", i + 1, task_text)

        try:
            params = init_param_variable()
            growth_regrowth = params.get('regeneration_mode', 0)

            task_id = row.get('task')
            functional_unit = row.get('functional_unit', 1.0)
            flow = row.get('flow')
            flow_text = row.get('flowText')
            flow_unit = row.get('unit')
            unit_text = row.get('unitText')
            impact_category = row.get('impact_category', 'GWP')
            manual_allocation = row.get('manual_allocation', {})

            logger.warning(
                "Input:\n Task: %s, Flow: %s, Functional unit: %s, Unit: %s, Impact category: %s",
                task_id, flow, functional_unit, flow_unit, impact_category
            )

            try:
                functional_unit = float(functional_unit)
            except (ValueError, TypeError):
                logger.error(
                    "Task %s: Invalid functional unit '%s'; defaulting to 1.0",
                    task_id, functional_unit
                )
                functional_unit = 1.0

            try:
                task_id = int(task_id)
            except (ValueError, TypeError):
                logger.error("Invalid task_id '%s'; skipping this row", task_id)
                results.append({
                    "error": f"Invalid task id: {task_id}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 1. Import data
            # ---------------------------------------------------------
            A_raw = format_rawdata_a(task_id, A='A')
            B_raw = import_matrix_b(task_id, sort='yes')

            logger.warning("B_raw with labels:\n%s", B_raw.to_string())

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

            # Force B process order to follow A
            a_process_cols = A_raw.columns.tolist()[3:]
            b_fixed_cols = B_raw.columns.tolist()[:3]

            missing_in_b = [c for c in a_process_cols if c not in B_raw.columns]
            if missing_in_b:
                raise ValueError(f"Matrix B is missing process columns present in A: {missing_in_b}")

            B_raw = B_raw[b_fixed_cols + a_process_cols]

            if growth_regrowth == 1:
                value_B, value_A = forest_growth_function(task_id)
                A_raw = forest_growth_newA(A_raw, value_A, 'A')
                B_raw = forest_growth_newA(B_raw, value_B, 'B')
            else:
                logger.warning("Growth/regrowth model disabled.")

            logger.warning("Shape: %s\nMatrix A:\n%s", A_raw.shape, A_raw.to_string())
            logger.warning("Shape: %s\nMatrix B:\n%s", B_raw.shape, B_raw.to_string())

            # ---------------------------------------------------------
            # 2. Multifunctionality
            # ---------------------------------------------------------
            try:
                adjusted_A, adjusted_B = adjust_matrix_for_multiple_outputs(
                    A_raw,
                    B_raw,
                    manual_allocation=manual_allocation,
                    task_id=task_id
                )
            except ManualAllocationRequired as e:
                logger.error(
                    "Manual allocation missing in database for task %s. %s",
                    task_text,
                    e.message
                )
                results.append({
                    "error": "Manual allocation missing in datasheet. Please configure allocation before running analysis.",
                    "task_name": task_text
                })
                continue
            except Exception as e:
                logger.error(
                    "Error during matrix adjustment for task %s: %s",
                    task_text, str(e), exc_info=True
                )
                results.append({
                    "error": f"Error adjusting matrices: {str(e)}",
                    "task_name": task_text
                })
                continue

            adjusted_A = pd.DataFrame(adjusted_A)
            adjusted_B = pd.DataFrame(adjusted_B)

            logger.warning("Adjusted A:\n%s", adjusted_A.to_string())
            logger.warning("Adjusted B:\n%s", adjusted_B.to_string())

            # ---------------------------------------------------------
            # 3. Build aligned B + LCI labels
            # ---------------------------------------------------------
            b_meta, adjusted_B_np = build_b_alignment(adjusted_B)
            lci_flow = get_lci_flow_labels(b_meta)

            logger.warning("Aligned LCI flow: %s", list(lci_flow))

            # ---------------------------------------------------------
            # 4. Functional unit to SI
            # ---------------------------------------------------------
            try:
                functional_unit_si = unit_conversion(functional_unit, unit_text, 'SI')
                functional_unit_si_unit = get_si_unit(unit_text)
            except Exception as e:
                logger.error(
                    "Unit conversion failed for task %s: %s",
                    task_text, e, exc_info=True
                )
                results.append({
                    "error": f"Unit conversion failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 5. Final demand vector
            # ---------------------------------------------------------
            selected_flow_id = str(flow).strip()

            flow_names = adjusted_A.iloc[:, :3].copy()
            flow_names.columns = ['flow', 'flow ID', 'unit']
            flow_names['flow ID'] = flow_names['flow ID'].astype(str)

            flow_names['Amount'] = np.where(
                flow_names['flow ID'] == selected_flow_id,
                float(functional_unit_si),
                0.0
            )

            logger.warning("Selected flow from UI: %s", selected_flow_id)
            logger.warning("Adjusted A flow IDs: %s", flow_names['flow ID'].tolist())
            logger.warning("Flow mapping table:\n%s", flow_names.to_string())

            final_demand = flow_names['Amount'].values.astype(float)
            logger.warning("Final demand:\n%s", final_demand.tolist())

            # ---------------------------------------------------------
            # 6. Extract matrices
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

            adjusted_A_np = np.nan_to_num(
                np.array(adjusted_A.iloc[:, 3:], dtype=float),
                nan=0.0
            )

            logger.warning("Process names: %s", process_names)
            logger.warning("Adjusted B numeric:\n%s", pd.DataFrame(adjusted_B_np, columns=process_names).to_string())
            logger.warning("LCI flows: %s", list(lci_flow))

            if adjusted_A_np.shape[0] != len(final_demand):
                results.append({
                    "error": (
                        f"Final demand length ({len(final_demand)}) does not match "
                        f"number of A rows ({adjusted_A_np.shape[0]})."
                    ),
                    "task_name": task_text
                })
                continue

            if adjusted_B_np.shape[1] != adjusted_A_np.shape[1]:
                results.append({
                    "error": (
                        f"A and B process-column mismatch: "
                        f"A={adjusted_A_np.shape}, B={adjusted_B_np.shape}"
                    ),
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 7. Scaling vector
            # ---------------------------------------------------------
            try:
                scaling_vector = calculate_scaling_vector(adjusted_A_np, final_demand)
            except np.linalg.LinAlgError as e:
                logger.error(
                    "Scaling vector error (singular matrix) for task %s: %s",
                    task_text, e
                )
                results.append({
                    "error": f"Cannot solve linear system (singular matrix): {e}",
                    "task_name": task_text
                })
                continue
            except Exception as e:
                logger.error(
                    "Scaling vector error for task %s: %s",
                    task_text, e, exc_info=True
                )
                results.append({
                    "error": f"Scaling vector calculation failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 8. Inventory impact
            # ---------------------------------------------------------
            try:
                g = calculate_inventory_impact(adjusted_B_np, scaling_vector)
                g = np.array(g).flatten()

                total_impact = calculate_impact_score(g, lci_flow, impact_category)
                logger.warning("Total impact:\n%s", total_impact)
            except Exception as e:
                logger.error(
                    "Impact calculation error for task %s: %s",
                    task_text, e, exc_info=True
                )
                results.append({
                    "error": f"Impact calculation failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 9. Process contribution
            # ---------------------------------------------------------
            try:
                diag_s = diagonal_vector(scaling_vector)
                G = calculate_inventory_matrix(adjusted_B_np, diag_s)

                process_contribution = calculate_process_contribution(
                    G, lci_flow, impact_category
                )

                process_contribution = np.array(process_contribution).flatten().astype(float)
                process_names_np = np.array(process_names).flatten().astype(str)

                mask = process_contribution != 0
                process_names_filtered = process_names_np[mask]
                process_contribution_filtered = process_contribution[mask]

                contribution_table_df = pd.DataFrame({
                    "Process": process_names_filtered,
                    "Contribution": process_contribution_filtered
                })

                logger.warning("Contribution table:\n%s", contribution_table_df.to_string())

            except Exception as e:
                logger.error(
                    "Process contribution error for task %s: %s",
                    task_text, e, exc_info=True
                )
                results.append({
                    "error": f"Process contribution calculation failed: {str(e)}",
                    "task_name": task_text
                })
                continue

            # ---------------------------------------------------------
            # 10. Store comparison rows
            # ---------------------------------------------------------
            all_contributions_data.extend(
                pd.DataFrame({
                    "Process": process_names_filtered,
                    "Task": task_text,
                    "Contribution": process_contribution_filtered
                }).to_dict('records')
            )

            # Store graph-safe plain list
            graph_values = None
            if not contribution_table_df.empty:
                graph_values = contribution_table_df.astype({
                    "Process": str,
                    "Contribution": float
                }).values.tolist()

            graph_data[task_id] = {
                "task_name": task_text,
                "contribution_table_values": graph_values
            }

            # Optional preview chart for summary card
            chart_base64 = None
            chart_note = None
            if graph_values:
                has_negative = (contribution_table_df["Contribution"] < 0).any()

                if has_negative:
                    chart_note = "Negative process contributions detected. Pie chart replaced with bar chart."
                    chart_base64 = create_graph(
                        graph_values,
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
                        graph_values,
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
            logger.exception("Error in task %s", task_text)
            results.append({"error": str(e), "task_name": task_text})

    # ---------------------------------------------------------
    # FINAL COMPARISON TABLE
    # ---------------------------------------------------------
    if all_contributions_data:
        try:
            df_all = pd.DataFrame(all_contributions_data)
            pivot = df_all.pivot_table(
                index='Process',
                columns='Task',
                values='Contribution',
                aggfunc='sum',
                fill_value=0
            )
            combined = pivot.reset_index().to_dict('records')
        except Exception as e:
            logger.error("Error generating combined contribution table: %s", e, exc_info=True)
            combined = []
    else:
        combined = []

    logger.warning("--- ENDING run_analysis ---")

    return {
        "individual_results": results,
        "combined_contribution_table": combined
    }


def graph_results_single(chart_type='pie', theme='vibrant', task_name=None, task_id=None):
    task_id = int(task_id)
    data = graph_data.get(task_id, {}).get("contribution_table_values")

    if not data or len(data) == 0:
        logger.warning("No data available for graph for task %s", task_id)
        return None

    logger.warning("Graph data for task %s:\n%s", task_id, data)

    return create_graph_wt(
        data,
        graph_type=chart_type,
        x_column=0,
        y_column=1,
        has_header=False,
        xlabel="Process",
        ylabel="Contribution",
        title=f"Contribution Analysis: {task_name}",
        theme=theme
    )