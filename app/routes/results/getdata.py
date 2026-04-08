import pandas as pd
import numpy as np
import logging
from sqlalchemy.exc import SQLAlchemyError

from app import db
from app.models import Step, Datasheet, UOM, Element, Item, BElement

logger = logging.getLogger(__name__)


def get_all_processes(idt_param: int):
    """
    Return all distinct process names for the task, in DB order.
    """
    results = (
        db.session.query(Step.SName)
        .join(Datasheet, Datasheet.IDS == Step.IDS)
        .filter(Datasheet.IDT == idt_param)
        .distinct()
        .all()
    )
    return [row[0] for row in results]


def _get_base_task_data(idt_param: int) -> pd.DataFrame:
    """
    Fetch all datasheet rows needed to build Matrix A and Matrix B.

    Returned columns:
      - IDD
      - IDT
      - Flow_id   -> Element.IDBE
      - Flow      -> BElement.EName
      - Process   -> Step.SName
      - ValueD
      - UnitD
      - CHK
      - IName     -> Item.IName
      - IDE       -> Element.IDE
    """
    results = (
        db.session.query(
            Datasheet.IDD.label("IDD"),
            Datasheet.IDT.label("IDT"),
            Element.IDE.label("IDE"),
            Element.IDBE.label("Flow_id"),
            BElement.EName.label("Flow"),
            Step.SName.label("Process"),
            Datasheet.ValueD.label("ValueD"),
            UOM.Unit.label("UnitD"),
            Datasheet.CHK.label("CHK"),
            Item.IName.label("IName"),
        )
        .join(Element, Datasheet.IDE == Element.IDE)
        .join(BElement, Element.IDBE == BElement.IDBE)
        .join(Item, Element.IDI == Item.IDI)
        .join(Step, Datasheet.IDS == Step.IDS)
        .join(UOM, Datasheet.IDU == UOM.IDU)
        .filter(Datasheet.IDT == idt_param)
        .all()
    )

    if not results:
        return pd.DataFrame(
            columns=[
                "IDD", "IDT", "IDE", "Flow_id", "Flow", "Process",
                "ValueD", "UnitD", "CHK", "IName"
            ]
        )

    return pd.DataFrame(
        results,
        columns=[
            "IDD", "IDT", "IDE", "Flow_id", "Flow", "Process",
            "ValueD", "UnitD", "CHK", "IName"
        ]
    )


def _build_output_process_map(df: pd.DataFrame) -> dict:
    """
    Build:
        Flow_id -> set(process names where this flow is an OUTPUT)

    Output rows are ONLY:
      - Product
      - Co-Products with CHK = 0
    """
    outputs_df = df.loc[
        (df["IName"] == "Product") |
        ((df["IName"] == "Co-Products") & (df["CHK"] == 0)),
        ["Flow_id", "Process"]
    ].drop_duplicates()

    if outputs_df.empty:
        return {}

    return (
        outputs_df.groupby("Flow_id")["Process"]
        .apply(lambda s: set(str(x).strip() for x in s if pd.notna(x)))
        .to_dict()
    )


def _classify_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classify each row into Matrix A or Matrix B and compute signed value.

    Business rules:
    - Product -> A, positive
    - Co-Products with CHK=0 -> A, negative
    - Input Materials and Energy with Flow='Tree' -> A, negative
    - Input Materials and Energy that exists as output in ANOTHER process -> A, negative
    - Other Input Materials and Energy -> B, positive
    - Co-Products with CHK!=0 -> B, negative
    - Waste Treatment / Emission / Emissions -> B, positive
    """
    if df.empty:
        out = df.copy()
        out["Matrix"] = pd.Series(dtype="object")
        out["Value_Final"] = pd.Series(dtype="float64")
        return out

    output_process_map = _build_output_process_map(df)

    matrix_list = []
    value_list = []

    for _, row in df.iterrows():
        item = str(row["IName"]).strip() if pd.notna(row["IName"]) else ""
        flow_name = str(row["Flow"]).strip() if pd.notna(row["Flow"]) else ""
        flow_id = row["Flow_id"]
        process = str(row["Process"]).strip() if pd.notna(row["Process"]) else ""
        chk = row["CHK"] if pd.notna(row["CHK"]) else 0
        value = float(row["ValueD"]) if pd.notna(row["ValueD"]) else 0.0

        matrix = None
        signed_value = None

        # 1. Product -> A, positive
        if item == "Product":
            matrix = "A"
            signed_value = value

        # 2. Co-Products CHK=0 -> A, negative
        elif item == "Co-Products" and chk == 0:
            matrix = "A"
            signed_value = -value

        # 3. Input Materials and Energy
        elif item == "Input Materials and Energy":
            # Special rule: Tree always in A, negative
            if flow_name.lower() == "tree":
                matrix = "A"
                signed_value = -value
            else:
                producing_processes = output_process_map.get(flow_id, set())

                # Input belongs to A only if same flow is output in another process
                if any(prod_process != process for prod_process in producing_processes):
                    matrix = "A"
                    signed_value = -value
                else:
                    matrix = "B"
                    signed_value = value

        # 4. Co-Products CHK!=0 -> B, negative
        elif item == "Co-Products" and chk != 0:
            matrix = "B"
            signed_value = -value

        # 5. Waste / Emissions -> B, positive
        elif item in ["Waste Treatment", "Emission", "Emissions"]:
            matrix = "B"
            signed_value = value

        matrix_list.append(matrix)
        value_list.append(signed_value)

    out = df.copy()
    out["Matrix"] = matrix_list
    out["Value_Final"] = value_list

    # Keep only classified rows
    out = out[out["Matrix"].notna()].copy()

    logger.warning(
        "Classified rows:\n%s",
        out[[
            "IDD", "IDE", "Flow_id", "Flow", "Process", "IName",
            "CHK", "ValueD", "Matrix", "Value_Final"
        ]].to_string(index=False)
    )

    return out


def _choose_unit_per_flow(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enforce one unit per flow.

    If a flow appears with multiple units, keep the first non-null unit
    and log a warning.
    """
    if df.empty:
        return pd.DataFrame(columns=["Flow", "Flow_id", "Unit"])

    unit_check = (
        df.groupby(["Flow", "Flow_id"])["UnitD"]
        .agg(lambda s: sorted({str(x).strip() for x in s.dropna() if str(x).strip() != ""}))
        .reset_index(name="UnitsFound")
    )

    inconsistent = unit_check[unit_check["UnitsFound"].apply(len) > 1]
    if not inconsistent.empty:
        for _, row in inconsistent.iterrows():
            logger.warning(
                "Multiple units found for Flow_id=%s Flow=%s : %s. Keeping first unit.",
                row["Flow_id"], row["Flow"], row["UnitsFound"]
            )

    unit_df = (
        df.groupby(["Flow", "Flow_id"], as_index=False)["UnitD"]
        .agg(lambda s: next((str(x).strip() for x in s if pd.notna(x) and str(x).strip() != ""), np.nan))
        .rename(columns={"UnitD": "Unit"})
    )

    return unit_df


def _pivot_matrix(df_matrix: pd.DataFrame, all_processes: list[str]) -> pd.DataFrame:
    """
    Pivot a classified matrix dataframe to:
        Flow | Flow_id | Unit | Process_1 | Process_2 | ...
    """
    if df_matrix.empty:
        cols = ["Flow", "Flow_id", "Unit"] + all_processes
        return pd.DataFrame(columns=cols)

    pivot_df = df_matrix.pivot_table(
        index=["Flow", "Flow_id"],
        columns="Process",
        values="Value_Final",
        aggfunc="sum",
        fill_value=0.0
    ).reset_index()

    # Ensure all process columns exist
    for p in all_processes:
        if p not in pivot_df.columns:
            pivot_df[p] = 0.0

    unit_df = _choose_unit_per_flow(df_matrix)

    result = pivot_df.merge(unit_df, on=["Flow", "Flow_id"], how="left")

    final_cols = ["Flow", "Flow_id", "Unit"] + all_processes
    result = result[final_cols].sort_values(by="Flow_id").reset_index(drop=True)

    return result


def get_matrix_a(idt_param: int):
    """
    Build Matrix A for a task.
    """
    try:
        all_processes = get_all_processes(idt_param)
        base_df = _get_base_task_data(idt_param)

        if base_df.empty:
            cols = ["Flow", "Flow_id", "Unit"] + all_processes
            return pd.DataFrame(columns=cols)

        classified = _classify_rows(base_df)
        df_a = classified[classified["Matrix"] == "A"].copy()

        result = _pivot_matrix(df_a, all_processes)

        logger.info("Matrix A:\n%s", result.to_string(index=False))
        logger.info("Matrix A shape: %s", result.shape)

        return result

    except SQLAlchemyError as e:
        logger.exception("SQLAlchemy error in get_matrix_a for IDT=%s: %s", idt_param, e)
        db.session.rollback()
        return pd.DataFrame()

    except Exception as e:
        logger.exception("Unexpected error in get_matrix_a for IDT=%s: %s", idt_param, e)
        db.session.rollback()
        return pd.DataFrame()


def get_matrix_b(idt_param: int):
    """
    Build Matrix B for a task.
    """
    try:
        all_processes = get_all_processes(idt_param)
        base_df = _get_base_task_data(idt_param)

        if base_df.empty:
            cols = ["Flow", "Flow_id", "Unit"] + all_processes
            return pd.DataFrame(columns=cols)

        classified = _classify_rows(base_df)
        df_b = classified[classified["Matrix"] == "B"].copy()

        result = _pivot_matrix(df_b, all_processes)

        logger.info("Matrix B:\n%s", result.to_string(index=False))
        logger.info("Matrix B shape: %s", result.shape)

        return result

    except SQLAlchemyError as e:
        logger.exception("SQLAlchemy error in get_matrix_b for IDT=%s: %s", idt_param, e)
        db.session.rollback()
        return pd.DataFrame()

    except Exception as e:
        logger.exception("Unexpected error in get_matrix_b for IDT=%s: %s", idt_param, e)
        db.session.rollback()
        return pd.DataFrame()