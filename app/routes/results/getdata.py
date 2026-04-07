import pandas as pd
import numpy as np
import logging
from sqlalchemy.exc import SQLAlchemyError
from app import db
from app.models import Step, Datasheet, UOM, Element, Item, BElement

logger = logging.getLogger(__name__)


def get_all_processes(idt_param: int):
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
    """
    results = (
        db.session.query(
            Datasheet.IDD.label("IDD"),
            Datasheet.IDT.label("IDT"),
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
                "IDD", "IDT", "Flow_id", "Flow", "Process",
                "ValueD", "UnitD", "CHK", "IName"
            ]
        )

    return pd.DataFrame(
        results,
        columns=[
            "IDD", "IDT", "Flow_id", "Flow", "Process",
            "ValueD", "UnitD", "CHK", "IName"
        ]
    )


def _build_internal_output_keys(df: pd.DataFrame) -> set:
    """
    Internal outputs are the flows that are produced by another process
    inside the same task and therefore should move matching input rows
    into Matrix A.

    Rules used:
    - Product
    - Co-Products with CHK = 0
    """
    outputs_df = df.loc[
        (df["IName"] == "Product") |
        ((df["IName"] == "Co-Products") & (df["CHK"] == 0)),
        ["Flow_id", "Process"]
    ].drop_duplicates()

    return set(tuple(x) for x in outputs_df[["Flow_id", "Process"]].to_numpy())


def _classify_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classify each row into Matrix A or Matrix B and compute signed value
    based on the business rules provided by the user.
    """
    if df.empty:
        df["Matrix"] = pd.Series(dtype="object")
        df["Value_Final"] = pd.Series(dtype="float64")
        return df

    # Flows that are outputs somewhere in the same task
    output_flow_ids = set(
        df.loc[
            (df["IName"] == "Product") |
            ((df["IName"] == "Co-Products") & (df["CHK"] == 0)),
            "Flow_id"
        ].dropna().unique()
    )

    matrix_list = []
    value_list = []

    for _, row in df.iterrows():
        item = str(row["IName"]).strip() if pd.notna(row["IName"]) else ""
        flow_name = str(row["Flow"]).strip() if pd.notna(row["Flow"]) else ""
        flow_id = row["Flow_id"]
        chk = row["CHK"] if pd.notna(row["CHK"]) else 0
        value = float(row["ValueD"]) if pd.notna(row["ValueD"]) else 0.0

        matrix = None
        signed_value = None

        # Matrix A
        if item == "Product":
            matrix = "A"
            signed_value = value

        elif item == "Co-Products" and chk == 0:
            matrix = "A"
            signed_value = -value

        elif item == "Input Materials and Energy":
            # Force Tree into A
            if flow_name.lower() == "tree":
                matrix = "A"
                signed_value = -value
            # If same flow is produced by another process in same task => A
            elif flow_id in output_flow_ids:
                matrix = "A"
                signed_value = -value
            else:
                matrix = "B"
                signed_value = value

        # Matrix B
        elif item == "Co-Products" and chk == 1:
            matrix = "B"
            signed_value = -value

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
    return out


def _choose_unit_per_flow(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enforce one unit per flow.

    If a flow appears with multiple units, keep the first non-null unit
    and log a warning.
    """
    if df.empty:
        return pd.DataFrame(columns=["Flow_id", "Flow", "Unit"])

    unit_check = (
        df.groupby(["Flow_id", "Flow"])["UnitD"]
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
        df.groupby(["Flow_id", "Flow"], as_index=False)["UnitD"]
        .agg(lambda s: next((str(x).strip() for x in s if pd.notna(x) and str(x).strip() != ""), np.nan))
        .rename(columns={"UnitD": "Unit"})
    )

    return unit_df


def get_matrix_a(idt_param: int):
    try:
        all_processes = get_all_processes(idt_param)
        base_df = _get_base_task_data(idt_param)

        if base_df.empty:
            cols = ["Flow", "Flow_id", "Unit"] + all_processes
            return pd.DataFrame(columns=cols)

        classified = _classify_rows(base_df)
        df_a = classified[classified["Matrix"] == "A"].copy()

        if df_a.empty:
            cols = ["Flow", "Flow_id", "Unit"] + all_processes
            return pd.DataFrame(columns=cols)

        # Pivot
        pivot_a = df_a.pivot_table(
            index=["Flow", "Flow_id"],
            columns="Process",
            values="Value_Final",
            aggfunc="sum",
            fill_value=0.0
        ).reset_index()

        # Ensure all processes exist
        for p in all_processes:
            if p not in pivot_a.columns:
                pivot_a[p] = 0.0

        # Get ONE unit per flow
        unit_df = (
            df_a.groupby(["Flow", "Flow_id"], as_index=False)["UnitD"]
            .agg(lambda s: next((x for x in s if pd.notna(x)), np.nan))
            .rename(columns={"UnitD": "Unit"})
        )

        # Merge units
        result = pivot_a.merge(unit_df, on=["Flow", "Flow_id"], how="left")

        # FINAL ORDER (CRITICAL)
        final_cols = ["Flow", "Flow_id", "Unit"] + all_processes
        result = result[final_cols]

        result = result.sort_values(by="Flow_id").reset_index(drop=True)

        logger.info(f"Matrix A:\n{result}")
        return result

    except Exception as e:
        logger.exception(f"Error in get_matrix_a: {e}")
        return pd.DataFrame()


def get_matrix_b(idt_param: int):
    try:
        all_processes = get_all_processes(idt_param)
        base_df = _get_base_task_data(idt_param)

        if base_df.empty:
            cols = ["Flow", "Flow_id", "Unit"] + all_processes
            return pd.DataFrame(columns=cols)

        classified = _classify_rows(base_df)
        df_b = classified[classified["Matrix"] == "B"].copy()

        if df_b.empty:
            cols = ["Flow", "Flow_id", "Unit"] + all_processes
            return pd.DataFrame(columns=cols)

        pivot_b = df_b.pivot_table(
            index=["Flow", "Flow_id"],
            columns="Process",
            values="Value_Final",
            aggfunc="sum",
            fill_value=0.0
        ).reset_index()

        for p in all_processes:
            if p not in pivot_b.columns:
                pivot_b[p] = 0.0

        unit_df = (
            df_b.groupby(["Flow", "Flow_id"], as_index=False)["UnitD"]
            .agg(lambda s: next((x for x in s if pd.notna(x)), np.nan))
            .rename(columns={"UnitD": "Unit"})
        )

        result = pivot_b.merge(unit_df, on=["Flow", "Flow_id"], how="left")

        final_cols = ["Flow", "Flow_id", "Unit"] + all_processes
        result = result[final_cols]

        result = result.sort_values(by="Flow_id").reset_index(drop=True)

        logger.info(f"Matrix B:\n{result}")
        return result

    except Exception as e:
        logger.exception(f"Error in get_matrix_b: {e}")
        return pd.DataFrame()