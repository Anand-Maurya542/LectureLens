import React, { useState, useEffect } from "react";
import { api } from "../../api/client";
import { BarChart3, AlertTriangle, Users, Award, BookOpen } from "lucide-react";

export default function TeacherAnalytics() {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const data = await api.getCourses();
        setCourses(data || []);
        if (data?.length > 0) {
          setSelectedCourseId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    async function loadAnalytics() {
      try {
        const res = await api.getCourseAnalytics(selectedCourseId);
        setAnalytics(res);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    }
    loadAnalytics();
  }, [selectedCourseId]);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /> Loading student learning analytics...</div>;
  }

  return (
    <div className="dashboard-page max-w-5xl">
      <div className="dashboard-header">
        <div>
          <h1>Student Learning & Quiz Analytics</h1>
          <p>
            Track student retention, identify recurring topic misconceptions, and guide targeted
            revision sessions.
          </p>
        </div>
      </div>

      <div className="card-box mb-6">
        <label>Select Course:</label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="mt-2"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {analytics ? (
        <>
          {/* Summary Stat Grid */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon purple"><Users size={24} /></div>
              <div>
                <div className="metric-value">{analytics.total_attempts}</div>
                <div className="metric-label">Total Quiz Attempts</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon green"><Award size={24} /></div>
              <div>
                <div className="metric-value">{analytics.average_score}%</div>
                <div className="metric-label">Average Class Score</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon amber"><AlertTriangle size={24} /></div>
              <div>
                <div className="metric-value">
                  {analytics.topic_weakness_summary?.filter((t) => t.error_rate_percentage > 30).length || 0}
                </div>
                <div className="metric-label">Struggling Topics Detected</div>
              </div>
            </div>
          </div>

          {/* Topic Struggles Table */}
          <div className="dashboard-section mt-6">
            <div className="section-header">
              <h2>Topic Difficulty & Error Breakdown</h2>
              <span className="text-muted">Ranked by error rate</span>
            </div>

            {analytics.topic_weakness_summary?.length === 0 ? (
              <div className="empty-state">
                <p>No quiz attempt submissions recorded yet for this course.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Topic Section</th>
                      <th>Total Attempts</th>
                      <th>Error Rate</th>
                      <th>Diagnostic Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topic_weakness_summary?.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.topic}</strong></td>
                        <td>{item.attempts} attempts</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="progress-bar-bg">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${Math.min(100, item.error_rate_percentage)}%`,
                                  backgroundColor:
                                    item.error_rate_percentage > 40
                                      ? "#ef4444"
                                      : item.error_rate_percentage > 20
                                      ? "#f59e0b"
                                      : "#10b981",
                                }}
                              />
                            </div>
                            <span>{item.error_rate_percentage}%</span>
                          </div>
                        </td>
                        <td>
                          {item.error_rate_percentage > 40 ? (
                            <span className="pill-badge red">Needs Instructor Review</span>
                          ) : item.error_rate_percentage > 20 ? (
                            <span className="pill-badge amber">Moderate Confusion</span>
                          ) : (
                            <span className="pill-badge green">Well Mastered</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>Select a course to view analytics.</p>
        </div>
      )}
    </div>
  );
}

