document.addEventListener("DOMContentLoaded", () => {
    const taskInput = document.getElementById("taskSelect");
    const taskList = document.getElementById("taskList");
    const stepSelect = document.getElementById("activeStepsSelect");
    const moduleTabs = document.querySelectorAll(".module-tab:not(select)");
    const categoryButtons = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");

    let allUOMs = [];
    let allDatasheets = [];
    let allSteps = [];
    let allMTransport = [];
    let selectedElement = "";

    const specialSteps = ["Forest Operation", "Transportation", "Wood Processing"];
    let currentModule = "Forest Operation";
    let currentCategory = "Product";

    let stepsLoaded = false;
    let datasheetsLoaded = false;

    function showInlineMessage(message, type = "info") {
        let box = document.getElementById("update-message-box");
        if (!box) {
            box = document.createElement("div");
            box.id = "update-message-box";
            box.style.marginBottom = "15px";
            box.style.padding = "10px 12px";
            box.style.borderRadius = "6px";
            rightPanel.prepend(box);
        }

        box.textContent = message;

        if (type === "success") {
            box.style.background = "#e8f7ea";
            box.style.color = "#1f6b2a";
            box.style.border = "1px solid #bfe3c6";
        } else if (type === "error") {
            box.style.background = "#fdeaea";
            box.style.color = "#a61d24";
            box.style.border = "1px solid #f1b8bc";
        } else if (type === "warning") {
            box.style.background = "#fff7e5";
            box.style.color = "#8a6500";
            box.style.border = "1px solid #f1df9c";
        } else {
            box.style.background = "#eef4ff";
            box.style.color = "#234";
            box.style.border = "1px solid #c9daf8";
        }
    }

    function clearInlineMessage() {
        const box = document.getElementById("update-message-box");
        if (box) box.remove();
    }

    function closeManualAllocationModal() {
        const modal = document.getElementById("manualAllocationModal");
        if (!modal) return;
        modal.classList.remove("show");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");

        const err = document.getElementById("manualAllocationError");
        if (err) err.textContent = "";
    }

    function openManualAllocationModal(flows, saveCallback) {
        const modal = document.getElementById("manualAllocationModal");
        const fieldsContainer = document.getElementById("manualAllocationFields");
        const messageEl = document.getElementById("manualAllocationMessage");
        const errorEl = document.getElementById("manualAllocationError");
        const saveBtn = document.getElementById("saveManualAllocationBtn");

        if (!modal || !fieldsContainer || !messageEl || !errorEl || !saveBtn) {
            console.error("Manual allocation modal elements are missing.");
            return;
        }

        fieldsContainer.innerHTML = "";
        errorEl.textContent = "";
        messageEl.textContent =
            "Enter allocation factors for Product and Co-Products with CHK not checked. Total cannot exceed 100%.";

        flows.forEach(flow => {
            const wrapper = document.createElement("div");
            wrapper.className = "mb-3";
            wrapper.innerHTML = `
                <label>${flow.name} (${flow.category}${flow.chk === 0 ? ", CHK not checked" : ""})</label>
                <input
                    type="number"
                    class="allocation-input"
                    data-ide="${flow.IDE}"
                    min="0"
                    max="100"
                    step="0.01"
                    value="${flow.manual_allocation != null ? (flow.manual_allocation * 100) : 0}"
                />
                <small>Enter allocation in %</small>
            `;
            fieldsContainer.appendChild(wrapper);
        });

        saveBtn.onclick = async () => {
            errorEl.textContent = "";

            const inputs = document.querySelectorAll(".allocation-input");
            const allocation = {};
            let total = 0;

            inputs.forEach(input => {
                const value = parseFloat(input.value || 0);
                allocation[input.dataset.ide] = value;
                total += value;
            });

            if (total > 100.0000001) {
                errorEl.textContent = "Total allocation percentage cannot exceed 100%.";
                return;
            }

            try {
                await saveCallback(allocation);
            } catch (err) {
                console.error(err);
                errorEl.textContent = "Unexpected error while saving allocation.";
            }
        };

        modal.classList.add("show");
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    }

    function getStepIdByName(stepName) {
        const step = allSteps.find(s => s.SName.toLowerCase() === String(stepName).toLowerCase());
        return step ? step.IDS : null;
    }

    function tryInitialRefresh() {
        if (stepsLoaded && datasheetsLoaded) {
            refreshForm();
        }
    }

    fetch("/listTotbystatus/1")
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) {
                allMTransport = data;
            }
        })
        .catch(err => console.error("Error loading transport modes:", err));

    fetch("/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allUOMs = data.uoms;
            }
        })
        .catch(err => console.error("Error loading UOMs:", err));

    fetch("/get_all_steps")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allSteps = data.steps;
                stepsLoaded = true;
                tryInitialRefresh();

                stepSelect.innerHTML = '<option disabled selected value="">Select Step</option>';
                data.steps.forEach(step => {
                    if (!specialSteps.includes(step.SName)) {
                        const opt = document.createElement("option");
                        opt.value = step.IDS;
                        opt.textContent = step.SName;
                        stepSelect.appendChild(opt);
                    }
                });
            }
        })
        .catch(err => console.error("Error loading steps:", err));

    function loadTaskData(taskId) {
        fetch(`/get_datasheet_by_task/${taskId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    allDatasheets = data.data;
                    datasheetsLoaded = true;
                    tryInitialRefresh();
                } else {
                    alert("Failed to load datasheet entries for this task.");
                }
            })
            .catch(err => {
                console.error("Error fetching datasheet:", err);
                alert("An error occurred while loading task data.");
            });
    }

    const hasInitialTask = typeof initialTaskId !== "undefined" && initialTaskId !== null;

    if (hasInitialTask) {
        taskInput.value = initialTaskName;

        const initialTaskOption = document.createElement("option");
        initialTaskOption.value = initialTaskName;
        initialTaskOption.dataset.id = initialTaskId;
        taskList.appendChild(initialTaskOption);

        taskInput.disabled = true;
        loadTaskData(initialTaskId);
    } else {
        taskInput.placeholder = "Error: Task not selected.";
        taskInput.disabled = true;
        rightPanel.innerHTML = "<p>Task data could not be loaded. Please return to the task list.</p>";
    }

    moduleTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            moduleTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentModule = tab.dataset.sname.trim();
            stepSelect.value = "";
            refreshForm();
        });
    });

    categoryButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            categoryButtons.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            currentCategory = btn.dataset.category.trim();
            refreshForm();
        });
    });

    stepSelect.addEventListener("change", () => {
        currentModule = stepSelect.options[stepSelect.selectedIndex].text.trim();
        moduleTabs.forEach(t => t.classList.remove("active"));
        refreshForm();
    });

    document.addEventListener("change", (event) => {
        if (event.target && event.target.name === "CHK") {
            const category = currentCategory;
            const ischk = event.target.checked ? 1 : 0;

            const row = event.target.closest(".form-row");
            const elementSelect = row.querySelector('select[name="IDE"]');

            if (elementSelect) {
                searchElement(category, ischk, elementSelect, row);
            }
        }
    });

    function searchElement(category, ischk, elementSelect, row) {
        fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(category)}/${encodeURIComponent(ischk)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    console.error("Category elements not found.");
                    return;
                }

                const currentVal = elementSelect.value;
                const elements = data.elements || [];

                elementSelect.innerHTML = "";

                const defaultOption = document.createElement("option");
                defaultOption.value = "";
                defaultOption.textContent = "-- Select --";
                elementSelect.appendChild(defaultOption);

                elements.forEach(element => {
                    const option = document.createElement("option");
                    let txtcontent = element.EName;
                    if (element.SName) txtcontent += ` | ${element.SName}`;
                    if (element.TName) txtcontent += ` | ${element.TName}`;
                    option.value = element.IDE;
                    option.textContent = txtcontent;
                    elementSelect.appendChild(option);
                });

                elementSelect.value = currentVal;

                if (!elementSelect.value) {
                    const uName = row.querySelector('[name="UName"]');
                    const idu = row.querySelector('[name="IDU1"]');
                    if (uName) uName.innerHTML = '<option value="">-- Select UName --</option>';
                    if (idu) idu.innerHTML = "";
                }
            })
            .catch(err => console.error("Error searching elements:", err));
    }

    function refreshForm() {
        clearInlineMessage();

        const taskId = initialTaskId;
        const stepName = currentModule;
        const category = currentCategory;

        if (!taskId || !stepName || !category) {
            rightPanel.innerHTML = `<p>Please select a task, a step, and a category.</p>`;
            return;
        }

        const chkElement = document.querySelector('[name="CHK"]');
        const ischk = chkElement ? (chkElement.checked ? 1 : 0) : 0;

        const stepObj = allSteps.find(s => s.SName.toLowerCase() === stepName.toLowerCase());
        if (!stepObj) return;
        const stepId = stepObj.IDS;

        fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(category)}/${encodeURIComponent(ischk)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    rightPanel.innerHTML = `<p>Category elements not found.</p>`;
                    return;
                }

                const filteredElements = data.elements || [];
                const matchingIDE = filteredElements.map(e => e.IDE);

                const filteredRows = allDatasheets.filter(row =>
                    String(row.IDT) === String(taskId) &&
                    String(row.IDS) === String(stepId) &&
                    matchingIDE.includes(row.IDE)
                );

                renderForm(filteredRows, filteredElements, taskId, stepId);
            })
            .catch(err => {
                console.error("Error refreshing form:", err);
                rightPanel.innerHTML = `<p>Error loading form.</p>`;
            });
    }

    function renderForm(rows, elements, taskId, stepId) {
        rightPanel.innerHTML = "";

        rightPanel.classList.remove("co-products-form", "transportations-form");
        if (currentModule.trim() === "Transportation") {
            rightPanel.classList.add("transportations-form");
        } else if (currentCategory.trim() === "Co-Products") {
            rightPanel.classList.add("co-products-form");
        }

        const header = document.createElement("div");
        header.className = "form-header";

        if (
            currentModule.trim() === "Transportation" &&
            (currentCategory.trim() === "Co-Products" || currentCategory.trim() === "Emissions")
        ) {
            header.innerHTML = ``;
        } else if (currentModule.trim() === "Transportation") {
            header.innerHTML = `
                <span>Materials</span>
                <span>Quantity</span>
                <span>Unit</span>
                <span></span>
                <span></span>
            `;
        } else if (currentCategory.trim() === "Co-Products") {
            header.innerHTML = `
                <span>Name</span>
                <span>Value</span>
                <span>Unit</span>
                <span>CHK</span>
                <span></span>
                <span></span>
            `;
        } else {
            header.innerHTML = `
                <span>Name</span>
                <span>Value</span>
                <span>Unit</span>
                <span></span>
                <span></span>
            `;
        }

        rightPanel.appendChild(header);

        const rowsContainer = document.createElement("div");
        rowsContainer.id = "rowsContainer";

        rows.forEach(r => {
            rowsContainer.appendChild(createRow(r, elements));
        });

        if (rows.length === 0 && currentCategory.trim() === "Product") {
            rowsContainer.appendChild(createRow({}, elements));
        }

        rightPanel.appendChild(rowsContainer);

        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "form-footer-buttons";

        const addBtn = document.createElement("button");
        addBtn.className = "action-button add-button";
        addBtn.textContent = "Add Row";
        addBtn.type = "button";

        if (
            currentCategory.trim() === "Product" ||
            (currentModule.trim() === "Transportation" &&
                (currentCategory.trim() === "Co-Products" || currentCategory.trim() === "Emissions"))
        ) {
            addBtn.style.display = "none";
        }

        addBtn.onclick = () => {
            rowsContainer.appendChild(createRow({}, elements));
        };
        buttonsContainer.appendChild(addBtn);

        const saveBtn = document.createElement("button");
        saveBtn.className = "action-button check-button";
        saveBtn.textContent = "Save Changes";
        saveBtn.type = "button";

        if (
            currentModule.trim() === "Transportation" &&
            (currentCategory.trim() === "Co-Products" || currentCategory.trim() === "Emissions")
        ) {
            saveBtn.style.display = "none";
        }

        saveBtn.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to save changes?")) {
                return;
            }
            await saveData(taskId, stepId);
        });

        buttonsContainer.appendChild(saveBtn);
        rightPanel.appendChild(buttonsContainer);
    }

    function createRow(rowData = {}, elements) {
        const row = document.createElement("div");
        row.className = "form-row";

        if (
            currentModule.trim() === "Transportation" &&
            (currentCategory.trim() === "Co-Products" || currentCategory.trim() === "Emissions")
        ) {
            return row;
        }

        const hiddenIDD = document.createElement("input");
        hiddenIDD.type = "hidden";
        hiddenIDD.name = "IDD";
        hiddenIDD.value = rowData.IDD || "";
        row.appendChild(hiddenIDD);

        const elementSelect = document.createElement("select");
        elementSelect.name = "IDE";
        elementSelect.classList.add("select-common");

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select --";
        elementSelect.appendChild(defaultOption);

        elements
            .slice()
            .sort((a, b) => a.EName.localeCompare(b.EName))
            .forEach(el => {
                const opt = document.createElement("option");
                let txtcontent = el.EName;
                if (el.SName) txtcontent += ` | ${el.SName}`;
                if (el.TName) txtcontent += ` | ${el.TName}`;
                opt.value = el.IDE;
                opt.textContent = txtcontent;
                if (String(rowData.IDE) === String(el.IDE)) opt.selected = true;
                elementSelect.appendChild(opt);
            });

        row.appendChild(createCell(elementSelect));

        elementSelect.addEventListener("change", (event) => {
            selectedElement = event.target.value;
            if (!selectedElement) {
                allUOMs = [];
                return;
            }

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        allUOMs = data.uoms || [];
                        populateUNameOptions(row, rowData);
                    }
                })
                .catch(err => console.error("UOM fetch failed:", err));
        });

        const valueInput = document.createElement("input");
        valueInput.type = "number";
        valueInput.name = "ValueD1";
        valueInput.value = rowData.ValueD1 || "";
        row.appendChild(createCell(valueInput));

        const unitCell = document.createElement("div");
        const unitContainer = document.createElement("div");
        unitContainer.className = "unit-container";

        const unameSelect = document.createElement("select");
        unameSelect.name = "UName";
        unameSelect.classList.add("select-common");

        const defaultUNameOpt = document.createElement("option");
        defaultUNameOpt.value = "";
        defaultUNameOpt.textContent = "-- Select UName --";
        unameSelect.appendChild(defaultUNameOpt);

        const iduSelect = document.createElement("select");
        iduSelect.name = "IDU1";
        iduSelect.classList.add("select-common");

        unitContainer.appendChild(unameSelect);
        unitContainer.appendChild(iduSelect);
        unitCell.appendChild(unitContainer);
        row.appendChild(unitCell);

        function populateUNameOptions(currentRow, currentRowData = {}) {
            const ide = currentRow.querySelector('[name="IDE"]').value;
            if (!ide) return;

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(ide)}`)
                .then(res => res.json())
                .then(data => {
                    const uoms = data.success ? (data.uoms || []) : [];

                    const uNameSelect = currentRow.querySelector('[name="UName"]');
                    const idu1Select = currentRow.querySelector('[name="IDU1"]');

                    uNameSelect.innerHTML = '<option value="">-- Select UName --</option>';
                    idu1Select.innerHTML = "";

                    const uniqueUNames = [...new Set(uoms.map(u => u.UName))];
                    uniqueUNames.forEach(uname => {
                        const opt = document.createElement("option");
                        opt.value = uname;
                        opt.textContent = uname;
                        if (currentRowData.UName === uname) opt.selected = true;
                        uNameSelect.appendChild(opt);
                    });

                    if (currentRowData.UName) {
                        populateIDUOptions(currentRow, currentRowData.UName, currentRowData.IDU1);
                    }
                });
        }

        function populateIDUOptions(currentRow, uName, selectedIDU = null) {
            const ide = currentRow.querySelector('[name="IDE"]').value;
            if (!ide || !uName) return;

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(ide)}`)
                .then(res => res.json())
                .then(data => {
                    const uoms = data.success ? (data.uoms || []) : [];
                    const idu1Select = currentRow.querySelector('[name="IDU1"]');

                    idu1Select.innerHTML = "";

                    uoms
                        .filter(u => u.UName === uName)
                        .forEach(u => {
                            const opt = document.createElement("option");
                            opt.value = u.IDU;
                            opt.textContent = u.Unit;
                            if (String(selectedIDU) === String(u.IDU)) opt.selected = true;
                            idu1Select.appendChild(opt);
                        });
                });
        }

        unameSelect.addEventListener("change", () => {
            populateIDUOptions(row, unameSelect.value);
        });

        if (rowData.IDE) {
            populateUNameOptions(row, rowData);
        }

        if (currentCategory.trim() === "Co-Products") {
            const chkContainer = document.createElement("div");
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.name = "CHK";
            chk.checked = Number(rowData.CHK) === 1;
            chkContainer.appendChild(chk);
            row.appendChild(createCell(chkContainer));
        }

        const statusSpan = document.createElement("span");
        statusSpan.className = "row-status";
        statusSpan.style.minWidth = "20px";
        statusSpan.style.textAlign = "center";
        row.appendChild(createCell(statusSpan));

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "✖";
        deleteBtn.className = "delete-row";
        deleteBtn.type = "button";
        deleteBtn.onclick = () => {
            if (confirm("Are you sure you want to delete this row?")) {
                handleDelete(row, rowData.IDD);
            }
        };
        row.appendChild(createCell(deleteBtn));

        return row;
    }

    function createCell(child) {
        const div = document.createElement("div");
        div.appendChild(child);
        return div;
    }

    function handleDelete(row, IDD) {
        if (IDD) {
            fetch(`/delete_datasheet_row/${IDD}`, { method: "DELETE" })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        row.remove();
                        showInlineMessage("Row deleted successfully.", "success");
                    } else {
                        alert("Error deleting row from the database.");
                    }
                })
                .catch(() => alert("Network error. Could not delete row."));
        } else {
            row.remove();
        }
    }

    function collectRowsForSave() {
        const rows = [];
        const rowDivs = Array.from(document.querySelectorAll("#rowsContainer .form-row"));

        rowDivs.forEach(row => {
            const IDE = row.querySelector('[name="IDE"]')?.value || null;
            const UName = row.querySelector('[name="UName"]')?.value || null;
            const IDU1 = row.querySelector('[name="IDU1"]')?.value || null;
            const val = row.querySelector('[name="ValueD1"]')?.value;
            const ValueD1 = parseFloat(val);
            const IDD = row.querySelector('[name="IDD"]')?.value || null;
            const CHK = currentCategory.trim() === "Co-Products"
                ? (row.querySelector('[name="CHK"]')?.checked ? 1 : 0)
                : null;

            if (currentModule.trim() === "Transportation") {
                if (!IDE || !IDU1 || isNaN(ValueD1)) return;
                rows.push({
                    IDE,
                    UName,
                    IDU1,
                    ValueD1,
                    CHK: null,
                    IDD,
                    Category: currentCategory
                });
                return;
            }

            if (!IDE || !IDU1 || isNaN(ValueD1)) return;

            rows.push({
                IDE,
                UName,
                IDU1,
                ValueD1,
                CHK,
                IDD,
                Category: currentCategory
            });
        });

        return rows;
    }

    async function saveData(taskId, stepId, allocation = null) {
        clearInlineMessage();

        const rowDivs = Array.from(document.querySelectorAll("#rowsContainer .form-row"));
        rowDivs.forEach(row => {
            const statusSpan = row.querySelector(".row-status");
            if (statusSpan) {
                statusSpan.textContent = "❌";
                statusSpan.style.color = "red";
            }
        });

        const rows = collectRowsForSave();

        if (rows.length === 0) {
            showInlineMessage("No valid rows to save.", "warning");
            return;
        }

        try {
            const payload = { task_id: taskId, step_id: stepId, rows };
            if (allocation) {
                payload.allocation = allocation;
            }

            const response = await fetch("/save_datasheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.requires_allocation) {
                openManualAllocationModal(data.flows, async (allocMap) => {
                    const retryResponse = await fetch("/save_datasheet", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            task_id: taskId,
                            step_id: stepId,
                            rows,
                            allocation: allocMap
                        })
                    });

                    const retryData = await retryResponse.json();

                    if (retryData.success) {
                        closeManualAllocationModal();
                        showInlineMessage(retryData.message || "Changes saved successfully.", "success");
                        markRowsSuccess(rowDivs);

                        if (retryData.updated_rows) {
                            allDatasheets = retryData.updated_rows;
                        } else {
                            loadTaskData(taskId);
                        }
                    } else {
                        const err = document.getElementById("manualAllocationError");
                        if (err) err.textContent = retryData.message || "Error saving allocation.";
                    }
                });
                return;
            }

            if (data.success) {
                showInlineMessage(data.message || "Changes saved successfully.", "success");

                if (data.rowsStatus && data.rowsStatus.length === rows.length) {
                    let idx = 0;
                    rowDivs.forEach(row => {
                        const ide = row.querySelector('[name="IDE"]')?.value;
                        const idu1 = row.querySelector('[name="IDU1"]')?.value;
                        const val = parseFloat(row.querySelector('[name="ValueD1"]')?.value);

                        if (!ide || !idu1 || isNaN(val)) return;

                        const statusSpan = row.querySelector(".row-status");
                        if (!statusSpan) return;

                        const status = data.rowsStatus[idx];
                        idx += 1;

                        if (status === "success") {
                            statusSpan.textContent = "✔";
                            statusSpan.style.color = "green";
                        } else {
                            statusSpan.textContent = "❌";
                            statusSpan.style.color = "red";
                        }
                    });
                } else {
                    markRowsSuccess(rowDivs);
                }

                loadTaskData(taskId);
            } else {
                showInlineMessage(data.message || "Error saving changes.", "error");
            }

        } catch (err) {
            console.error("Save error:", err);
            showInlineMessage("Unexpected error while saving.", "error");
        }
    }

    function markRowsSuccess(rowDivs) {
        rowDivs.forEach(row => {
            const ide = row.querySelector('[name="IDE"]')?.value;
            const idu1 = row.querySelector('[name="IDU1"]')?.value;
            const val = parseFloat(row.querySelector('[name="ValueD1"]')?.value);
            if (!ide || !idu1 || isNaN(val)) return;

            const statusSpan = row.querySelector(".row-status");
            if (statusSpan) {
                statusSpan.textContent = "✔";
                statusSpan.style.color = "green";
            }
        });
    }

    const manualAllocationCloseBtn = document.getElementById("manualAllocationCloseBtn");
    if (manualAllocationCloseBtn) {
        manualAllocationCloseBtn.addEventListener("click", closeManualAllocationModal);
    }

    const manualAllocationModal = document.getElementById("manualAllocationModal");
    if (manualAllocationModal) {
        manualAllocationModal.addEventListener("click", (e) => {
            if (e.target === manualAllocationModal) {
                closeManualAllocationModal();
            }
        });
    }
});