import os
from datetime import datetime, date
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import inspect, text
import sendgrid
from sendgrid.helpers.mail import Mail

app = Flask(__name__)
CORS(app)

# --- Config ---
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/job_tracker"
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "notifications@jobtracker.com")

db = SQLAlchemy(app)

STATUS_CHOICES = ["Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"]
LEGACY_DEVICE_ID = "legacy"



# --- Models ---
class Application(db.Model):
    __tablename__ = "applications"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(64), nullable=False, index=True) 
    company = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(30), nullable=False, default="Applied")
    applied_date = db.Column(db.Date, nullable=False, default=date.today)
    deadline = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    contact_email = db.Column(db.String(120), nullable=True)  # user's email for notifications
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "company": self.company,
            "role": self.role,
            "status": self.status,
            "applied_date": self.applied_date.isoformat() if self.applied_date else None,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "notes": self.notes,
            "contact_email": self.contact_email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

def get_device_id():                                    
    device_id = request.headers.get("X-Device-Id")
    if not device_id:
        return None
    return device_id


def ensure_application_device_id_column():
    inspector = inspect(db.engine)
    columns = {column["name"] for column in inspector.get_columns("applications")}
    if "device_id" not in columns:
        db.session.execute(text("ALTER TABLE applications ADD COLUMN device_id VARCHAR(64)"))
        db.session.execute(
            text(
                "UPDATE applications "
                "SET device_id = :legacy_id "
                "WHERE device_id IS NULL"
            ),
            {"legacy_id": LEGACY_DEVICE_ID},
        )
        db.session.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_applications_device_id "
                "ON applications (device_id)"
            )
        )
        db.session.commit()
    else:
        db.session.execute(
            text(
                "UPDATE applications "
                "SET device_id = :legacy_id "
                "WHERE device_id IS NULL"
            ),
            {"legacy_id": LEGACY_DEVICE_ID},
        )
        db.session.commit()


def get_application_for_device(app_id, device_id):
    return Application.query.filter(
        Application.id == app_id,
        Application.device_id.in_([device_id, LEGACY_DEVICE_ID]),
    ).first()

# --- Email helper ---
def send_email(to_email, subject, content):
    """Send an email via SendGrid. Fails silently (logs) if not configured."""
    if not SENDGRID_API_KEY or not to_email:
        print(f"[email skipped] to={to_email} subject={subject}")
        return False
    try:
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=content,
        )
        sg.send(message)
        return True
    except Exception as e:
        print(f"[email error] {e}")
        return False


# --- Error Handler ---
@app.errorhandler(Exception)
def handle_exception(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    import traceback
    traceback.print_exc()
    return jsonify({
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc()
    }), 500


# --- Routes ---
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/applications", methods=["GET"])
def list_applications():
    device_id = get_device_id()                          
    if not device_id:                                     
        return jsonify({"error": "X-Device-Id header is required"}), 400  

    status_filter = request.args.get("status")
    query = Application.query.filter(
        Application.device_id.in_([device_id, LEGACY_DEVICE_ID])
    )
    if status_filter:
        query = query.filter_by(status=status_filter)
    apps = query.order_by(Application.applied_date.desc()).all()
    return jsonify([a.to_dict() for a in apps])


@app.route("/api/applications/<int:app_id>", methods=["GET"])
def get_application(app_id):
    device_id = get_device_id()
    if not device_id:
        return jsonify({"error": "X-Device-Id header is required"}), 400

    application = get_application_for_device(app_id, device_id)
    if not application:
        return jsonify({"error": "Application not found"}), 404
    return jsonify(application.to_dict())


@app.route("/api/applications", methods=["POST"])
def create_application():
    data = request.get_json() or {}
    device_id = get_device_id()

    if not device_id:
        return jsonify({"error": "X-Device-Id header is required"}), 400

    if not data.get("company") or not data.get("role"):
        return jsonify({"error": "company and role are required"}), 400

    application = Application(
        device_id=device_id,
        company=data["company"],
        role=data["role"],
        status=data.get("status", "Applied"),
        applied_date=datetime.fromisoformat(data["applied_date"]).date()
        if data.get("applied_date")
        else date.today(),
        deadline=datetime.fromisoformat(data["deadline"]).date()
        if data.get("deadline")
        else None,
        notes=data.get("notes"),
        contact_email=data.get("contact_email"),
    )
    db.session.add(application)
    db.session.commit()

    send_email(
        application.contact_email,
        f"Application logged: {application.role} at {application.company}",
        f"<p>Your application for <b>{application.role}</b> at "
        f"<b>{application.company}</b> has been added to your tracker.</p>",
    )

    return jsonify(application.to_dict()), 201


@app.route("/api/applications/<int:app_id>", methods=["PUT"])
def update_application(app_id):
    device_id = get_device_id()
    if not device_id:
        return jsonify({"error": "X-Device-Id header is required"}), 400

    application = get_application_for_device(app_id, device_id)
    if not application:
        return jsonify({"error": "Application not found"}), 404
    data = request.get_json() or {}

    old_status = application.status

    for field in ["company", "role", "status", "notes", "contact_email"]:
        if field in data:
            setattr(application, field, data[field])

    if "applied_date" in data and data["applied_date"]:
        application.applied_date = datetime.fromisoformat(data["applied_date"]).date()
    if "deadline" in data:
        application.deadline = (
            datetime.fromisoformat(data["deadline"]).date() if data["deadline"] else None
        )

    db.session.commit()

    # Notify on status change
    if "status" in data and data["status"] != old_status:
        send_email(
            application.contact_email,
            f"Status update: {application.role} at {application.company}",
            f"<p>Your application status changed from <b>{old_status}</b> to "
            f"<b>{application.status}</b>.</p>",
        )

    return jsonify(application.to_dict())


@app.route("/api/applications/<int:app_id>", methods=["DELETE"])
def delete_application(app_id):
    device_id = get_device_id()
    if not device_id:
        return jsonify({"error": "X-Device-Id header is required"}), 400

    application = get_application_for_device(app_id, device_id)
    if not application:
        return jsonify({"error": "Application not found"}), 404
    db.session.delete(application)
    db.session.commit()
    return jsonify({"deleted": app_id})


@app.route("/api/stats", methods=["GET"])
def stats():
    device_id = get_device_id()
    if not device_id:
        return jsonify({"error": "X-Device-Id header is required"}), 400

    apps = Application.query.filter(
        Application.device_id.in_([device_id, LEGACY_DEVICE_ID])
    ).all()
    counts = {s: 0 for s in STATUS_CHOICES}
    for a in apps:
        counts[a.status] = counts.get(a.status, 0) + 1
    return jsonify({"total": len(apps), "by_status": counts})


# --- Deadline reminder job (runs daily) ---
def check_deadlines():
    with app.app_context():
        today = date.today()
        upcoming = Application.query.filter(
            Application.deadline.isnot(None),
            Application.status.notin_(["Rejected", "Withdrawn"]),
        ).all()
        for a in upcoming:
            days_left = (a.deadline - today).days
            if days_left in (3, 1, 0):
                send_email(
                    a.contact_email,
                    f"Deadline reminder: {a.role} at {a.company}",
                    f"<p>Your deadline for <b>{a.role}</b> at <b>{a.company}</b> "
                    f"is in {days_left} day(s).</p>",
                )


scheduler = BackgroundScheduler()
scheduler.add_job(check_deadlines, "interval", hours=24)

with app.app_context():
    db.create_all()
    ensure_application_device_id_column()
if not scheduler.running:
    scheduler.start()


@app.cli.command("init-db")
def init_db():
    """flask --app app.py init-db"""
    db.create_all()
    print("Database initialized.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
