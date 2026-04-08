import numpy as np
import pandas as pd
import logging

from app import db
from app.models import Datasheet, Element, Item, Step
from .unit_conversion import unit_conversion, get_si_unit

logger = logging.getLogger(__name__)


class ManualAllocationRequired(Exception):
    def __init__(self, message, process_name=None, process_id=None, process_index=None, outputs=None):
        super().__init__(message)
        self.message = message
        self.process_name = process_name
        self.process_id = process_id
        self.process_index = process_index
        self.outputs = outputs or []


def get_relevant_output_rows(A, retained_columns_Aa, process_idx, task_id, process_name):
    """
    Return only matrix row indices corresponding to relevant outputs for allocation:
      - Product
      - Co-Products with CHK == 0
    for the same task and same process/step.

    Falls back to all positive outputs if task_id is missing.
    """
    if not task_id or not process_name:
        return np.where(A[:, process_idx] > 0)[0]

    db_rows = (
        db.session.query(
            Element.IDBE.label("flow_id")
        )
        .join(Datasheet, Datasheet.IDE == Element.IDE)
        .join(Item, Element.IDI == Item.IDI)
        .join(Step, Datasheet.IDS == Step.IDS)
        .filter(Datasheet.IDT == task_id)
        .filter(Step.SName == process_name)
        .filter(
            db.or_(
                Item.IName == "Product",
                db.and_(Item.IName == "Co-Products", Datasheet.CHK == 0)
            )
        )
        .all()
    )

    allowed_flow_ids = {str(r.flow_id) for r in db_rows}

    output_rows = []
    for row_idx in np.where(A[:, process_idx] > 0)[0]:
        matrix_flow_id = str(retained_columns_Aa.iloc[row_idx, 1])
        if matrix_flow_id in allowed_flow_ids:
            output_rows.append(row_idx)

    return np.array(output_rows, dtype=int)


def build_output_payload(output_rows, retained_columns_Aa, raw_values, raw_units, si_units):
    outputs = []
    for row, raw_value, raw_unit, si_unit in zip(output_rows, raw_values, raw_units, si_units):
        outputs.append({
            "row_index": int(row),
            "flow_name": str(retained_columns_Aa.iloc[row, 0]),
            "flow_id": str(retained_columns_Aa.iloc[row, 1]),
            "raw_value": float(raw_value),
            "raw_unit": str(raw_unit),
            "si_unit": str(si_unit)
        })
    return outputs


def calculate_allocation_factors_with_units(
    A,
    retained_columns_Aa,
    process_idx,
    process_name=None,
    process_id=None,
    task_id=None
):
    """
    Automatic allocation:
    - considers only relevant outputs:
        * Product
        * Co-Products with CHK == 0
      for the same task/process
    - all relevant outputs must have the same SI property
    - converts values to SI before calculating allocation factors
    """
    output_rows = get_relevant_output_rows(
        A,
        retained_columns_Aa,
        process_idx,
        task_id,
        process_name
    )

    if len(output_rows) == 0:
        raise ValueError(
            f"Process '{process_name}' has no relevant outputs "
            f"(Product / Co-Products with CHK = 0)."
        )

    if len(output_rows) == 1:
        return np.array([1.0]), output_rows

    raw_values = A[output_rows, process_idx]
    raw_units = [str(retained_columns_Aa.iloc[row, 2]).strip() for row in output_rows]

    try:
        si_units = [get_si_unit(unit) for unit in raw_units]
    except Exception as e:
        raise ManualAllocationRequired(
            message=f"Could not determine comparable unit properties automatically: {e}",
            process_name=process_name,
            process_id=process_id,
            process_index=int(process_idx),
            outputs=build_output_payload(
                output_rows,
                retained_columns_Aa,
                raw_values,
                raw_units,
                ["unknown"] * len(output_rows)
            )
        )

    if not all(si == si_units[0] for si in si_units):
        raise ManualAllocationRequired(
            message=(
                "Flows have different properties (for example mass and volume). "
                "Automatic allocation cannot be performed."
            ),
            process_name=process_name,
            process_id=process_id,
            process_index=int(process_idx),
            outputs=build_output_payload(
                output_rows,
                retained_columns_Aa,
                raw_values,
                raw_units,
                si_units
            )
        )

    values_si = np.array([
        float(unit_conversion(value, unit, 'SI'))
        for value, unit in zip(raw_values, raw_units)
    ], dtype=float)

    total_output_si = np.sum(values_si)

    if total_output_si == 0:
        logger.warning(
            "Process '%s' has multiple relevant outputs but zero total SI value. "
            "Using uniform allocation.",
            process_name
        )
        allocation_factors = np.full(len(values_si), 1.0 / len(values_si))
    else:
        allocation_factors = values_si / total_output_si

    return allocation_factors, output_rows


def get_manual_allocation_factors(
    A,
    retained_columns_Aa,
    process_idx,
    provided_factors,
    process_id,
    task_id=None,
    process_name=None
):
    """
    Manual allocation:
    - applies only to relevant outputs:
        * Product
        * Co-Products with CHK == 0
      for the same task/process
    - each factor must be between 0 and 1
    - sum must be <= 1
    """
    output_rows = get_relevant_output_rows(
        A,
        retained_columns_Aa,
        process_idx,
        task_id,
        process_name
    )

    if len(output_rows) == 0:
        raise ValueError(
            f"Process '{process_id}' has no relevant outputs for manual allocation."
        )

    allocation_factors = []

    for row in output_rows:
        flow_id = str(retained_columns_Aa.iloc[row, 1])

        if flow_id not in provided_factors:
            raise ValueError(
                f"Missing manual allocation factor for flow_id '{flow_id}' in process '{process_id}'."
            )

        factor = float(provided_factors[flow_id])

        if factor < 0 or factor > 1:
            raise ValueError(
                f"Manual allocation factor for flow_id '{flow_id}' must be between 0 and 1."
            )

        allocation_factors.append(factor)

    allocation_factors = np.array(allocation_factors, dtype=float)
    total = allocation_factors.sum()

    if total > 1.0000001:
        raise ValueError(
            f"Manual allocation factors for process '{process_id}' exceed 1."
        )

    return allocation_factors, output_rows


def get_db_allocation_for_process(retained_columns_Aa, output_rows, task_id, process_name):
    """
    Get allocation from Datasheet only for relevant outputs:
      - Product
      - Co-Products with CHK == 0
    in the same task and same process.

    IMPORTANT:
    Matrix flow ids use Element.IDBE, so DB matching must also use IDBE.
    Returns dict: {flow_id(IDBE): factor}
    """
    if not task_id or not process_name:
        return {}

    db_rows = (
        db.session.query(
            Element.IDBE.label("flow_id"),
            Datasheet.ManualAllocation.label("manual_allocation")
        )
        .join(Datasheet, Datasheet.IDE == Element.IDE)
        .join(Item, Element.IDI == Item.IDI)
        .join(Step, Datasheet.IDS == Step.IDS)
        .filter(Datasheet.IDT == task_id)
        .filter(Step.SName == process_name)
        .filter(
            db.or_(
                Item.IName == "Product",
                db.and_(Item.IName == "Co-Products", Datasheet.CHK == 0)
            )
        )
        .all()
    )

    db_alloc = {}

    for row in output_rows:
        flow_id = str(retained_columns_Aa.iloc[row, 1])  # this is IDBE in matrix

        matches = [
            float(r.manual_allocation)
            for r in db_rows
            if str(r.flow_id) == flow_id and r.manual_allocation is not None
        ]

        if matches:
            # use the first non-null value
            db_alloc[flow_id] = matches[0]

    return db_alloc


def adjust_matrix_for_multiple_outputs(Aa, Bb, manual_allocation=None, task_id=None):
    """
    Adjust A and B matrices for multifunctionality.

    manual_allocation format:
    {
        "process_key": {
            "flow_id_1": 0.7,
            "flow_id_2": 0.3
        }
    }

    Notes:
    - process_key is generated as: "{process_name}__col_{col}"
    - relevant outputs for allocation are only:
        * Product
        * Co-Products with CHK == 0
      for the same task and same process
    """
    manual_allocation = manual_allocation or {}

    retained_columns_Aa = Aa.iloc[:, :3].copy()
    retained_columns_Bb = Bb.iloc[:, :3].copy()

    process_names = Aa.columns.tolist()[3:]

    A_val = Aa.iloc[:, 3:].reset_index(drop=True)
    B_val = Bb.iloc[:, 3:].reset_index(drop=True)

    A = A_val.values.astype(float)
    B = B_val.values.astype(float)

    num_rows, num_columns = A.shape
    num_rowsB, _ = B.shape

    new_A = []
    new_B = []
    new_column_names = []
    new_column_id = []

    for col in range(num_columns):
        process_name = str(process_names[col])
        process_id = f"{process_name}__col_{col}"

        output_rows = get_relevant_output_rows(
            A,
            retained_columns_Aa,
            col,
            task_id,
            process_name
        )

        num_outputs = len(output_rows)

        # No relevant outputs or only one relevant output -> no allocation split needed
        if num_outputs <= 1:
            new_A.append(A[:, col])
            new_B.append(B[:, col])
            new_column_names.append(process_name)
            new_column_id.append(process_id)
            continue

        try:
            allocation_factors, output_rows = calculate_allocation_factors_with_units(
                A,
                retained_columns_Aa,
                col,
                process_name=process_name,
                process_id=process_id,
                task_id=task_id
            )

        except ManualAllocationRequired as e:
            # 1. Try frontend-provided manual allocation
            if process_id in manual_allocation:
                provided_factors = manual_allocation[process_id]

                allocation_factors, output_rows = get_manual_allocation_factors(
                    A,
                    retained_columns_Aa,
                    col,
                    provided_factors,
                    process_id,
                    task_id=task_id,
                    process_name=process_name
                )

            else:
                # 2. Try DB allocation from Datasheet
                db_alloc = get_db_allocation_for_process(
                    retained_columns_Aa,
                    output_rows,
                    task_id,
                    process_name
                )

                logger.debug("Relevant outputs for %s: %s", process_name, output_rows)
                logger.debug("DB allocation found for %s: %s", process_name, db_alloc)

                if db_alloc and len(db_alloc) == len(output_rows):
                    allocation_factors, output_rows = get_manual_allocation_factors(
                        A,
                        retained_columns_Aa,
                        col,
                        db_alloc,
                        process_id,
                        task_id=task_id,
                        process_name=process_name
                    )
                else:
                    raise e

        for i, factor in enumerate(allocation_factors):
            new_column_A = np.zeros(num_rows)
            new_column_B = np.zeros(num_rowsB)

            # Allocate inputs only (negative values in A)
            new_column_A[A[:, col] < 0] = A[A[:, col] < 0, col] * factor

            # Allocate B entirely by factor
            new_column_B = B[:, col] * factor

            # Keep only one relevant output in each split column
            new_column_A[output_rows] = 0.0
            new_column_A[output_rows[i]] = A[output_rows[i], col]

            new_A.append(new_column_A)
            new_B.append(new_column_B)

            output_flow_name = str(retained_columns_Aa.iloc[output_rows[i], 0])
            new_column_names.append(f"{process_name} - {output_flow_name}")
            new_column_id.append(f"{process_id}_{i+1}")

    adjusted_A_val = pd.DataFrame(np.column_stack(new_A), columns=new_column_names)
    adjusted_B_val = pd.DataFrame(np.column_stack(new_B), columns=new_column_names)

    adjusted_A = pd.concat(
        [retained_columns_Aa.reset_index(drop=True), adjusted_A_val.reset_index(drop=True)],
        axis=1
    )
    adjusted_B = pd.concat(
        [retained_columns_Bb.reset_index(drop=True), adjusted_B_val.reset_index(drop=True)],
        axis=1
    )

    return adjusted_A, adjusted_B