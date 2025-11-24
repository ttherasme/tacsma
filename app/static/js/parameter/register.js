document.addEventListener("DOMContentLoaded", function () {

    const taskSelect = document.getElementById("task-data");
    const parameterSelect = document.getElementById("parameter-info");
    const regionLabel = document.getElementById("task-region-label");

    const valInput = document.getElementById("parameter-value");
    const defaultInput = document.getElementById("parameter-default");
    const unitInput = document.getElementById("parameter-unit");

    const addRowBtn = document.getElementById("add-row");
    const saveBtn = document.getElementById("save-row");
    const resetBtn = document.getElementById("reset-to-default");
    const deleteBtn = document.getElementById("delete-row");

    const tableBody = document.getElementById("parameter-table-body");
    let selectedRow = null;

    /* ------------------ Load Tasks ------------------ */
    fetch("/listtasks")
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                data.tasks.forEach(t => {
                    let opt = document.createElement("option");
                    opt.value = t.IDT;
                    opt.textContent = t.TName;
                    opt.dataset.region = t.Region;
                    taskSelect.appendChild(opt);
                });
            }
        })
        .catch(err => console.error("Failed to load tasks:", err));

    taskSelect.addEventListener("change", function () {
        const region = this.options[this.selectedIndex].dataset.region || "";
        regionLabel.textContent = region ? `(Region: ${region})` : "";
    });

    /* ------------------ Load Parameters ------------------ */
    fetch("/listparameters")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const parameters = data.parameter_list;
                parameterSelect.innerHTML = '<option value="">--Select--</option>';
                parameters.forEach(p => {
                    const opt = document.createElement("option");
                    opt.value = p.id;
                    opt.textContent = p.name;
                    opt.dataset.default = p.default;
                    opt.dataset.unit = p.unit;
                    parameterSelect.appendChild(opt);
                });
            }
        })
        .catch(err => console.error("Failed to load parameters:", err));

    parameterSelect.addEventListener("change", function () {
        const default_value = this.options[this.selectedIndex].dataset.default || 0;
        const unit_value = this.options[this.selectedIndex].dataset.unit || "";
        defaultInput.value = default_value;
        unitInput.value = unit_value;
        valInput.value = default_value;
    });

    /* ------------------ Add Row ------------------ */
    addRowBtn.addEventListener("click", function () {

        const taskId = taskSelect.value;
        const paramId = parameterSelect.value;
        const val = valInput.value;

        if (!taskId || !paramId || val === "") {
            alert("Task, Parameter, and Value are required.");
            return;
        }

        // Limit: same parameter cannot appear twice for same task
        let exists = [...tableBody.querySelectorAll("tr")].some(tr =>
            tr.dataset.taskId == taskId && tr.dataset.paramId == paramId
        );

        if (exists) {
            alert("This parameter is already added for this task.");
            return;
        }

        // 🔥 User confirmation before adding row
        if (!confirm("Do you want to add this parameter to the table?")) {
            return;
        }

        const tName = taskSelect.options[taskSelect.selectedIndex].textContent;
        const region = taskSelect.options[taskSelect.selectedIndex].dataset.region;
        const pName = parameterSelect.options[parameterSelect.selectedIndex].textContent;
        const def = defaultInput.value;
        const unit = unitInput.value;

        let tr = document.createElement("tr");
        tr.dataset.new = "true";
        tr.dataset.taskId = taskId;
        tr.dataset.paramId = paramId;

        tr.innerHTML = `
            <td>${tName}</td>
            <td>${taskId}</td>
            <td>${region}</td>
            <td>${pName}</td>
            <td>${paramId}</td>
            <td contenteditable="true">${val}</td>
            <td>${def}</td>
            <td>${unit}</td>
            <td class="status-cell status-new">New</td>
        `;

        tableBody.appendChild(tr);
    });


    /* ------------------ Select row ------------------ */
    tableBody.addEventListener("click", function (e) {
        let tr = e.target.closest("tr");
        if (!tr) return;

        if (selectedRow) selectedRow.classList.remove("selected-row");
        selectedRow = tr;
        selectedRow.classList.add("selected-row");
    });

    /* ------------------ Reset (Value to Default) ------------------ */
    resetBtn.addEventListener("click", function () {
        [...tableBody.querySelectorAll("tr")].forEach(tr => {
            // Reset Value (cell 5) to Default (cell 6)
            tr.cells[5].textContent = tr.cells[6].textContent;

            if (tr.dataset.new !== "true") {
                let cell = tr.querySelector(".status-cell");
                cell.textContent = "Updated";
                cell.className = "status-cell status-updated";
            }
        });
    });

    /* ------------------ Delete ------------------ */
    deleteBtn.addEventListener("click", function () {
        if (!selectedRow) {
            alert("Select a row first.");
            return;
        }

        const isNew = selectedRow.dataset.new === "true";
        const paramId = selectedRow.dataset.paramId;
        const taskId = selectedRow.dataset.taskId;

        if (isNew) {
            if (!confirm("This row is not saved yet. Remove it?")) return;
            selectedRow.remove();
            selectedRow = null;
            alert("Row deleted.");
            return;
        }

        if (!confirm("Delete this parameter from the database?")) return;

        // Send DELETE request with two query parameters
        fetch(`/delete-parametervalue?param_id=${paramId}&idt=${taskId}`, {
            method: "DELETE"
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                selectedRow.remove();
                selectedRow = null;
                alert("Row deleted.");
            } else {
                alert("Error: " + data.error);
            }
        })
        .catch(err => console.error("Delete error:", err));
    });


    /* ------------------ Save UserParameterValue ------------------ */
    saveBtn.addEventListener("click", function () {

        // Confirm user wants to save
        if (!confirm("Do you want to save all parameter values?")) return;

        let updates = [];

        [...tableBody.querySelectorAll("tr")].forEach(tr => {
            const paramId = parseInt(tr.dataset.paramId);
            const taskId = parseInt(tr.dataset.taskId);
            const paramName = tr.cells[3].textContent;
            const valueCell = tr.cells[5].textContent;
            const paramValue = parseFloat(valueCell);

            if (isNaN(paramValue)) {
                alert(`Invalid value for parameter "${paramName}".`);
                return;
            }

            updates.push({
                parameter_id: paramId,
                task_id: taskId,
                parameter_value: paramValue
            });
        });

        if (updates.length === 0) {
            alert("No valid changes to save.");
            return;
        }

        console.log("Sending updates:", updates);

        fetch("/save-parametersvalue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                [...tableBody.querySelectorAll("tr")].forEach(tr => {
                    tr.dataset.new = "false";
                    let cell = tr.querySelector(".status-cell");
                    cell.textContent = "Saved";
                    cell.className = "status-cell status-saved";
                });
                alert("Parameter values saved successfully!");
            } else {
                alert("Error saving parameters: " + (data.error || "Unknown error"));
            }
        })
        .catch(err => {
            console.error("Fetch error:", err);
            alert("Failed to save parameters. Check console for details.");
        });

    });


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
