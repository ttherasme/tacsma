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

    /* ===============================================================
       LOAD INITIAL DATA
    =============================================================== */

    fetch("/listTotbystatus/1")
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) allMTransport = data; });

    fetch("/get_all_uoms")
        .then(res => res.json())
        .then(data => { if (data.success) allUOMs = data.uoms; });

    fetch("/listtasks")
        .then(res => res.json())
        .then(data => {
            taskList.innerHTML = "";
            if (data.success && Array.isArray(data.tasks)) {
                data.tasks.forEach(task => {
                    const opt = document.createElement("option");
                    opt.value = task.TName;
                    opt.dataset.id = task.IDT;
                    taskList.appendChild(opt);
                });
            }
        });

    fetch("/get_all_steps")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allSteps = data.steps;

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

    taskInput.addEventListener("change", () => {
        const selected = taskList.querySelector(`option[value="${taskInput.value}"]`);
        const taskId = selected ? selected.dataset.id : null;
        if (!taskId) return;

        fetch(`/get_datasheet_by_task/${taskId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    allDatasheets = data.data;
                    refreshForm();
                }
            });
    });

    stepSelect.addEventListener("change", () => {
        currentModule = stepSelect.options[stepSelect.selectedIndex].text.trim();
        moduleTabs.forEach(t => t.classList.remove("active"));
        refreshForm();
    });

    /* ===============================================================
       REFRESH UI
    =============================================================== */

    function refreshForm() {
        const taskName = taskInput.value;
        const opt = taskList.querySelector(`option[value="${taskName}"]`);
        const taskId = opt ? opt.dataset.id : null;

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

        fetch(`/get_elements_by_category/${encodeURIComponent(currentCategory)}`)
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
                <th>Mass</th>
                <th>Distance</th>
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
            const unit2 = allUOMs.find(u => u.IDU == rowData.IDU2)?.Unit || "";
            const mt = allMTransport.find(m => m.IDM == rowData.IDM)?.MTName || "";

            tr.innerHTML = `
                <td>${elementName}</td>
                <td>${rowData.ValueD1} ${unit1}</td>
                <td>${rowData.ValueD2} ${unit2}</td>
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
