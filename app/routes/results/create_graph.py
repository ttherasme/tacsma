
import matplotlib.pyplot as plt
import numpy as np
import io
import base64
from typing import Optional, Union


def create_graph(data, graph_type='line', x_column=None, y_column=None, has_header=False, **kwargs):
    
    if not hasattr(data, 'shape') or len(data.shape) != 2:
        raise ValueError("Data should be a 2D array-like structure.")

    header = None
    if isinstance(data, np.ndarray):
        if has_header:
            header = list(data[0])
            data = data[1:]
    else:
        raise ValueError("Data is not in the expected NumPy format.")

    if isinstance(x_column, str) and header:
        if x_column not in header:
            raise ValueError(f"x_column '{x_column}' not found in header.")
        x_column = header.index(x_column)

    if isinstance(y_column, str) and header:
        if y_column not in header:
            raise ValueError(f"y_column '{y_column}' not found in header.")
        y_column = header.index(y_column)

    x_data = data[:, x_column]
    y_data = data[:, y_column].astype(float)

    n = len(x_data)
    fig_width = max(10, min(20, n * 0.4))
    plt.figure(figsize=(fig_width, 6))

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

        # Sort largest to smallest
        sort_order = np.argsort(-large_y)
        large_x = large_x[sort_order]
        large_y = large_y[sort_order]

        # Compute percentages for autopct formatting
        def autopct_format(pct):
            return '%1.1f%%' % pct if pct >= 5 else ''  # Show percent only if ≥ 5%

        colors = kwargs.get('color', plt.cm.tab20.colors)
        if len(large_y) > len(colors):
            import itertools
            colors = list(itertools.islice(itertools.cycle(colors), len(large_y)))

        plt.pie(
            large_y,
            labels=large_x,                    # Always show labels
            autopct=autopct_format,            # Only show % if ≥5%
            startangle=90,
            labeldistance=1.15,
            colors=colors
        )
        plt.axis('equal')

    else:
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
        plt.xlabel(kwargs.get('xlabel', header[x_column] if header else 'X-Axis'))
        plt.ylabel(kwargs.get('ylabel', header[y_column] if header else 'Y-Axis'))
        plt.legend()
        plt.grid(True)
        plt.tight_layout()

    # Title with styling
    plt.title(
        kwargs.get('title', 'Graph Title'),
        y=1.08,
        fontsize=14,
        fontweight='bold'
    )


    plt.title(kwargs.get('title', 'Graph Title'), y=1.08, fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    # Save plot to buffer in PNG format and encode as base64 string
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close()
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')

    return img_base64
