import matplotlib
matplotlib.use('Agg')  # Safe backend for non-GUI threads
import matplotlib.pyplot as plt
import numpy as np
import io
import base64
from typing import Optional

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

# --- Create Graph (basic) ---
def create_graph(data, graph_type='line', x_column=None, y_column=None, has_header=False, **kwargs):
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

        # Sort descending
        sort_order = np.argsort(-large_y)
        large_x = large_x[sort_order]
        large_y = large_y[sort_order]

        # Pie autopct and scaling
        def autopct_format(pct):
            return '%1.1f%%' % pct if pct >= 5 else ''

        colors = kwargs.get('color', plt.cm.tab20.colors)
        if len(large_y) > len(colors):
            import itertools
            colors = list(itertools.islice(itertools.cycle(colors), len(large_y)))

        wedges, texts, autotexts = plt.pie(
            large_y,
            autopct=autopct_format,
            startangle=90,
            colors=colors,
            labeldistance=1.15
        )

        # Scale text for many slices
        fontsize = min(10, max(6, 200 // len(large_y)))
        for t in texts + autotexts:
            t.set_fontsize(fontsize)

        plt.legend(
            wedges,
            large_x,
            title=kwargs.get('legend_title', 'Categories'),
            loc='center left',
            bbox_to_anchor=(1, 0.5),
            fontsize=fontsize
        )
        plt.axis('equal')

    else:
        # Sort data descending
        sort_order = np.argsort(-y_data)
        x_data = x_data[sort_order]
        y_data = y_data[sort_order]

        x_tick_rotation = kwargs.get('x_tick_rotation', 45)
        fontsize = min(12, max(6, 200 // len(x_data)))

        if graph_type == 'bar':
            plt.bar(x_data, y_data, label=kwargs.get('label', 'Data'), color=kwargs.get('color', 'steelblue'))
        elif graph_type == 'line':
            plt.plot(x_data, y_data, label=kwargs.get('label', 'Data'), color=kwargs.get('color', 'orange'), marker='o', linewidth=2)
        elif graph_type == 'scatter':
            plt.scatter(x_data, y_data, label=kwargs.get('label', 'Data'), color=kwargs.get('color', 'green'), s=50)
        else:
            raise ValueError(f"Unsupported graph type: {graph_type}")

        plt.xticks(rotation=x_tick_rotation, ha='right', fontsize=fontsize)
        plt.yticks(fontsize=fontsize)
        plt.xlabel(kwargs.get('xlabel', f'Column {x_column}'), fontsize=fontsize)
        plt.ylabel(kwargs.get('ylabel', f'Column {y_column}'), fontsize=fontsize)
        plt.title(kwargs.get('title', 'Graph Title'), y=1.05, fontsize=fontsize+2, fontweight='bold')
        plt.legend(fontsize=fontsize)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close()
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    return img_base64

# --- Create Graph with Theme ---
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

        wedges, texts, autotexts = ax.pie(
            large_y,
            autopct=autopct_format,
            startangle=90,
            labeldistance=1.15,
            colors=colors
        )

        fontsize = min(10, max(6, 200 // len(large_y)))
        for t in texts + autotexts:
            t.set_fontsize(fontsize)

        ax.legend(
            wedges,
            large_x,
            title=kwargs.get('legend_title', 'Categories'),
            loc='center left',
            bbox_to_anchor=(1, 0.5),
            fontsize=fontsize
        )
        ax.axis('equal')

    else:
        sort_order = np.argsort(-y_data)
        x_data = x_data[sort_order]
        y_data = y_data[sort_order]

        rotation = min(90, max(0, len(str(max(x_data, key=len))) * 2))
        fontsize = min(12, max(6, 200 // len(x_data)))

        if graph_type == 'bar':
            ax.bar(x_data, y_data, label=kwargs.get('label', 'Data'), color=colors[:len(y_data)])
        elif graph_type == 'line':
            ax.plot(x_data, y_data, label=kwargs.get('label', 'Data'), color=colors[0], marker='o', linewidth=2)
        elif graph_type == 'scatter':
            ax.scatter(x_data, y_data, label=kwargs.get('label', 'Data'), color=colors[0], s=50)
        else:
            raise ValueError(f"Unsupported graph type: {graph_type}")

        ax.set_xticks(range(len(x_data)))
        ax.set_xticklabels(x_data, rotation=rotation, ha='right', fontsize=fontsize)
        ax.set_yticklabels(ax.get_yticks(), fontsize=fontsize)
        ax.set_xlabel(kwargs.get('xlabel', f'Column {x_column}'), fontsize=fontsize)
        ax.set_ylabel(kwargs.get('ylabel', f'Column {y_column}'), fontsize=fontsize)
        ax.legend(fontsize=fontsize)

    ax.set_title(kwargs.get('title', 'Graph Title'), y=1.05, fontsize=fontsize+2, fontweight='bold')
    fig.tight_layout()

    if return_fig:
        return fig

    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    plt.close(fig)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    return img_base64
