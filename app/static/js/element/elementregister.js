document.addEventListener("DOMContentLoaded", () => {
    const messageArea = document.getElementById("message-area");
    const formRowsContainer = document.getElementById("form-rows");
    const runButtonWrapper = document.querySelector(".run-button-wrapper");
    const elementname = document.getElementById("element-name-hidden").value;

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
                formRowsContainer.innerHTML = '';
                formRowsContainer.appendChild(generateFormRow());
                hideClearButton();
            });

            runButtonWrapper.appendChild(clearButton);
        }

        clearButton.style.display = 'none';
    }

    setupClearButton();

    function generateFormRow() {
        const row = document.createElement("div");
        row.className = "form-row";

        row.innerHTML = `
            <div class="unit-input">
                <input type="text" class="element-name" placeholder="Name of the new ${elementname}..."/>
            </div>
            <div class="status-indicator"></div> 
            <div>
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

    if (formRowsContainer) {
        formRowsContainer.appendChild(generateFormRow());
    } else {
        console.error("Error: #form-rows not found in the DOM.");
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
        }, 30000);
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

            const elementsData = [];
            const rows = document.querySelectorAll("#form-rows .form-row");

            rows.forEach(row => {
                const nameInput = row.querySelector(".element-name");
                const name = nameInput.value.trim();
                const statusCell = row.querySelector(".status-indicator");
                const alreadyInserted = statusCell.textContent === "✅";

                if (name && !alreadyInserted) {
                    elementsData.push({ EName: name });
                    statusCell.textContent = "";
                    statusCell.className = "status-indicator";
                }
            });

            if (elementsData.length === 0) {
                displayMessage(`Please enter at least one new ${elementname}.`, false);
                return;
            }

            const confirmed = confirm(`Are you sure you want to register ${elementsData.length} new ${elementname}(s)?`);
            if (!confirmed) return;
            
            // Get the elementname from the URL via the hidden input
            const elementnameForUrl = document.getElementById("element-name-hidden").value;

            fetch("/register_element_post", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    elements: elementsData,
                    elementname: elementnameForUrl
                })
            })
            .then(response => response.json())
            .then(data => {
                const rows = document.querySelectorAll("#form-rows .form-row");

                if (data.success) {
                    let newlyAddedCount = 0;
                    rows.forEach(row => {
                        const nameInput = row.querySelector(".element-name");
                        const statusCell = row.querySelector(".status-indicator");
                        const name = nameInput.value.trim();
                        const alreadyInserted = statusCell.textContent === "✅";
                        
                        if (name && !alreadyInserted) {
                            statusCell.textContent = "✅";
                            statusCell.className = "status-indicator success";
                            nameInput.disabled = true;
                            newlyAddedCount++;
                        }
                    });
                    displayMessage(`Successfully registered ${newlyAddedCount} new ${elementname}(s).`, true);
                    showClearButton();
                } else {
                    rows.forEach(row => {
                        const statusCell = row.querySelector(".status-indicator");
                        if (statusCell.textContent !== "✅") {
                            statusCell.textContent = "❌";
                            statusCell.className = "status-indicator error";
                        }
                    });
                    displayMessage("Error: " + (data.message || "Element submission failed."), false);
                    hideClearButton();
                }
            })
            .catch(error => {
                console.error("Error:", error);
                displayMessage("An unexpected error occurred.", false);
                hideClearButton();
            });
        });
    } else {
        console.error("Error: .run-button not found in the DOM.");
    }
});