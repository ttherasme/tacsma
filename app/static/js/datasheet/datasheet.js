// datasheet.js
document.addEventListener("DOMContentLoaded", () => {
    // Select all necessary elements from the DOM
    const moduleTabs = document.querySelectorAll(".module-tab");
    const categoryTabs = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");
    const activeStepsSelect = document.getElementById("activeStepsSelect");
    let selectedElement = '';
    //const taskSelect = document.getElementById("taskSelect");
    const taskInput = document.getElementById("taskSelect");
    const taskList = document.getElementById("taskList");
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

    // Form configurations factory function
    function makeFormConfig({
        category,
        selectClass,
        elementType,
        hasCheckbox = false,
        showDeleteButton = true,
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
                rowFields.push(`<input type="checkbox" id="${elementType}Checkbox">`);
            }

            rowFields.push(`<div class="status-indicator"></div>`);

            if (showDeleteButton) {
                rowFields.push(`<button title="Delete Row" class="delete-row">🗑️</button>`);
            } else {
                rowFields.push(``);
            }

            return rowFields;
        });

        const footer = () => `
            <button class="action-button register-element-button" data-element-type="${elementType}">Add new Name</button>
            <button class="action-button check-button">Validate ✔️</button>
        `;

        return { header, row, footer };
    }


    // Form configurations for combinations with NON-STANDARD LAYOUTS (only Transportation)
    const formConfigs = {
        // Transportation - Custom Layout (Mass, Distance, Mode)
        "Transportation|+ Product": makeFormConfig({
            category: "+ Product",
            selectClass: "productSelect",
            elementType: "Product",
            customHeader: ["Materials", "Mass", "Distance", "Transportation mode", " ", " "],
            customRow: () => {
                return [
                    `<select class="productSelect"></select>`, // Materials
                    `<div class="inline-selects">
                        <input type="number" data-id="valued1" placeholder="Mass" class="styled-select2" />
                        <select data-id="unitd1" class="styled-select2 uom-mass-select"></select>
                    </div>`, // Mass
                    `<div class="inline-selects">
                        <input type="number" data-id="valued2" placeholder="Distance" class="styled-select2" />
                        <select data-id="unitd2" class="styled-select uom-distance-select"></select>
                    </div>`, // Distance
                    `<select data-id="selectmodetransport" class="styled-select2 transport-mode-select">
                    </select>`,
                    `<div class="status-indicator"></div>`,
                    `` // No delete button for Product
                ];
            }
        }),
        "Transportation|+ Input Materials and Resources": makeFormConfig({
            category: "+ Input Materials and Resources",
            selectClass: "materielSelect",
            elementType: "Input Materials and Resources",
            customHeader: ["Materials", "Mass", "Distance", "Transportation mode", " ", " "],
            customRow: () => {
                return [
                    `<select class="materielSelect"></select>`, // Materials
                    `<div class="inline-selects">
                        <input type="number" data-id="valued1" placeholder="Mass" class="styled-select2" />
                        <select data-id="unitd1" class="styled-select2 uom-mass-select"></select>
                    </div>`, // Mass
                    `<div class="inline-selects">
                        <input type="number" data-id="valued2" placeholder="Distance" class="styled-select2" />
                        <select data-id="unitd2" class="styled-select uom-distance-select"></select>
                    </div>`, // Distance
                    `<select data-id="selectmodetransport" class="styled-select2 transport-mode-select">
                    </select>`,
                    `<div class="status-indicator"></div>`,
                    `<button title="Delete Row" class="delete-row">🗑️</button>`
                ];
            }
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
            customHeader: ["Materials", "Mass", "Distance", "Transportation mode", " ", " "],
            customRow: () => {
                return [
                    `<select class="wasteSelect"></select>`, // Materials
                    `<div class="inline-selects">
                        <input type="number" data-id="valued1" placeholder="Mass" class="styled-select2" />
                        <select data-id="unitd1" class="styled-select2 uom-mass-select"></select>
                    </div>`, // Mass
                    `<div class="inline-selects">
                        <input type="number" data-id="valued2" placeholder="Distance" class="styled-select2" />
                        <select data-id="unitd2" class="styled-select uom-distance-select"></select>
                    </div>`, // Distance
                    `<select data-id="selectmodetransport" class="styled-select2 transport-mode-select">
                    </select>`,
                    `<div class="status-indicator"></div>`,
                    `<button title="Delete Row" class="delete-row">🗑️</button>`
                ];
            }
        }),

        // Other
        "default": {
            header: ["Item", "Value", "Unit", " ", " "],
            row: () => ['In process', '', '', '', ''],
            footer: () => `<small>Default footer for undefined combinations.</small><div><button class="check-button">Submit ✔️</button></div>`
        }
    };

    // ----------------------------------------------------
    // Reload dropdowns after element registration (MODAL)
    // ----------------------------------------------------

    document.addEventListener('reloadProductSelect', () => {
        refreshCurrentFormSelect('productSelect', 'Product');
    });

    document.addEventListener('reloadMaterielSelect', () => {
        refreshCurrentFormSelect('materielSelect', 'Input Materials and Resources');
    });

    document.addEventListener('reloadCoproductSelect', () => {
        refreshCurrentFormSelect('coproductSelect', 'Co-Products');
    });

    document.addEventListener('reloadEnergySelect', () => {
        refreshCurrentFormSelect('energySelect', 'Input Energy');
    });

    document.addEventListener('reloadEmissionsSelect', () => {
        refreshCurrentFormSelect('emissionsSelect', 'Emissions');
    });

    document.addEventListener('reloadWasteSelect', () => {
        refreshCurrentFormSelect('wasteSelect', 'Waste Treatment');
    });


    function refreshCurrentFormSelect(selectClass, categoryName) {
        const rows = document.querySelectorAll('.form-row');

        rows.forEach(row => {
            const select = row.querySelector(`.${selectClass}`);
            if (!select) return;

            const currentValue = select.value;

            fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(categoryName)}`)
                .then(res => res.json())
                .then(data => {
                    const elements = data.elements || [];

                    select.innerHTML = '<option value="">Select ...</option>';

                    elements.forEach(el => {
                        const option = document.createElement('option');
                        option.value = el.IDE;
                        option.textContent = el.EName;
                        select.appendChild(option);
                    });

                    // Restore previous selection if it still exists
                    select.value = currentValue;
                })
                .catch(err => console.error('Error refreshing dropdown:', err));
        });
    }



    /**
     * Dynamically retrieves the form configuration. If a module/category 
     * combination is not explicitly defined, it generates a standard 
     * configuration using makeFormConfig.
     * @param {string} module The active module (e.g., "Construction").
     * @param {string} category The active category (e.g., "+ Product").
     * @returns {object} The form configuration object.
     */
    function getFormConfig(module, category) {
        const configKey = `${module}|${category}`;
        const explicitConfig = formConfigs[configKey];

        // 1. Return explicit config if it exists (e.g., Transportation)
        if (explicitConfig) {
            return explicitConfig;
        }

        // 2. Handle generic modules (Forest Operation, Wood Processing, Construction, or new custom ones)
        //    that use the standard 5- or 6-column layout.
        const categoryName = category.substring(2).trim(); // Remove "+ "
        
        let selectClass;
        let elementType = categoryName; 
        let hasCheckbox = categoryName.includes("Co-Products");
        let showDeleteButton = !categoryName.endsWith("Product");

        // Dynamic mapping to get the correct CSS class and element type
        if(module ==="Transportation" && (categoryName =="Emissions" || categoryName.trim() === 'Co-Products' || categoryName =="Input Energy")){
            return formConfigs["default"];
        } else if (categoryName.includes("Materials and Resources")) {
            selectClass = "materielSelect";
        } else if (categoryName.includes("Co-Products")) {
            selectClass = "coproductSelect";
        } else if (categoryName.includes("Energy")) {
            selectClass = "energySelect";
        } else if (categoryName.includes("Emissions")) {
            selectClass = "emissionsSelect";
        } else if (categoryName.includes("Waste Treatment")) {
            selectClass = "wasteSelect";
        } else if (categoryName.includes("Product")) {
            selectClass = "productSelect";
        } else {
            // Fallback to the hardcoded default if the category name is unrecognizable
            return formConfigs["default"];
        }

        // Generate and return the standard config for this dynamic module/category
        return makeFormConfig({
            category: category,
            selectClass: selectClass,
            elementType: elementType,
            hasCheckbox: hasCheckbox,
            showDeleteButton: showDeleteButton
        });
    }


    /**
     * Builds the form based on the active module and category.
     * This function dynamically generates the HTML content for the right panel.
     */
    function updateContent() {
        const { activeModule, activeCategory } = state;
        rightPanel.innerHTML = "";

        const configKey = `${activeModule}|${activeCategory}`;
        // Use the new dynamic config function
        const config = getFormConfig(activeModule, activeCategory); 

        const groupBox = document.createElement("div");
        groupBox.className = "group-box";

        // Determine the number of columns and apply the corresponding CSS class
        const numColumns = config.header.length;

        // Transportation is the unique custom layout
        if (configKey.startsWith("Transportation|+")) {
            groupBox.classList.add('transport-columns');
        } 
        // All categories with a checkbox (Co-Products) use 6 columns
        else if (numColumns === 6) { 
            groupBox.classList.add('six-columns');
        } 
        // All other standard categories (Product, Energy, Waste, etc.) use 5 columns
        else if (numColumns === 5) {
            groupBox.classList.add('five-columns');
        }


        // Create group icons (e.g., "Add Row" button)
        const groupIcons = document.createElement("div");
        groupIcons.className = "group-icons";
        groupIcons.innerHTML = `<button title="Add Row" class="add-row" ${(state.activeCategory === "+ Product") || (state.activeModule ==="Transportation" && (state.activeCategory ==="+ Emissions" || state.activeCategory ==="+ Co-Products" || state.activeCategory ==="+ Input Energy")) ? "disabled" : ""}>➕</button>`;
        //groupIcons.innerHTML = `<button title="Add Row" class="add-row" ${state.activeCategory === "+ Product" ? "disabled" : ""}>➕</button>`;
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
        populateFormSelects(initialRow, configKey); // Pass configKey for logic split

        autoFillForestRegeneration(formRowsContainer, configKey);

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
     * Populates the form selects in a given row with appropriate data,
     * dynamically determining logic based on the configKey.
     * @param {HTMLElement} rowElement The row to populate.
     * @param {string} configKey The key for the form configuration (e.g., "Construction|+ Product").
     */
    function populateFormSelects(rowElement, configKey) {
        // Determine the Element Type (e.g., "Product", "Input Energy") and select class from the category name
        const parts = configKey.split("|+ ");
        if (parts.length < 2) return; 

        const activeModule = parts[0];
        const categoryName = parts[1]; // e.g., "Product", "Input Materials and Resources"

        // Map Category name to the appropriate select class for the element name dropdown
        let selectClass;
        if (categoryName.includes("Materials and Resources")) {
            selectClass = "materielSelect";
        } else if (categoryName.includes("Co-Products")) {
            selectClass = "coproductSelect";
        } else if (categoryName.includes("Input Energy")) {
            selectClass = "energySelect";
        } else if (categoryName.includes("Emissions")) {
            selectClass = "emissionsSelect";
        } else if (categoryName.includes("Waste Treatment")) {
            selectClass = "wasteSelect";
        } else if (categoryName.includes("Product")) {
            selectClass = "productSelect";
        } else {
            // If the category name is unknown, we can't populate the element select
            return; 
        }

        // 1. All modules need the element select populated
        populateElementSelect(rowElement, selectClass, categoryName);

        // 2. Handle specific unit of measure (UOM) logic based on the module
        if (activeModule === "Transportation") {
            // Transportation has a unique data row (Mass/Distance/Mode)
            populateAndLinkMassUnit(rowElement);
            populateAndLinkDistanceUnit(rowElement);
            populateAndLinkTransportationMode(rowElement);
        } else {
            // All other standard modules (Forest Operation, Wood Processing, Construction, etc.)
            // use the Name/Quantity/Unit structure.
            populateAndLinkUomSelects(rowElement);
        }
    }

    async function autoFillForestRegeneration(formRowsContainer, configKey) {
        // Only apply to the exact condition
        if (configKey !== "Forest Operation|+ Input Materials and Resources") return;

        try {
            // 1️⃣ Get regeneration value
            const response = await fetch("/get_regeneration_user");
            const data = await response.json();

            if (!("value" in data)) return;
            const regenerationValue = data.value;

            // 2️⃣ Get first row
            const firstRow = formRowsContainer.querySelector(".form-row");
            if (!firstRow) return;

            const elementSelect = firstRow.querySelector(".materielSelect");
            const quantityInput = firstRow.querySelector('input[data-id="valued1"]');

            if (!elementSelect || !quantityInput) return;

            // 3️⃣ Select "Tree" once options exist
            const selectTree = () => {
                const options = [...elementSelect.options];
                const treeOption = options.find(
                    opt => opt.textContent.trim().toLowerCase() === "tree"
                );

                if (treeOption) {
                    elementSelect.value = treeOption.value;
                    elementSelect.dispatchEvent(new Event("change"));
                }
            };

            // Options may load async → wait a bit
            setTimeout(selectTree, 100);

            // 4️⃣ Set regeneration value
            quantityInput.value = regenerationValue;

            // 5️⃣ Add a blank second row
            const addRowBtn = document.querySelector(".add-row");
            if (addRowBtn && !addRowBtn.disabled) {
                addRowBtn.click();
            }

        } catch (err) {
            console.error("Auto regeneration fill failed:", err);
        }
    }



    /**
     * Populates and links the UOM (Unit of Measure) name and unit selects.
     * @param {HTMLElement} rowElement The row containing the selects.
     */
    function populateAndLinkTransportationMode(rowElement) {
        const transportationSelect = rowElement.querySelector(".transport-mode-select");

        if (!transportationSelect) {
            console.error("Select element .transport-mode-select not found in the row element.");
            return;
        }

        fetch("/listTotbystatus/1")
            .then(response => response.json())
            .then(data => {
                transportationSelect.innerHTML = '<option value="" disabled selected>Select...</option>';

                if (Array.isArray(data)) {
                    data.forEach(result => {
                        const option = document.createElement("option");
                        option.value = result.IDM;
                        option.textContent = result.MTName;
                        transportationSelect.appendChild(option);
                    });
                } else {
                    transportationSelect.innerHTML = '<option value="" disabled selected>No transportations available</option>';
                }
            })
            .catch(err => {
                console.error("Error fetching transportation:", err);
                transportationSelect.innerHTML = '<option value="" disabled selected>Error loading transportation</option>';
            });
    }

    function populateAndLinkMassUnit(rowElement) {
        const uomUnitMassSelect = rowElement.querySelector(".uom-mass-select");
        const uomname = 'Mass';

        if (!uomUnitMassSelect) {
            console.error("Select element .uom-mass-select not found in the row element.");
            return;
        }

        fetch("/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}")
            .then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data.uoms)) {
                    console.error("Invalid UOM data format:", data);
                    return;
                }

                const filteredUnits = data.uoms.filter(uom => uom.UName === uomname);
                uomUnitMassSelect.innerHTML = '<option value="">Select...</option>';
                filteredUnits.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.IDU;
                    option.textContent = item.Unit;
                    uomUnitMassSelect.appendChild(option);
                });
            })
            .catch(err => console.error("Error loading units:", err));
    }


    function populateAndLinkDistanceUnit(rowElement) {
        const uomUnitDistanceSelect = rowElement.querySelector(".uom-distance-select");
        const uomname = 'Distance';

        if (!uomUnitDistanceSelect) {
            console.error("Select element .uom-distance-select not found in the row element.");
            return;
        }

        fetch("/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}")
            .then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data.uoms)) {
                    console.error("Invalid UOM data format:", data);
                    return;
                }

                const filteredUnits = data.uoms.filter(uom => uom.UName === uomname);
                uomUnitDistanceSelect.innerHTML = '<option value="">Select...</option>';
                filteredUnits.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.IDU;
                    option.textContent = item.Unit;
                    uomUnitDistanceSelect.appendChild(option);
                });
            })
            .catch(err => console.error("Error loading units:", err));
    }

    function populateAndLinkUomSelects(rowElement) {
        const uomNameSelect = rowElement.querySelector(".uom-name-select");
        const uomUnitSelect = rowElement.querySelector(".uom-unit-select");
        if (!uomNameSelect || !uomUnitSelect) return;

        // Fetch UOM names
        fetch("/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}")
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
                fetch("/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}")
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

                        const preferredUnit = filteredUnits.find(u => u.Unit === "kg");
                        uomUnitSelect.value = preferredUnit
                            ? preferredUnit.IDU
                            : filteredUnits[0].IDU;

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
        const uomNameSelect = rowElement.querySelector(".uom-name-select");
        const uomUnitSelect = rowElement.querySelector(".uom-unit-select");
        if (!elementSelect) return;

        fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(categoryName)}`)
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

        // Event listener for UOM name change to populate UOM units
        elementSelect.addEventListener("change", function (event) {
            const selectedElement = event.target.value;

            fetch(`/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}`)
                .then(res => res.json())
                .then(data => {
                    const uoms = data.uoms || [];
                    if (!uoms.length) return;

                    uomNameSelect.value = uoms[0].UName;
                    uomNameSelect.dispatchEvent(new Event("change"));
                    uomUnitSelect.value = uoms[0].Unit;
                })
                .catch(err => console.error("Error loading units:", err));
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
            const quantityInput = row.querySelector('input[data-id="valued1"]');
            const unitSelect = row.querySelector('select[data-id="unitd1"]');
            const checkbox = row.querySelector('input[type="checkbox"]');
            const quantityInput2 = row.querySelector('input[data-id="valued2"]');
            const unitSelect2 = row.querySelector('select[data-id="unitd2"]');
            const modetransportation = row.querySelector('select[data-id="selectmodetransport"]');

            const ide = selectElement ? selectElement.value : null;
            const quantity = quantityInput ? quantityInput.value : null;
            const unitId = unitSelect ? unitSelect.value : null;
            const isChecked = checkbox ? checkbox.checked : null;
            const quantity2 = quantityInput2 ? quantityInput2.value : null;
            const unitId2 = unitSelect2 ? unitSelect2.value : null;
            const modtransport = modetransportation ? modetransportation.value : null;

            // Basic validation: Check if Quantity/Unit are filled if anything is entered
            if (quantity && unitId) { // ide &&
                const rowData = {
                    IDE: ide,
                    ValueD1: parseFloat(quantity),
                    IDU1: unitId
                };

                if (quantity2 && unitId2){
                    rowData.ValueD2 = parseFloat(quantity2);
                    rowData.IDU2 = unitId2
                } else if (quantity2 || unitId2) {
                    // Fail validation if only one of ValueD2 or IDU2 is present
                    isValid = false; 
                }

                if (modtransport){
                    rowData.IDM = modtransport;
                }

                if (isChecked !== null) {
                    rowData.CHK = isChecked ? 1 : 0;
                }
                formData.push(rowData);
                submittedRows.push(row);
            } else if (quantity || unitId) { // ide || 
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
                // Simplified check for "has data" (might need refinement based on exact requirements)
                const hasData = Array.from(row.querySelectorAll('select, input')).some(
                    el => (el.value && el.value !== "Select...") || (el.type === 'checkbox' && el.checked)
                );

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

            const selectedTaskName = taskInput.value;
            const selectedOption = taskList.querySelector(`option[value="${selectedTaskName}"]`);

            let taskId = null;
            if (selectedOption) {
                // Retrieve the stored ID from the custom data attribute
                taskId = selectedOption.dataset.id; 
            } else {
                // If the user typed something custom or the input is empty but not in the list, 
                // we should treat it as invalid unless your application allows new task creation here.
                // For now, treat it as an unselected task.
                taskId = null;
            }

            if (!taskId) {
                showMessage("Please select a task from the list or ensure your input matches a valid task.", "error");
                return;
            }
           // const stepName = state.activeModule;

            if (!taskId) {
                showMessage("Please select a task.", "error");
                return;
            }

            const stepName = state.activeModule; // e.g., "Forest Operation", "Construction"
            let stepId = null;

            // Determine the source of the Step ID based on the active module
            if (stepName === "Forest Operation" || stepName === "Transportation" || stepName === "Wood Processing") {
                // For fixed modules, we fetch the ID based on the module name
                stepId = await getStepIdByName(stepName); 
            } else {
                // For other modules (e.g., Construction) which might be selected via the dropdown
                // We use the ID directly from the selected option's value
                stepId = activeStepsSelect.value;
                
                // Optional validation: Ensure a value was actually selected in the dropdown
                if (!stepId || stepId === "Select an active step...") {
                    showMessage("Please select an active step from the list.", "error");
                    return;
                }
            }

            if (!stepId) {
                // This catches errors from getStepIdByName or if the activeStepsSelect validation fails
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

                    // ------------------------------------
                    // Ask user ONLY if ALL rows are saved
                    // ------------------------------------
                    if (areAllRowsSaved()) {
                        setTimeout(() => {
                            showYesNoConfirm(
                                "All rows are saved successfully.\n\nDo you finish with the registration?",
                                () => redirectToEditPage(),
                                () => {} // stay on page
                            );
                        }, 300);
                    }

                }
                /* if (result.success) {
                    showMessage(result.message, "success");
                    updateStatusIndicators(true, submittedRows, allRows);
                } */ else {
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

    /* area all rows save */
    function areAllRowsSaved() {
        const rows = document.querySelectorAll('.form-rows .form-row');
        return [...rows].every(row =>
            row.querySelector('.status-icon.green-check')
        );
    }

    /* Redirect page */
    function redirectToEditPage() {
        const selectedTaskName = taskInput.value;
        const selectedOption = taskList.querySelector(
            `option[value="${selectedTaskName}"]`
        );

        if (!selectedOption) {
            showMessage("Unable to determine the selected task.", "error");
            return;
        }

        const taskId = selectedOption.dataset.id;

        // SAME pattern used in main.js
        const editUrl = "/datasheetupdate";

        window.location.href =
            `${editUrl}?id=${taskId}&name=${encodeURIComponent(selectedTaskName)}`;
    }

    // Show message after success registration
    function showYesNoConfirm(message, onYes, onNo) {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmModalMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        messageEl.textContent = message;
        modal.style.display = 'flex';

        const cleanup = () => {
            modal.style.display = 'none';
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
    fetch("/listtasks_with_out_datasheet")
        .then(response => response.json())
        .then(data => {
            taskList.innerHTML = ''; 
            if (data.success && Array.isArray(data.tasks)) {
                data.tasks.forEach(task => {
                    const option = document.createElement("option");
                    option.value = task.TName;
                    option.dataset.id = task.IDT;
                    taskList.appendChild(option);
                });
            } else {
                taskList.innerHTML = '<option value="" disabled selected>No tasks available</option>';
            }
        })
        .catch(err => {
            console.error("Error fetching tasks:", err);
            // Add a temporary option to the datalist on error
            const option = document.createElement("option");
            option.value = "Error loading tasks";
            taskList.appendChild(option);
        });

});