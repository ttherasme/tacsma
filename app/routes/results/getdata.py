import pandas as pd
import numpy as np
import logging
from sqlalchemy.orm import aliased
from sqlalchemy import and_
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from app import db
from app.models import Step, Datasheet, UOM, Element, Item, BElement

logger = logging.getLogger(__name__)

# --- Fetch all distinct processes globally ---
def get_all_processes(idt_param: int):
    results = db.session.query(Step.SName)\
        .join(Datasheet, Datasheet.IDS == Step.IDS)\
        .filter(Datasheet.IDT == idt_param)\
        .distinct()\
        .all()
    
    return [row[0] for row in results]

def get_matrix_a(idt_param: int):
    try:
        all_processes = get_all_processes(idt_param)

        # Base query
        base_query = (
            db.session.query(
                Datasheet.IDD.label('IDD'),
                Element.IDBE.label('Flow_id'),
                BElement.EName.label('Flow'),
                Step.SName.label('Process'),
                Datasheet.ValueD.label('ValueD'),
                UOM.Unit.label('UnitD'),
                #Element.Global_Val.label('Global_Val'),
                Datasheet.CHK.label('CHK'),
                Item.IName.label('IName')
            )
            .join(Element, Datasheet.IDE == Element.IDE)
            .join(BElement, Element.IDBE == BElement.IDBE)
            .join(Item, Element.IDI == Item.IDI)
            .join(Step, Datasheet.IDS == Step.IDS)
            .join(UOM, Datasheet.IDU == UOM.IDU)
            .filter(Datasheet.IDT == idt_param)
        )

        # Filter all Products
        query_product = base_query.filter(Item.IName == 'Product')

        # Filter all Co-Products with CHK=0
        query_coproduct = base_query.filter(
            and_(Item.IName == 'Co-Products', Datasheet.CHK == 0)
        )

         # Filter all Input with Global_Value in [0, 2]
        query_input = base_query.filter(
            and_(Item.IName == 'Input Materials and Energy', Element.Global_Val.in_([0, 2]))
        )

        # Combine queries using UNION (Products first)
        query_final = query_product.union_all(query_coproduct)

        query_final = query_final.union_all(query_input)

        # Execute
        results = query_final.all()

        if not results:
            logger.warning(f"No records found for IDT={idt_param}.")
            # Return empty df with all processes
            columns = ['Flow_id', 'Flow']
            for i, p in enumerate(all_processes, start=1):
                columns.append(p)
                columns.append(f'Unit_{i}')
            return pd.DataFrame(columns=columns)

        df = pd.DataFrame(results, columns=[
            'IDD', 'Flow_id', 'Flow', 'Process',
            'ValueD', 'UnitD', 'CHK', 'IName'
        ])

        outputs = df.loc[
            df['IName'].isin(['Product', 'Co-Products']),
            ['Flow_id', 'Process']
        ].drop_duplicates()

        inputs_mask = (
            (df['IName'] == 'Input Materials and Energy') &
            df['Flow_id'].isin(outputs['Flow_id'])
        )

        matched = df.loc[inputs_mask, ['IDD', 'Flow_id', 'Process']]\
        .merge(outputs, on='Flow_id', suffixes=('_in', '_out'))

        idd_to_flip = matched.loc[
            matched['Process_in'] != matched['Process_out'],
            'IDD'
        ].unique()

        df.loc[df['IDD'].isin(idd_to_flip), 'ValueD'] *= -1

        # --- Step 1: Compute Value_Final ---
        df['Value_Final'] = df['ValueD']

        # --- Step 2: Compute Unit_Final ---
        df['Unit_Final'] = df['UnitD']

        # --- Step 3: Pivot tables ---
        pivot_value = df.pivot_table(
            index=['Flow', 'Flow_id', 'UnitD'], 
            columns='Process',
            values='Value_Final',
            aggfunc='sum',
            fill_value=0.0
        )

        pivot_unit = df.pivot_table(
            index=['Flow', 'Flow_id', 'UnitD'],
            columns='Process',
            values='Unit_Final',
            aggfunc='first'
        )

        # --- Step 4: Ensure all processes exist ---
        for p in all_processes:
            if p not in pivot_value.columns:
                pivot_value[p] = 0.0
            if p not in pivot_unit.columns:
                pivot_unit[p] = np.nan

        # --- Step 5: Add suffix and combine ---
        pivot_value = pivot_value.add_suffix('_Val')
        pivot_unit = pivot_unit.add_suffix('_Unit')

        df2 = pd.concat([pivot_value, pivot_unit], axis=1).reset_index()

        # --- Step 6: Rename columns ---
        rename_map = {}
        for i, p in enumerate(all_processes, start=1):
            val_col = f"{p}_Val"
            unit_col = f"{p}_Unit"
            if val_col in df2.columns:
                rename_map[val_col] = p
            if unit_col in df2.columns:
                rename_map[unit_col] = f'Unit_{i}'
        df2 = df2.rename(columns=rename_map)

        # --- Step 7: Reorder columns ---
        final_cols = ['Flow_id', 'Flow']
        for i, p in enumerate(all_processes, start=1):
            final_cols.append(p)
            final_cols.append(f'Unit_{i}')
        df2 = df2[final_cols]

        # --- Step 8: Fill NaNs in unit columns row-wise ---
        unit_cols = [c for c in df2.columns if 'Unit' in c]
        df2[unit_cols] = df2[unit_cols].bfill(axis=1).ffill(axis=1)

        #logger.info(f"Data successfully retrieved for IDT={idt_param} ({len(df)} rows).")
        logger.info(f"Matrix A getdata : \n {df2}")
        return df2

    except SQLAlchemyError as e:
        logger.exception(f"SQLAlchemy error for IDT={idt_param}: {e}")
        db.session.rollback()
        return pd.DataFrame()

    except Exception as e:
        logger.exception(f"Unexpected error for IDT={idt_param}: {e}")
        db.session.rollback()
        return pd.DataFrame()


def get_matrix_b(idt_param: int):
    try:
        all_processes = get_all_processes(idt_param)

        # -----------------------------
        # Query 1: Products (exclude 'Product', 'Co-Products' and 'Input Materials and Energy')
        # -----------------------------
        query_product = (
            db.session.query(
                Datasheet.IDD.label('IDD'),
                Element.IDBE.label('Flow_id'),
                BElement.EName.label('Flow'),
                Step.SName.label('Process'),
                Datasheet.ValueD.label('ValueD'),
                UOM.Unit.label('UnitD'),
                #Element.Global_Val.label('Global_Val'),
                Item.IName.label('IName')
            )
            .join(Element, Datasheet.IDE == Element.IDE)
            .join(BElement, Element.IDBE == BElement.IDBE)
            .join(Item, Element.IDI == Item.IDI)
            .join(Step, Datasheet.IDS == Step.IDS)
            .join(UOM, Datasheet.IDU == UOM.IDU)
            .filter(Datasheet.IDT == idt_param)
            .filter(Item.IName.notin_(['Product', 'Co-Products', 'Input Materials and Energy']))
        )

        # -----------------------------
        # Query 2: Co-Products with CHK = 1 (negate values)
        # -----------------------------
        query_coproduct = (
            db.session.query(
                Datasheet.IDD.label('IDD'),
                Element.IDBE.label('Flow_id'),
                BElement.EName.label('Flow'),
                Step.SName.label('Process'),
                (-Datasheet.ValueD).label('ValueD'),
                UOM.Unit.label('UnitD'),
                #Element.Global_Val.label('Global_Val'),
                Item.IName.label('IName')
            )
            .join(Element, Datasheet.IDE == Element.IDE)
            .join(BElement, Element.IDBE == BElement.IDBE)
            .join(Item, Element.IDI == Item.IDI)
            .join(Step, Datasheet.IDS == Step.IDS)
            .join(UOM, Datasheet.IDU == UOM.IDU)
            .filter(Datasheet.IDT == idt_param)
            .filter(and_(Item.IName == 'Co-Products', Datasheet.CHK == 1))
        )

         # -----------------------------
        # Query 3: Input with Global_Val = 1 
        # -----------------------------
        query_input = (
            db.session.query(
                Datasheet.IDD.label('IDD'),
                Element.IDBE.label('Flow_id'),
                BElement.EName.label('Flow'),
                Step.SName.label('Process'),
                Datasheet.ValueD.label('ValueD'),
                UOM.Unit.label('UnitD'),
                #Element.Global_Val.label('Global_Val'),
                Item.IName.label('IName')
            )
            .join(Element, Datasheet.IDE == Element.IDE)
            .join(BElement, Element.IDBE == BElement.IDBE)
            .join(Item, Element.IDI == Item.IDI)
            .join(Step, Datasheet.IDS == Step.IDS)
            .join(UOM, Datasheet.IDU == UOM.IDU)
            .filter(Datasheet.IDT == idt_param)
            .filter(Item.IName == 'Input Materials and Energy', Element.Global_Val == 1)
        )

        # -----------------------------
        # Combine both queries using UNION ALL
        # -----------------------------
        query_final = query_product.union_all(query_coproduct)
        query_final = query_final.union_all(query_input)
        # Execute
        results = query_final.all()


        if not results:
            logger.warning(f"No records found for IDT={idt_param}.")
            columns = ['Flow_id', 'Flow']
            for i, p in enumerate(all_processes, start=1):
                columns.append(p)
            return pd.DataFrame(columns=columns)

        df = pd.DataFrame(results, columns=[
            'IDD', 'Flow_id', 'Flow', 'Process',
            'ValueD', 'UnitD', 'IName'
        ])

        outputs = df.loc[
            df['IName'].isin(['Product', 'Co-Products']),
            ['Flow_id', 'Process']
        ].drop_duplicates()

        inputs_mask = (
            (df['IName'] == 'Waste Treatment') &
            df['Flow_id'].isin(outputs['Flow_id'])
        )

        matched = df.loc[inputs_mask, ['IDD', 'Flow_id', 'Process']]\
        .merge(outputs, on='Flow_id', suffixes=('_in', '_out'))

        idd_to_flip = matched.loc[
            matched['Process_in'] != matched['Process_out'],
            'IDD'
        ].unique()

        df.loc[df['IDD'].isin(idd_to_flip), 'ValueD'] *= -1

        df['Value_Final'] = df['ValueD']

        # Pivot table
        pivot_value = df.pivot_table(
            index=['Flow', 'Flow_id', 'UnitD'],
            columns='Process',
            values='Value_Final',
            aggfunc='sum',
            fill_value=0.0
        ).reset_index().rename(columns={'UnitD': 'Unit'})

        for p in all_processes:
            if p not in pivot_value.columns:
                pivot_value[p] = 0.0

        # Reorder columns
        pivot_cols = ['Flow', 'Flow_id', 'Unit'] + all_processes
        pivot_value = pivot_value[pivot_cols]

        logger.info(f"Matrix B getdata : \n {pivot_value}")
        return pivot_value

    except SQLAlchemyError as e:
        logger.exception(f"SQLAlchemy error while retrieving data for IDT={idt_param}: {e}")
        db.session.rollback()
        return pd.DataFrame()

    except Exception as e:
        logger.exception(f"Unexpected error while retrieving data for IDT={idt_param}: {e}")
        db.session.rollback()
        return pd.DataFrame()
