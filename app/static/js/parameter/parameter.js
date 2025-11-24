document.addEventListener('DOMContentLoaded', async function() {

    // === DOM ELEMENTS ===
    const tableBody = document.getElementById('parameter-table-body');
    const resetButton = document.getElementById('reset-to-default');
    const saveButton = document.getElementById('save-row');
    const addRowButton = document.getElementById('add-row');
    const deleteRowButton = document.getElementById('delete-row');
    const taskFilter = document.getElementById('task-filter');

    let selectedRow = null;

    // ==============================================
    // 1) LOAD TASK LIST (for displaying task names + filter)
    // ==============================================
    let taskOptions = [];

    try {
        const res = await fetch('/listtasks');
        const data = await res.json();

        if (data.success) {
            taskOptions = data.tasks;

            // Fill the filter dropdown
            taskOptions.forEach(task => {
                const opt = document.createElement('option');
                opt.value = task.IDT;
                opt.textContent = `${task.TName} - ${task.IDT}`;
                opt.dataset.region = task.Region ?? "";
                taskFilter.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Could not load tasks:", err);
    }

    // ==============================================
    // 2) FILL TASK NAME COLUMN IN TABLE
    // ==============================================
    tableBody.querySelectorAll("tr").forEach(row => {
        const idtCell = row.querySelector(".task-name-cell");
        const idtValue = idtCell?.dataset.idt;
        if (!idtValue) return;

        const task = taskOptions.find(t => String(t.IDT) === String(idtValue));
        idtCell.textContent = task ? task.TName : "";
    });

    // ==============================================
    // 3) FILTER TABLE BY SELECTED TASK
    // ==============================================
    function applyTableFilters() {
        const selectedTask = taskFilter.value;

        tableBody.querySelectorAll("tr").forEach(row => {
            const idt = row.querySelector(".task-name-cell")?.dataset.idt || "";
            row.style.display = (!selectedTask || idt === selectedTask) ? "" : "none";
        });
    }

    taskFilter.addEventListener('change', applyTableFilters);

    // Display Region label dynamically
    document.getElementById('task-region-label').textContent = "";
    taskFilter.addEventListener('change', function() {
        const regionLabel = document.getElementById('task-region-label');
        const opt = this.options[this.selectedIndex];
        regionLabel.textContent = opt.dataset.region ? `(Region: ${opt.dataset.region})` : "";
    });

    // ==============================================
    // 4) ROW SELECTION
    // ==============================================
    tableBody.addEventListener('click', event => {
        const row = event.target.closest("tr");
        if (!row) return;

        if (selectedRow) selectedRow.classList.remove("selected-row");
        row.classList.add("selected-row");
        selectedRow = row;
    });

    // ==============================================
    // 5) ADD ROW → Go to registration page
    // ==============================================
    if (addRowButton) {
        addRowButton.addEventListener('click', function() {
            window.location.href = addRowButton.dataset.url;
        });
    }

    // ==============================================
    // 6) RESET PARAMETERS TO DEFAULT
    // ==============================================
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            if (!confirm("Reset all parameter values to default?")) return;

            fetch('/reset-parameters', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        tableBody.querySelectorAll("tr").forEach(row => {
                            const valueCell = row.cells[3];
                            const defaultCell = row.cells[4];
                            valueCell.textContent = defaultCell.textContent;
                        });
                        alert("Parameters reset successfully.");
                    } else {
                        alert("Error: " + data.error);
                    }
                })
                .catch(err => console.error(err));
        });
    }

    // ==============================================
    // 7) DELETE PARAMETER
    // ==============================================
    if (deleteRowButton) {
        deleteRowButton.addEventListener("click", function() {
            if (!selectedRow) {
                alert("Please select a row first.");
                return;
            }

            const paramId = selectedRow.dataset.id;
            const paramName = selectedRow.cells[0].textContent.trim();
            const paramidt = selectedRow.cells[1].dataset.idt;
            const paramtask = selectedRow.cells[1].textContent.trim();

            if (!confirm(`Delete parameter "${paramName}" of "${paramtask}"?`)) return;

            // Send DELETE with query params
            fetch(`/delete-parametervalue?param_id=${paramId}&idt=${paramidt}`, {
                method: "DELETE"
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    selectedRow.remove();
                    selectedRow = null;
                    alert("Parameter deleted.");
                } else {
                    alert("Error deleting: " + (data.error || "Unknown"));
                }
            })
            .catch(err => console.error(err));
        });
    }

    // ==============================================
    // 8) SAVE PARAMETERS — FULLY REWRITTEN VERSION
    // ==============================================

    if (saveButton) {
        saveButton.addEventListener("click", async function () {

            const modifiedRows = [];
            let containsNew = false;

            tableBody.querySelectorAll("tr").forEach(row => {

                const paramId = row.dataset.id;        // "new" or param ID
                const name = row.cells[0].textContent.trim();
                const idt = row.cells[2].textContent.trim() || null; // IDTask

                // Editable value cell
                const valueCell = row.cells[3];
                const textValue = valueCell.textContent.trim();

                // --- VALIDATE VALUE ---
                if (!textValue || isNaN(parseFloat(textValue))) {
                    alert(`Parameter "${name}" must contain a valid number.`);
                    throw new Error("Invalid parameter numeric value");
                }

                const newValue = parseFloat(textValue);
                const originalValue = parseFloat(valueCell.dataset.original);

                // --- CHANGE DETECTION ---
                const isNew = paramId === "new";
                const changed = isNew || (newValue !== originalValue);

                if (changed) {
                    modifiedRows.push({
                        id: paramId,
                        parameter_name: name,
                        parameter_value: newValue,
                        parameter_idt: idt,
                        parameter_default: parseFloat(row.cells[4].textContent.trim()),
                        parameter_unit: row.cells[5].textContent.trim()
                    });

                    if (isNew) containsNew = true;
                }
            });

            // --- NOTHING TO SAVE ---
            if (modifiedRows.length === 0) {
                alert("No changes to save.");
                return;
            }

            if (!confirm(`Save ${modifiedRows.length} change(s)?`)) return;

            // --- SEND TO SERVER ---
            try {
                const response = await fetch("/save-parameters", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ updates: modifiedRows })
                });

                const data = await response.json();

                if (!data.success) {
                    alert("Save error: " + data.error);
                    return;
                }

                // --- UPDATE ORIGINAL VALUES ---
                tableBody.querySelectorAll("tr").forEach(row => {
                    const valueCell = row.cells[3];
                    valueCell.dataset.original = valueCell.textContent.trim();
                });

                alert("Saved successfully.");

                // New rows require reload to obtain real DB ID
                if (containsNew) {
                    window.location.reload();
                }

            } catch (err) {
                console.error("Save error:", err);
                alert("Save failed — check console for details.");
            }
        });
    }

    /* ------------------ Update regeneration mode ------------------ */
    
    document.querySelectorAll('input[name="regeneration"]').forEach(radio => {
        radio.addEventListener("change", function () {
            if (!confirm("Do you want to change regeneration mode?")) {
                // revert to previous
                const prevMode = document.querySelector('.regeneration-controls').dataset.initialMode;
                document.querySelector(`input[name="regeneration"][value="${prevMode}"]`).checked = true;
                return;
            }

            const mode = this.value;

            fetch("/update-regeneration-mode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        document.querySelector('.regeneration-controls').dataset.initialMode = mode;
                        alert("Regeneration mode updated.");
                    } else {
                        alert("Error: " + data.error);
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert("Error updating regeneration mode.");
                });
        });
    });


});
