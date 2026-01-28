document.addEventListener("DOMContentLoaded", () => {
    // Select HTML elements
    const taskInput = document.getElementById("taskSelect");
    const taskList = document.getElementById("taskList");
    const stepSelect = document.getElementById("activeStepsSelect");
    const moduleTabs = document.querySelectorAll(".module-tab:not(select)");
    const categoryButtons = document.querySelectorAll(".category");
    const rightPanel = document.getElementById("rightPanel");

    // Global data
    let allUOMs = [];
    let allDatasheets = [];
    let allSteps = [];
    let allElements = [];
    let allMTransport = [];

    const specialSteps = ["Forest Operation", "Transportation", "Wood Processing"];
    let currentModule = "Forest Operation";
    let currentCategory = "Product";

    let stepsLoaded = false;
    let datasheetsLoaded = false;


    /* ===============================================================
        LOAD INITIAL DATA (UOMs, MTransport, Steps)
    =============================================================== */

    fetch("/listTotbystatus/1")
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) allMTransport = data; });

    fetch("/get_all_uoms")
        .then(res => res.json())
        .then(data => { if (data.success) allUOMs = data.uoms; });

    // --- REMOVED: fetch("/listtasks") ---

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


    /* ===============================================================
        NEW: TASK INITIALIZATION
    =============================================================== */
    
    // Function to fetch datasheet data and trigger initial form refresh
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


    // Initialization Block: Use the data passed from the backend (initialTaskId, initialTaskName)
    const hasInitialTask = typeof initialTaskId !== 'undefined' && initialTaskId !== null;

    if (hasInitialTask) {
        // 1. Set the input field and disable it
        taskInput.value = initialTaskName;
        taskInput.disabled = true;
        
        // 2. Add the option to the list (even though it's disabled)
        const initialTaskOption = document.createElement("option");
        initialTaskOption.value = initialTaskName;
        initialTaskOption.dataset.id = initialTaskId;
        taskList.appendChild(initialTaskOption);

        // 3. Immediately load the task data (Datasheet entries)
        loadTaskData(initialTaskId);
        
    } else {
        // Fallback for missing parameters
        taskInput.placeholder = "Error: Task not selected.";
        taskInput.disabled = true;
        rightPanel.innerHTML = '<p>Task data could not be loaded.</p>';
    }

    /* ===============================================================
        EVENT LISTENERS
    =============================================================== */

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

    // --- REMOVED: taskInput.addEventListener("change", ...) ---

    stepSelect.addEventListener("change", () => {
        currentModule = stepSelect.options[stepSelect.selectedIndex].text.trim();
        moduleTabs.forEach(t => t.classList.remove("active"));
        refreshForm();
    });

    /* ===============================================================
        REFRESH UI
    =============================================================== */

    function refreshForm() {
        // MODIFIED: Get taskId directly from the global variable
        const taskId = initialTaskId;

        if (!taskId) {
            rightPanel.innerHTML = `<p>Please select a valid task.</p>`;
            return;
        }

        const stepObj = allSteps.find(s => s.SName.toLowerCase() === currentModule.toLowerCase());
        if (!stepObj) {
            rightPanel.innerHTML = `<p>Invalid step selected.</p>`;
            return;
        }

        const stepId = stepObj.IDS;

        fetch(`/get_elements_info_by_category/${encodeURIComponent(currentCategory)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    rightPanel.innerHTML = `<p>No elements for category.</p>`;
                    return;
                }
                const filteredElements = data.elements;
                const elementIDs = filteredElements.map(e => e.IDE);
                const filteredRows = allDatasheets.filter(row =>
                    row.IDT == taskId &&
                    row.IDS == stepId &&
                    elementIDs.includes(row.IDE)
                );
                renderTable(filteredRows, filteredElements);
            });

    }

    /* ===============================================================
        TABLE RENDERING
    =============================================================== */

    function renderTable(rows, elements) {
        rightPanel.innerHTML = "";

        const table = document.createElement("table");
        table.className = "view-table";

        /* HEADER */
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        if (currentModule === "Transportation") {
            headerRow.innerHTML = `
                <th>Material</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Transport Mode</th>`;
        }
        else if (currentCategory === "Co-Products") {
            headerRow.innerHTML = `
                <th>Name</th>
                <th>Value</th>
                <th>Unit</th>
                <th>CHK</th>`;
        }
        else {
            headerRow.innerHTML = `
                <th>Name</th>
                <th>Value</th>
                <th>Unit</th>`;
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        /* BODY */
        const tbody = document.createElement("tbody");

        rows.forEach(rowData => {
            tbody.appendChild(createReadOnlyRow(rowData, elements));
        });

        table.appendChild(tbody);
        rightPanel.appendChild(table);

        // ENABLE CLICK SELECTION
        enableRowSelection(table);
    }

    function createReadOnlyRow(rowData, elements) {
        const tr = document.createElement("tr");

        const elementObj = elements.find(e => e.IDE == rowData.IDE);
        const elementName = elementObj ? elementObj.EName : "";

        if (currentModule === "Transportation") {
            const unit1 = allUOMs.find(u => u.IDU == rowData.IDU1)?.Unit || "";
            //const unit2 = allUOMs.find(u => u.IDU == rowData.IDU2)?.Unit || "";
            const mt = allMTransport.find(m => m.IDM == rowData.IDM)?.MTName || "";

            tr.innerHTML = `
                <td>${elementName}</td>
                <td>${rowData.ValueD1} </td>
                <td>${unit1}</td>
                <td>${mt}</td>
            `;
        }
        else if (currentCategory === "Co-Products") {
            const unit = allUOMs.find(u => u.IDU == rowData.IDU1)?.Unit || "";
            tr.innerHTML = `
                <td>${elementName}</td>
                <td>${rowData.ValueD1}</td>
                <td>${unit}</td>
                <td>${rowData.CHK === 1 ? "✔" : ""}</td>
            `;
        }
        else {
            const unit = allUOMs.find(u => u.IDU == rowData.IDU1)?.Unit || "";
            tr.innerHTML = `
                <td>${elementName}</td>
                <td>${rowData.ValueD1}</td>
                <td>${unit}</td>
            `;
        }

        return tr;
    }

    /* ===============================================================
        ROW SELECTION LOGIC
    =============================================================== */

    function enableRowSelection(table) {
        let lastSelectedRow = null;

        table.addEventListener("click", (event) => {
            const row = event.target.closest("tr");
            if (!row || row.parentNode.tagName === "THEAD") return;

            const rows = [...table.querySelectorAll("tbody tr")];

            // SHIFT (range select)
            if (event.shiftKey && lastSelectedRow) {
                let start = rows.indexOf(lastSelectedRow);
                let end = rows.indexOf(row);
                if (start > end) [start, end] = [end, start];

                rows.forEach(r => r.classList.remove("selected-row"));
                rows.slice(start, end + 1).forEach(r => r.classList.add("selected-row"));
            }

            // CTRL/Command → toggle
            else if (event.ctrlKey || event.metaKey) {
                row.classList.toggle("selected-row");
            }

            // Normal click → single selection
            else {
                rows.forEach(r => r.classList.remove("selected-row"));
                row.classList.add("selected-row");
            }

            lastSelectedRow = row;
        });
    }

});