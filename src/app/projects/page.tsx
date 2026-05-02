"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";

export default function ProjectsPage() {
  const [task, setTask] = useState("");
  const [projects, setProjects] = useState("MyBroker");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const data = await postJson("/api/v2/projects/decision", {
        task_description: task,
        existing_projects: projects
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      });
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="pageHeader">
        <h2>项目判断（是否新建）</h2>
        <p>根据任务描述与已有项目池，辅助决策是否创建新项目。</p>
      </header>

      <section className="card">
        <div className="field">
          <label htmlFor="task-description">任务描述</label>
          <textarea
            id="task-description"
            rows={6}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="输入任务背景、目标、交付内容和关键限制"
          />
        </div>
        <div className="field">
          <label htmlFor="project-pool">已有项目（逗号分隔）</label>
          <input
            id="project-pool"
            value={projects}
            onChange={(e) => setProjects(e.target.value)}
            placeholder="例如：MyBroker,CRM优化,数据看板"
          />
        </div>
        <div className="actions">
          <button className="btnPrimary" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "判断中..." : "开始判断"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card result">
        <h3>返回结果</h3>
        <pre>{result || "提交后将显示项目归属建议"}</pre>
      </section>
    </>
  );
}
