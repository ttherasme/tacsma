// static/js/datasheet/elementmodal.js

// Cette fonction sera appelée depuis datasheet.js
function showElementRegistrationModal(elementname) {
    const modal = document.getElementById("elementModal");
    const modalBody = document.getElementById("modal-body");
    const closeButton = modal.querySelector(".close-button");

    modalBody.innerHTML = 'Loading form...';
    modal.style.display = "block";

    // Fetch the element registration page content
    fetch(`/registerelement/${elementname}`)
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const contentContainer = doc.querySelector('.page-content');

            // Find elements to rename to avoid conflicts
            const formHeaderTop = contentContainer.querySelector('.form-header-top');
            const formActionsTop = contentContainer.querySelector('.form-actions-top');
            const runButtonWrapper = contentContainer.querySelector('.run-button-wrapper');
            const runButton = contentContainer.querySelector('.run-button');
            const formHeader = contentContainer.querySelector('.form-header');
            const formRows = contentContainer.querySelector('#form-rows');
            
            if (formHeaderTop) formHeaderTop.className = 'modal-form-header-top';
            if (formActionsTop) formActionsTop.className = 'modal-form-actions-top';
            if (runButtonWrapper) runButtonWrapper.className = 'modal-run-button-wrapper';
            if (runButton) runButton.className = 'modal-run-button modal-action-button';
            if (formHeader) formHeader.className = 'modal-form-header modal-form-row';

            modalBody.innerHTML = contentContainer.innerHTML;
            modalBody.querySelector('h1').textContent = `Register ${elementname}`;

            const formRowsContainer = modalBody.querySelector("#form-rows");
            const addRowButton = modalBody.querySelector("#add-row");
            const runButtonInModal = modalBody.querySelector(".modal-run-button");
            const messageArea = modalBody.querySelector("#message-area");

            function generateFormRow() {
                const row = document.createElement("div");
                row.className = "modal-form-row";
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
                    row.remove();
                    if (formRowsContainer.children.length === 0) {
                        formRowsContainer.appendChild(generateFormRow());
                    }
                });
                return row;
            }

            formRowsContainer.appendChild(generateFormRow());

            if (addRowButton) {
                addRowButton.addEventListener("click", () => {
                    formRowsContainer.appendChild(generateFormRow());
                });
            }

            if (runButtonInModal) {
                runButtonInModal.addEventListener("click", () => {
                    const elementsData = [];
                    const rows = formRowsContainer.querySelectorAll(".modal-form-row");
                    rows.forEach(row => {
                        const nameInput = row.querySelector(".element-name");
                        const name = nameInput.value.trim();
                        if (name) {
                            elementsData.push({ EName: name });
                        }
                    });

                    if (elementsData.length === 0) {
                        messageArea.textContent = `Please enter at least one new ${elementname}.`;
                        messageArea.className = "message-area error-message";
                        messageArea.style.display = 'block';
                        return;
                    }

                    fetch("/register_element_post", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            elements: elementsData,
                            elementname: elementname
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            messageArea.textContent = `Successfully registered ${data.message.split(' ')[0]} new ${elementname}(s).`;
                            messageArea.className = "message-area success-message";
                            messageArea.style.display = 'block';
                            // MODIFICATION: Appeler la nouvelle fonction de rechargement
                            updateDropdownAfterRegistration(elementname);
                            formRowsContainer.innerHTML = '';
                            formRowsContainer.appendChild(generateFormRow());
                        } else {
                            messageArea.textContent = `Error: ${data.message}`;
                            messageArea.className = "message-area error-message";
                            messageArea.style.display = 'block';
                        }
                    })
                    .catch(error => {
                        console.error("Error:", error);
                        messageArea.textContent = "An unexpected error occurred.";
                        messageArea.className = "message-area error-message";
                        messageArea.style.display = 'block';
                    });
                });
            }
        })
        .catch(error => {
            console.error("Error loading modal content:", error);
            modalBody.innerHTML = "Error loading form. Please try again.";
        });

    closeButton.onclick = () => {
        modal.style.display = "none";
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}

// MODIFICATION: Mettre à jour la fonction pour déclencher le bon événement
function updateDropdownAfterRegistration(elementname) {
    if (elementname.toLowerCase() === "product") {
        document.dispatchEvent(new Event('reloadProductSelect'));
    } else if (elementname.toLowerCase().includes("input")) {
        document.dispatchEvent(new Event('reloadMaterielSelect'));
    } else if (elementname.toLowerCase().includes("co-products")) {
        document.dispatchEvent(new Event('reloadCoproductSelect'));
    }
}