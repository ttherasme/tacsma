import base64
import io
from typing import Optional

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np


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
        "#111111", "#333333", "#555555", "#777777", "#999999",
        "#bbbbbb", "#dddddd", "#eeeeee", "#cccccc", "#888888"
    ]
}


def short_label(label: object, max_len: int = 25) -> str:
    label = str(label)
    return label if len(label) <= max_len else label[:max_len] + "…"


def _normalize_2d_data(data, has_header: bool):
    arr = np.array(data, dtype=object)

    if arr.ndim != 2:
        raise ValueError("Data should be a 2D array-like structure.")

    header = None
    if has_header:
        if arr.shape[0] < 2:
            raise ValueError("Data with header must contain at least one data row.")
        header = list(arr[0])
        arr = arr[1:]

    if arr.shape[0] == 0:
        raise ValueError("No data rows available for plotting.")

    return arr, header


def _resolve_column_index(column, header, column_name: str) -> int:
    if isinstance(column, str):
        if header is None:
            raise ValueError(f"{column_name} was given as a string but no header is available.")
        if column not in header:
            raise ValueError(f"{column_name} '{column}' not found in header.")
        return header.index(column)

    if column is None:
        raise ValueError(f"{column_name} must be provided.")

    return int(column)


def _prepare_xy(data, x_column, y_column, has_header=False, shorten_labels=False):
    arr, header = _normalize_2d_data(data, has_header)

    x_idx = _resolve_column_index(x_column, header, "x_column")
    y_idx = _resolve_column_index(y_column, header, "y_column")

    x_data = arr[:, x_idx]
    y_data = arr[:, y_idx].astype(float)

    if shorten_labels:
        x_data = np.array([short_label(v) for v in x_data], dtype=object)

    return x_data, y_data, header


def _pick_colors(theme: str, n: int):
    base_colors = COLOR_THEMES.get(theme, COLOR_THEMES["vibrant"])
    if n <= len(base_colors):
        return base_colors[:n]

    import itertools
    return list(itertools.islice(itertools.cycle(base_colors), n))


def _save_figure_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _plot_pie(ax, x_data, y_data, colors, legend_title="Categories"):
    if len(y_data) == 0:
        raise ValueError("No data available for pie chart.")

    if np.any(y_data < 0):
        raise ValueError("Pie chart cannot be created with negative values.")

    total = np.sum(y_data)
    if total <= 0:
        raise ValueError("Pie chart requires a positive total.")

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

    colors = colors[:len(large_y)] if len(colors) >= len(large_y) else _pick_colors("vibrant", len(large_y))

    def autopct_format(pct):
        return f"{pct:.1f}%" if pct >= 5 else ""

    wedges, texts, autotexts = ax.pie(
        large_y,
        autopct=autopct_format,
        startangle=90,
        colors=colors,
        labeldistance=1.15
    )

    fontsize = min(10, max(6, 200 // max(len(large_y), 1)))

    for t in list(texts) + list(autotexts):
        t.set_fontsize(fontsize)

    ax.legend(
        wedges,
        large_x,
        title=legend_title,
        loc="center left",
        bbox_to_anchor=(1, 0.5),
        fontsize=fontsize
    )
    ax.axis("equal")


def _plot_cartesian(
    ax,
    x_data,
    y_data,
    graph_type,
    colors,
    xlabel,
    ylabel,
    title,
    label="Data"
):
    sort_order = np.argsort(-y_data)
    x_data = x_data[sort_order]
    y_data = y_data[sort_order]

    fontsize = min(12, max(6, 200 // max(len(x_data), 1)))

    if graph_type == "bar":
        ax.bar(x_data, y_data, label=label, color=colors[:len(y_data)])
    elif graph_type == "line":
        ax.plot(x_data, y_data, label=label, color=colors[0], marker="o", linewidth=2)
    elif graph_type == "scatter":
        ax.scatter(x_data, y_data, label=label, color=colors[0], s=50)
    else:
        raise ValueError(f"Unsupported graph type: {graph_type}")

    max_label_len = max((len(str(v)) for v in x_data), default=0)
    rotation = min(90, max(0, max_label_len * 2))

    ax.tick_params(axis="x", labelrotation=rotation, labelsize=fontsize)
    ax.tick_params(axis="y", labelsize=fontsize)
    for tick in ax.get_xticklabels():
        tick.set_ha("right")

    ax.set_xlabel(xlabel, fontsize=fontsize)
    ax.set_ylabel(ylabel, fontsize=fontsize)
    ax.set_title(title, y=1.05, fontsize=fontsize + 2, fontweight="bold")
    ax.legend(fontsize=fontsize)


def create_graph(
    data,
    graph_type="line",
    x_column=None,
    y_column=None,
    has_header=False,
    **kwargs
):
    x_data, y_data, _ = _prepare_xy(
        data,
        x_column=x_column,
        y_column=y_column,
        has_header=has_header,
        shorten_labels=False
    )

    n = len(x_data)
    fig_width = max(10, min(20, n * 0.4))
    fig, ax = plt.subplots(figsize=(fig_width, 6))

    graph_type = str(graph_type).lower()
    colors = kwargs.get("color")

    if colors is None:
        colors = list(plt.cm.tab20.colors)

    if graph_type == "pie" and np.any(y_data < 0):
        graph_type = "bar"

    if graph_type == "pie":
        _plot_pie(
            ax,
            np.array(x_data, dtype=object),
            y_data,
            colors,
            legend_title=kwargs.get("legend_title", "Categories")
        )
        ax.set_title(kwargs.get("title", "Graph Title"), y=1.05, fontsize=12, fontweight="bold")
    else:
        _plot_cartesian(
            ax,
            np.array(x_data, dtype=object),
            y_data,
            graph_type=graph_type,
            colors=colors if isinstance(colors, list) else [colors],
            xlabel=kwargs.get("xlabel", f"Column {x_column}"),
            ylabel=kwargs.get("ylabel", f"Column {y_column}"),
            title=kwargs.get("title", "Graph Title"),
            label=kwargs.get("label", "Data")
        )

    fig.tight_layout()
    return _save_figure_to_base64(fig)


def create_graph_wt(
    data,
    graph_type="line",
    x_column=0,
    y_column=1,
    has_header=False,
    return_fig=False,
    **kwargs
):
    x_data, y_data, _ = _prepare_xy(
        data,
        x_column=x_column,
        y_column=y_column,
        has_header=has_header,
        shorten_labels=True
    )

    n = len(x_data)
    fig_width = max(10, min(20, n * 0.4))
    fig, ax = plt.subplots(figsize=(fig_width, 6))

    theme = kwargs.get("theme", "vibrant")
    colors = _pick_colors(theme, max(len(y_data), 1))

    graph_type = str(graph_type).lower()
    if graph_type == "pie" and np.any(y_data < 0):
        graph_type = "bar"

    if graph_type == "pie":
        _plot_pie(
            ax,
            np.array(x_data, dtype=object),
            y_data,
            colors,
            legend_title=kwargs.get("legend_title", "Categories")
        )
        fontsize = min(12, max(6, 200 // max(len(y_data), 1)))
        ax.set_title(
            kwargs.get("title", "Graph Title"),
            y=1.05,
            fontsize=fontsize + 2,
            fontweight="bold"
        )
    else:
        _plot_cartesian(
            ax,
            np.array(x_data, dtype=object),
            y_data,
            graph_type=graph_type,
            colors=colors,
            xlabel=kwargs.get("xlabel", f"Column {x_column}"),
            ylabel=kwargs.get("ylabel", f"Column {y_column}"),
            title=kwargs.get("title", "Graph Title"),
            label=kwargs.get("label", "Data")
        )

    fig.tight_layout()

    if return_fig:
        return fig

    return _save_figure_to_base64(fig)