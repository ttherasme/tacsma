# -*- coding: utf-8 -*-
"""
Forest growth model utilities.

Updated so that:
- loc comes from Tasks.Region
- HWP_tree comes from Datasheet.ValueD where BElement.EName == 'Tree' for the task
- HWP_tree is converted to SI (kg)
"""

import math
import logging
import pandas as pd
import numpy as np

from app import db
from app.models import Tasks, Datasheet, Element, BElement, UOM, Step
from app.routes.parameters_routes import get_current_user_data, get_user_parameter_data
from .unit_conversion import unit_conversion, get_si_unit

logger = logging.getLogger(__name__)


def init_param_variable():
    current_user, user_id = get_current_user_data()
    parameter_list = get_user_parameter_data(user_id)
    valregeneration = current_user.regeneration_mode
    logger.warning("Current regeneration mode: %s", valregeneration)

    DEFAULT_RATE = 0.0
    DEFAULT_HALF_LIFE = 1.0
    DEFAULT_TIME = 1

    if valregeneration is True:
        param_dict = {p['name']: p['value'] for p in parameter_list}
    else:
        param_dict = {p['name']: p['default'] for p in parameter_list}

    result = {
        'regeneration_mode': valregeneration,
        'pre_harvest_yield': param_dict.get('Pre-harvest growth rate', DEFAULT_RATE),
        'post_harvest_yield': param_dict.get('Post-harvest growth rate', DEFAULT_RATE),
        'time_horizon': param_dict.get('# of years for growth integration', DEFAULT_TIME),
        'p_residues': param_dict.get('Residues left behind', DEFAULT_RATE),
        'T_half_decay': param_dict.get('Residues half life', DEFAULT_HALF_LIFE),
        'c_content': param_dict.get('Carbon content, wood', DEFAULT_RATE),
        'standing_biomass': param_dict.get('Standing biomas', DEFAULT_HALF_LIFE)
    }
    return result


def get_task_region(task_id: int) -> str:
    """
    Return Tasks.Region for the given task.
    """
    task = Tasks.query.filter_by(IDT=task_id).first()
    if not task:
        raise ValueError(f"Task ID {task_id} not found.")
    return task.Region or ""


def get_hwp_tree_kg(task_id: int):
    """
    Get HWP_tree from Datasheet for the task where BElement.EName == 'Tree'.

    Returns:
        tuple:
            (hwp_tree_kg, raw_value, raw_unit, process_name)

    If Tree is missing or invalid:
        returns (0.0, 0.0, None, None) and logs a warning.
    """
    row = (
        db.session.query(
            Datasheet.ValueD.label("value"),
            UOM.Unit.label("unit"),
            Step.SName.label("process"),
            BElement.EName.label("flow")
        )
        .join(Element, Datasheet.IDE == Element.IDE)
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(UOM, Datasheet.IDU == UOM.IDU)
        .join(Step, Datasheet.IDS == Step.IDS)
        .filter(Datasheet.IDT == task_id)
        .filter(BElement.EName == "Tree")
        .order_by(Datasheet.IDD.asc())
        .first()
    )

    # ✅ Case 1: No Tree found
    if not row:
        logger.warning(
            "No 'Tree' flow found for task ID %s. Using default value 0.",
            task_id
        )
        return 0.0, 0.0, None, None

    raw_value = float(row.value or 0.0)
    raw_unit = str(row.unit).strip() if row.unit is not None else None
    process_name = str(row.process).strip() if row.process is not None else None

    # ✅ Case 2: Missing unit
    if not raw_unit:
        logger.warning(
            "Tree flow for task ID %s has no unit. Using value without conversion.",
            task_id
        )
        return raw_value, raw_value, None, process_name

    try:
        hwp_tree_si = float(unit_conversion(raw_value, raw_unit, 'SI'))
        si_unit = get_si_unit(raw_unit)

        # ✅ Case 3: Not kg → still continue
        if str(si_unit).strip().lower() != 'kg':
            logger.warning(
                "Tree flow for task ID %s converts to '%s' instead of kg.",
                task_id, si_unit
            )

        return hwp_tree_si, raw_value, raw_unit, process_name

    except Exception as e:
        logger.warning(
            "Tree conversion failed for task ID %s (%s %s): %s. Using raw value.",
            task_id, raw_value, raw_unit, e
        )
        return raw_value, raw_value, raw_unit, process_name


def Post_harvest(t, post_harvest_yield):
    """
    Integrated post-harvest growth function.

    Note:
    Keeps your updated hardcoded integral expression and converts
    from Mg/ha/yr to kg/ha/yr via *1000.
    """
    post_harvest_yield = 7.07 * t - 1.78 * (t * np.log(t) - t) / np.log(10)
    post_harvest = post_harvest_yield * 1000
    return post_harvest


def Forgone_growth(t, pre_harvest_yield):
    """
    Forgone growth in kg/ha.
    Assumes input yield is in Mg/ha/yr and converts to kg/ha/yr via *1000.
    """
    forgone_growth = pre_harvest_yield * 1000 * t
    return forgone_growth


def forest_growth_function(task_id: int):
    """
    Compute forest growth impacts for a given task.

    Uses:
    - task region from Tasks.Region
    - HWP_tree from Datasheet Tree flow, converted to kg

    Returns:
        tuple:
            (E_net, HWP_tree)
    """
    params = init_param_variable()

    pre_harvest_yield = float(params['pre_harvest_yield'] or 0.0)
    post_harvest_yield = float(params['post_harvest_yield'] or 0.0)
    t = int(params['time_horizon'] or 1)
    p_residues = float(params['p_residues'] or 0.0)
    T_half_decay = float(params['T_half_decay'] or 1.0)
    c_content = float(params['c_content'] or 0.0)
    standing_biomass = float(params['standing_biomass'] or 0.0)

    loc = get_task_region(task_id)
    HWP_tree, raw_tree_value, raw_tree_unit, tree_process = get_hwp_tree_kg(task_id)

    logger.warning(
        "Forest growth input for task %s: region=%s, Tree=%s %s, converted=%s kg, process=%s",
        task_id, loc, raw_tree_value, raw_tree_unit, HWP_tree, tree_process
    )

    if p_residues >= 100:
        raise ValueError("Residues left behind must be less than 100.")

    if standing_biomass == 0:
        raise ValueError("Standing biomass cannot be zero.")

    Amount_residues = HWP_tree * p_residues / (100 - p_residues)

    if T_half_decay == 0.0:
        E_decay = 1.0 * Amount_residues * (c_content / 100) * 44 / 12
    else:
        k = math.log(2) / T_half_decay
        E_decay = (
            1.0
            * Amount_residues
            * (1 - math.exp(-k * t))
            * (c_content / 100)
            * 44 / 12
        )

    logger.warning("Decay emissions: %s kg CO2 eq", E_decay)

    pre_harvest = HWP_tree * (1 + (p_residues / (100 - p_residues)))
    E_preharvest = -1.0 * pre_harvest * (c_content / 100) * 44 / 12

    logger.warning("Pre-harvest biomass: %s kg", pre_harvest)
    logger.warning("Pre-harvest growth: %s kg CO2 eq", E_preharvest)

    Harvested_area = pre_harvest / standing_biomass
    post_harvest_growth = Post_harvest(t, post_harvest_yield)
    E_postharvest = (
        -1.0 * post_harvest_growth * Harvested_area * (c_content / 100) * 44 / 12
    )

    logger.warning("Post-harvest growth: %s kg CO2 eq", E_postharvest)

    forgone_growth = Forgone_growth(t, pre_harvest_yield)
    E_forgone = (
        1.0 * forgone_growth * Harvested_area * (c_content / 100) * 44 / 12
    )

    logger.warning("Forgone growth emissions: %s kg CO2 eq", E_forgone)

    E_net = E_preharvest + E_decay + E_postharvest + E_forgone

    logger.warning(
        "Forest growth result for task %s: region=%s, E_net=%s kg CO2 eq, HWP_tree=%s kg",
        task_id, loc, E_net, HWP_tree
    )
    if HWP_tree == 0:
        logger.warning("Skipping forest growth for task %s (no Tree data).", task_id)
        return 0.0, 0.0

    return E_net, HWP_tree


def forest_growth_newA(matrix, value, tmatrix):
    """
    Add forest growth as a new process column, but do NOT duplicate rows.
    If the target flow already exists, update that row instead of appending.

    Expected matrix structure:
        col 0 = Flow
        col 1 = Flow_id
        col 2 = Unit / SI Unit
        col 3+ = process columns
    """
    new_col_name = 'Forest growth'
    df_A = matrix.copy()

    if df_A is None or df_A.empty:
        return df_A

    flow_col = df_A.columns[0]
    flow_id_col = df_A.columns[1]
    unit_col = df_A.columns[2] if len(df_A.columns) > 2 else None

    # Add the new process column once, with numeric zeros
    if new_col_name not in df_A.columns:
        df_A[new_col_name] = 0.0

    if tmatrix == 'A':
        target_flow = 'Tree'
        target_flow_id = '100'
        target_unit = 'kg'
    elif tmatrix == 'B':
        target_flow = 'Carbon dioxide'
        target_flow_id = 'E1140'
        target_unit = 'kg'
    else:
        return df_A

    # Normalize for matching
    flow_series = df_A[flow_col].astype(str).str.strip().str.lower()
    flow_id_series = df_A[flow_id_col].astype(str).str.strip()

    mask = (
        (flow_series == target_flow.strip().lower()) &
        (flow_id_series == str(target_flow_id).strip())
    )

    if mask.any():
        # Update existing row instead of appending a duplicate
        idx = df_A.index[mask][0]
        current_val = float(df_A.at[idx, new_col_name] or 0.0)
        df_A.at[idx, new_col_name] = current_val + float(value)

        if unit_col and (
            pd.isna(df_A.at[idx, unit_col]) or str(df_A.at[idx, unit_col]).strip() in ("", "0")
        ):
            df_A.at[idx, unit_col] = target_unit

        logger.warning(
            "Updated existing '%s' row in %s matrix with Forest growth=%s",
            target_flow, tmatrix, value
        )
    else:
        # Append only if row truly does not exist
        new_row = {col: 0.0 for col in df_A.columns}
        new_row[flow_col] = target_flow
        new_row[flow_id_col] = target_flow_id
        if unit_col:
            new_row[unit_col] = target_unit
        new_row[new_col_name] = float(value)

        df_A = pd.concat([df_A, pd.DataFrame([new_row])], ignore_index=True)

        logger.warning(
            "Appended new '%s' row in %s matrix with Forest growth=%s",
            target_flow, tmatrix, value
        )

    return df_A