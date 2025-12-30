document.addEventListener("DOMContentLoaded", () => {
    // Select HTML elements
    const taskInput = document.getElementById("taskSelect");
    const taskList = document.getElementById("taskList");
    const stepSelect = document.getElementById("activeStepsSelect");
    const moduleTabs = document.querySelectorAll(".module-tab:not(select)");
    const categoryButtons = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");

    // Initialize global data arrays
    let allUOMs = [];
    let allDatasheets = [];
    let allSteps = [];
    let allElements = [];
    let allMTransport = [];
    let selectedElement = '';

    // Define special steps that are handled differently
    const specialSteps = ["Forest Operation", "Transportation", "Wood Processing"];
    let currentModule = "Forest Operation";
    let currentCategory = "Product";

    let stepsLoaded = false;
    let datasheetsLoaded = false;

    // --- Data Fetching (UOMs, MTransport, Steps) ---

    // Load all MTransport (Transportation Modes)
    fetch("/listTotbystatus/1")
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (Array.isArray(data)) {
            allMTransport = data;
        } 
    });

    // Load all Units of Measurement (UOMs)
    fetch("/get_all_uoms_by_element/${encodeURIComponent(selectedElement)}")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allUOMs = data.uoms;
            }
        });

    // Load all steps from the server
    fetch("/get_all_steps")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allSteps = data.steps;
                stepsLoaded = true;          // ✅ ADD
                tryInitialRefresh();         // ✅ ADD

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


    // --- Core Task Loading Logic ---

    // Function to fetch datasheet data and trigger form refresh
    function loadTaskData(taskId) {
        fetch(`/get_datasheet_by_task/${taskId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    allDatasheets = data.data;
                    datasheetsLoaded = true;   // ✅ ADD
                    tryInitialRefresh();       // ✅ ADD
                } else {
                    alert("Failed to load datasheet entries for this task.");
                }
            })
            .catch(err => {
                console.error("Error fetching datasheet:", err);
                alert("An error occurred while loading task data.");
            });
    }

    function tryInitialRefresh() {
        if (stepsLoaded && datasheetsLoaded) {
            refreshForm(); // ✅ guaranteed safe
        }
    }

    // Initialization Block: Use the data passed from the backend
    // Check if the variables defined in the HTML script block are available
    const hasInitialTask = typeof initialTaskId !== 'undefined' && initialTaskId !== null;

    if (hasInitialTask) {
        // 1. Set the input field to display the selected task's name
        taskInput.value = initialTaskName;
        
        // 2. Populate the datalist with ONLY the selected task as an option.
        const initialTaskOption = document.createElement("option");
        initialTaskOption.value = initialTaskName;
        initialTaskOption.dataset.id = initialTaskId;
        taskList.appendChild(initialTaskOption);
        
        // 3. Prevent the user from changing the task
        taskInput.disabled = true;

        // 4. Immediately load the task data (Datasheet entries)
        loadTaskData(initialTaskId);
        
    } else {
        // Fallback for missing parameters
        taskInput.placeholder = "Error: Task not selected.";
        taskInput.disabled = true;
        rightPanel.innerHTML = '<p>Task data could not be loaded. Please return to the task list.</p>';
    }

    // --- Event Listeners for Tabs/Categories/Steps ---
    
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

    // Add event listener for step selection change
    stepSelect.addEventListener("change", () => {
        // Update current module from the selected step
        currentModule = stepSelect.options[stepSelect.selectedIndex].text.trim();
        moduleTabs.forEach(t => t.classList.remove("active"));
        refreshForm();
    });

    // NOTE: The previous taskInput.addEventListener("change", ...) is removed here.
    
    // --- Core Functions ---

    // Function to refresh the form content based on selections
    /* function refreshForm() {
        const taskId = initialTaskId;
        const stepName = currentModule;
        const category = currentCategory;

        if (!taskId || !stepName || !category) {
            rightPanel.innerHTML = `<p>Please select a task, a step (module), and a category.</p>`;
            return;
        }

        const stepObj = allSteps.find(
            s => s.SName.toLowerCase() === stepName.toLowerCase()
        );

        if (!stepObj) {
            rightPanel.innerHTML = `<p>Invalid step selected.</p>`;
            return;
        }

        const stepId = stepObj.IDS;

        Promise.all([
            fetch(`/get_elements_info_by_category/${encodeURIComponent(category)}`)
                .then(res => res.json()),

            fetch(`/get_elements_by_category_for_compare/${encodeURIComponent(category)}`)
                .then(res => res.json())
        ])
        .then(([listData, compareData]) => {

            if (!listData.success || !compareData.success) {
                rightPanel.innerHTML = `<p>Category elements not found.</p>`;
                return;
            }

            const filteredElements = listData.elements;               // for display
            const matchingIDE = compareData.elements.map(e => e.IDE); // for filtering

            const filteredRows = allDatasheets.filter(row =>
                row.IDT == taskId &&
                row.IDS == stepId &&
                matchingIDE.includes(row.IDE)
            );

            renderForm(filteredRows, filteredElements, taskId, stepId);
        })
        .catch(err => {
            console.error(err);
            rightPanel.innerHTML = `<p>Error loading elements.</p>`;
        });
    } */

    function refreshForm() {
        // Get taskId directly from the initial global variable
        const taskId = initialTaskId; 
        
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
        fetch(`/get_elements_by_category_for_datasheet/${encodeURIComponent(category)}`)
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

        // Add a specific class for form type to apply special CSS grids
        rightPanel.classList.remove('co-products-form', 'transportations-form');
        if (currentModule.trim() === 'Transportation') {
            rightPanel.classList.add('transportations-form');
        } else if (currentCategory.trim() === 'Co-Products') {
            rightPanel.classList.add('co-products-form');
        }

        // Create the form header
        const header = document.createElement("div");
        header.className = "form-header";
        
        // Adjust the header based on the category
        if ((currentModule.trim() === 'Transportation' && (currentCategory.trim() === 'Input Energy' || currentCategory.trim() === 'Co-Products' || currentCategory.trim() === 'Emissions'))) {
             header.innerHTML = ``;
        } else if (currentModule.trim() === 'Transportation') {
            header.innerHTML = `
                <span>Materials</span>
                <span>Mass</span>
                <span>Distance</span>
                <span>Transportation Mode</span>
                <span></span>
                <span></span>
            `;
        } else if (currentCategory.trim() === 'Co-Products') {
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

        // ✅ Auto-add one row for Product if no data exists
        if (
            rows.length === 0 &&
            currentCategory.trim() === "Product"
        ) {
            const emptyRow = createRow({}, elements);
            rowsContainer.appendChild(emptyRow);
        }

        rightPanel.appendChild(rowsContainer);

        // Create the footer with "Add Row" and "Save" buttons
        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "form-footer-buttons";

        const addBtn = document.createElement("button");
        addBtn.className = "action-button add-button";
        addBtn.textContent = "Add Row";

        // Disable the "Add Row" button if the category is "Product"
        if ((currentCategory.trim() === 'Product') || (currentModule.trim() === 'Transportation' && (currentCategory.trim() === 'Input Energy' || currentCategory.trim() === 'Co-Products' || currentCategory.trim() === 'Emissions'))) {
            addBtn.style.display = 'none';
        }

        addBtn.onclick = () => {
            const newRow = createRow({}, elements);
            rowsContainer.appendChild(newRow);
        };
        buttonsContainer.appendChild(addBtn);

        const saveBtn = document.createElement("button");
        saveBtn.className = "action-button check-button";
        saveBtn.textContent = "Save Changes";
        if ((currentModule.trim() === 'Transportation' && (currentCategory.trim() === 'Input Energy' || currentCategory.trim() === 'Co-Products' || currentCategory.trim() === 'Emissions'))) {
            saveBtn.style.display = 'none';
        }
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

        const rowCells = [];
        if (currentModule.trim() === 'Transportation' && (currentCategory.trim() === 'Input Energy' || currentCategory.trim() === 'Co-Products' || currentCategory.trim() === 'Emissions')){
            row.append(...rowCells);
            return row;
        }
        else{
            // Hidden IDD
            const hiddenIDD = document.createElement("input");
            hiddenIDD.type = "hidden";
            hiddenIDD.name = "IDD";
            hiddenIDD.value = rowData.IDD || "";
            row.appendChild(hiddenIDD);


            // Element select (IDE) - This is the first visible column ('Name' or 'Materials')
            const elementSelect = document.createElement("select");
            elementSelect.name = "IDE";
            elementSelect.classList.add("select-common");

            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "-- Select --";
            elementSelect.appendChild(defaultOption);

            elements.sort((a, b) => a.EName.localeCompare(b.EName));
            elements.forEach(el => {
                const opt = document.createElement("option");
                opt.value = el.IDE;
                opt.textContent = el.EName;
                if (rowData.IDE == el.IDE) opt.selected = true;
                elementSelect.appendChild(opt);
            });
            rowCells.push(createCell(elementSelect));

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
                            allUOMs = data.uoms;
                        }
                    })
                    .catch(err => console.error("UOM fetch failed:", err));
            });


            // ==== TRANSPORTATION MODE ====
            if (currentModule.trim() === 'Transportation') {
                
                // --- Mass (ValueD1 + UOM) - Column 2 ---
                
                const massContainer = document.createElement("div");
                massContainer.className = "trans-container"; // <-- USING trans-container
                
                const massInput = document.createElement("input");
                massInput.type = "number";
                massInput.name = "ValueD1";
                massInput.value = rowData.ValueD1 || "";

                const massUOM = document.createElement("select");
                massUOM.name = "IDU1";
                massUOM.classList.add("select-common");

                updateUOMOptions(massUOM, "Mass");

                if (rowData.IDU1) massUOM.value = rowData.IDU1;

                massContainer.appendChild(massInput);
                massContainer.appendChild(massUOM);
                rowCells.push(massContainer); 

                // --- Distance (ValueD2 + UOM) - Column 3 ---
                
                const distContainer = document.createElement("div");
                distContainer.className = "trans-container"; // <-- USING trans-container

                const distInput = document.createElement("input");
                distInput.type = "number";
                distInput.name = "ValueD2";
                distInput.value = rowData.ValueD2 || "";

                const distUOM = document.createElement("select");
                distUOM.name = "IDU2";
                distUOM.classList.add("select-common");

                updateUOMOptions(distUOM, "Distance");

                if (rowData.IDU2) distUOM.value = rowData.IDU2;

                distContainer.appendChild(distInput);
                distContainer.appendChild(distUOM);
                rowCells.push(distContainer); 

                // --- Transport Mode (MT) - Column 4 ---
                const mtSelect = document.createElement("select");
                mtSelect.name = "MT";
                mtSelect.classList.add("select-common");

                allMTransport.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m.IDM;
                    opt.textContent = m.MTName;
                    mtSelect.appendChild(opt);
                });
                if (rowData.IDM) mtSelect.value = rowData.IDM;
                rowCells.push(createCell(mtSelect)); 
            }

            // ==== CO-PRODUCTS OR DEFAULT ====
            else {
                // --- ValueD1 - Column 2 ---
                const valueInput = document.createElement("input");
                valueInput.type = "number";
                valueInput.name = "ValueD1";
                valueInput.value = rowData.ValueD1 || "";
                rowCells.push(createCell(valueInput)); 

                // --- Unit selector (UName + IDU1) - Column 3 ---
                // Create the cell container for the unit-container
                const unitCell = document.createElement("div");
                
                const unitContainer = document.createElement("div");
                unitContainer.className = "unit-container"; // <-- REMAINS unit-container
                
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

                // Populate UName select
                const uniqueUNames = [...new Set(allUOMs.map(u => u.UName))];
                uniqueUNames.forEach(uname => {
                    const opt = document.createElement("option");
                    opt.value = uname;
                    opt.textContent = uname;
                    if (rowData.UName === uname) opt.selected = true;
                    unameSelect.appendChild(opt);
                });

                // Populate IDU1 based on selected UName
                function populateIDUOptions(uName) {
                    iduSelect.innerHTML = "";
                    allUOMs
                        .filter(u => u.UName === uName)
                        .forEach(u => {
                            const opt = document.createElement("option");
                            opt.value = u.IDU;
                            opt.textContent = u.Unit;
                            iduSelect.appendChild(opt);
                        });
                }

                if (rowData.UName) {
                    populateIDUOptions(rowData.UName);
                    if (rowData.IDU1) iduSelect.value = rowData.IDU1;
                }

                unameSelect.addEventListener("change", () => {
                    populateIDUOptions(unameSelect.value);
                });

                rowCells.push(unitCell); 

                // --- Co-Products → add CHK checkbox - Column 4 ---
                if (currentCategory.trim() === "Co-Products") {
                    const chkContainer = document.createElement("div");
                    const chk = document.createElement("input");
                    chk.type = "checkbox";
                    chk.name = "CHK";
                    chk.checked = rowData.CHK === 1;
                    chkContainer.appendChild(chk);
                    rowCells.push(createCell(chkContainer)); 
                }
            }

            // Status - Column 5 (or 4 for default, 5 for Transportation)
            const statusSpan = document.createElement("span");
            statusSpan.className = "row-status";
            statusSpan.style.minWidth = "20px";
            statusSpan.style.textAlign = "center";
            rowCells.push(createCell(statusSpan));

            // Delete button - Column 6 (or 5 for default, 6 for Transportation)
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "✖";
            deleteBtn.className = "delete-row";
            deleteBtn.onclick = () => {
                if (confirm("Are you sure you want to delete this row?")) {
                    handleDelete(row, rowData.IDD);
                }
            };
            rowCells.push(createCell(deleteBtn));

            // Append all cells to the row
            row.append(...rowCells);
            return row;

             // Reusable UOM helper for Transportation
            function updateUOMOptions(selectElement, uName) {
                selectElement.innerHTML = "";
                allUOMs
                    .filter(u => u.UName === uName)
                    .forEach(u => {
                        const opt = document.createElement("option");
                        opt.value = u.IDU;
                        opt.textContent = u.Unit;
                        selectElement.appendChild(opt);
                    });
            }
        }

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
            // Since IDD is now appended directly to the row and not inside a cell, use querySelector on the row itself
            const IDD = row.querySelector('[name="IDD"]')?.value; 
            const CHK = currentCategory.trim() === 'Co-Products' ? (row.querySelector('[name="CHK"]').checked ? 1 : 0) : null;
            
            // For Transportation, we also need IDU2, ValueD2, and MT
            let IDU2 = null;
            let ValueD2 = null;
            let MT = null;

            if (currentModule.trim() === 'Transportation') {
                 IDU2 = row.querySelector('[name="IDU2"]')?.value || null;
                 ValueD2 = parseFloat(row.querySelector('[name="ValueD2"]')?.value) || null;
                 MT = row.querySelector('[name="MT"]')?.value || null;

                // Transportation validation (Mass, Distance, and Mode must be present)
                if (!IDE || !IDU1 || isNaN(ValueD1) || !IDU2 || isNaN(ValueD2) || !MT) {
                    return; // Skip rows with invalid data
                }

                rows.push({ IDE, IDU1, ValueD1, IDU2, ValueD2, IDM: MT, CHK: null, IDD }); // Added IDD to the object
                return; // Go to next row
            }

            // Default/Co-Products validation
            if (!IDE || !IDU1 || isNaN(ValueD1)) {
                return; // Skip rows with invalid data
            }

            rows.push({ IDE, IDU1, ValueD1, CHK, IDD}); // Added IDD to the object
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