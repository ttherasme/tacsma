// datasheet.js
document.addEventListener("DOMContentLoaded", () => {
    // Select all necessary elements from the DOM
    const moduleTabs = document.querySelectorAll(".module-tab");
    const categoryTabs = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");
    const activeStepsSelect = document.getElementById("activeStepsSelect");
    const taskSelect = document.getElementById("taskSelect");
    let messageArea = document.getElementById('message-area');

    // Global application state
    const state = {
        activeModule: "Forest Operation",
        activeCategory: "+ Product"
    };

    /**
     * Updates the application's state and triggers a content refresh.
     * @param {string} key The state key to update (e.g., 'activeModule').
     * @param {string} value The new value.
     */
    function setState(key, value) {
        if (state[key] !== value) {
            state[key] = value;
            updateContent();
        }
    }

    // Form configurations for each module and category combination
    function makeFormConfig({ 
        category, 
        selectClass, 
        elementType, 
        hasCheckbox = false, 
        showDeleteButton = true 
    }) {
        const header = hasCheckbox 
            ? ["Name", "Quantity", "Unit", "CHK", " ", " "] 
            : ["Name", "Quantity", "Unit", " ", " "];

        const row = () => {
            const rowFields = [
                `<select class="${selectClass}"></select>`,
                `<input type="number" placeholder="0" />`,
                `<div class="inline-selects">
                    <select class="styled-select uom-name-select"></select>
                    <select class="styled-select uom-unit-select"></select>
                </div>`
            ];

            if (hasCheckbox) {
                rowFields.push(`<input type="checkbox" id="${elementType}Checkbox">`);
            }

            rowFields.push(`<div class="status-indicator"></div>`);

            if (showDeleteButton) {
                rowFields.push(`<button title="Delete Row" class="delete-row">🗑️</button>`);
            } else {
                rowFields.push(`<!-- no delete -->`);
            }

            return rowFields;
        };

        const footer = () => `
            <button class="action-button register-element-button" data-element-type="${elementType}">Add new Name</button>
            <button class="action-button check-button">Validate ✔️</button>
        `;

        return { header, row, footer };
    }

    const formConfigs = {
        "Forest Operation|+ Product": makeFormConfig({
            category: "+ Product",
            selectClass: "productSelect",
            elementType: "Product",
            showDeleteButton: false
        }),
        "Forest Operation|+ Input Materials and Resources": makeFormConfig({
            category: "+ Input Materials and Resources",
            selectClass: "materielSelect",
            elementType: "Input Materials and Resources"
        }),
        "Forest Operation|+ Co-Products": makeFormConfig({
            category: "+ Co-Products",
            selectClass: "coproductSelect",
            elementType: "Co-Products",
            hasCheckbox: true
        }),
        "Forest Operation|+ Input Energy": makeFormConfig({
            category: "+ Input Energy",
            selectClass: "energySelect",
            elementType: "Input Energy"
        }),
        "Forest Operation|+ Emissions": makeFormConfig({
            category: "+ Emissions",
            selectClass: "emissionsSelect",
            elementType: "Emissions"
        }),
        "Forest Operation|+ Waste Treatment": makeFormConfig({
            category: "+ Waste Treatment",
            selectClass: "wasteSelect",
            elementType: "Waste Treatment"
        }),
        "default": {
            header: ["Item", "Value", "Unit", " ", " "],
            row: () => ['In process', '', '', '', ''],
            footer: () => `<small>Default footer for undefined combinations.</small><div><button class="check-button">Submit ✔️</button></div>`
        }
    };

    /**
     * Builds the form based on the active module and category.
     * This function dynamically generates the HTML content for the right panel.
     */
    function updateContent() {
        const { activeModule, activeCategory } = state;
        rightPanel.innerHTML = "";

        const configKey = `${activeModule}|${activeCategory}`;
        const config = formConfigs[configKey] || formConfigs["default"];

        const groupBox = document.createElement("div");
        groupBox.className = "group-box";

        // Déterminer le nombre de colonnes et appliquer la classe CSS correspondante
        const numColumns = config.header.length;
        if (numColumns === 5) {
            groupBox.classList.add('five-columns');
        } else if (numColumns === 6) {
            groupBox.classList.add('six-columns');
        }

        // Create group icons (e.g., "Add Row" button)
        const groupIcons = document.createElement("div");
        groupIcons.className = "group-icons";
        groupIcons.innerHTML = `<button title="Add Row" class="add-row" ${state.activeCategory === "+ Product" ? "disabled" : ""}>➕</button>`;
        //groupIcons.innerHTML = `<button title="Add Row" class="add-row">➕</button>`;
        groupBox.appendChild(groupIcons);

        // Create form header
        const header = document.createElement("div");
        header.className = "form-header";
        config.header.forEach(h => {
            const span = document.createElement("span");
            span.textContent = h;
            header.appendChild(span);
        });
        groupBox.appendChild(header);

        // Create container for form rows
        const formRowsContainer = document.createElement("div");
        formRowsContainer.className = "form-rows";

        /**
         * Creates a new form row and attaches event listeners.
         * @returns {HTMLElement} The new row element.
         */
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
                    const confirmed = confirm("Are you sure you want to delete this row?");
                    if (confirmed) row.remove();
                });
            }
            return row;
        };

        // Add the initial form row and populate its selects
        const initialRow = createFormRow();
        formRowsContainer.appendChild(initialRow);
        populateFormSelects(initialRow, configKey);

        groupBox.appendChild(formRowsContainer);

        // Create form footer
        if (typeof config.footer === "function") {
            const footer = document.createElement("div");
            footer.className = "form-footer";
            footer.innerHTML = config.footer();
            groupBox.appendChild(footer);
        }

        // Event listener for the "Add Row" button
        groupIcons.querySelector(".add-row").addEventListener("click", () => {
            const newRow = createFormRow();
            formRowsContainer.appendChild(newRow);
            populateFormSelects(newRow, configKey);
        });

        rightPanel.appendChild(groupBox);

        // Event listeners for "Add new Name" buttons (opens a modal)
        const registerButtons = rightPanel.querySelectorAll(".register-element-button");
        registerButtons.forEach(button => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const elementType = button.dataset.elementType;
                // Assumes showElementRegistrationModal is defined in elementmodal.js
                if (typeof showElementRegistrationModal === "function") {
                    showElementRegistrationModal(elementType);
                } else {
                    console.error("The function 'showElementRegistrationModal' is not defined.");
                }
            });
        });
    }

    /**
     * Populates the form selects in a given row with appropriate data.
     * @param {HTMLElement} rowElement The row to populate.
     * @param {string} configKey The key for the form configuration.
     */
    function populateFormSelects(rowElement, configKey) {
        switch (configKey) {
            case "Forest Operation|+ Product":
                populateElementSelect(rowElement, "productSelect", "Product");
                populateAndLinkUomSelects(rowElement);
                break;
            case "Forest Operation|+ Input Materials and Resources":
                populateElementSelect(rowElement, "materielSelect", "Input Materials and Resources");
                populateAndLinkUomSelects(rowElement);
                break;
            case "Forest Operation|+ Co-Products":
                populateElementSelect(rowElement, "coproductSelect", "Co-Products");
                populateAndLinkUomSelects(rowElement);
                break;
            case "Forest Operation|+ Input Energy":
                populateElementSelect(rowElement, "energySelect", "Input Energy");
                populateAndLinkUomSelects(rowElement);
                break;
            case "Forest Operation|+ Emissions":
                populateElementSelect(rowElement, "emissionsSelect", "Emissions");
                populateAndLinkUomSelects(rowElement);
                break;
            case "Forest Operation|+ Waste Treatment":
                populateElementSelect(rowElement, "wasteSelect", "Waste Treatment");
                populateAndLinkUomSelects(rowElement);
                break;
        }
    }

    /**
     * Populates and links the UOM (Unit of Measure) name and unit selects.
     * @param {HTMLElement} rowElement The row containing the selects.
     */
    function populateAndLinkUomSelects(rowElement) {
        const uomNameSelect = rowElement.querySelector(".uom-name-select");
        const uomUnitSelect = rowElement.querySelector(".uom-unit-select");

        // Fetch UOM names
        fetch("/get_all_uoms")
            .then(res => res.json())
            .then(data => {
                const uoms = data.uoms;
                if (!uoms) {
                    console.error("No UOM data found.");
                    return;
                }
                // Get unique UOM names
                const distinctUNames = [...new Set(uoms.map(uom => uom.UName))];
                uomNameSelect.innerHTML = '<option value="">Select...</option>';
                distinctUNames.forEach(uName => {
                    const option = document.createElement("option");
                    option.value = uName;
                    option.textContent = uName;
                    uomNameSelect.appendChild(option);
                });
            })
            .catch(err => console.error("Error loading UOM names:", err));

        // Event listener for UOM name change to populate UOM units
        uomNameSelect.addEventListener("change", (event) => {
            const selectedUName = event.target.value;
            if (selectedUName) {
                fetch("/get_all_uoms")
                    .then(res => res.json())
                    .then(data => {
                        const uoms = data.uoms;
                        if (!uoms) {
                            console.error("No UOM data found.");
                            return;
                        }
                        const filteredUnits = uoms.filter(uom => uom.UName === selectedUName);
                        uomUnitSelect.innerHTML = '<option value="">Select...</option>';
                        filteredUnits.forEach(item => {
                            const option = document.createElement("option");
                            option.value = item.IDU;
                            option.textContent = item.Unit;
                            uomUnitSelect.appendChild(option);
                        });
                    })
                    .catch(err => console.error("Error loading units:", err));
            } else {
                uomUnitSelect.innerHTML = '<option value="">Select...</option>';
            }
        });
    }

    /**
     * Populates an element select with options from a specific category.
     * @param {HTMLElement} rowElement The row.
     * @param {string} selectClass The CSS class of the select.
     * @param {string} categoryName The category name to filter by.
     */
    function populateElementSelect(rowElement, selectClass, categoryName) {
        const elementSelect = rowElement.querySelector(`.${selectClass}`);
        if (!elementSelect) return;

        fetch(`/get_elements_by_category/${encodeURIComponent(categoryName)}`)
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
                    option.value = element.IDE;
                    option.textContent = element.EName;
                    elementSelect.appendChild(option);
                });
            })
            .catch(err => {
                console.error(`Error loading ${categoryName} options:`, err);
            });
    }

    // Event listeners for module tabs and category buttons
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

    // Initial content load
    updateContent();

    // ----------------------------------------------------
    // Data Saving Logic (Validation & Submission)
    // ----------------------------------------------------

    /**
     * Fetches the step ID by its name from the server.
     * @param {string} stepName The name of the step.
     * @returns {Promise<string|null>} The step ID or null if not found.
     */
    async function getStepIdByName(stepName) {
        try {
            const response = await fetch(`/get_step_id/${encodeURIComponent(stepName)}`);
            const data = await response.json();
            if (data.success) {
                return data.ids;
            } else {
                console.error("Error fetching step ID:", data.message);
                return null;
            }
        } catch (error) {
            console.error("Network error fetching step ID:", error);
            return null;
        }
    }

    /**
     * Collects and validates form data from the rows.
     * Ignores rows that have already been successfully validated (green checkmark).
     * @returns {{data: Array, isValid: boolean, submittedRows: Array}} The data, a validation flag, and the submitted row references.
     */
    function collectFormData() {
        const rows = document.querySelectorAll('.form-rows .form-row');
        const formData = [];
        const submittedRows = [];
        let isValid = true;

        rows.forEach(row => {
            if (row.querySelector('.status-icon.green-check')) {
                return; // Skip this row if it's already saved
            }

            const selectElement = row.querySelector('select:not(.uom-name-select)');
            const quantityInput = row.querySelector('input[type="number"]');
            const unitSelect = row.querySelector('.uom-unit-select');
            const checkbox = row.querySelector('input[type="checkbox"]');

            const ide = selectElement ? selectElement.value : null;
            const quantity = quantityInput ? quantityInput.value : null;
            const unitId = unitSelect ? unitSelect.value : null;
            const isChecked = checkbox ? checkbox.checked : null;

            if (ide && quantity && unitId) {
                const rowData = {
                    IDE: ide,
                    ValueD1: parseFloat(quantity),
                    IDU1: unitId
                };

                if (isChecked !== null) {
                    rowData.CHK = isChecked ? 1 : 0;
                }
                formData.push(rowData);
                submittedRows.push(row);
            } else if (ide || quantity || unitId) {
                isValid = false;
            }
        });
        return { data: formData, isValid: isValid, submittedRows: submittedRows };
    }

    /**
     * Disables all input fields in a given row.
     * @param {HTMLElement} row The row to disable.
     */
    function disableRowInputs(row) {
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.disabled = true;
        });
        const deleteBtn = row.querySelector('.delete-row');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
    }

    /**
     * Updates the status indicators for the rows.
     * @param {boolean} isSuccess - Success or failure of the submission.
     * @param {HTMLElement[]} submittedRows - The rows that were submitted.
     * @param {HTMLElement[]} allRows - All rows in the form.
     */
    function updateStatusIndicators(isSuccess, submittedRows, allRows) {
        submittedRows.forEach(row => {
            const indicator = row.querySelector('.status-indicator');
            if (indicator) {
                indicator.innerHTML = '';
                if (isSuccess) {
                    indicator.innerHTML = '<span class="status-icon green-check">✓</span>';
                    disableRowInputs(row);
                } else {
                    indicator.innerHTML = '<span class="status-icon red-cross">✗</span>';
                }
            }
        });

        allRows.forEach(row => {
            if (!submittedRows.includes(row)) {
                const indicator = row.querySelector('.status-indicator');
                const hasData = row.querySelector('select:not(.uom-name-select)').value ||
                    row.querySelector('input[type="number"]').value ||
                    row.querySelector('.uom-unit-select').value;

                if (hasData && !indicator.querySelector('.status-icon')) {
                    if (indicator) {
                        indicator.innerHTML = '<span class="status-icon red-cross">✗</span>';
                    }
                }
            }
        });
    }

    // Event listener for the "Validate" button
    rightPanel.addEventListener('click', async (event) => {
        if (event.target.classList.contains('check-button')) {
            if (messageArea) {
                messageArea.textContent = '';
                messageArea.style.display = 'none';
            }

            const taskId = taskSelect.value;
            const stepName = state.activeModule;

            if (!taskId) {
                showMessage("Please select a task.", "error");
                return;
            }

            const stepId = await getStepIdByName(stepName);
            if (!stepId) {
                showMessage(`Error: Could not find step '${stepName}'.`, "error");
                return;
            }

            const allRows = document.querySelectorAll('.form-rows .form-row');
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
                const response = await fetch('/save_datasheetregister', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rows: data,
                        step_id: stepId,
                        task_id: taskId
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, "success");
                    updateStatusIndicators(true, submittedRows, allRows);
                } else {
                    showMessage(`Error: ${result.message}`, "error");
                    updateStatusIndicators(false, submittedRows, allRows);
                }
            } catch (error) {
                console.error("Error submitting form:", error);
                showMessage("An unexpected error occurred.", "error");
                updateStatusIndicators(false, submittedRows, allRows);
            }
        }
    });

    /**
     * Displays a temporary message to the user.
     * @param {string} message The message to display.
     * @param {string} type The message type ('success', 'error', 'warning').
     */
    function showMessage(message, type) {
        if (!messageArea) {
            messageArea = document.createElement('div');
            messageArea.id = 'message-area';
            messageArea.className = 'message-area';
            rightPanel.prepend(messageArea);
        }
        messageArea.textContent = message;
        messageArea.className = `message-area ${type}-message`;
        messageArea.style.display = 'block';
    }

    // ----------------------------------------------------
    // Initial Select Box Loading
    // ----------------------------------------------------

    /**
     * Fetches and populates the list of active steps.
     */
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

    /**
     * Fetches and populates the list of tasks.
     */
    fetch("/listtasks")
        .then(response => response.json())
        .then(data => {
            taskSelect.innerHTML = '<option value="" disabled selected>Select a task...</option>';
            if (data.success && Array.isArray(data.tasks)) {
                data.tasks.forEach(task => {
                    const option = document.createElement("option");
                    option.value = task.IDT;
                    option.textContent = task.TName;
                    taskSelect.appendChild(option);
                });
            } else {
                taskSelect.innerHTML = '<option value="" disabled selected>No tasks available</option>';
            }
        })
        .catch(err => {
            console.error("Error fetching tasks:", err);
            taskSelect.innerHTML = '<option value="" disabled selected>Error loading tasks</option>';
        });
});