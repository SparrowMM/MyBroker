from fastapi import APIRouter
from fastapi.responses import HTMLResponse


router = APIRouter(tags=["web"])


@router.get("/", response_class=HTMLResponse)
def web_home():
    return """
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MyBroker 控制台</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; background: #f8fafc; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(320px,1fr)); gap: 16px; }
    .card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
    h1 { margin: 0 0 16px 0; }
    h3 { margin: 0 0 12px 0; }
    textarea,input,button { width: 100%; margin: 6px 0; padding: 10px; border-radius: 8px; border: 1px solid #d0d7de; }
    button { background: #111827; color: #fff; border: none; cursor: pointer; }
    pre { background: #0b1020; color: #d1e4ff; padding: 12px; border-radius: 8px; white-space: pre-wrap; max-height: 320px; overflow:auto; }
  </style>
</head>
<body>
  <h1>MyBroker 经纪人后台</h1>
  <div class="grid">
    <div class="card">
      <h3>1) 上传截图</h3>
      <input id="shotFile" type="file" />
      <button onclick="uploadShot()">上传截图</button>
      <pre id="shotOut"></pre>
    </div>

    <div class="card">
      <h3>2) 每日记录 + AI分析</h3>
      <input id="recordDate" type="date" />
      <textarea id="rawText" rows="4" placeholder="今天经纪人做了什么"></textarea>
      <textarea id="chatText" rows="3" placeholder="对话摘要"></textarea>
      <input id="shotPath" placeholder="截图URL（可粘贴上传返回的 public_url）" />
      <button onclick="createRecord()">提交并分析</button>
      <pre id="recordOut"></pre>
    </div>

    <div class="card">
      <h3>3) 项目判断（是否新建）</h3>
      <textarea id="taskDesc" rows="4" placeholder="输入任务描述"></textarea>
      <input id="existingProjects" placeholder="已有项目，逗号分隔" />
      <button onclick="projectDecision()">判断</button>
      <pre id="projectOut"></pre>
    </div>

    <div class="card">
      <h3>4) 周报/月报查询</h3>
      <input id="weekYear" type="number" placeholder="年，如 2026" />
      <input id="weekNo" type="number" placeholder="周，如 17" />
      <button onclick="weekly()">查看周报</button>
      <input id="monthYear" type="number" placeholder="年，如 2026" />
      <input id="monthNo" type="number" placeholder="月，如 4" />
      <button onclick="monthly()">查看月报</button>
      <pre id="reportOut"></pre>
    </div>
  </div>

  <script>
    document.getElementById("recordDate").value = new Date().toISOString().slice(0,10);

    async function uploadShot() {
      const f = document.getElementById("shotFile").files[0];
      const out = document.getElementById("shotOut");
      if (!f) return out.textContent = "请选择文件";
      const fd = new FormData();
      fd.append("file", f);
      const resp = await fetch("/uploads/screenshot", { method: "POST", body: fd });
      const data = await resp.json();
      out.textContent = JSON.stringify(data, null, 2);
      if (data.public_url) document.getElementById("shotPath").value = data.public_url;
    }

    async function createRecord() {
      const body = {
        record_date: document.getElementById("recordDate").value,
        raw_text: document.getElementById("rawText").value,
        chat_text: document.getElementById("chatText").value,
        screenshot_paths: document.getElementById("shotPath").value ? [document.getElementById("shotPath").value] : [],
        screenshot_notes: ""
      };
      const resp = await fetch("/records", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      document.getElementById("recordOut").textContent = JSON.stringify(await resp.json(), null, 2);
    }

    async function projectDecision() {
      const existing = document.getElementById("existingProjects").value
        .split(",").map(x=>x.trim()).filter(Boolean);
      const body = { task_description: document.getElementById("taskDesc").value, existing_projects: existing };
      const resp = await fetch("/projects/decision", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      document.getElementById("projectOut").textContent = JSON.stringify(await resp.json(), null, 2);
    }

    async function weekly() {
      const y = document.getElementById("weekYear").value;
      const w = document.getElementById("weekNo").value;
      const resp = await fetch(`/records/reports/weekly?year=${y}&week=${w}`);
      document.getElementById("reportOut").textContent = JSON.stringify(await resp.json(), null, 2);
    }

    async function monthly() {
      const y = document.getElementById("monthYear").value;
      const m = document.getElementById("monthNo").value;
      const resp = await fetch(`/records/reports/monthly?year=${y}&month=${m}`);
      document.getElementById("reportOut").textContent = JSON.stringify(await resp.json(), null, 2);
    }
  </script>
</body>
</html>
"""
