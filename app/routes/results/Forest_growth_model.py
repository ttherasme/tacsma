# -*- coding: utf-8 -*-
"""
Created on Tue Oct  7 02:27:22 2025

@author: otherasm
"""
from flask import session
import math 
import pandas as pd
from app.routes.parameters_routes import get_current_user_data, get_user_parameter_data


#Parameter and Assumption to be defined/updated later
loc='loc' #region where the harvest is occuring--- to be updated from CAFRI and User input data
standing_biomass=1000 #kg/ha, to be updated with CAFRI data

#End of parameter list

def init_param_variable():
    current_user, user_id = get_current_user_data()
    parameter_list = get_user_parameter_data(user_id)
    valregeneration = current_user.regeneration_mode

    # Define robust default values to prevent NoneType errors
    DEFAULT_RATE = 0.0
    # IMPORTANT: Use a non-zero, small default for half-life
    DEFAULT_HALF_LIFE = 1.0 
    DEFAULT_TIME = 1

    if valregeneration == True:
        param_dict = {p['name']: p['value'] for p in parameter_list}
    else:
        param_dict = {p['name']: p['default'] for p in parameter_list}

    result = {
        'regeneration_mode': valregeneration,
        # Use .get() with a default value
        'pre_harvest_yield': param_dict.get('Pre-harvest growth rate', DEFAULT_RATE),
        'post_harvest_yield': param_dict.get('Post-harvest growth rate', DEFAULT_RATE),
        'time_horizon': param_dict.get('# of years for growth integration', DEFAULT_TIME),
        'p_residues': param_dict.get('Residues left behind', DEFAULT_RATE),
        # Ensure T_half_decay has a non-zero default
        'T_half_decay': param_dict.get('Residues half life', DEFAULT_HALF_LIFE), 
        'c_content': param_dict.get('Carbon content, wood', DEFAULT_RATE)
    }
    return result

def Post_harvest (t, post_harvest_yield):
    post_harvest=post_harvest_yield*t #kg/ha to be updated with CAFRI growth model
    
    return (post_harvest)

def Forgone_growth (t, pre_harvest_yield):
    forgone_growth=pre_harvest_yield*t # kg/ha to be updated with CAFRI growth model, projected at annual growth rate over previous 10 years
    
    return (forgone_growth)

def forest_growth_function ():
    params = init_param_variable()
    
    # Safely convert to float, using OR fallback just in case init_param_variable fails
    pre_harvest_yield = float(params['pre_harvest_yield'] or 0.0)
    post_harvest_yield = float(params['post_harvest_yield'] or 0.0)
    t = int(params['time_horizon'] or 1)
    p_residues = float(params['p_residues'] or 0.0)
    T_half_decay = float(params['T_half_decay'] or 1.0) # Ensure a minimum of 1.0 as a final safeguard
    c_content = float(params['c_content'] or 0.0)

    HWP_tree=1000 #kg, amount of biomass harvested, excluding residues left for decay. summ of all wood products extracted from the forest
    
    #Residues decay
    Amount_residues=HWP_tree*p_residues/(100-p_residues) # amount of residues left in the forest, kg oven dry 
    
    # --- ZERO DIVISION CHECK ---
    if T_half_decay == 0.0:
        # If half-life is zero, assume k is effectively infinite, meaning full decay occurs within time t
        E_decay=1.0*Amount_residues*(c_content/100)*44/12 
    else:
        k=math.log(2)/T_half_decay
        E_decay=1.0*Amount_residues*(1-math.exp(-k*t))*(c_content/100)*44/12 #kg CO2 after t years due to decay of forest residues
    # --- END ZERO DIVISION CHECK ---
    
    print('decay emissions:', E_decay)
    
    #pre harvest growth
    pre_harvest=HWP_tree*(1+p_residues/(100-p_residues))
    print('pre harvest', pre_harvest)
    E_preharvest=-1.0*pre_harvest*(c_content/100)*44/12 # CO2 sequestered during the initial tree growth prior to harvest
    print('preharvest growth', E_preharvest)
    
    #post harvest growth
    Harvested_area=pre_harvest/standing_biomass #ha required to provide the amount of HWP_tree
    post_harvest_growth=Post_harvest(t, post_harvest_yield)
    E_postharvest=-1.0*post_harvest_growth*Harvested_area*(c_content/100)*44/12 #kg CO2 sequestered due to forest regrowth. 
    print('post-harvest growth', E_postharvest)
    
    # forgone forest growth due to tree harvesting
      
    forgone_growth= Forgone_growth(t, pre_harvest_yield)
    E_forgone=1.0*forgone_growth*Harvested_area*(c_content/100)*44/12 #kg CO2 not sequestered due to forest growth that did not happen because of harvest. 
    print('forgone growth emissions', E_forgone)
    
    
    #Net emissions, excluding carbon in the HWP itself
      
    E_net=E_preharvest+E_decay+E_postharvest+E_forgone
    
    print(E_net, HWP_tree)
  
    return E_net, HWP_tree    
    
def forest_growth_newA(matrix, value, tmatrix):

    new_col_name = 'Forest growth'
    df_A = matrix.copy()
    df_A[new_col_name] = pd.NA

    # Avoid using all-NA dict for new row
    new_row = {col: 0 for col in df_A.columns}  # default to 0

    if tmatrix == 'A':
        new_row[df_A.columns[0]] = 'HWP_tree'
    elif tmatrix == 'B':
        new_row[df_A.columns[0]] = 'Carbon dioxide'
    else:
        new_row[df_A.columns[0]] = ''

    new_row[df_A.columns[1]] = 'HWP_001'
    new_row[new_col_name] = value

    df_A = pd.concat([df_A, pd.DataFrame([new_row])], ignore_index=True)

    # Replace NaNs with 0
    df_A.fillna(0, inplace=True)
    df_A.infer_objects(copy=False)  # Avoid future warning about type downcasting

    return df_A




    

    