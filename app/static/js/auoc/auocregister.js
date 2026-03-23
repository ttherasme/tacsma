document.addEventListener("DOMContentLoaded", () => {
    const messageArea = document.getElementById("message-area");
    const formRowsContainer = document.getElementById("form-rows");
    const runButtonWrapper = document.querySelector(".run-button-wrapper");

    let clearButton = null;

    async function loadCanonicalUnits(selectElement) {
        try {
            const response = await fetch("/list_uocs/1");
            const data = await response.json();

            // Clear existing options except first
            selectElement.innerHTML = `<option value="">Select unit...</option>`;

            data.forEach(uoc => {
                const option = document.createElement("option");
                option.value = uoc.Unit;   // IMPORTANT: matches backend (canonical_unit = unit_name)
                option.textContent = uoc.Unit;
                selectElement.appendChild(option);
            });

        } catch (error) {
            console.error("Error loading units:", error);
        }
    }

    function setupClearButton() {
        if (!clearButton) {
            clearButton = document.createElement("button");
            clearButton.className = "run-button clear-form-button";
            clearButton.textContent = "Clear Form";
            clearButton.type = "button";
            clearButton.style.marginLeft = "10px";

            clearButton.addEventListener("click", () => {
                hideMessage();
                formRowsContainer.innerHTML = "";
                formRowsContainer.appendChild(generateFormRow());
                clearButton.style.display = "none";
            });

            runButtonWrapper.appendChild(clearButton);
        }

        clearButton.style.display = "none";
    }

    setupClearButton();

    function generateFormRow() {
        const row = document.createElement("div");
        row.className = "form-row";

        row.innerHTML = `
            <div class="unit-input">
                <input type="text" class="auoc-alias" placeholder="lb, kilo, metre, ..." />
            </div>
            <div class="unit-input">
                <select class="auoc-canonical-unit">
                    <option value="">Select unit...</option>
                </select>
            </div>
            <div class="status-indicator"></div>
            <div>
                <button class="icon-button delete-row" type="button">🗑️</button>
            </div>
        `;

        const select = row.querySelector(".auoc-canonical-unit");
        loadCanonicalUnits(select);

        row.querySelector(".delete-row").addEventListener("click", () => {
            const confirmed = confirm("Are you sure you want to delete this row?");
            if (!confirmed) return;

            row.remove();

            if (formRowsContainer.children.length === 0) {
                formRowsContainer.appendChild(generateFormRow());
            }

            hideMessage();
            hideClearButton();
        });

        return row;
    }

    if (formRowsContainer) {
        formRowsContainer.appendChild(generateFormRow());
    } else {
        console.error("Error: #form-rows not found in the DOM.");
        return;
    }

    const addRowButton = document.getElementById("add-row");
    if (addRowButton) {
        addRowButton.addEventListener("click", () => {
            formRowsContainer.appendChild(generateFormRow());
            hideMessage();
            hideClearButton();
        });
    } else {
        console.error("Error: #add-row button not found in the DOM.");
    }

    function displayMessage(message, isSuccess) {
        messageArea.textContent = message;
        messageArea.className = "message-area " + (isSuccess ? "success-message" : "error-message");
        messageArea.style.display = "block";

        setTimeout(() => {
            hideMessage();
        }, 30000);
    }

    function hideMessage() {
        messageArea.style.display = "none";
        messageArea.textContent = "";
        messageArea.className = "message-area";
    }

    function showClearButton() {
        if (clearButton) clearButton.style.display = "inline-block";
    }

    function hideClearButton() {
        if (clearButton) clearButton.style.display = "none";
    }

    const runButton = document.querySelector(".run-button");
    if (runButton) {
        runButton.addEventListener("click", () => {
            hideMessage();
            hideClearButton();

            const auocData = [];
            const rows = document.querySelectorAll("#form-rows .form-row");

            rows.forEach(row => {
                const aliasInput = row.querySelector(".auoc-alias");
                const canonicalUnitInput = row.querySelector(".auoc-canonical-unit");
                const statusCell = row.querySelector(".status-indicator");

                const alias = aliasInput.value.trim();
                const canonicalUnit = canonicalUnitInput.value.trim();
                const alreadyInserted = statusCell.textContent === "✅";

                if (alias && canonicalUnit && !alreadyInserted) {
                    auocData.push({
                        UAlias: alias,
                        CanonicalUnit: canonicalUnit,
                        State: 1
                    });

                    statusCell.textContent = "";
                    statusCell.className = "status-indicator";
                }
            });

            if (auocData.length === 0) {
                displayMessage("Please enter at least one new Unit Alias.", false);
                return;
            }

            const confirmed = confirm(`Are you sure you want to register ${auocData.length} new Unit Alias(es)?`);
            if (!confirmed) return;

            fetch("/registerauoc", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(auocData)
            })
                .then(response => response.json())
                .then(data => {
                    const rows = document.querySelectorAll("#form-rows .form-row");

                    if (data.success) {
                        rows.forEach(row => {
                            const aliasInput = row.querySelector(".auoc-alias");
                            const canonicalUnitInput = row.querySelector(".auoc-canonical-unit");
                            const statusCell = row.querySelector(".status-indicator");

                            const alias = aliasInput.value.trim();
                            const canonicalUnit = canonicalUnitInput.value.trim();
                            const alreadyInserted = statusCell.textContent === "✅";

                            if (alias && canonicalUnit && !alreadyInserted) {
                                statusCell.textContent = "✅";
                                statusCell.className = "status-indicator success";
                                aliasInput.disabled = true;
                                canonicalUnitInput.disabled = true;
                            }
                        });

                        displayMessage("New Unit Aliases registered successfully.", true);
                        showClearButton();
                    } else {
                        rows.forEach(row => {
                            const alias = row.querySelector(".auoc-alias").value.trim();
                            const canonicalUnit = row.querySelector(".auoc-canonical-unit").value.trim();
                            const statusCell = row.querySelector(".status-indicator");

                            if (alias && canonicalUnit && statusCell.textContent !== "✅") {
                                statusCell.textContent = "❌";
                                statusCell.className = "status-indicator error";
                            }
                        });

                        displayMessage("Error: " + (data.message || "Unit Alias submission failed."), false);
                        hideClearButton();
                    }
                })
                .catch(error => {
                    console.error("Error:", error);

                    const rows = document.querySelectorAll("#form-rows .form-row");
                    rows.forEach(row => {
                        const alias = row.querySelector(".auoc-alias").value.trim();
                        const canonicalUnit = row.querySelector(".auoc-canonical-unit").value.trim();
                        const statusCell = row.querySelector(".status-indicator");

                        if (alias && canonicalUnit && statusCell.textContent !== "✅") {
                            statusCell.textContent = "❌";
                            statusCell.className = "status-indicator error";
                        }
                    });

                    displayMessage("Unexpected error occurred.", false);
                    hideClearButton();
                });
        });
    } else {
        console.error("Error: .run-button not found in the DOM.");
    }
});