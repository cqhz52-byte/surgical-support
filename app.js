const APP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};

const MASTER_DATA = {
  hospitals: [
    { id: "h1", name: "北京协和医院", region: "华北", level: "三甲" },
    { id: "h2", name: "上海瑞金医院", region: "华东", level: "三甲" },
    { id: "h3", name: "广州南方医院", region: "华南", level: "三甲" }
  ],
  devices: [
    {
      id: "d1",
      modelName: "US-Pro",
      category: "超声刀",
      parameters: [
        { key: "power_w", label: "输出功率(W)", type: "number", min: 1, max: 300, step: 1 },
        { key: "pressure_kpa", label: "吸引压力(kPa)", type: "number", min: 1, max: 120, step: 1 },
        { key: "duration_min", label: "使用时长(min)", type: "number", min: 1, max: 360, step: 1 }
      ]
    },
    {
      id: "d2",
      modelName: "Endocam-X2",
      category: "内窥镜系统",
      parameters: [
        { key: "light_intensity", label: "光源强度(%)", type: "number", min: 1, max: 100, step: 1 },
        { key: "pressure_kpa", label: "气腹压力(kPa)", type: "number", min: 1, max: 40, step: 1 },
        { key: "duration_min", label: "使用时长(min)", type: "number", min: 1, max: 360, step: 1 }
      ]
    }
  ]
};

const STATE = {
  currentStep: 1,
  db: null,
  pendingCases: [],
  submittedCases: [],
  selectedFiles: [],
  supabaseClient: null
};

const ELS = {
  dashboardView: document.getElementById("dashboardView"),
  caseFormView: document.getElementById("caseFormView"),
  newCaseFab: document.getElementById("newCaseFab"),
  backBtn: document.getElementById("backBtn"),
  nextStepBtn: document.getElementById("nextStepBtn"),
  prevStepBtn: document.getElementById("prevStepBtn"),
  submitBtn: document.getElementById("submitBtn"),
  caseForm: document.getElementById("caseForm"),
  hospitalOptions: document.getElementById("hospitalOptions"),
  deviceModel: document.getElementById("deviceModel"),
  dynamicParameters: document.getElementById("dynamicParameters"),
  addConsumableBtn: document.getElementById("addConsumableBtn"),
  consumableList: document.getElementById("consumableList"),
  mediaInput: document.getElementById("mediaInput"),
  mediaPreview: document.getElementById("mediaPreview"),
  recentCaseList: document.getElementById("recentCaseList"),
  statToday: document.getElementById("statToday"),
  statMonth: document.getElementById("statMonth"),
  statPending: document.getElementById("statPending"),
  syncBtn: document.getElementById("syncBtn")
};

document.addEventListener("DOMContentLoaded", async () => {
  renderHospitals();
  renderDevices();
  renderDynamicParameters();
  addConsumableRow();

  initSupabase();
  registerPWA();

  STATE.db = await openDB();
  await refreshLocalData();
  updateDashboard();
  bindEvents();
});

function bindEvents() {
  ELS.newCaseFab.addEventListener("click", () => showView("form"));
  ELS.backBtn.addEventListener("click", () => showView("dashboard"));
  ELS.nextStepBtn.addEventListener("click", handleNextStep);
  ELS.prevStepBtn.addEventListener("click", handlePrevStep);
  ELS.caseForm.addEventListener("submit", submitCase);
  ELS.deviceModel.addEventListener("change", renderDynamicParameters);
  ELS.addConsumableBtn.addEventListener("click", addConsumableRow);
  ELS.mediaInput.addEventListener("change", handleMediaPreview);
  ELS.syncBtn.addEventListener("click", syncPendingCases);
  window.addEventListener("online", syncPendingCases);
}

function showView(target) {
  const isForm = target === "form";
  ELS.dashboardView.classList.toggle("is-active", !isForm);
  ELS.caseFormView.classList.toggle("is-active", isForm);
  ELS.newCaseFab.classList.toggle("is-hidden", isForm);
}

function renderHospitals() {
  ELS.hospitalOptions.innerHTML = MASTER_DATA.hospitals
    .map((h) => `<option value="${h.name}">${h.region} ${h.level}</option>`)
    .join("");
}

function renderDevices() {
  ELS.deviceModel.innerHTML = MASTER_DATA.devices
    .map((d) => `<option value="${d.id}">${d.modelName} (${d.category})</option>`)
    .join("");
}

function renderDynamicParameters() {
  const selected = MASTER_DATA.devices.find((d) => d.id === ELS.deviceModel.value) || MASTER_DATA.devices[0];
  ELS.dynamicParameters.innerHTML = selected.parameters
    .map(
      (p) => `
      <label class="field-label" for="${p.key}">${p.label}</label>
      <input id="${p.key}" class="field" type="${p.type}" min="${p.min}" max="${p.max}" step="${p.step}">
    `
    )
    .join("");
}

function handleNextStep() {
  if (!validateStep(STATE.currentStep)) {
    return;
  }
  STATE.currentStep = Math.min(4, STATE.currentStep + 1);
  paintStep();
}

function handlePrevStep() {
  STATE.currentStep = Math.max(1, STATE.currentStep - 1);
  paintStep();
}

function validateStep(step) {
  if (step !== 1) {
    return true;
  }
  const hospital = document.getElementById("hospitalSearch").value.trim();
  const doctor = document.getElementById("doctorName").value.trim();
  if (!hospital || !doctor) {
    alert("请先完成基础信息：医院和手术医生。");
    return false;
  }
  return true;
}

function paintStep() {
  document.querySelectorAll(".step").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.step) === STATE.currentStep);
  });
  document.querySelectorAll(".form-step").forEach((node) => {
    node.classList.toggle("is-active", Number(node.dataset.step) === STATE.currentStep);
  });

  ELS.prevStepBtn.classList.toggle("is-hidden", STATE.currentStep === 1);
  ELS.nextStepBtn.classList.toggle("is-hidden", STATE.currentStep === 4);
  ELS.submitBtn.classList.toggle("is-hidden", STATE.currentStep !== 4);
}

function addConsumableRow() {
  const row = document.createElement("div");
  row.className = "consumable-row";
  row.innerHTML = `
    <div class="consumable-grid">
      <input class="field consumable-name" placeholder="耗材名称">
      <input class="field consumable-qty" type="number" min="1" step="1" placeholder="数量">
    </div>
    <div class="scan-wrap">
      <input class="field consumable-batch" placeholder="批号">
      <button type="button" class="mini-btn scan-btn">扫码批号</button>
    </div>
  `;
  row.querySelector(".scan-btn").addEventListener("click", () => runBarcodeScan(row));
  ELS.consumableList.appendChild(row);
}

async function runBarcodeScan(row) {
  const batchInput = row.querySelector(".consumable-batch");
  if ("BarcodeDetector" in window) {
    try {
      const detector = new BarcodeDetector({ formats: ["code_128", "ean_13", "qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const result = await detector.detect(video);
      stream.getTracks().forEach((track) => track.stop());
      if (result.length > 0) {
        batchInput.value = result[0].rawValue;
        return;
      }
    } catch (error) {
      console.warn("Barcode scan failed:", error);
    }
  }
  const manual = prompt("当前设备不支持自动扫码，请手动输入耗材批号：");
  if (manual) {
    batchInput.value = manual.trim();
  }
}

function handleMediaPreview(event) {
  STATE.selectedFiles = Array.from(event.target.files || []);
  if (STATE.selectedFiles.length === 0) {
    ELS.mediaPreview.textContent = "暂无文件";
    return;
  }
  ELS.mediaPreview.innerHTML = STATE.selectedFiles
    .map((file) => `<span class="media-chip">${file.name}</span>`)
    .join("");
}

function buildCasePayload() {
  const selectedDevice = MASTER_DATA.devices.find((d) => d.id === ELS.deviceModel.value) || MASTER_DATA.devices[0];
  const parameters = {};
  selectedDevice.parameters.forEach((p) => {
    const value = document.getElementById(p.key)?.value;
    parameters[p.key] = value === "" ? null : Number(value);
  });

  const consumables = Array.from(document.querySelectorAll(".consumable-row"))
    .map((row) => ({
      item_name: row.querySelector(".consumable-name")?.value?.trim() || "",
      quantity: Number(row.querySelector(".consumable-qty")?.value || 0),
      batch_no: row.querySelector(".consumable-batch")?.value?.trim() || ""
    }))
    .filter((item) => item.item_name);

  return {
    local_id: crypto.randomUUID(),
    date: new Date().toISOString(),
    hospital_name: document.getElementById("hospitalSearch").value.trim(),
    doctor_name: document.getElementById("doctorName").value.trim(),
    surgery_type: document.getElementById("surgeryType").value.trim(),
    device_id: selectedDevice.id,
    device_model_name: selectedDevice.modelName,
    status: "进行中",
    is_abnormal: document.getElementById("isAbnormal").checked,
    outcome: document.getElementById("outcome").value.trim(),
    complications: document.getElementById("complications").value.trim(),
    parameters,
    consumables,
    media_files: STATE.selectedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    created_at: Date.now()
  };
}

async function submitCase(event) {
  event.preventDefault();
  if (!validateStep(1)) {
    STATE.currentStep = 1;
    paintStep();
    return;
  }

  const payload = buildCasePayload();
  await savePendingCase(payload);

  alert(navigator.onLine ? "记录已保存，正在尝试同步。" : "当前离线，记录已缓存，联网后自动同步。");
  ELS.caseForm.reset();
  ELS.consumableList.innerHTML = "";
  addConsumableRow();
  renderDynamicParameters();
  ELS.mediaPreview.textContent = "暂无文件";
  STATE.selectedFiles = [];
  STATE.currentStep = 1;
  paintStep();

  await refreshLocalData();
  updateDashboard();
  showView("dashboard");

  if (navigator.onLine) {
    await syncPendingCases();
  }
}

function initSupabase() {
  if (!APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) {
    STATE.supabaseClient = null;
    return;
  }
  try {
    STATE.supabaseClient = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
  } catch (error) {
    console.warn("Supabase init failed:", error);
    STATE.supabaseClient = null;
  }
}

async function syncPendingCases() {
  if (!STATE.supabaseClient) {
    alert("未配置 Supabase，当前仅本地离线模式。请在 app.js 中填写 APP_CONFIG。");
    return;
  }

  const pending = await getAllFromStore("pending_cases");
  if (pending.length === 0) {
    return;
  }

  for (const item of pending) {
    try {
      const caseInsert = {
        date: item.date,
        doctor_name: item.doctor_name,
        status: item.status
      };

      const { data: caseRow, error: caseError } = await STATE.supabaseClient
        .from("clinical_cases")
        .insert(caseInsert)
        .select("id")
        .single();

      if (caseError) {
        throw caseError;
      }

      const caseId = caseRow.id;
      const detailInsert = {
        case_id: caseId,
        device_id: item.device_id,
        parameters: item.parameters,
        outcome: item.outcome,
        complications: item.complications
      };

      const { error: detailError } = await STATE.supabaseClient.from("case_details").insert(detailInsert);
      if (detailError) {
        throw detailError;
      }

      if (item.consumables.length > 0) {
        const rows = item.consumables.map((c) => ({ case_id: caseId, ...c }));
        const { error: consumablesError } = await STATE.supabaseClient.from("consumables").insert(rows);
        if (consumablesError) {
          throw consumablesError;
        }
      }

      await deleteFromStore("pending_cases", item.local_id);
      item.status = "已完成";
      await putStore("submitted_cases", item);
    } catch (error) {
      console.warn("sync one case failed:", error);
    }
  }

  await refreshLocalData();
  updateDashboard();
}

function updateDashboard() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const all = [...STATE.pendingCases, ...STATE.submittedCases];

  const todayCount = all.filter((item) => isSameDay(new Date(item.date), now)).length;
  const monthCount = all.filter((item) => {
    const date = new Date(item.date);
    return date.getMonth() === month && date.getFullYear() === year;
  }).length;

  ELS.statToday.textContent = String(todayCount);
  ELS.statMonth.textContent = String(monthCount);
  ELS.statPending.textContent = String(STATE.pendingCases.length);
  renderRecentCases(all);
}

function renderRecentCases(cases) {
  const recent = [...cases].sort((a, b) => b.created_at - a.created_at).slice(0, 3);
  if (recent.length === 0) {
    ELS.recentCaseList.innerHTML = `<li class="case-item"><p>暂无跟台记录</p></li>`;
    return;
  }

  ELS.recentCaseList.innerHTML = recent
    .map((item) => {
      const statusClass = item.status === "已完成" ? "completed" : "in-progress";
      return `
        <li class="case-item">
          <span class="status-badge ${statusClass}">${item.status}</span>
          <p>${item.hospital_name} · ${item.doctor_name}</p>
          <p>${item.device_model_name} · ${formatDate(item.date)}</p>
        </li>
      `;
    })
    .join("");
}

function formatDate(dateInput) {
  const date = new Date(dateInput);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${mm}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker register failed:", error);
    });
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("case-support-db", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pending_cases")) {
        db.createObjectStore("pending_cases", { keyPath: "local_id" });
      }
      if (!db.objectStoreNames.contains("submitted_cases")) {
        db.createObjectStore("submitted_cases", { keyPath: "local_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putStore(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = STATE.db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAllFromStore(storeName) {
  return new Promise((resolve, reject) => {
    const tx = STATE.db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deleteFromStore(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = STATE.db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function savePendingCase(payload) {
  await putStore("pending_cases", payload);
}

async function refreshLocalData() {
  STATE.pendingCases = await getAllFromStore("pending_cases");
  STATE.submittedCases = await getAllFromStore("submitted_cases");
}
