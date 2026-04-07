document.addEventListener("DOMContentLoaded", () => {
    const moduleTabs = document.querySelectorAll(".module-tab");
    const categoryTabs = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");
    const activeStepsSelect = document.getElementById("activeStepsSelect");
    const taskInput = document.getElementById("taskSelect");
    const taskList = document.getElementById("taskList");

    let messageArea = document.getElementById("message-area");

    const state = {
        activeModule: "Forest Operation",
        activeCategory: "+ Product"
    };

    function setState(key, value) {
        if (state[key] !== value) {
            state[key] = value;
            updateContent();
        }
    }

    function makeFormConfig({
        category,
        selectClass,
        elementType,
        hasCheckbox = false,
        showDeleteButton = true,
        showRegisterButton = true,
        customHeader = null,
        customRow = null
    }) {
        const header = customHeader
            ? customHeader
            : hasCheckbox
                ? ["Name", "Quantity", "Unit", "CHK", " ", " "]
                : ["Name", "Quantity", "Unit", " ", " "];

        const row = customRow || (() => {
            const rowFields = [
                `<select class="${selectClass}"></select>`,
                `<input type="number" data-id="valued1" placeholder="0" />`,
                `<div class="inline-selects">
                    <select class="styled-select uom-name-select"></select>
                    <select data-id="unitd1" class="styled-select uom-unit-select"></select>
                </div>`
            ];

            if (hasCheckbox) {
                rowFields.push(`<input type="checkbox" class="coproduct-chk">`);
            }

            rowFields.push(`<div class="status-indicator"></div>`);

            if (showDeleteButton) {
                rowFields.push(`<button title="Delete Row" class="delete-row" type="button">🗑️</button>`);
            } else {
                rowFields.push(``);
            }

            return rowFields;
        });

        const footer = () => `
            ${showRegisterButton
                ? `<button class="action-button register-element-button" data-element-type="${elementType}" type="button">
                        Add new Name
                   </button>`
                : ''}
            <button class="action-button check-button" type="button">Validate ✔️</button>
        `;

        return { header, row, footer };
    }

    const formConfigs = {
        "Transportation|+ Product": makeFormConfig({
            category: "+ Product",
            selectClass: "productSelect",
            elementType: "Product",
            customHeader: ["Materials", "Quantity", "Unit", " ", " "],
            customRow: () => ([
                `<select class="productSelect"></select>`,
                `<input type="number" data-id="valued1" placeholder="0" />`,
                `<div class="inline-selects">
                    <select class="styled-select uom-name-select"></select>
                    <select data-id="unitd1" class="styled-select uom-unit-select"></select>
                </div>`,
                `<div class="status-indicator"></div>`,
                ``
            ])
        }),

        "Transportation|+ Input Materials and Energy": makeFormConfig({
            category: "+ Input Materials and Energy",
            selectClass: "materielSelect",
            elementType: "Input Materials and Energy",
            customHeader: ["Materials", "Quantity", "Unit", " ", " "],
            customRow: () => ([
                `<select class="materielSelect"></select>`,
                `<input type="number" data-id="valued1" placeholder="0" />`,
                `<div class="inline-selects">
                    <select class="styled-select uom-name-select"></select>
                    <select data-id="unitd1" class="styled-select uom-unit-select"></select>
                </div>`,
                `<div class="status-indicator"></div>`,
                `<button title="Delete Row" class="delete-row" type="button">🗑️</button>`
            ])
        }),

        "Transportation|+ Co-Products": {
            header: [" "],
            row: () => ['']
        },

        "Transportation|+ Input Energy": {
            header: [" "],
            row: () => ['']
        },

        "Transportation|+ Emissions": {
            header: [" "],
            row: () => ['']
        },

        "Transportation|+ Waste Treatment": makeFormConfig({
            category: "+ Waste Treatment",
            selectClass: "wasteSelect",
            elementType: "Waste Treatment",
            showRegisterButton: false,
            customHeader: ["Materials", "Quantity", "Unit", " ", " "],
            customRow: () => ([
                `<select class="wasteSelect"></select>`,
                `<input type="number" data-id="valued1" placeholder="0" />`,
                `<div class="inline-selects">
                    <select class="styled-select uom-name-select"></select>
                    <select data-id="unitd1" class="styled-select uom-unit-select"></select>
                </div>`,
                `<div class="status-indicator"></div>`,
                `<button title="Delete Row" class="delete-row" type="button">🗑️</button>`
            ])
        }),

        "default": {
            header: ["Item", "Value", "Unit", " ", " "],
            row: () => ['In process', '', '', '', ''],
            footer: () => `<small>Default footer for undefined combinations.</small><div><button class="check-button" type="button">Submit ✔️</button></div>`
        }
    };

    function getFormConfig(module, category) {
        const configKey = `${module}|${category}`;
        const explicitConfig = formConfigs[configKey];

        if (explicitConfig) {
            return explicitConfig;
        }

        const categoryName = category.substring(2).trim();

        let selectClass;
        let elementType = categoryName;
        let hasCheckbox = categoryName.includes("Co-Products");
        let showDeleteButton = !categoryName.endsWith("Product");
        let showRegisterButton =
            !categoryName.includes("Emissions") &&
            !categoryName.includes("Waste Treatment");

        if (
            module === "Transportation" &&
            (categoryName === "Emissions" ||
             categoryName === "Co-Products" ||
             categoryName === "Input Energy")
        ) {
            return formConfigs["default"];
        } else if (categoryName.includes("Materials and Energy")) {
            selectClass = "materielSelect";
        } else if (categoryName.includes("Co-Products")) {
            selectClass = "coproductSelect";
        } else if (categoryName.includes("Emissions")) {
            selectClass = "emissionsSelect";
        } else if (categoryName.includes("Waste Treatment")) {
            selectClass = "wasteSelect";
        } else if (categoryName.includes("Product")) {
            selectClass = "productSelect";
        } else {
            return formConfigs["default"];
        }

        return makeFormConfig({
            category,
            selectClass,
            elementType,
            hasCheckbox,
            showDeleteButton,
            showRegisterButton
        });
    }

    function showMessage(message, type) {
        if (!messageArea) {
            messageArea = document.createElement("div");
            messageArea.id = "message-area";
            messageArea.className = "message-area";
            rightPanel.prepend(messageArea);
        }

        messageArea.textContent = message;
        messageArea.className = `message-area ${type}-message`;
        messageArea.style.display = "block";
    }

    function clearMessage() {
        if (messageArea) {
            messageArea.textContent = "";
            messageArea.style.display = "none";
            messageArea.className = "message-area";
        }
    }

    function disableRowInputs(row) {
        const inputs = row.querySelectorAll("input, select");
        inputs.forEach(input => {
            input.disabled = true;
        });

        const deleteBtn = row.querySelector(".delete-row");
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
    }

    function updateStatusIndicators(isSuccess, submittedRows, allRows) {
        submittedRows.forEach(row => {
            const indicator = row.querySelector(".status-indicator");
            if (!indicator) return;

            indicator.innerHTML = "";
            if (isSuccess) {
                indicator.innerHTML = '<span class="status-icon green-check">✓</span>';
                disableRowInputs(row);
            } else {
                indicator.innerHTML = '<span class="status-icon red-cross">✗</span>';
            }
        });

        allRows.forEach(row => {
            if (submittedRows.includes(row)) return;

            const indicator = row.querySelector(".status-indicator");
            if (!indicator) return;

            const hasData = Array.from(row.querySelectorAll("select, input")).some(el => {
                if (el.type === "checkbox") return el.checked;
                return el.value && el.value !== "Select...";
            });

            if (hasData && !indicator.querySelector(".status-icon")) {
                indicator.innerHTML = '<span class="status-icon red-cross">✗</span>';
            }
        });
    }

    function areAllRowsSaved() {
        const rows = document.querySelectorAll(".form-rows .form-row");
        return [...rows].every(row => row.querySelector(".status-icon.green-check"));
    }

    function showYesNoConfirm(message, onYes, onNo) {
        const modal = document.getElementById("confirmModal");
        const messageEl = document.getElementById("confirmModalMessage");
        const yesBtn = document.getElementById("confirmYes");
        const noBtn = document.getElementById("confirmNo");

        messageEl.textContent = message;
        modal.style.display = "flex";

        const cleanup = () => {
            modal.style.display = "none";
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };

        yesBtn.onclick = () => {
            cleanup();
            onYes();
        };

        noBtn.onclick = () => {
            cleanup();
            if (onNo) onNo();
        };
    }

    function redirectToEditPage() {
        const selectedTaskName = taskInput.value;
        const selectedOption = taskList.querySelector(`option[value="${selectedTaskName}"]`);

        if (!selectedOption) {
            showMessage("Unable to determine the selected task.", "error");
            return;
        }

        const taskId = selectedOption.dataset.id;
        const editUrl = "/datasheetupdate";
        window.location.href = `${editUrl}?id=${taskId}&name=${encodeURIComponent(selectedTaskName)}`;
    }

    async function getStepIdByName(stepName) {
        try {
            const response = await fetch(`/get_step_id/${encodeURIComponent(stepName)}`);
            const data = await response.json();
            return data.success ? data.ids : null;
        } catch (error) {
            console.error("Network error fetching step ID:", error);
            return null;
        }
    }

    async function fetchFlowsForAllocation(stepId, taskId, rowsData) {
        const response = await fetch("/save_datasheetregister", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rows: rowsData,
                step_id: stepId,
                task_id: taskId
            })
        });

        return response.json();
    }

    function closeManualAllocationModal() {
        const modal = document.getElementById("manualAllocationModal");
        if (!modal) return;
        modal.classList.remove("show");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");

        const errorEl = document.getElementById("manualAllocationError");
        if (errorEl) errorEl.textContent = "";
    }

    function openManualAllocationModal(flows, originalRows, stepId, taskId, submittedRows, allRows) {
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
        messageEl.textContent ="Enter allocation percentages for the relevant flows. Total cannot exceed 100%.";

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
                const response = await fetch("/save_datasheetregister", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        rows: originalRows,
                        step_id: stepId,
                        task_id: taskId,
                        allocation: allocation
                    })
                });

                const result = await response.json();

                if (result.success) {
                    closeManualAllocationModal();
                    showMessage(result.message, "success");
                    updateStatusIndicators(true, submittedRows, allRows);

                    if (areAllRowsSaved()) {
                        setTimeout(() => {
                            showYesNoConfirm(
                                "All rows are saved successfully.\n\nDo you finish with the registration?",
                                () => redirectToEditPage(),
                                () => {}
                            );
                        }, 300);
                    }
                } else {
                    errorEl.textContent = result.message || "Error saving allocation.";
                }
            } catch (err) {
                console.error("Error saving manual allocation:", err);
                errorEl.textContent = "Unexpected error while saving allocation.";
            }
        };

        modal.classList.add("show");
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    }

    function collectFormData() {
        const rows = document.querySelectorAll(".form-rows .form-row");
        const formData = [];
        const submittedRows = [];
        let isValid = true;

        rows.forEach(row => {
            if (row.querySelector(".status-icon.green-check")) {
                return;
            }

            const elementSelect = row.querySelector("select:not(.uom-name-select):not(.uom-unit-select)");
            const quantityInput = row.querySelector('input[data-id="valued1"]');
            const unitSelect = row.querySelector('select[data-id="unitd1"]');
            const checkbox = row.querySelector('input[type="checkbox"]');

            const ide = elementSelect ? elementSelect.value : null;
            const quantity = quantityInput ? quantityInput.value : null;
            const unitId = unitSelect ? unitSelect.value : null;
            const chk = checkbox ? (checkbox.checked ? 1 : 0) : 0;
            const currentCategory = state.activeCategory.replace("+ ", "").trim();

            if (ide && quantity && unitId) {
                formData.push({
                    IDE: ide,
                    ValueD1: parseFloat(quantity),
                    IDU1: unitId,
                    CHK: chk,
                    IDM: null,
                    Category: currentCategory
                });
                submittedRows.push(row);
            } else if (ide || quantity || unitId) {
                isValid = false;
            }
        });

        return { data: formData, isValid, submittedRows };
    }

    function refreshCurrentFormSelect(selectClass, categoryName) {
        const rows = document.querySelectorAll(".form-row");

        rows.forEach(row => {
            const select = row.querySelector(`.${selectClass}`);
            if (!select) return;

            const currentValue = select.value;
            const checkbox = row.querySelector('input[type="checkbox"]');
            const ischk = checkbox ? (checkbox.checked ? 1 : 0) : 0;

            fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(categoryName)}/${encodeURIComponent(ischk)}`)
                .then(res => res.json())
                .then(data => {
                    const elements = data.elements || [];

                    select.innerHTML = '<option value="">Select ...</option>';

                    elements.forEach(el => {
                        const option = document.createElement("option");
                        let txtcontent = el.EName;

                        // Only for Product / Co-Products
                        if (categoryName.trim() === "Product" || categoryName.trim() === "Co-Products") {
                            if (el.SName) txtcontent += ` | ${el.SName}`;
                            if (el.TName) txtcontent += ` | ${el.TName}`;
                        }
                        option.value = el.IDE;
                        option.textContent = txtcontent;
                        select.appendChild(option);
                    });

                    select.value = currentValue;
                })
                .catch(err => console.error("Error refreshing dropdown:", err));
        });
    }

    document.addEventListener("reloadProductSelect", () => {
        refreshCurrentFormSelect("productSelect", "Product");
    });

    document.addEventListener("reloadMaterielSelect", () => {
        refreshCurrentFormSelect("materielSelect", "Input Materials and Energy");
    });

    document.addEventListener("reloadCoproductSelect", () => {
        refreshCurrentFormSelect("coproductSelect", "Co-Products");
    });

    document.addEventListener("reloadEnergySelect", () => {
        refreshCurrentFormSelect("energySelect", "Input Energy");
    });

    document.addEventListener("reloadEmissionsSelect", () => {
        refreshCurrentFormSelect("emissionsSelect", "Emissions");
    });

    document.addEventListener("reloadWasteSelect", () => {
        refreshCurrentFormSelect("wasteSelect", "Waste Treatment");
    });

    function populateAndLinkUomSelects(rowElement, elementSelect) {
        const uomNameSelect = rowElement.querySelector(".uom-name-select");
        const uomUnitSelect = rowElement.querySelector(".uom-unit-select");

        if (!uomNameSelect || !uomUnitSelect || !elementSelect) return;

        elementSelect.addEventListener("change", () => {
            const elementId = elementSelect.value;

            uomNameSelect.innerHTML = '<option value="">Select...</option>';
            uomUnitSelect.innerHTML = '<option value="">Select...</option>';

            if (!elementId) return;

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(elementId)}`)
                .then(res => res.json())
                .then(data => {
                    const uoms = data.uoms || [];
                    if (!uoms.length) return;

                    const uniqueNames = [...new Set(uoms.map(u => u.UName))];
                    uniqueNames.forEach(name => {
                        const opt = document.createElement("option");
                        opt.value = name;
                        opt.textContent = name;
                        uomNameSelect.appendChild(opt);
                    });
                });
        });

        uomNameSelect.addEventListener("change", () => {
            const elementId = elementSelect.value;
            const uName = uomNameSelect.value;

            uomUnitSelect.innerHTML = '<option value="">Select...</option>';
            if (!elementId || !uName) return;

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(elementId)}`)
                .then(res => res.json())
                .then(data => {
                    const uoms = (data.uoms || []).filter(u => u.UName === uName);
                    uoms.forEach(u => {
                        const opt = document.createElement("option");
                        opt.value = u.IDU;
                        opt.textContent = u.Unit;
                        uomUnitSelect.appendChild(opt);
                    });
                });
        });
    }

    function populateElementSelect(rowElement, selectClass, categoryName) {
        const elementSelect = rowElement.querySelector(`.${selectClass}`);
        const uomNameSelect = rowElement.querySelector(".uom-name-select");
        const uomUnitSelect = rowElement.querySelector(".uom-unit-select");
        const checkbox = rowElement.querySelector('input[type="checkbox"]');

        if (!elementSelect) return;

        const fetchElements = (ischk) => {
            fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(categoryName)}/${encodeURIComponent(ischk)}`)
                .then(res => res.json())
                .then(data => {
                    const elements = data.elements || [];
                    elementSelect.innerHTML = '';

                    const defaultOption = document.createElement("option");
                    defaultOption.value = "";
                    defaultOption.textContent = "Select ...";
                    elementSelect.appendChild(defaultOption);

                    elements.forEach(element => {
                        const option = document.createElement("option");
                        let txtcontent = element.EName;

                        // Only for Product / Co-Products
                        if (categoryName.trim() === "Product" || categoryName.trim() === "Co-Products") {
                            if (element.SName) txtcontent += ` | ${element.SName}`;
                            if (element.TName) txtcontent += ` | ${element.TName}`;
                        }
                        option.value = element.IDE;
                        option.textContent = txtcontent;
                        elementSelect.appendChild(option);
                    });
                })
                .catch(err => {
                    console.error(`Error loading ${categoryName} options:`, err);
                });
        };

        let ischk = checkbox ? (checkbox.checked ? 1 : 0) : 0;
        fetchElements(ischk);

        if (checkbox) {
            checkbox.addEventListener("change", () => {
                ischk = checkbox.checked ? 1 : 0;
                fetchElements(ischk);
            });
        }

        elementSelect.addEventListener("change", function () {
            const selectedElementId = elementSelect.value;

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(selectedElementId)}`)
                .then(res => res.json())
                .then(data => {
                    const uoms = data.uoms || [];
                    if (!uoms.length) return;

                    uomNameSelect.value = uoms[0].UName;
                    uomNameSelect.dispatchEvent(new Event("change"));

                    setTimeout(() => {
                        const matchingUnit = [...uomUnitSelect.options].find(opt => opt.textContent === uoms[0].Unit);
                        if (matchingUnit) {
                            uomUnitSelect.value = matchingUnit.value;
                        }
                    }, 50);
                })
                .catch(err => console.error("Error loading units:", err));
        });
    }

    function populateFormSelects(rowElement, configKey) {
        const parts = configKey.split("|+ ");
        if (parts.length < 2) return;

        const categoryName = parts[1];

        let selectClass;
        if (categoryName.includes("Materials and Energy")) {
            selectClass = "materielSelect";
        } else if (categoryName.includes("Co-Products")) {
            selectClass = "coproductSelect";
        } else if (categoryName.includes("Emissions")) {
            selectClass = "emissionsSelect";
        } else if (categoryName.includes("Waste Treatment")) {
            selectClass = "wasteSelect";
        } else if (categoryName.includes("Product")) {
            selectClass = "productSelect";
        } else {
            return;
        }

        populateElementSelect(rowElement, selectClass, categoryName);
        const elementSelect = rowElement.querySelector(`.${selectClass}`);
        populateAndLinkUomSelects(rowElement, elementSelect);
    }

    async function autoFillInputMaterials(formRowsContainer, taskID, categoryName, moduleName) {
        if (!taskID) return;

        try {
            const response = await fetch(`/get_in_datasheet/${encodeURIComponent(taskID)}/${encodeURIComponent(categoryName)}/${encodeURIComponent(moduleName)}`);
            const data = await response.json();

            if (!data.success || !data.result || data.result.length === 0) return;
            const autoData = data.result[0];

            const firstRow = formRowsContainer.querySelector(".form-row");
            if (!firstRow) return;

            const elementSelect = firstRow.querySelector(".materielSelect");
            const uomNameSelect = firstRow.querySelector(".uom-name-select");
            const uomUnitSelect = firstRow.querySelector(".uom-unit-select");
            const quantityInput = firstRow.querySelector('input[data-id="valued1"]');

            const selectWhenReady = (selectEl, targetText) => {
                return new Promise((resolve) => {
                    const triggerSelection = () => {
                        const options = [...selectEl.options];
                        const match = options.find(opt => opt.textContent.trim() === targetText.trim());
                        if (match) {
                            selectEl.value = match.value;
                            selectEl.dispatchEvent(new Event("change"));
                            return true;
                        }
                        return false;
                    };

                    if (triggerSelection()) {
                        resolve();
                        return;
                    }

                    const observer = new MutationObserver(() => {
                        if (triggerSelection()) {
                            observer.disconnect();
                            resolve();
                        }
                    });

                    observer.observe(selectEl, { childList: true });
                });
            };

            quantityInput.value = autoData.ValueD;

            await selectWhenReady(elementSelect, autoData.EName);
            await selectWhenReady(uomNameSelect, autoData.UName);
            await selectWhenReady(uomUnitSelect, autoData.Unit);

            const addRowBtn = document.querySelector(".add-row");
            if (addRowBtn && !addRowBtn.disabled) {
                addRowBtn.click();
            }
        } catch (err) {
            console.error("Auto fill materials failed:", err);
        }
    }

    async function autoFillForestRegeneration(formRowsContainer, configKey) {
        if (configKey !== "Forest Operation|+ Input Materials and Energy") return;

        try {
            const response = await fetch("/get_regeneration_user");
            const data = await response.json();

            if (!("value" in data)) return;
            const regenerationValue = data.value;

            const firstRow = formRowsContainer.querySelector(".form-row");
            if (!firstRow) return;

            const elementSelect = firstRow.querySelector(".materielSelect");
            const quantityInput = firstRow.querySelector('input[data-id="valued1"]');

            if (!elementSelect || !quantityInput) return;

            const observer = new MutationObserver(() => {
                const options = [...elementSelect.options];
                const treeOption = options.find(
                    opt => opt.textContent.trim().toLowerCase() === "tree"
                );

                if (treeOption) {
                    elementSelect.value = treeOption.value;
                    elementSelect.dispatchEvent(new Event("change"));
                    observer.disconnect();
                }
            });

            observer.observe(elementSelect, { childList: true });

            quantityInput.value = regenerationValue;

            const addRowBtn = document.querySelector(".add-row");
            if (addRowBtn && !addRowBtn.disabled) {
                addRowBtn.click();
            }
        } catch (err) {
            console.error("Auto regeneration fill failed:", err);
        }
    }

    function updateContent() {
        const { activeModule, activeCategory } = state;
        rightPanel.innerHTML = "";

        const configKey = `${activeModule}|${activeCategory}`;
        const config = getFormConfig(activeModule, activeCategory);

        const groupBox = document.createElement("div");
        groupBox.className = "group-box";

        const numColumns = config.header.length;
        if (configKey.startsWith("Transportation|+")) {
            groupBox.classList.add("transport-columns");
        } else if (numColumns === 6) {
            groupBox.classList.add("six-columns");
        } else if (numColumns === 5) {
            groupBox.classList.add("five-columns");
        }

        const groupIcons = document.createElement("div");
        groupIcons.className = "group-icons";
        groupIcons.innerHTML = `<button title="Add Row" class="add-row" type="button" ${
            (state.activeCategory === "+ Product") ||
            (state.activeModule === "Transportation" &&
                (state.activeCategory === "+ Emissions" ||
                 state.activeCategory === "+ Co-Products" ||
                 state.activeCategory === "+ Input Energy"))
                ? "disabled"
                : ""
        }>➕</button>`;
        groupBox.appendChild(groupIcons);

        const header = document.createElement("div");
        header.className = "form-header";
        config.header.forEach(h => {
            const span = document.createElement("span");
            span.textContent = h;
            header.appendChild(span);
        });
        groupBox.appendChild(header);

        const formRowsContainer = document.createElement("div");
        formRowsContainer.className = "form-rows";

        const createFormRow = () => {
            const row = document.createElement("div");
            row.className = "form-row";

            const fields = config.row();
            fields.forEach(html => {
                const cell = document.createElement("div");
                cell.innerHTML = html;
                row.appendChild(cell);
            });

            const deleteBtn = row.querySelector(".delete-row");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", () => {
                    if (confirm("Are you sure you want to delete this row?")) {
                        row.remove();
                    }
                });
            }

            return row;
        };

        const initialRow = createFormRow();
        formRowsContainer.appendChild(initialRow);
        populateFormSelects(initialRow, configKey);

        autoFillForestRegeneration(formRowsContainer, configKey);

        const currentCategory = activeCategory.replace("+ ", "").trim();
        if (activeModule !== "Forest Operation" && currentCategory === "Input Materials and Energy") {
            const selectedTaskName = taskInput.value;
            const selectedOption = taskList.querySelector(`option[value="${selectedTaskName}"]`);

            if (selectedOption) {
                const taskID = selectedOption.dataset.id;
                const moduleName = activeModule;

                setTimeout(() => {
                    autoFillInputMaterials(formRowsContainer, taskID, currentCategory, moduleName);
                }, 100);
            }
        }

        groupBox.appendChild(formRowsContainer);

        if (typeof config.footer === "function") {
            const footer = document.createElement("div");
            footer.className = "form-footer";
            footer.innerHTML = config.footer();
            groupBox.appendChild(footer);
        }

        groupIcons.querySelector(".add-row").addEventListener("click", () => {
            const newRow = createFormRow();
            formRowsContainer.appendChild(newRow);
            populateFormSelects(newRow, configKey);
        });

        rightPanel.appendChild(groupBox);

        const registerButtons = rightPanel.querySelectorAll(".register-element-button");
        registerButtons.forEach(button => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const elementType = button.dataset.elementType;
                if (typeof showElementRegistrationModal === "function") {
                    showElementRegistrationModal(elementType);
                } else {
                    console.error("The function 'showElementRegistrationModal' is not defined.");
                }
            });
        });
    }

    moduleTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            moduleTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            setState("activeModule", tab.textContent.trim());
        });
    });

    categoryTabs.forEach(button => {
        button.addEventListener("click", () => {
            categoryTabs.forEach(c => c.classList.remove("selected"));
            button.classList.add("selected");
            setState("activeCategory", button.textContent.trim());
        });
    });

    rightPanel.addEventListener("click", async (event) => {
        if (!event.target.classList.contains("check-button")) return;

        clearMessage();

        const selectedTaskName = taskInput.value;
        const selectedOption = taskList.querySelector(`option[value="${selectedTaskName}"]`);
        const taskId = selectedOption ? selectedOption.dataset.id : null;

        if (!taskId) {
            showMessage("Please select a task from the list or ensure your input matches a valid task.", "error");
            return;
        }

        const stepName = state.activeModule;
        let stepId = null;

        if (stepName === "Forest Operation" || stepName === "Transportation" || stepName === "Wood Processing") {
            stepId = await getStepIdByName(stepName);
        } else {
            stepId = activeStepsSelect.value;
            if (!stepId || stepId === "Select an active step...") {
                showMessage("Please select an active step from the list.", "error");
                return;
            }
        }

        if (!stepId) {
            showMessage(`Error: Could not find step '${stepName}'.`, "error");
            return;
        }

        const allRows = document.querySelectorAll(".form-rows .form-row");
        const { data, isValid, submittedRows } = collectFormData();

        if (!isValid) {
            showMessage("One or more form rows are incomplete.", "error");
            updateStatusIndicators(false, submittedRows, allRows);
            return;
        }

        if (data.length === 0) {
            showMessage("The form is empty, or all valid rows have been saved.", "warning");
            return;
        }

        const userConfirmed = confirm("Do you want to save this data to the database?");
        if (!userConfirmed) {
            showMessage("Data saving canceled.", "warning");
            return;
        }

        try {
            const result = await fetchFlowsForAllocation(stepId, taskId, data);

            if (result.requires_allocation) {
                openManualAllocationModal(result.flows, data, stepId, taskId, submittedRows, allRows);
                return;
            }

            if (result.success) {
                showMessage(result.message, "success");
                updateStatusIndicators(true, submittedRows, allRows);

                if (areAllRowsSaved()) {
                    setTimeout(() => {
                        showYesNoConfirm(
                            "All rows are saved successfully.\n\nDo you finish with the registration?",
                            () => redirectToEditPage(),
                            () => {}
                        );
                    }, 300);
                }
            } else {
                showMessage(`Error: ${result.message}`, "error");
                updateStatusIndicators(false, submittedRows, allRows);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            showMessage("An unexpected error occurred.", "error");
            updateStatusIndicators(false, submittedRows, allRows);
        }
    });

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

    fetch("/active_steps")
        .then(response => response.json())
        .then(data => {
            activeStepsSelect.innerHTML = '<option value="" disabled selected>Select an active step...</option>';
            if (data.success && Array.isArray(data.steps)) {
                data.steps.forEach(step => {
                    const option = document.createElement("option");
                    option.value = step.IDS;
                    option.textContent = step.SName;
                    activeStepsSelect.appendChild(option);
                });
            } else {
                activeStepsSelect.innerHTML = '<option value="" disabled selected>No active steps available</option>';
            }
        })
        .catch(err => {
            console.error("Error fetching active steps:", err);
            activeStepsSelect.innerHTML = '<option value="" disabled selected>Error loading steps</option>';
        });

    fetch("/listtasks_with_out_datasheet")
        .then(response => response.json())
        .then(data => {
            taskList.innerHTML = "";
            if (data.success && Array.isArray(data.tasks)) {
                data.tasks.forEach(task => {
                    const option = document.createElement("option");
                    option.value = task.TName;
                    option.dataset.id = task.IDT;
                    taskList.appendChild(option);
                });
            } else {
                const option = document.createElement("option");
                option.value = "No tasks available";
                taskList.appendChild(option);
            }
        })
        .catch(err => {
            console.error("Error fetching tasks:", err);
            const option = document.createElement("option");
            option.value = "Error loading tasks";
            taskList.appendChild(option);
        });

    updateContent();
});