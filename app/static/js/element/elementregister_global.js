document.addEventListener("DOMContentLoaded", () => {

    const formRowsContainer = document.getElementById("form-rows");
    const addRowButton = document.getElementById("add-row");
    const runButton = document.querySelector(".run-button");
    const messageArea = document.getElementById("message-area");
    let clearButton = null;

    function setupClearButton(){

        if(!clearButton){

            clearButton = document.createElement("button");
            clearButton.textContent = "Clear";
            clearButton.className = "clear-form-button";
            clearButton.style.marginLeft = "10px";

            clearButton.addEventListener("click", () => {

                // Reset rows
                formRowsContainer.innerHTML = "";
                formRowsContainer.appendChild(generateRow());

                // Clear message area
                messageArea.textContent = "";
                messageArea.className = "message-area";
                messageArea.style.display = "none";

                // Hide clear button again
                clearButton.style.display = "none";
            });

            runButton.parentElement.appendChild(clearButton);
        }

        clearButton.style.display = "none";
    }

    setupClearButton();

    function showClearButton(){
        if(clearButton) clearButton.style.display = "inline-block";
    }

    function hideClearButton(){
        if(clearButton) clearButton.style.display = "none";
    }

    function showMessage(msg, success=true){
        messageArea.textContent = msg;
        messageArea.className = "message-area " + (success ? "success-message":"error-message");
        messageArea.style.display = "block";
    }

    function generateRow(){

        const row = document.createElement("div");
        row.className = "form-row";

        row.innerHTML = `
            <div>
                <input type="text" class="element-name" placeholder="Element name">
            </div>

            <div>
                <select class="element-type">
                    <option value="">Select type</option>
                    ${window.itemOptions}
                </select>
            </div>

            <div class="status-indicator"></div>

            <div>
                <button class="icon-button delete-row">🗑️</button>
            </div>
        `;

        row.querySelector(".delete-row").addEventListener("click", () => {
            row.remove();
        });

        return row;
    }

    // ---------- INIT ----------
    formRowsContainer.appendChild(generateRow());

    addRowButton.addEventListener("click", ()=>{
        formRowsContainer.appendChild(generateRow());

        messageArea.textContent = "";
        messageArea.style.display = "none";
    });

    // ---------- REGISTER ----------
    runButton.addEventListener("click", async ()=>{

        const rows = document.querySelectorAll(".form-row");
        const elements = [];

        rows.forEach(row => {

            const nameInput = row.querySelector(".element-name");
            const typeSelect = row.querySelector(".element-type");
            const statusCell = row.querySelector(".status-indicator");

            const name = nameInput.value.trim();
            const idi = typeSelect.value;

            const alreadyInserted = statusCell.textContent === "✅";

            if(name && idi && !alreadyInserted){

                const iname = typeSelect.options[typeSelect.selectedIndex].text;

                elements.push({
                    EName: name,
                    IDI: idi,
                    IName: iname
                });

                statusCell.textContent = "";
            }
        });

        if(elements.length === 0){
            showMessage("Please enter at least one element.", false);
            return;
        }

        // ✅ Confirmation dialog
        const confirmed = confirm(
            `Are you sure you want to register ${elements.length} element(s)?`
        );

        if(!confirmed) return;

        try{

            const response = await fetch("/registerelement_global",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({elements})
            });

            const data = await response.json();

            if(data.success){

                rows.forEach(row => {

                    const nameInput = row.querySelector(".element-name");
                    const typeSelect = row.querySelector(".element-type");
                    const statusCell = row.querySelector(".status-indicator");

                    const name = nameInput.value.trim();
                    const idi = typeSelect.value;

                    if(name && idi && statusCell.textContent !== "✅"){

                        statusCell.textContent = "✅";
                        statusCell.classList.add("success");

                        nameInput.disabled = true;
                        typeSelect.disabled = true;
                    }

                });

                showMessage(data.message, true);
                showClearButton();
            }else{
                showMessage(data.message,false);
            }

        }catch(e){
            showMessage("Server error",false);
        }

    });

});