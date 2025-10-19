from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# Simple health endpoint (useful for uptime checks)
@app.get("/healthz")
def healthz():
    return jsonify({"ok": True})

# Contact form endpoint
@app.post("/contact")
def contact():
    """
    Receives form fields: name, email, message
    TODO: Replace the print() with your email/Slack webhook, SES, or DynamoDB write.
    """
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()
    message = request.form.get("message", "").strip()

    # Basic guard
    if not name or not email or not message:
        return jsonify({"ok": False, "error": "Missing fields"}), 400

    # TODO: send to your destination (email, Slack, db). For now we just log:
    print(f"[CONTACT] {name} <{email}>: {message}")

    # Simple success page
    html = """
    <!doctype html><meta charset="utf-8">
    <title>Thanks!</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#0a0f0a; color:#e8fbe8; display:grid; place-items:center; height:100vh}
      .card{border:1px solid rgba(57,255,20,.25); padding:1.5rem; border-radius:14px; background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))}
      a{color:#39ff14}
    </style>
    <div class="card">
      <h1>Thanksâ€”message received âœ…</h1>
      <p>Iâ€™ll get back to you shortly.</p>
      <p><a href="/">â† Back to portfolio</a></p>
    </div>
    """
    return render_template_string(html)

if __name__ == "__main__":
    # Run locally: python app.py
    app.run(host="0.0.0.0", port=5000, debug=True)