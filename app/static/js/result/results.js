document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("dynamic-content");

    // --- Global Variables ---
    let taskData = null;
    let uomData = null;
    let fullAnalysisResults = null; // Stores data from the /results/graph endpoint
    let visualizationTasks = [];
    let rowData = []; // MOVED OUTSIDE runButton LISTENER TO BE ACCESSIBLE by visualizeButton

    // --- Constants for Selectors ---
    const TASK_SELECT_CLASS = "task-select";
    const FLOW_SELECT_CLASS = "flow-select";
    const FUNCTIONAL_UNIT_CLASS = "functional-unit-input";
    const UNIT_NAME_SELECT_CLASS = "select-unit-name";
    const UNIT_SELECT_CLASS = "select-unit";
    const IMPACT_CATEGORY_SELECT_CLASS = "impact-category-select";
    const DELETE_ROW_CLASS = "delete-row";

    // --- Helper Functions ---

    /**
     * Helper to build HTML table from array of objects (e.g., individual contribution table)
     */
    function buildTableFromData(data) {
        if (!data || data.length === 0) {
            return '<p>No contribution data available.</p>';
        }

        let tableHtml = '<table class="table table-bordered table-striped"><thead><tr>';
        const headers = Object.keys(data[0]);
        headers.forEach(header => {
            tableHtml += `<th>${header.replace('_', ' ').charAt(0).toUpperCase() + header.replace('_', ' ').slice(1)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        data.forEach(row => {
            tableHtml += '<tr>';
            headers.forEach(header => {
                const value = row[header];
                const displayValue = (typeof value === 'number') ? value.toFixed(4) : value;
                tableHtml += `<td>${displayValue}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        return tableHtml;
    }

    /**
     * Helper to build the Comparison Table (Process Names as rows, Tasks as columns)
     * MODIFIED: To create a three-row header structure.
     */
    function buildComparisonTable(data) {
        if (!data || data.length === 0) {
            return '<p class="text-muted">No combined contribution data available for comparison.</p>';
        }

        const df = data;
        const allKeys = Object.keys(df[0]);
        const taskColumns = allKeys.filter(key => key !== 'Process');

        // Look up task-specific details (product, unit, impact category) from fullAnalysisResults
        const taskDetails = {};
        if (fullAnalysisResults && fullAnalysisResults.individual_results) {
            fullAnalysisResults.individual_results.forEach(result => {
                // The task key in the combined table is the Task Name (e.g., 'Task 1500 (1.0 Kg Logs, 1)')
                // We use this full string to match, but only the 'Task Name' part is the column name.
                // We'll need to use the full name as the key, but extract the column name part for the map.

                // The column name is just the task name, e.g., 'Task 1500'
                // We need to reliably map 'Task 1500' to the full product/impact details.
                const fullTaskName = result.task_name; // e.g., 'Task 1500 (1.0 Kg Logs, 1)'

                // Find the task ID and name from the rowData
                const matchingRow = rowData.find(row => fullTaskName.startsWith(row.taskText));
                const columnName = matchingRow ? matchingRow.taskText : fullTaskName.split(' ')[0]; // Fallback

                taskDetails[columnName] = {
                    product: result.product || '', // e.g., '1.0 Kg Logs, 1'
                    impact_category: result.impact_category || '' // e.g., 'GWP'
                };
            });
        }


        let tableHtml = '<table class="table table-bordered table-striped comparison-table"><thead><tr>';

        // Header Row
        tableHtml += '<th>Process</th>';
        taskColumns.forEach(task => {
            const details = taskDetails[task] || { product: 'N/A', impact_category: 'N/A' };
            const functionalUnitText = details.product; // Use the full product string for the unit row

            tableHtml += `<th class="task-header-multi-row">
                <div class="header-row-wrapper">
                    <div class="task-name-row">${task}</div>
                    <div class="functional-unit-row">${functionalUnitText}</div>
                    <div class="impact-category-row">${details.impact_category}</div>
                </div>
            </th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        // Data Rows
        df.forEach(row => {
            tableHtml += '<tr>';
            tableHtml += `<td>${row['Process']}</td>`; // The Process Name
            taskColumns.forEach(task => {
                const contribution = row[task];
                const displayValue = (typeof contribution === 'number')
                    ? contribution.toFixed(4)
                    : '0.0000';
                tableHtml += `<td>${displayValue}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        return tableHtml;
    }

    // Function to fetch flows for a specific task ID
    async function fetchFlowsForTask(idTask) {
        if (!idTask) return { success: true, flows: [] };

        try {
            const res = await fetch(`/listFlows/${idTask}`);
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Error fetching flows:", err);
            return { success: false, flows: [] };
        }
    }

    // Generates a single form row
    function generateFormRow(isInitialRow = false) {
        const row = document.createElement("div");
        row.className = "form-row";

        const showDeleteButton = !isInitialRow;

        const deleteButtonHTML = showDeleteButton
            ? `<button type="button" class="icon-button ${DELETE_ROW_CLASS}">🗑️</button>`
            : '<div></div>';

        row.innerHTML = `
            <div>
                <select class="${TASK_SELECT_CLASS}"></select>
            </div>
            <div>
                <select class="${FLOW_SELECT_CLASS}"></select>
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
                    <option>Non carcinogenics</option>
                    <option>Respiratory effects</option>
                    <option>Ecotoxicity</option>
                    <option>Fossil fuel depletion</option>
                    <option>Ozone depletion</option>
                </select>
            </div>
            <div>
                ${deleteButtonHTML}
            </div>
        `;

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

    // Populate selects and link unit name/task/flow selects dynamically
    function populateAndLinkSelects(rowElement) {
        const taskSelect = rowElement.querySelector(`.${TASK_SELECT_CLASS}`);
        const flowSelect = rowElement.querySelector(`.${FLOW_SELECT_CLASS}`);
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

        // Initialize flow dropdown
        flowSelect.innerHTML = '<option value="" disabled selected>Select a task first</option>';

        // Task change listener
        taskSelect.addEventListener("change", async (event) => {
            const selectedTaskId = event.target.value;
            flowSelect.innerHTML = '<option value="" disabled selected>Loading flows...</option>';

            if (selectedTaskId) {
                const flowResponse = await fetchFlowsForTask(selectedTaskId);

                flowSelect.innerHTML = '<option value="" disabled selected>Select a flow...</option>';
                if (flowResponse.success && Array.isArray(flowResponse.flows) && flowResponse.flows.length > 0) {
                    flowResponse.flows.forEach(flow => {
                        const option = document.createElement("option");
                        option.value = flow.IDE;
                        option.textContent = flow.EName;
                        flowSelect.appendChild(option);
                    });
                } else {
                    flowSelect.innerHTML = '<option value="" disabled selected>No flows for this task</option>';
                }
            } else {
                flowSelect.innerHTML = '<option value="" disabled selected>Select a task first</option>';
            }
        });

        // Populate unit name dropdown
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

        // Unit name change listener
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

    // Function to handle the print action
    function printResults() {
        const resultsContent = document.getElementById("results-output");
        if (!resultsContent || resultsContent.style.display === 'none') {
             alert("Please run the analysis first to generate results for printing.");
             return;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Analysis Results</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: Arial, sans-serif; padding: 20px; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }');
        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
        printWindow.document.write('img { max-width: 100%; height: auto; display: block; margin: 20px auto; }');
        printWindow.document.write('#print-results-button, .visualization-controls, .results-flex-container > div:not(.comparison-table-wrapper):not(.visualization-area), .comparison-table-wrapper h3 { display: none !important; }');
        printWindow.document.write('.results-flex-container { flex-direction: column !important; }');
        printWindow.document.write('</style>');

        printWindow.document.write('</head><body>');

        // Create a dedicated print container to isolate content
        const printContainer = document.createElement('div');
        printContainer.innerHTML = '<h2>Results Summary & Comparison</h2>';
        
        // Clone the relevant parts and append to the print container
        const comparisonTableArea = document.getElementById('comparison-table-area').cloneNode(true);
        const chartAreaElement = document.getElementById('chart-area').cloneNode(true);

        // Append the comparison table and chart
        if (comparisonTableArea) {
            printContainer.appendChild(document.createElement('h3')).textContent = "Combined Process Contribution Comparison";
            printContainer.appendChild(comparisonTableArea);
        }
        if (chartAreaElement && chartAreaElement.querySelector('img')) {
            printContainer.appendChild(document.createElement('h3')).textContent = "Contribution Analysis Chart";
            printContainer.appendChild(chartAreaElement);
        }

        printWindow.document.write(printContainer.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }


    // Generate the main form HTML and attach event listeners
    function generateMainForm() {
        let formRowsContainer;
        let addRowButton;
        let runButton;
        let loadingSpinner;
        let resultsContainer;
        let printButton;
        let vizTaskSelect;
        let visualizeButton;
        let chartArea;
        let comparisonTableAreaElement;
        let chartTitleElement;

        // Injected HTML template - MODIFIED FOR NEW LAYOUT
        container.innerHTML = `
            <div class="dynamic-wrapper">
                <div class="form-header-top">
                    <h2>Analysis</h2>
                    <div class="form-actions-top">
                        <button type="button" class="icon-button" id="add-row" disabled>➕ Add Row</button>
                    </div>
                </div>
                <div class="form-box">
                    <div class="form-header">
                        <div>Tasks</div>
                        <div>Products</div>
                        <div>Functional unit</div>
                        <div>Impact categories</div>
                        <div></div>
                    </div>
                    <div id="form-rows"></div>

                    <div class="run-button-wrapper-alone">
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

            <div id="results-output" class="dynamic-wrapper" style="display: none;">
                <h2>Results Summary & Comparison</h2>

                <h3>Individual Task Summaries</h3>
                <div id="summary-section"></div>
                
                <div class="results-flex-container">
                    
                    <div class="comparison-table-wrapper">
                        <h3>Combined Process Contribution Comparison</h3>
                        <div id="comparison-table-area" class="table-responsive bg-white p-2 border mb-4"></div>
                    </div>

                    <div class="visualization-area">
                        <div class="visualization-controls">
                            <select id="visualization-task-select" class="form-control"></select>
                            <select id="visualization-chart-select" class="form-control"></select>
                            <select id="visualization-theme-select" class="form-control"></select>
                        </div>
                        <div class="run-button-wrapper-alone">
                            <button type="button" id="visualize-task-button" class="visualize-button">Visualize</button>
                            <button type="button" id="print-results-button" class="print-button">Print Result</button>
                        </div>
                        
                        <div id="visualization-chart-title" class="text-center">
                            </div>
                        <div id="chart-area" class="text-center">
                            </div>
                    </div>
                </div>
            </div>
        `;

        // Get References to the new elements
        formRowsContainer = document.getElementById("form-rows");
        addRowButton = document.getElementById("add-row");
        runButton = document.querySelector(".run-button");
        loadingSpinner = document.getElementById("loading-spinner");
        resultsContainer = document.getElementById("results-output");
        printButton = document.getElementById("print-results-button");
        vizTaskSelect = document.getElementById("visualization-task-select");
        const vizChartSelect = document.getElementById("visualization-chart-select");
        const vizThemeSelect = document.getElementById("visualization-theme-select");
        visualizeButton = document.getElementById("visualize-task-button");
        chartArea = document.getElementById("chart-area");
        comparisonTableAreaElement = document.getElementById("comparison-table-area");
        chartTitleElement = document.getElementById("visualization-chart-title");

        // Populate chart and theme selects
        vizChartSelect.innerHTML = `
            <!-- <option value="" disabled selected>Chart type...</option> -->
            <option value="pie" selected>Pie</option>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="scatter">Scatter</option>
        `;

         vizThemeSelect.innerHTML = `
            <!-- <option value="" disabled selected>Theme...</option> -->
            <option value="vibrant" selected>Vibrant</option>
            <option value="pastel">Pastel</option>
            <option value="grayscale">Grayscale</option>
        `;

        // --- UI Setup & Listeners ---

        // Add initial row
        formRowsContainer.appendChild(generateFormRow(true));

        // Enable button after form is generated and data is loaded
        if (taskData && uomData) {
            addRowButton.disabled = false;
        }

        // Add new rows on button click
        addRowButton.addEventListener("click", () => {
            formRowsContainer.appendChild(generateFormRow());
        });

        // Add Print Button Listener
        printButton.addEventListener("click", printResults);

        // Populate Visualization Task Select
        function populateVizTaskSelect() {
            vizTaskSelect.innerHTML = '<option value="" disabled selected>Select a Task...</option>';
            if (visualizationTasks.length > 0) {
                 visualizationTasks.forEach(task => {
                    const option = document.createElement("option");
                    option.value = task.IDT;
                    option.textContent = task.TName;
                    vizTaskSelect.appendChild(option);
                });
            } else {
                 vizTaskSelect.innerHTML = '<option value="" disabled selected>Run Analysis First</option>';
            }
        }

        // Visualize Button Listener (FIXED: Uses rowData to reconstruct server's expected task name)
       visualizeButton.addEventListener("click", () => {
            const selectedTaskId = vizTaskSelect.value;
            const selectedTaskName = vizTaskSelect.options[vizTaskSelect.selectedIndex]?.text;
            const selectedChartType = vizChartSelect.value;
            const selectedChartTheme = vizThemeSelect.value;

            chartTitleElement.innerHTML = '';

            if (!selectedTaskId || !selectedChartType) {
                alert("Please select a task and chart type.");
                return;
            }

            chartArea.innerHTML = '<p>Loading chart...</p>';
            visualizeButton.disabled = true;

            if (fullAnalysisResults && fullAnalysisResults.individual_results) {
                const taskResult = fullAnalysisResults.individual_results.find(
                    result => String(result.task_id) === String(selectedTaskId)
                );

                if (!taskResult) {
                    chartArea.innerHTML = `<p class="text-danger">No result found for task.</p>`;
                    visualizeButton.disabled = false;
                    return;
                }

                if (taskResult.error) {
                    chartArea.innerHTML = `<p class="text-danger">Error: ${taskResult.error}</p>`;
                    visualizeButton.disabled = false;
                    return;
                }

                const selectedTaskContribution = taskResult.contribution_table || [];

                fetch('/graph_results_single', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task_id: selectedTaskId,
                        task_name: selectedTaskName,
                        process_contribution: selectedTaskContribution,
                        chart_type: selectedChartType,
                        theme: selectedChartTheme
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.chart_base64) {
                        chartArea.innerHTML = `<img id="chart-container" src="data:image/png;base64,${data.chart_base64}" alt="Chart"/>`;
                    } else {
                        chartArea.innerHTML = `<p class="text-danger">Chart generation failed.</p>`;
                    }
                })
                .catch(err => {
                    chartArea.innerHTML = `<p class="text-danger">Error generating chart.</p>`;
                    console.error(err);
                })
                .finally(() => visualizeButton.disabled = false);

            } else {
                chartArea.innerHTML = '<p class="text-danger">Please run the main analysis first.</p>';
                visualizeButton.disabled = false;
            }
        });


        // --- Run Analysis Button Listener ---
        runButton.addEventListener("click", () => {
            // 1. Initial UI setup/cleanup
            runButton.disabled = true;
            loadingSpinner.style.display = 'block';
            resultsContainer.style.display = 'none';
            document.getElementById('summary-section').innerHTML = '';
            comparisonTableAreaElement.innerHTML = '';
            chartArea.innerHTML = '<p class="text-muted text-center">Select a task, a chart type, and/or a theme, and click "Visualize" to see the chart.</p>';
            chartTitleElement.innerHTML = ''; // Clear chart title

            // 2. Data Collection and Validation
            const rows = [...document.querySelectorAll(".form-row")];
            
            // Populating the globally accessible rowData
            rowData = rows.map(row => { 
                const taskSelect = row.querySelector(`.${TASK_SELECT_CLASS}`);
                const flowSelect = row.querySelector(`.${FLOW_SELECT_CLASS}`);
                const numberInput = row.querySelector(`.${FUNCTIONAL_UNIT_CLASS}`);
                const unitSelect = row.querySelector(`.${UNIT_SELECT_CLASS}`);
                const impactCategorySelect = row.querySelector(`.${IMPACT_CATEGORY_SELECT_CLASS}`);

                // Collecting Displayed Text
                const taskText = taskSelect?.options[taskSelect.selectedIndex]?.text || null;
                const flowText = flowSelect?.options[flowSelect.selectedIndex]?.text || null;
                const unitText = unitSelect?.options[unitSelect.selectedIndex]?.text || null;

                return {
                    task: taskSelect?.value || null,
                    taskText: taskText,
                    flow: flowSelect?.value || null,
                    flowText: flowText,
                    functional_unit: numberInput?.value || null,
                    unit: unitSelect?.value || null,
                    unitText: unitText,
                    impact_category: impactCategorySelect?.value || null
                };
            });

            const isValid = rowData.every(row => row.task && row.flow && row.functional_unit && row.unit && row.impact_category);

            if (!isValid) {
                alert("Please select a Task, Flow, Functional unit value, and Unit for all rows before running the analysis.");
                loadingSpinner.style.display = 'none';
                runButton.disabled = false;
                return;
            }

            // Collect unique tasks for the visualization dropdown
            const uniqueTasks = new Map();
            rows.forEach(row => {
                const taskSelect = row.querySelector(`.${TASK_SELECT_CLASS}`);
                if (taskSelect.value) {
                    uniqueTasks.set(taskSelect.value, taskSelect.options[taskSelect.selectedIndex].text);
                }
            });
            visualizationTasks = Array.from(uniqueTasks, ([IDT, TName]) => ({ IDT, TName }));


            // 3. Fetch Request
            fetch("/graph_results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: rowData })
            })
            .then(res => {
                if (!res.ok) {
                    const status = res.status;
                    return res.text().then(text => {
                        throw new Error(`Server returned HTTP ${status}: ${text || 'Unknown Error'}`);
                    });
                }
                return res.json().catch(err => {
                    throw new Error(`Failed to parse server response as JSON. Check network response. (${err.message})`);
                });
            })
            .then(data => {
                // --- SUCCESS PATH ---

                if (data.error) {
                    alert(`Server Error: ${data.error}`);
                    console.error("Server Error:", data.error);
                    return; 
                }

                // CRITICAL: Store the successful full analysis data
                fullAnalysisResults = data;

                resultsContainer.style.display = 'block';
                const individualResults = data.individual_results || [];
                const combinedTableData = data.combined_contribution_table || [];

                // 4. Display Individual Results Summary (hidden by CSS)
                let summaryHtml = '';
                individualResults.forEach(result => {
                    try {
                        if (result.error) {
                            summaryHtml += `<div class="alert alert-danger mb-3"><strong>Error for ${result.task_name || 'Task'}:</strong> ${result.error}</div>`;
                            return;
                        }

                        const totalImpact = (typeof result.total_impact === 'number')
                            ? result.total_impact.toFixed(4)
                            : 'N/A';
                        const contributionTableHtml = result.contribution_table
                            ? buildTableFromData(result.contribution_table)
                            : '<p class="text-warning">No detailed contribution data.</p>';
                        
                        // NOTE: This entire section is hidden by the new CSS but remains for functional correctness
                        summaryHtml += `
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h5>Task: ${result.task_name} (${result.product})</h5>
                                </div>
                                <div class="card-body">
                                    <div class="alert alert-info">
                                        <strong>Total ${result.impact_category} Impact:</strong> ${totalImpact}
                                    </div>
                                    <h6>Process Contributions:</h6>
                                    <div class="table-responsive">
                                        ${contributionTableHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                    } catch (e) {
                        console.error("Client-Side Error processing individual result:", result, e);
                        summaryHtml += `<div class="alert alert-danger mb-3"><strong>Client-Side Error:</strong> Could not display result for ${result.task_name || 'Task'}. See console.</div>`;
                    }
                });

                document.getElementById('summary-section').innerHTML = summaryHtml || '<p class="text-warning">No successful analysis results were returned.</p>';


                // 5. Display Combined Comparison Table (Uses the modified function)
                comparisonTableAreaElement.innerHTML = buildComparisonTable(combinedTableData);


                // 6. Update the visualization task select
                populateVizTaskSelect();

                // Reset the chart area message
                chartArea.innerHTML = '<p class="text-muted text-center">Select a task, a chart type, and/or a theme, and click "Visualize" to see the chart.</p>';

            })
            .catch(err => {
                // --- ERROR PATH ---
                console.error("Analysis Fetch/Processing Error:", err);
                const summarySection = document.getElementById('summary-section');
                if (summarySection) {
                    summarySection.innerHTML = `<div class="alert alert-danger"><strong>Analysis Failed:</strong> ${err.message || 'Check the browser console for details.'}</div>`;
                    resultsContainer.style.display = 'block'; // Show results area to display error
                }
            })
            .finally(() => {
                // --- CRITICAL: Ensure UI is reset regardless of success or failure ---
                loadingSpinner.style.display = 'none';
                runButton.disabled = false;
            });
        });

        // Initialize the visualization task select
        populateVizTaskSelect();
    }

    // --- Initial Data Fetch ---

    Promise.all([
        fetch("/listtasks").then(res => res.json()),
        fetch("/get_all_uoms").then(res => res.json())
    ])
    .then(([taskResponse, uomResponse]) => {
        if (taskResponse.success && Array.isArray(taskResponse.tasks)) {
            taskData = taskResponse.tasks;
        } else {
            console.error("No task data found. Check the '/listtasks' endpoint.");
            taskData = [];
        }

        if (uomResponse.uoms) {
            uomData = uomResponse.uoms;
        } else {
            console.error("No UOM data found. Check the '/get_all_uoms' endpoint.");
            uomData = [];
        }

        generateMainForm();
    })
    .catch(err => {
        console.error("Error fetching essential data:", err);
        container.innerHTML = "<p class='text-danger'>Could not load essential data. Please ensure the backend is running and endpoints are correct.</p>";
    });
});