document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("dynamic-content");
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

        formRowsContainer.innerHTML = '';
        formRowsContainer.appendChild(generateFormRow());

        clearButton.style.display = 'none';
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
        <input type="text" class="task-name" placeholder="Task name" />
      </div>
      <div>
        <input type="text" class="task-detail" placeholder="Optional detail" />
      </div>
      <div class="status-indicator"></div>
      <div>
        <button class="icon-button delete-row">🗑️</button>
      </div>
    `;

    row.querySelector(".delete-row").addEventListener("click", () => {
      const confirmed = confirm("Are you sure you want to delete this row?");
      if (confirmed) row.remove();
    });

    return row;
  }

  formRowsContainer.appendChild(generateFormRow());

  document.getElementById("add-row").addEventListener("click", () => {
    formRowsContainer.appendChild(generateFormRow());
    hideMessage();
    hideClearButton();
  });

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

  document.querySelector(".run-button").addEventListener("click", () => {
    hideMessage();
    hideClearButton();

    const taskData = [];
    const rows = document.querySelectorAll(".form-row");

    rows.forEach(row => {
      const nameInput = row.querySelector(".task-name");
      const detailInput = row.querySelector(".task-detail");
      const name = nameInput.value.trim();
      const detail = detailInput.value.trim();
      const statusCell = row.querySelector(".status-indicator");

      const alreadyInserted = statusCell.textContent === "✅";

      if (name && !alreadyInserted) {
        taskData.push({ TName: name, Description: detail });
        statusCell.textContent = ""; // Clear previous ❌ if retrying
        statusCell.className = "status-indicator";
      }
    });

    if (taskData.length === 0) {
      displayMessage("Please enter at least one *new* task.", false);
      return;
    }

    const confirmed = confirm(`Are you sure you want to register ${taskData.length} new task(s)?`);
    if (!confirmed) return;

    fetch("/registertask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(taskData)
    })
    .then(response => response.json())
    .then(data => {
      const rows = document.querySelectorAll(".form-row");

      if (data.success) {
        rows.forEach(row => {
          const nameInput = row.querySelector(".task-name");
          const detailInput = row.querySelector(".task-detail");
          const statusCell = row.querySelector(".status-indicator");

          const name = nameInput.value.trim();
          const alreadyInserted = statusCell.textContent === "✅";

          if (name && !alreadyInserted) {
            statusCell.textContent = "✅";
            statusCell.className = "status-indicator success";

            nameInput.disabled = true;
            detailInput.disabled = true;
          }
        });

        displayMessage("New tasks registered successfully.", true);
        showClearButton();
      } else {
        rows.forEach(row => {
          const name = row.querySelector(".task-name").value.trim();
          const statusCell = row.querySelector(".status-indicator");

          if (name && statusCell.textContent !== "✅") {
            statusCell.textContent = "❌";
            statusCell.className = "status-indicator error";
          }
        });

        displayMessage("Error: " + (data.message || "Task submission failed."), false);
        hideClearButton();
      }
    })
    .catch(error => {
      console.error("Error:", error);

      rows.forEach(row => {
        const name = row.querySelector(".task-name").value.trim();
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
});
