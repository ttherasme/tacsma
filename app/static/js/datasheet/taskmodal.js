document.addEventListener("DOMContentLoaded", () => {

  const popup = document.getElementById("taskPopup");
  const popupRows = document.getElementById("popup-form-rows");
  const popupMessage = document.getElementById("popup-message-area");
  const taskList = document.getElementById("taskList");

  const openPopupBtn = document.querySelector(".task-button");
  const closePopupBtn = popup.querySelector(".close-popup");

  const addRowBtn = document.getElementById("popup-add-row");
  const registerBtn = document.getElementById("popup-register");
  const clearBtn = document.getElementById("popup-clear");

  /* ------------------ ROW CREATION ------------------ */
  function createRow() {
    const row = document.createElement("div");
    row.className = "form-row";

    row.innerHTML = `
      <div><input type="text" class="task-name" placeholder="Task name"></div>
      <div>
        <select class="task-region">
          <option value="">Select</option>
          <option value="Zone 1">Zone 1</option>
          <option value="Zone 2">Zone 2</option>
        </select>
      </div>
      <div><input type="text" class="task-detail" placeholder="Optional detail"></div>
      <div class="status-indicator"></div>
      <div><button class="icon-button delete-row">🗑️</button></div>
    `;

    row.querySelector(".delete-row").addEventListener("click", () => {
      if (confirm("Delete this row?")) row.remove();
    });

    return row;
  }

  /* ------------------ POPUP CONTROL ------------------ */
  function openPopup() {
    popupRows.innerHTML = "";
    popupRows.appendChild(createRow());
    popupMessage.style.display = "none";
    popup.style.display = "block";
  }

  function closePopup() {
    popup.style.display = "none";
    refreshTaskDatalist();
  }

  openPopupBtn.addEventListener("click", openPopup);
  closePopupBtn.addEventListener("click", closePopup);

  window.addEventListener("click", e => {
    if (e.target === popup) closePopup();
  });

  /* ------------------ ADD / CLEAR ROWS ------------------ */
  addRowBtn.addEventListener("click", () => {
    popupRows.appendChild(createRow());
  });

  clearBtn.addEventListener("click", () => {
    popupRows.innerHTML = "";
    popupRows.appendChild(createRow());
    popupMessage.style.display = "none";
  });

  /* ------------------ REGISTER TASKS ------------------ */
  registerBtn.addEventListener("click", async () => {
    const rows = popupRows.querySelectorAll(".form-row");
    const payload = [];

    rows.forEach(row => {
      const name = row.querySelector(".task-name").value.trim();
      const region = row.querySelector(".task-region").value;
      const detail = row.querySelector(".task-detail").value.trim();
      const status = row.querySelector(".status-indicator");

      if (name && status.textContent !== "✅") {
        payload.push({ TName: name, Region: region, Description: detail });
        status.textContent = "";
      }
    });

    if (!payload.length) {
      showPopupMessage("Please enter at least one new task.", false);
      return;
    }

    if (!confirm(`Register ${payload.length} task(s)?`)) return;

    try {
      const res = await fetch("/registertask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        rows.forEach(row => {
          const status = row.querySelector(".status-indicator");
          const name = row.querySelector(".task-name").value.trim();
          if (name) status.textContent = "✅";
        });

        showPopupMessage("Tasks registered successfully.", true);
        setTimeout(closePopup, 800);
      } else {
        showPopupMessage(data.message || "Registration failed.", false);
      }
    } catch (err) {
      console.error(err);
      showPopupMessage("Unexpected error.", false);
    }
  });

  /* ------------------ HELPERS ------------------ */
  function showPopupMessage(msg, success) {
    popupMessage.textContent = msg;
    popupMessage.className = "message-area " + (success ? "success-message" : "error-message");
    popupMessage.style.display = "block";
  }

  function refreshTaskDatalist() {
    fetch("/listtasks_with_out_datasheet")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          taskList.innerHTML = "";
          data.tasks.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.TName;
            opt.dataset.id = t.IDT;
            taskList.appendChild(opt);
          });
        }
      });
  }
});
