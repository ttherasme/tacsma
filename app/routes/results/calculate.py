import logging
logger = logging.getLogger(__name__)
import numpy as np
from .import_rawdata import import_lci

# Function to calculate the scaling vector s based on the final demand f
def calculate_scaling_vector(A, final_demand):
    # Solve A.s = f using numpy's linear solver
    A=A.astype(float)
    scaling_vector = np.linalg.solve(A, final_demand)
    return scaling_vector
    # try:
    #     scaling_vector = np.linalg.solve(A, final_demand)
    # except np.linalg.LinAlgError:
    #     print("WARNING: Singular matrix detected. Using pseudoinverse fallback.")
    #     scaling_vector = np.dot(np.linalg.pinv(A), final_demand)
    return scaling_vector


#function that convert the vect s into a diagonal matrix
def diagonal_vector (scaling_vector):
    diag_scaling_vector=np.diag(scaling_vector)
    #print (f"the diagonal matrix s is: \n{diag_scaling_vector}")
    return diag_scaling_vector

# Function to calculate the inventory table scaled to the final demand vector f,  using the scaling vector s and the emission matrix B
def calculate_inventory_impact(B, scaling_vector):
    # Calculate the impact vector g = B.s
    g = np.dot(B, scaling_vector)  # Matrix multiplication
    
    # Print the resulting impact table (g)
    #print(f"Inventory Impact (g):\n{g}")
    return g

# Function to calculate the inventory table by process [MAtrix as opposed to the vector] scaled to the final demand vector f,  using the diagonal vector diag(s) and the emission matrix B
def calculate_inventory_matrix(B, diag_scaling_vector):
    # Calculate the impact vector g = B.s
    G = np.dot(B, diag_scaling_vector)  # Matrix multiplication
    
    # Print the resulting impact table (g)
    #print(f"Inventory Impact by process (G):\n{G}")
    return G


def calculate_impact_score(g, lci_flow, category):
    
    logger.warning("Calculating impact score...")

    # Convert to array
    g = np.array(g, dtype=float)

    # Validate lengths
    if len(g) != len(lci_flow):
        logger.error("Length mismatch between g and lci_flow.")
        logger.warning(f"len(g): {len(g)}, len(lci_flow): {len(lci_flow)}")
        return None

    i_LCI_values = []

    for i, flow in enumerate(lci_flow):
        impact_value = import_lci(flow, category)
        if impact_value is None:
            logger.warning(f"No LCI value found for flow '{flow}' and category '{category}'. Skipping.")
            impact_value = 0.0  # or continue if you want to skip
        i_LCI_values.append(impact_value)

    logger.warning(f"Selected LCI values: {i_LCI_values}")

    i_LCI = np.array(i_LCI_values, dtype=float)

    I_score = np.dot(g, i_LCI)
    logger.warning(f"Impact score for final demand: {I_score}")
    return I_score


def calculate_process_contribution(G, lci_flow, category):

    logger.warning("Calculating process contribution...")

    # Validate dimensions
    G = np.array(G, dtype=float)
    if G.shape[0] != len(lci_flow):
        logger.error(f"Mismatch between G rows ({G.shape[0]}) and number of LCI flows ({len(lci_flow)}).")
        return None

    # Build the LCI vector for the given category
    LCI_vector = []
    for i, flow in enumerate(lci_flow):
        lci_value = import_lci(flow, category)
        if lci_value is None:
            logger.warning(f"No LCI value found for flow '{flow}' in category '{category}'. Assuming 0.")
            lci_value = 0.0
        LCI_vector.append(lci_value)

    LCI_vector = np.array(LCI_vector, dtype=float)  # shape: (n_flows,)

    # Compute contribution per process
    contribution_score = np.dot(LCI_vector.T, G)  # shape: (n_processes,)
    
    logger.warning(f"Process contribution scores: {contribution_score}")
    return contribution_score