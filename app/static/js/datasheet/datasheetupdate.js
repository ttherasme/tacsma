document.addEventListener("DOMContentLoaded", () => {
    // Select HTML elements
    const taskSelect = document.getElementById("taskSelect");
    const stepSelect = document.getElementById("activeStepsSelect");
    const moduleTabs = document.querySelectorAll(".module-tab:not(select)");
    const categoryButtons = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");

    // Initialize global data arrays
    let allUOMs = [];
    let allDatasheets = [];
    let allSteps = [];
    let allElements = [];

    // Define special steps that are handled differently
    const specialSteps = ["Forest Operation", "Transportation", "Wood Processing"];
    let currentModule = "Forest Operation";
    let currentCategory = "Product";

    // Load all Units of Measurement (UOMs) globally to access them later
    fetch("/get_all_uoms")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allUOMs = data.uoms;
            }
        });

    // Load all tasks from the server
    fetch("/get_all_tasks")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Populate the task dropdown with fetched tasks
                taskSelect.innerHTML = '<option disabled selected value="">Select...</option>';
                data.tasks.forEach(task => {
                    const opt = document.createElement("option");
                    opt.value = task.IDT;
                    opt.textContent = task.TName;
                    taskSelect.appendChild(opt);
                });
            }
        });

    // Load all steps from the server
    fetch("/get_all_steps")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allSteps = data.steps;
                // Populate the step dropdown, excluding special steps
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
        });

    // Add event listeners for module tabs
    moduleTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // Update active state of tabs
            moduleTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            // Set current module and refresh the form
            currentModule = tab.dataset.sname.trim();
            stepSelect.value = "";
            refreshForm();
        });
    });

    // Add event listeners for category buttons
    categoryButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            // Update active state of category buttons
            categoryButtons.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            // Set current category and refresh the form
            currentCategory = btn.dataset.category.trim();
            refreshForm();
        });
    });

    // Add event listener for task selection change
    taskSelect.addEventListener("change", () => {
        const taskId = taskSelect.value;
        if (!taskId) return;

        // Fetch datasheet for the selected task
        fetch(`/get_datasheet_by_task/${taskId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    allDatasheets = data.data;
                    refreshForm();
                }
            });
    });

    // Add event listener for step selection change
    stepSelect.addEventListener("change", () => {
        // Update current module from the selected step
        currentModule = stepSelect.options[stepSelect.selectedIndex].text.trim();
        moduleTabs.forEach(t => t.classList.remove("active"));
        refreshForm();
    });

    // Function to refresh the form content based on selections
    function refreshForm() {
        const taskId = taskSelect.value;
        const stepName = currentModule;
        const category = currentCategory;

        // Display a message if selections are incomplete
        if (!taskId || !stepName || !category) {
            rightPanel.innerHTML = `<p>Please select a task, a step (module), and a category.</p>`;
            return;
        }

        // Find the step object by its name
        const stepObj = allSteps.find(s => s.SName.toLowerCase() === stepName.toLowerCase());
        if (!stepObj) {
            rightPanel.innerHTML = `<p>Invalid step selected.</p>`;
            return;
        }
        const stepId = stepObj.IDS;

        // Fetch elements for the selected category
        fetch(`/get_elements_by_category/${encodeURIComponent(category)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    rightPanel.innerHTML = `<p>Category elements not found.</p>`;
                    return;
                }

                const filteredElements = data.elements;
                const matchingIDE = filteredElements.map(e => e.IDE);

                // Filter datasheet rows to match the selected task, step, and elements
                const filteredRows = allDatasheets.filter(row =>
                    row.IDT == taskId &&
                    row.IDS == stepId &&
                    matchingIDE.includes(row.IDE)
                );

                // Render the form with the filtered data
                renderForm(filteredRows, filteredElements, taskId, stepId);
            });
    }

    // Function to render the form and its rows
    function renderForm(rows, elements, taskId, stepId) {
        rightPanel.innerHTML = "";

        // Add a specific class for 'Co-Products' to apply special styles
        if (currentCategory.trim() === 'Co-Products') {
            rightPanel.classList.add('co-products-form');
        } else {
            rightPanel.classList.remove('co-products-form');
        }

        // Create the form header
        const header = document.createElement("div");
        header.className = "form-header";
        
        // Adjust the header based on the category
        if (currentCategory.trim() === 'Co-Products') {
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

        // Create a container for the form rows
        const rowsContainer = document.createElement("div");
        rowsContainer.id = "rowsContainer";

        // Create and append each row
        rows.forEach(r => {
            rowsContainer.appendChild(createRow(r, elements));
        });

        rightPanel.appendChild(rowsContainer);

        // Create the footer with "Add Row" and "Save" buttons
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "form-footer-buttons";

        const addBtn = document.createElement("button");
        addBtn.className = "action-button add-button";
        addBtn.textContent = "Add Row";

        // Disable the "Add Row" button if the category is "Product"
        if (currentCategory.trim() === 'Product') {
            addBtn.disabled = true;
            addBtn.style.backgroundColor = '#ccc';
            addBtn.style.cursor = 'not-allowed';
        }

        addBtn.onclick = () => {
            const newRow = createRow({}, elements);
            rowsContainer.appendChild(newRow);
        };
        buttonsContainer.appendChild(addBtn);

        const saveBtn = document.createElement("button");
        saveBtn.className = "action-button check-button";
        saveBtn.textContent = "Save Changes";
        saveBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to save changes?")) {
                saveData(taskId, stepId);
            }
        });
        buttonsContainer.appendChild(saveBtn);

        rightPanel.appendChild(buttonsContainer);
    }

    // Function to create a single form row
    function createRow(rowData = {}, elements) {
        const row = document.createElement("div");
        row.className = "form-row";

        // Hidden input for the row's ID
        const hiddenIDD = document.createElement("input");
        hiddenIDD.type = "hidden";
        hiddenIDD.name = "IDD";
        hiddenIDD.value = rowData.IDD || "";

        // Dropdown for selecting an element
        const elementSelect = document.createElement("select");
        elementSelect.name = "IDE";
        elementSelect.classList.add("select-common");

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select --";
        elementSelect.appendChild(defaultOption);

        // Sort and populate the element dropdown
        elements.sort((a, b) => a.EName.localeCompare(b.EName));
        elements.forEach(el => {
            const opt = document.createElement("option");
            opt.value = el.IDE;
            opt.textContent = el.EName;
            if (rowData.IDE == el.IDE) opt.selected = true;
            elementSelect.appendChild(opt);
        });

        // Combine UNameSelect and UOMSelect into a single unit container
        const unitContainer = document.createElement("div");
        unitContainer.className = "unit-container";

        // UNameSelect dropdown
        const unameSelect = document.createElement("select");
        unameSelect.name = "UName";
        unameSelect.classList.add("select-common");
        const defaultUNameOption = document.createElement("option");
        defaultUNameOption.value = "";
        defaultUNameOption.textContent = "-- Select UName --";
        unameSelect.appendChild(defaultUNameOption);

        allUOMs.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.UName;
            opt.textContent = u.UName;
            if (rowData.UName == u.UName) opt.selected = true;
            unameSelect.appendChild(opt);
        });

        // Event listener to update the UOM dropdown when UName changes
        unameSelect.addEventListener("change", function () {
            const selectedUName = unameSelect.value;
            updateUOMOptions(unitContainer, selectedUName);
        });

        // UOMSelect (Initially empty, will be populated based on UName)
        const uomSelect = document.createElement("select");
        uomSelect.name = "IDU1";
        uomSelect.classList.add("select-common");
        unitContainer.appendChild(unameSelect);
        unitContainer.appendChild(uomSelect);

        // Function to populate UOM options based on UName
        function updateUOMOptions(container, selectedUName) {
            const uomSelect = container.querySelector("select[name='IDU1']");
            while (uomSelect.options.length > 1) uomSelect.remove(1); // Clear previous options

            const selectedUOMs = allUOMs.filter(u => u.UName == selectedUName);
            selectedUOMs.forEach(u => {
                const option = document.createElement("option");
                option.value = u.IDU;
                option.textContent = u.Unit;
                uomSelect.appendChild(option);
            });
        }

        // Initially populate UOM options
        updateUOMOptions(unitContainer, rowData.UName);

        // Input for the value
        const valueInput = document.createElement("input");
        valueInput.type = "number";
        valueInput.name = "ValueD1";
        valueInput.value = rowData.ValueD1 || "";

        // Delete button for the row
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "✖";
        deleteBtn.className = "delete-row";
        deleteBtn.onclick = () => {
            if (confirm("Are you sure you want to delete this row?")) {
                handleDelete(row, rowData.IDD);
            }
        };

        // Span for displaying row status (success/error)
        const statusSpan = document.createElement("span");
        statusSpan.className = "row-status";
        statusSpan.style.minWidth = "20px";
        statusSpan.style.textAlign = "center";
        
        // Create an array of row cells
        const rowCells = [
            hiddenIDD,
            createCell(elementSelect),
            createCell(valueInput),
            createCell(unitContainer)
        ];

        // Add a checkbox if the category is 'Co-Products'
        if (currentCategory.trim() === 'Co-Products') {
            const checkboxContainer = document.createElement("div");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "CHK";
            if (rowData.CHK === 1) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
            checkboxContainer.appendChild(checkbox);
            rowCells.push(checkboxContainer);
        }

        // Add status and delete buttons
        rowCells.push(createCell(statusSpan));
        rowCells.push(createCell(deleteBtn));

        row.append(...rowCells);

        return row;
    }

    // Helper function to create a cell (div) for a child element
    function createCell(child) {
        const div = document.createElement("div");
        div.appendChild(child);
        return div;
    }

    // Function to handle row deletion
    function handleDelete(row, IDD) {
        if (IDD) {
            // Delete from the database if an ID exists
            fetch(`/delete_datasheet_row/${IDD}`, { method: "DELETE" })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        row.remove();
                    } else {
                        alert("Error deleting row from the database.");
                    }
                })
                .catch(() => alert("Network error. Could not delete row."));
        } else {
            // Simply remove the row from the DOM if it's new
            row.remove();
        }
    }

    // Function to save all data to the server
    function saveData(taskId, stepId) {
        const rows = [];
        const rowDivs = Array.from(document.querySelectorAll("#rowsContainer .form-row"));

        // Initialize status for all rows to '❌'
        rowDivs.forEach(row => {
            const statusSpan = row.querySelector(".row-status");
            statusSpan.textContent = "❌";
            statusSpan.style.color = "red";
        });

        // Collect data from each form row
        rowDivs.forEach(row => {
            const IDE = row.querySelector('[name="IDE"]').value;
            const IDU1 = row.querySelector('[name="IDU1"]').value;
            const val = row.querySelector('[name="ValueD1"]').value;
            const ValueD1 = parseFloat(val);
            const IDD = row.querySelector('[name="IDD"]')?.value;
            const CHK = currentCategory.trim() === 'Co-Products' ? (row.querySelector('[name="CHK"]').checked ? 1 : 0) : null;
            
            // Skip rows with invalid data
            if (!IDE || !IDU1 || isNaN(ValueD1)) {
                return;
            }

            rows.push({ IDE, IDU1, ValueD1, IDD, CHK});
        });

        // Check if there are valid rows to save
        if (rows.length === 0) {
            alert("No valid rows to save.");
            return;
        }

        // Send data to the server via a POST request
        fetch("/save_datasheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: taskId, step_id: stepId, rows })
        })
        .then(res => res.json())
        .then(data => {
            const rowDivs = Array.from(document.querySelectorAll("#rowsContainer .form-row"));

            // Update row status indicators based on server response
            if (data.success && data.rowsStatus?.length === rows.length) {
                data.rowsStatus.forEach((status, idx) => {
                    const statusSpan = rowDivs[idx].querySelector(".row-status");

                    if (status === "success") {
                        statusSpan.textContent = "✔";
                        statusSpan.style.color = "green";
                    } else {
                        statusSpan.textContent = "❌";
                        statusSpan.style.color = "red";
                    }
                });
            } else {
                // If the overall save fails, mark all rows with an error
                rowDivs.forEach(r => {
                    const statusSpan = r.querySelector(".row-status");
                    statusSpan.textContent = "❌";
                    statusSpan.style.color = "red";
                });
            }
        })
        .catch(() => {
            // Handle network errors by marking all rows with an error
            document.querySelectorAll(".row-status").forEach(span => {
                span.textContent = "❌";
                span.style.color = "red";
            });
        });
    }
});