document.addEventListener("DOMContentLoaded", () => {
    const messageArea = document.getElementById("message-area");
    const formRowsContainer = document.getElementById("form-rows");
    const runButtonWrapper = document.querySelector(".run-button-wrapper");

    let clearButton = null;

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

    setupClearButton(); // Call immediately to create the clear button

    function generateFormRow() {
        const row = document.createElement("div");
        row.className = "form-row";

        row.innerHTML = `
            <div class="mode-input">
                <input type="text" class="mode-name" placeholder="Truck, diesel, ..."/>
            </div>
            <div class="status-indicator"></div> <div>
                <button class="icon-button delete-row">🗑️</button>
            </div>
        `;

        row.querySelector(".delete-row").addEventListener("click", () => {
            const confirmed = confirm("Are you sure you want to delete this row?");
            if (confirmed) {
                row.remove();
                if (formRowsContainer.children.length === 0) {
                    formRowsContainer.appendChild(generateFormRow());
                }
                hideMessage();
                hideClearButton();
            }
        });

        return row;
    }

    // Append one row initially
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

            const totData = [];
            const rows = document.querySelectorAll("#form-rows .form-row");

            rows.forEach(row => {
                const nameInput = row.querySelector(".mode-name");
                const name = nameInput.value.trim();
                const statusCell = row.querySelector(".status-indicator");

                const alreadyInserted = statusCell.textContent === "✅";

                if (name && !alreadyInserted) {
                    totData.push({ MTName: name, State: 1 }); // Assuming State 1 for new entries
                    statusCell.textContent = "";
                    statusCell.className = "status-indicator";
                }
            });

            if (totData.length === 0) {
                displayMessage("Please enter at least one *new* Transportation Mode.", false);
                return;
            }

            const confirmed = confirm(`Are you sure you want to register ${totData.length} new Transportation Mode(s)?`);
            if (!confirmed) return;

            fetch("/registertot", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(totData)
            })
            .then(response => response.json())
            .then(data => {
                const rows = document.querySelectorAll("#form-rows .form-row");

                if (data.success) {
                    rows.forEach(row => {
                        const nameInput = row.querySelector(".mode-name");
                        const statusCell = row.querySelector(".status-indicator");
                        const name = nameInput.value.trim();
                        const alreadyInserted = statusCell.textContent === "✅";

                        if (name && !alreadyInserted) {
                            statusCell.textContent = "✅";
                            statusCell.className = "status-indicator success";
                            nameInput.disabled = true; // Disable input on successful registration
                        }
                    });
                    displayMessage("New Transportation Mode(s) registered successfully.", true);
                    showClearButton();
                } else {
                    rows.forEach(row => {
                        const name = row.querySelector(".mode-name").value.trim();
                        const statusCell = row.querySelector(".status-indicator");

                        if (name && statusCell.textContent !== "✅") {
                            statusCell.textContent = "❌";
                            statusCell.className = "status-indicator error";
                        }
                    });
                    displayMessage("Error: " + (data.message || "Transportation Mode submission failed."), false);
                    hideClearButton();
                }
            })
            .catch(error => {
                console.error("Error:", error);
                const rows = document.querySelectorAll("#form-rows .form-row");
                rows.forEach(row => {
                    const name = row.querySelector(".mode-name").value.trim();
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