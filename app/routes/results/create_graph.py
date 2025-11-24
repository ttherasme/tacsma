import matplotlib.pyplot as plt
import numpy as np
import io
import base64
from typing import Optional, Union

# --- Color Themes ---
COLOR_THEMES = {
    "vibrant": [
        "#ff6b6b", "#ff922b", "#fcc419", "#51cf66", "#339af0",
        "#845ef7", "#e64980", "#a9e34b", "#ffd43b", "#4dabf7"
    ],
    "pastel": [
        "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff",
        "#a0c4ff", "#bdb2ff", "#ffc6ff", "#fffffc", "#d0f4de"
    ],
    "grayscale": [
        "#111", "#333", "#555", "#777", "#999",
        "#bbb", "#ddd", "#eee", "#ccc", "#888"
    ]
}

# --- Utility ---
def short_label(label, max_len=25):
    label = str(label)
    return label if len(label) <= max_len else label[:max_len] + "…"

#--- Create Graph without theme ------
def create_graph(data, graph_type='line', x_column=None, y_column=None, has_header=False, **kwargs):
    
    if not hasattr(data, 'shape') or len(data.shape) != 2:
        raise ValueError("Data should be a 2D array-like structure.")

    header = None
    if isinstance(data, np.ndarray):
        # Data slicing is correct for NumPy array
        if has_header:
            header = list(data[0])
            data = data[1:]
    else:
        # This check is redundant since the input in run_analysis is always a NumPy array
        # but kept for safety.
        raise ValueError("Data is not in the expected NumPy format.")

    # --- Column Indexing ---
    
    # 1. Handle String Column Names (only if header is present)
    if isinstance(x_column, str) and header:
        if x_column not in header:
            raise ValueError(f"x_column '{x_column}' not found in header.")
        x_column = header.index(x_column)

    if isinstance(y_column, str) and header:
        if y_column not in header:
            raise ValueError(f"y_column '{y_column}' not found in header.")
        y_column = header.index(y_column)
        
    # 2. Default to integer indexing if not a string
    # (x_column/y_column are already integers 0 and 1 in your run_analysis call)
    
    # --- Data Extraction ---
    # Ensure float conversion happens after indexing
    x_data = data[:, x_column]
    y_data = data[:, y_column].astype(float)

    # Figure setup based on data size
    n = len(x_data)
    fig_width = max(10, min(20, n * 0.4))
    plt.figure(figsize=(fig_width, 6))

    if graph_type == 'pie':
        # Pie chart logic (no changes needed, it's robust)
        total = np.sum(y_data)
        threshold = 0.01 * total
        small_mask = y_data < threshold
        large_mask = ~small_mask

        large_x = x_data[large_mask]
        large_y = y_data[large_mask]

        small_sum = np.sum(y_data[small_mask])
        if small_sum > 0:
            large_x = np.append(large_x, "Other")
            large_y = np.append(large_y, small_sum)

        # Sort largest to smallest
        sort_order = np.argsort(-large_y)
        large_x = large_x[sort_order]
        large_y = large_y[sort_order]

        # Compute percentages for autopct formatting
        def autopct_format(pct):
            return '%1.1f%%' % pct if pct >= 5 else '' 

        colors = kwargs.get('color', plt.cm.tab20.colors)
        if len(large_y) > len(colors):
            import itertools
            colors = list(itertools.islice(itertools.cycle(colors), len(large_y)))

        plt.pie(
            large_y,
            labels=large_x,
            autopct=autopct_format,
            startangle=90,
            labeldistance=1.15,
            colors=colors
        )
        plt.axis('equal')

    else:
        # Non-pie chart logic (Bar, Line, Scatter)
        
        # Sort data for better visualization
        sort_order = np.argsort(-y_data)
        x_data = x_data[sort_order]
        y_data = y_data[sort_order]

        x_tick_rotation = kwargs.get('x_tick_rotation', 45)

        if graph_type == 'bar':
            plt.bar(x_data, y_data, label=kwargs.get('label', 'Data'), color=kwargs.get('color', 'steelblue'))
        elif graph_type == 'line':
            plt.plot(x_data, y_data, label=kwargs.get('label', 'Data'), color=kwargs.get('color', 'orange'), marker='o')
        elif graph_type == 'scatter':
            plt.scatter(x_data, y_data, label=kwargs.get('label', 'Data'), color=kwargs.get('color', 'green'))
        else:
            raise ValueError(f"Unsupported graph type: {graph_type}")

        plt.xticks(rotation=x_tick_rotation, ha='right')
        
        # FIX: Ensure axis labels fall back correctly when no header is provided
        # Use kwargs.get() for labels, regardless of header
        plt.xlabel(kwargs.get('xlabel', f'Column {x_column}'))
        plt.ylabel(kwargs.get('ylabel', f'Column {y_column}'))
        
        plt.legend()
        plt.grid(True)
        # plt.tight_layout() # Removed redundant call

    # --- Final Plotting and Encoding ---
    
    # Title with styling
    plt.title(
        kwargs.get('title', 'Graph Title'),
        y=1.05, # Adjusted y slightly
        fontsize=14,
        fontweight='bold'
    )
    
    # FIX: Removed the redundant second call to plt.title() and plt.tight_layout()
    plt.tight_layout()
    
    # Save plot to buffer in PNG format and encode as base64 string
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close()
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')

    return img_base64

#-- Create Graph with theme ----
def create_graph_wt(data, graph_type='line', x_column=0, y_column=1, has_header=False, return_fig=False, **kwargs):
    if not hasattr(data, 'shape') or len(data.shape) != 2:
        raise ValueError("Data should be a 2D array-like structure.")

    header = None
    if isinstance(data, np.ndarray) and has_header:
        header = list(data[0])
        data = data[1:]

    if isinstance(x_column, str) and header:
        x_column = header.index(x_column)
    if isinstance(y_column, str) and header:
        y_column = header.index(y_column)

    x_data = np.array([short_label(v) for v in data[:, x_column]], dtype=object)
    y_data = data[:, y_column].astype(float)

    n = len(x_data)
    fig_width = max(10, min(20, n * 0.4))
    fig, ax = plt.subplots(figsize=(fig_width, 6))

    theme = kwargs.get("theme", "vibrant")
    colors = COLOR_THEMES.get(theme, COLOR_THEMES["vibrant"])

    if graph_type == 'pie':
        total = np.sum(y_data)
        threshold = 0.01 * total
        small_mask = y_data < threshold
        large_mask = ~small_mask

        large_x = x_data[large_mask]
        large_y = y_data[large_mask]

        small_sum = np.sum(y_data[small_mask])
        if small_sum > 0:
            large_x = np.append(large_x, "Other")
            large_y = np.append(large_y, small_sum)

        sort_order = np.argsort(-large_y)
        large_x = large_x[sort_order]
        large_y = large_y[sort_order]

        def autopct_format(pct):
            return '%1.1f%%' % pct if pct >= 5 else ''

        if len(large_y) > len(colors):
            import itertools
            colors = list(itertools.islice(itertools.cycle(colors), len(large_y)))

        ax.pie(
            large_y,
            labels=large_x,
            autopct=autopct_format,
            startangle=90,
            labeldistance=1.15,
            colors=colors
        )
        ax.axis('equal')

    else:
        sort_order = np.argsort(-y_data)
        x_data = x_data[sort_order]
        y_data = y_data[sort_order]

        rotation = min(90, max(0, len(str(max(x_data, key=len))) * 2))

        if graph_type == 'bar':
            ax.bar(x_data, y_data, label=kwargs.get('label', 'Data'), color=colors[:len(y_data)])
        elif graph_type == 'line':
            ax.plot(x_data, y_data, label=kwargs.get('label', 'Data'), color=colors[0], marker='o')
        elif graph_type == 'scatter':
            ax.scatter(x_data, y_data, label=kwargs.get('label', 'Data'), color=colors[0])
        else:
            raise ValueError(f"Unsupported graph type: {graph_type}")

        ax.set_xticks(range(len(x_data)))
        ax.set_xticklabels(x_data, rotation=rotation, ha='right')
        ax.set_xlabel(kwargs.get('xlabel', f'Column {x_column}'))
        ax.set_ylabel(kwargs.get('ylabel', f'Column {y_column}'))
        ax.legend()
        ax.grid(True)

    ax.set_title(kwargs.get('title', 'Graph Title'), y=1.05, fontsize=14, fontweight='bold')
    fig.tight_layout()

    if return_fig:
        return fig  # return the matplotlib figure directly

    # Save to PNG base64
    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    plt.close(fig)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    return img_base64

