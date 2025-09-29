document.addEventListener("DOMContentLoaded", () => {
    // Select the message area directly from the DOM
    const messageArea = document.getElementById("message-area");
    const formRowsContainer = document.getElementById("form-rows");
    const runButtonWrapper = document.querySelector(".run-button-wrapper");

    let clearButton = null; // Declare clearButton here

    function setupClearButton() {
        if (!clearButton) {
            clearButton = document.createElement("button");
            clearButton.className = "run-button clear-form-button";
            clearButton.textContent = "Clear Form";
            clearButton.style.marginLeft = "10px";

            clearButton.addEventListener("click", () => {
                messageArea.style.display = "none";
                messageArea.textContent = "";
                messageArea.className = "message-area";

                formRowsContainer.innerHTML = ''; // Clear all rows
                formRowsContainer.appendChild(generateFormRow()); // Add one fresh row

                clearButton.style.display = 'none'; // Hide clear button after clearing
            });

            runButtonWrapper.appendChild(clearButton);
        }
        clearButton.style.display = 'none'; // Ensure it's hidden on initial load
    }

    // Call setupClearButton immediately to create it
    setupClearButton();

    function generateFormRow() {
        const row = document.createElement("div");
        row.className = "form-row";

        row.innerHTML = `
            <div class="unit-input">
                <input type="text" class="step-name" placeholder="Forest operation, Transportation, ..."/>
            </div>
            <div class="status-indicator"></div> <div>
                <button class="icon-button delete-row">🗑️</button>
            </div>
        `;

        // Add delete functionality
        row.querySelector(".delete-row").addEventListener("click", () => {
            const confirmed = confirm("Are you sure you want to delete this row?");
            if (confirmed) {
                row.remove();
                // If all rows are deleted, ensure at least one new row is present
                if (formRowsContainer.children.length === 0) {
                    formRowsContainer.appendChild(generateFormRow());
                }
                hideMessage(); // Hide messages when rows are manipulated
                hideClearButton(); // Hide clear button if user deletes a row
            }
        });

        return row;
    }

    // Append one row initially when the page loads
    // Ensure formRowsContainer is not null before appending
    if (formRowsContainer) {
        formRowsContainer.appendChild(generateFormRow());
    } else {
        console.error("Error: #form-rows not found in the DOM.");
        return; // Exit if critical element is missing
    }

    // Add event listener for the "Add Row" button
    const addRowButton = document.getElementById("add-row");
    if (addRowButton) {
        addRowButton.addEventListener("click", () => {
            formRowsContainer.appendChild(generateFormRow());
            hideMessage();
            hideClearButton(); // Hide clear button when adding a new row
        });
    } else {
        console.error("Error: #add-row button not found in the DOM.");
    }


    function displayMessage(message, isSuccess) {
        messageArea.textContent = message;
        messageArea.className = "message-area " + (isSuccess ? "success-message" : "error-message");
        messageArea.style.display = "block";
        setTimeout(() => {
            messageArea.style.display = "none";
            messageArea.textContent = "";
            messageArea.className = "message-area";
        }, 30000); // Message disappears after 30 seconds
    }

    function hideMessage() {
        messageArea.style.display = "none";
        messageArea.textContent = "";
        messageArea.className = "message-area";
    }

    function showClearButton() {
        if (clearButton) clearButton.style.display = 'inline-block';
    }

    function hideClearButton() {
        if (clearButton) clearButton.style.display = 'none';
    }

    const runButton = document.querySelector(".run-button");
    if (runButton) {
        runButton.addEventListener("click", () => {
            hideMessage();
            hideClearButton();

            const sopData = [];
            const rows = document.querySelectorAll("#form-rows .form-row");

            rows.forEach(row => {
                const nameInput = row.querySelector(".step-name");
                const name = nameInput.value.trim();
                const statusCell = row.querySelector(".status-indicator");

                const alreadyInserted = statusCell.textContent === "✅";

                // Only push data for rows that have a name and haven't been successfully inserted yet
                if (name && !alreadyInserted) {
                    sopData.push({ SName: name, State: 1 }); // Assuming default State 1 for new entries
                    statusCell.textContent = ""; // Clear previous ❌ if retrying
                    statusCell.className = "status-indicator"; // Reset class
                }
            });

            if (sopData.length === 0) {
                displayMessage("Please enter at least one *new* Step of Process.", false);
                return;
            }

            const confirmed = confirm(`Are you sure you want to register ${sopData.length} new Step(s) of Process?`);
            if (!confirmed) return;

            fetch("/registersop", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(sopData)
            })
            .then(response => response.json())
            .then(data => {
                const rows = document.querySelectorAll("#form-rows .form-row");

                if (data.success) {
                    rows.forEach(row => {
                        const nameInput = row.querySelector(".step-name");
                        const statusCell = row.querySelector(".status-indicator");

                        const name = nameInput.value.trim();
                        const alreadyInserted = statusCell.textContent === "✅";

                        // If a row has a name and hasn't been successfully inserted, mark it as success
                        if (name && !alreadyInserted) {
                            statusCell.textContent = "✅";
                            statusCell.className = "status-indicator success";
                            nameInput.disabled = true;
                        }
                    });
                    displayMessage("New Steps of Process registered successfully.", true);
                    showClearButton();
                } else {
                    rows.forEach(row => {
                        const name = row.querySelector(".step-name").value.trim();
                        const statusCell = row.querySelector(".status-indicator");

                        // If the row has data and wasn't already marked successful, mark it as error
                        if (name && statusCell.textContent !== "✅") {
                            statusCell.textContent = "❌";
                            statusCell.className = "status-indicator error";
                        }
                    });
                    displayMessage("Error: " + (data.message || "Step of Process submission failed."), false);
                    hideClearButton();
                }
            })
            .catch(error => {
                console.error("Error:", error);
                const rows = document.querySelectorAll("#form-rows .form-row");
                rows.forEach(row => {
                    const name = row.querySelector(".step-name").value.trim();
                    const statusCell = row.querySelector(".status-indicator");

                    if (name && statusCell.textContent !== "✅") {
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