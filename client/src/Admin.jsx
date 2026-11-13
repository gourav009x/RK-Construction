
import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  LogOut,
  Plus,
  Trash2,
  ClipboardList,
  Building2,
  ImagePlus,
  X
} from "lucide-react";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const statuses = [
  "New",
  "Contacted",
  "Site Visit",
  "Quoted",
  "Won",
  "Closed"
];

const blank = {
  title: "",
  category: "New Construction",
  location: "Karol Bagh, Delhi",
  description: "",
  image: null,
  featured: false
};

export default function Admin() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("rk_admin_token") || ""
  );

  const [user, setUser] = useState(() =>
    JSON.parse(sessionStorage.getItem("rk_admin_user") || "null")
  );

  const [login, setLogin] = useState({
    email: "",
    password: ""
  });

  const [err, setErr] = useState("");
  const [tab, setTab] = useState("enquiries");

  const [enquiries, setEnquiries] = useState([]);
  const [projects, setProjects] = useState([]);

  const [project, setProject] = useState(blank);
  const [showAdd, setShowAdd] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);

  // API request helper.
  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;

    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${API}${path}`, {
      ...options,
      headers
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  // Load enquiries and projects.
  async function load() {
    try {
      const [e, p] = await Promise.all([
        request("/admin/enquiries"),
        fetch(`${API}/projects`).then(async res => {
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || "Could not load projects.");
          }

          return data;
        })
      ]);

      setEnquiries(e.enquiries || []);
      setProjects(p.projects || []);
      setErr("");
    } catch (error) {
      setErr(error.message);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  // Admin login.
  async function signIn(e) {
    e.preventDefault();
    setErr("");

    try {
      const d = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(login)
      });

      sessionStorage.setItem("rk_admin_token", d.token);
      sessionStorage.setItem("rk_admin_user", JSON.stringify(d.admin));

      setToken(d.token);
      setUser(d.admin);
    } catch (error) {
      setErr(error.message);
    }
  }

  // Admin logout.
  function signOut() {
    sessionStorage.removeItem("rk_admin_token");
    sessionStorage.removeItem("rk_admin_user");

    setToken("");
    setUser(null);
  }

  // Update enquiry status.
  async function changeStatus(id, status) {
    try {
      await request(`/admin/enquiries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      setEnquiries(old =>
        old.map(e => e.id === id ? { ...e, status } : e)
      );
    } catch (error) {
      setErr(error.message);
    }
  }

  // Select image and show preview.
  function handleImageChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      setErr("Only JPG, PNG and WebP images are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErr("Image size must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    setErr("");

    setProject(old => ({
      ...old,
      image: file
    }));

    setImagePreview(URL.createObjectURL(file));
  }

  // Clear selected image.
  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview("");

    setProject(old => ({
      ...old,
      image: null
    }));
  }

  // Reset project form.
  function resetProjectForm() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setProject(blank);
    setImagePreview("");
    setShowAdd(false);
  }

  // Add project using FormData.
  async function addProject(e) {
    e.preventDefault();
    setErr("");

    if (!project.image) {
      setErr("Please select a project image.");
      return;
    }

    const formData = new FormData();

    formData.append("title", project.title);
    formData.append("category", project.category);
    formData.append("location", project.location);
    formData.append("description", project.description);
    formData.append("featured", String(project.featured));
    formData.append("image", project.image);

    try {
      setSaving(true);

      await request("/admin/projects", {
        method: "POST",
        body: formData
      });

      resetProjectForm();
      await load();

    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Delete project.
  async function deleteProject(id) {
    if (!confirm("Delete this project from the portfolio?")) return;

    try {
      await request(`/admin/projects/${id}`, {
        method: "DELETE"
      });

      setProjects(old => old.filter(x => x.id !== id));
    } catch (error) {
      setErr(error.message);
    }
  }

  // Login screen.
  if (!token) {
    return (
      <div className="admin-page">
        <a className="admin-back" href="/">
          <ArrowLeft size={16} />
          Back to website
        </a>

        <form className="login-card" onSubmit={signIn}>
          <span className="admin-kicker">
            RK CONSTRUCTION / PRIVATE
          </span>

          <Building2 size={34} />

          <h1>Admin sign in</h1>

          <p>
            Manage project photos and customer enquiries.
          </p>

          {err && (
            <div className="admin-error">{err}</div>
          )}

          <label>
            Email
            <input
              type="email"
              required
              value={login.email}
              onChange={e =>
                setLogin({ ...login, email: e.target.value })
              }
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              value={login.password}
              onChange={e =>
                setLogin({ ...login, password: e.target.value })
              }
            />
          </label>

          <button className="button button-dark" type="submit">
            Sign in
          </button>

          <small>
            Admin access only. Create the first admin using
            the setup instructions in README.md.
          </small>
        </form>
      </div>
    );
  }

  // Admin dashboard.
  return (
    <div className="dashboard">
      <aside className="admin-sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Building2 />
          </span>

          <span>
            <strong>
              RK <b>CONSTRUCTION</b>
            </strong>
            <small>ADMIN DASHBOARD</small>
          </span>
        </a>

        <button
          className={
            tab === "enquiries"
              ? "side-link selected"
              : "side-link"
          }
          onClick={() => setTab("enquiries")}
        >
          <ClipboardList size={18} />
          Enquiries
          <span>{enquiries.length}</span>
        </button>

        <button
          className={
            tab === "projects"
              ? "side-link selected"
              : "side-link"
          }
          onClick={() => setTab("projects")}
        >
          <Building2 size={18} />
          Projects
          <span>{projects.length}</span>
        </button>

        <div className="admin-sidebar-bottom">
          <span>{user?.name || "Administrator"}</span>

          <button onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <span className="admin-kicker">
              WORKSPACE / OVERVIEW
            </span>

            <h1>
              {tab === "enquiries"
                ? "Customer enquiries"
                : "Project portfolio"}
            </h1>
          </div>

          <a href="/" className="admin-site-link">
            View website ↗
          </a>
        </header>

        {err && (
          <div className="admin-error">{err}</div>
        )}

        {tab === "enquiries" ? (
          <section className="admin-panel">
            <div className="panel-head">
              <div>
                <h2>Enquiry inbox</h2>
                <p>
                  Review incoming project requests and update
                  their progress.
                </p>
              </div>

              <span className="count-pill">
                {enquiries.length} total
              </span>
            </div>

            {!enquiries.length ? (
              <div className="empty-state">
                <ClipboardList size={32} />
                <h3>No enquiries yet</h3>
                <p>
                  New website enquiries will appear here once
                  the backend and database are connected.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Project</th>
                      <th>Details</th>
                      <th>Received</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {enquiries.map(e => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.name}</strong>
                          <small>{e.phone}</small>
                          {e.email && <small>{e.email}</small>}
                        </td>

                        <td>
                          {e.projectType}
                          <small>{e.location}</small>
                        </td>

                        <td className="message-cell">
                          {e.message}
                          {e.budget && (
                            <small>Budget: {e.budget}</small>
                          )}
                        </td>

                        <td>
                          {new Date(e.createdAt).toLocaleDateString("en-IN")}
                        </td>

                        <td>
                          <select
                            className="status-select"
                            value={e.status}
                            onChange={ev =>
                              changeStatus(e.id, ev.target.value)
                            }
                          >
                            {statuses.map(s => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="admin-panel">
            <div className="panel-head">
              <div>
                <h2>Project gallery</h2>
                <p>
                  Add real project details and photos to the
                  public portfolio.
                </p>
              </div>

              <button
                className="button button-dark"
                onClick={() => {
                  setErr("");
                  setShowAdd(!showAdd);
                }}
              >
                <Plus size={17} />
                Add project
              </button>
            </div>

            {showAdd && (
              <form
                className="project-admin-form"
                onSubmit={addProject}
              >
                <label>
                  Project title
                  <input
                    required
                    value={project.title}
                    onChange={e =>
                      setProject({
                        ...project,
                        title: e.target.value
                      })
                    }
                  />
                </label>

                <label>
                  Category
                  <select
                    value={project.category}
                    onChange={e =>
                      setProject({
                        ...project,
                        category: e.target.value
                      })
                    }
                  >
                    {[
                      "New Construction",
                      "Renovation",
                      "Civil Work",
                      "Commercial",
                      "Residential"
                    ].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Location
                  <input
                    required
                    value={project.location}
                    onChange={e =>
                      setProject({
                        ...project,
                        location: e.target.value
                      })
                    }
                  />
                </label>

                <div className="wide">
                  <label>
                    Project image
                    <span className="image-upload-hint">
                      JPG, PNG or WebP · Maximum 5 MB
                    </span>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                    />
                  </label>

                  {imagePreview && (
                    <div className="image-preview">
                      <img
                        src={imagePreview}
                        alt="Selected project preview"
                      />

                      <button
                        type="button"
                        onClick={removeImage}
                        className="delete-button"
                      >
                        <X size={15} />
                        Remove image
                      </button>
                    </div>
                  )}

                  {!imagePreview && (
                    <div className="image-upload-placeholder">
                      <ImagePlus size={28} />
                      <p>Select a project image from your computer</p>
                    </div>
                  )}
                </div>

                <label className="wide">
                  Description
                  <textarea
                    required
                    rows="3"
                    value={project.description}
                    onChange={e =>
                      setProject({
                        ...project,
                        description: e.target.value
                      })
                    }
                  />
                </label>

                <label className="featured-check">
                  <input
                    type="checkbox"
                    checked={project.featured}
                    onChange={e =>
                      setProject({
                        ...project,
                        featured: e.target.checked
                      })
                    }
                  />
                  Feature this project
                </label>

                <div className="wide form-buttons">
                  <button
                    className="button button-dark"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? "Uploading..." : "Save project"}
                  </button>

                  <button
                    type="button"
                    className="button button-outline"
                    onClick={resetProjectForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="admin-project-grid">
              {projects.map(p => (
                <article key={p.id} className="admin-project">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    onError={e => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  <div>
                    <span>{p.category}</span>
                    <h3>{p.title}</h3>
                    <p>{p.location}</p>

                    <button
                      onClick={() => deleteProject(p.id)}
                      className="delete-button"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!projects.length && (
              <div className="empty-state">
                <Building2 size={32} />
                <h3>Your portfolio starts here</h3>
                <p>
                  Add your first completed or ongoing project above.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
