document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("dynamic-content");
    const resultsContainer = document.getElementById("results-output");

    // Define class names as constants for consistency
    const TASK_SELECT_CLASS = "task-select";
    const FUNCTIONAL_UNIT_CLASS = "functional-unit-input";
    const UNIT_NAME_SELECT_CLASS = "select-unit-name";
    const UNIT_SELECT_CLASS = "select-unit";
    const IMPACT_CATEGORY_SELECT_CLASS = "impact-category-select";
    const DELETE_ROW_CLASS = "delete-row";

    let taskData = null;
    let uomData = null;

    // Helper to build HTML table from array of objects
    function buildTableFromData(data) {
        if (!data || data.length === 0) {
            return '<p>No contribution data available.</p>';
        }

        let tableHtml = '<table class="table table-bordered table-striped"><thead><tr>';
        const headers = Object.keys(data[0]);
        headers.forEach(header => {
            tableHtml += `<th>${header}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        data.forEach(row => {
            tableHtml += '<tr>';
            headers.forEach(header => {
                tableHtml += `<td>${row[header]}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        return tableHtml;
    }

    // Generates a single form row
    function generateFormRow(showDeleteButton = true) {
        const row = document.createElement("div");
        row.className = "form-row";
    
        // Conditionally render the delete button based on the value of showDeleteButton
        const deleteButtonHTML = !showDeleteButton
            ? `<button type="button" class="icon-button ${DELETE_ROW_CLASS}">🗑️</button>`
            : '';
    
        row.innerHTML = `
            <div>
                <select class="${TASK_SELECT_CLASS}"></select>
            </div>
            <div class="unit-input">
                <input type="number" step="0.01" value="0" class="${FUNCTIONAL_UNIT_CLASS}"/>
                <select class="${UNIT_NAME_SELECT_CLASS}"></select>
                <select class="${UNIT_SELECT_CLASS}"></select>
            </div>
            <div>
                <select class="${IMPACT_CATEGORY_SELECT_CLASS}">
                    <option>GWP</option>
                    <option>Smog</option>
                    <option>Acidification</option>
                    <option>Eutrophication</option>
                    <option>Carcinogenics</option>
                    <option>Non_carcinogenics</option>
                    <option>Respiratory_effects</option>
                    <option>Ecotoxicity</option>
                    <option>Fossil_fuel_depletion</option>
                    <option>Ozone_depletion</option>
                </select>
            </div>
            <div></div>
            <div>
                ${deleteButtonHTML}
            </div>
        `;
    
        // Add delete button listener only if the button exists
        const deleteButton = row.querySelector(`.${DELETE_ROW_CLASS}`);
        if (deleteButton) {
            deleteButton.addEventListener("click", () => {
                if (confirm("Are you sure you want to delete this row?")) {
                    row.remove();
                }
            });
        }
    
        populateAndLinkSelects(row);
        return row;
    }


    // Populate selects and link unit name and unit selects dynamically
    function populateAndLinkSelects(rowElement) {
        const taskSelect = rowElement.querySelector(`.${TASK_SELECT_CLASS}`);
        const unitNameSelect = rowElement.querySelector(`.${UNIT_NAME_SELECT_CLASS}`);
        const unitSelect = rowElement.querySelector(`.${UNIT_SELECT_CLASS}`);

        // Populate task dropdown
        if (taskData) {
            taskSelect.innerHTML = '<option value="" disabled selected>Select a task...</option>';
            taskData.forEach(task => {
                const option = document.createElement("option");
                option.value = task.IDT;
                option.textContent = task.TName;
                taskSelect.appendChild(option);
            });
        }

        // Populate unit name dropdown with unique UNames
        if (uomData) {
            const distinctUNames = [...new Set(uomData.map(uom => uom.UName))];
            unitNameSelect.innerHTML = '<option value="">Select...</option>';
            distinctUNames.forEach(uName => {
                const option = document.createElement("option");
                option.value = uName;
                option.textContent = uName;
                unitNameSelect.appendChild(option);
            });
        }

        // When unit name changes, update units dropdown accordingly
        unitNameSelect.addEventListener("change", (event) => {
            const selectedUName = event.target.value;
            unitSelect.innerHTML = '<option value="">Select...</option>';
            if (selectedUName && uomData) {
                const filteredUnits = uomData.filter(uom => uom.UName === selectedUName);
                filteredUnits.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.IDU;
                    option.textContent = item.Unit;
                    unitSelect.appendChild(option);
                });
            }
        });
    }

    // Generate the main form HTML and attach event listeners
    function generateMainForm() {
        container.innerHTML = `
            <div class="dynamic-wrapper">
                <div class="form-header-top">
                    <h2>Analysis</h2>
                    <div class="form-actions-top">
                        <button type="button" class="icon-button" id="add-row">➕ Add Row</button>
                    </div>
                </div>
                <div class="form-box">
                    <div class="form-header">
                        <div>Products</div>
                        <div>Functional unit</div>
                        <div>Impact categories</div>
                        <div></div>
                        <div></div>
                    </div>
                    <div id="form-rows"></div>
                    <div class="run-button-wrapper">
                        <button type="button" class="run-button">Run Analysis</button>
                    </div>
                </div>
            </div>
            <div id="loading-spinner" class="text-center my-3" style="display: none;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>Please wait while the analysis runs...</p>
            </div>
        `;

        const formRowsContainer = document.getElementById("form-rows");
        const addRowButton = document.getElementById("add-row");
        addRowButton.disabled = true; // ← This disables the button
        const runButton = document.querySelector(".run-button");
        const loadingSpinner = document.getElementById("loading-spinner");

        // Add initial row
        formRowsContainer.appendChild(generateFormRow());

        // Add new rows on button click
        addRowButton.addEventListener("click", () => {
            formRowsContainer.appendChild(generateFormRow());
        });

        // Run analysis on button click
        runButton.addEventListener("click", () => {
            runButton.disabled = true;
            loadingSpinner.style.display = 'block';
            resultsContainer.style.display = 'none';

            // Collect data from each row
            const rows = [...document.querySelectorAll(".form-row")];
            const rowData = rows.map(row => {
                const taskSelect = row.querySelector(`.${TASK_SELECT_CLASS}`);
                const numberInput = row.querySelector(`.${FUNCTIONAL_UNIT_CLASS}`);
                const unitSelect = row.querySelector(`.${UNIT_SELECT_CLASS}`);
                const impactCategorySelect = row.querySelector(`.${IMPACT_CATEGORY_SELECT_CLASS}`);

                return {
                    task: taskSelect?.value || null,  //taskSelect?.selectedOptions[0]?.textContent || null,
                    functional_unit: numberInput?.value || null,
                    unit: unitSelect?.value || null,
                    impact_category: impactCategorySelect?.value || null
                };
            });

            // Validate all fields are filled
            const isValid = rowData.every(row => row.task && row.functional_unit && row.unit && row.impact_category);

            if (!isValid) {
                alert("Please fill in all fields before running the analysis.");
                loadingSpinner.style.display = 'none';
                runButton.disabled = false;
                return;
            }

            // Post data to backend
            fetch("/results/graph", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: rowData })
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! Status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                resultsContainer.style.display = 'block';
                resultsContainer.innerHTML = '';

                const resultsWrapper = document.createElement("div");
                resultsWrapper.className = "dynamic-wrapper";

                let resultsContent = `<h3>Results:</h3>`;

                if (data.total_impact !== undefined && data.total_impact !== null) {
                    resultsContent += `<div class="alert alert-info"><strong>1 - Total Impact: ${data.total_impact}</strong></div>`;
                } else {
                    resultsContent += `<div class="alert alert-warning"><strong>1 - Total Impact data not available.</strong></div>`;
                }

                if (data.chart_base64) {
                    resultsContent += `
                        <div id="chart-container" class="mb-4 text-center">
                            <img src="data:image/png;base64,${data.chart_base64}" alt="LCA Analysis Chart" />
                        </div>
                    `;
                } else {
                    resultsContent += `<p>No chart available.</p>`;
                }

                if (data.contribution_table && data.contribution_table.length > 0) {
                    resultsContent += `
                        <div class="mb-4">
                            <strong>2 - Process Contributions:</strong>
                            <div id="table4" class="table-responsive bg-white p-2 border">
                                ${buildTableFromData(data.contribution_table)}
                            </div>
                        </div>
                    `;
                } else {
                    resultsContent += `<p>No contribution table available.</p>`;
                }

                resultsWrapper.innerHTML = resultsContent;
                resultsContainer.appendChild(resultsWrapper);
            })
            .catch(err => {
                console.error("Error while running analysis:", err);
                alert("An error occurred. Please try again later. Check the console for details.");
            })
            .finally(() => {
                loadingSpinner.style.display = 'none';
                runButton.disabled = false;
            });
        });
    }

    // Fetch tasks and units before building the form
    Promise.all([
        fetch("/listFlows").then(res => res.json()),
        fetch("/get_all_uoms").then(res => res.json())
    ])
    .then(([taskResponse, uomResponse]) => {
        if (taskResponse.success && Array.isArray(taskResponse.tasks)) {
            taskData = taskResponse.tasks;
        } else {
            console.error("No task data found.");
        }

        if (uomResponse.uoms) {
            uomData = uomResponse.uoms;
        } else {
            console.error("No UOM data found.");
        }

        generateMainForm();
    })
    .catch(err => {
        console.error("Error fetching essential data:", err);
        container.innerHTML = "<p class='text-danger'>Could not load essential data. Please try again later.</p>";
    });
});
