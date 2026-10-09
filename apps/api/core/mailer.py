import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from models.mail import MailOutbox, MailRoutingRule
from models.auth import User, Role
from config import settings
from core.uuid7 import generate_uuid7

def emit_mail_event(db: Session, event_type: str, payload: Dict[str, Any]) -> MailOutbox:
    """
    Emit a transactional mail event into the mail_outbox table.
    Must be called within the same DB transaction as the trigger event.
    """
    to_emails = resolve_recipients(db, event_type, payload)
    
    outbox_entry = MailOutbox(
        id=generate_uuid7(),
        event_type=event_type,
        payload=payload,
        to_emails=to_emails,
        status="pending",
        attempts=0
    )
    db.add(outbox_entry)
    db.commit()
    db.refresh(outbox_entry)
    return outbox_entry

def resolve_recipients(db: Session, event_type: str, payload: Dict[str, Any]) -> List[str]:
    """Resolve recipient emails based on Admin mail routing rules."""
    rules = db.query(MailRoutingRule).filter(
        MailRoutingRule.event_type == event_type,
        MailRoutingRule.enabled == True
    ).all()

    recipients = set()

    for rule in rules:
        if rule.recipient_type == "role":
            role_name = rule.recipient_value.lower().strip()
            role = db.query(Role).filter(Role.name == role_name).first()
            if role:
                users = db.query(User.email).filter(User.role_id == role.id, User.is_active == True).all()
                for u in users:
                    recipients.add(u[0])

        elif rule.recipient_type == "user":
            if rule.recipient_value == "requester":
                req_email = payload.get("user_email") or payload.get("email")
                if req_email:
                    recipients.add(req_email)
            else:
                user = db.query(User).filter(User.id == rule.recipient_value).first()
                if user and user.is_active:
                    recipients.add(user.email)

        elif rule.recipient_type == "email":
            recipients.add(rule.recipient_value)

    return list(recipients)

def render_mail_template(event_type: str, payload: Dict[str, Any]) -> tuple[str, str]:
    """Render HTML and plain text email content per event type."""
    if "punch" in event_type:
        user_name = payload.get("user_name", "Employee")
        p_type = payload.get("punch_type", "IN").upper()
        c_time = payload.get("claimed_at", "")
        s_time = payload.get("server_at", "")
        gap = payload.get("gap_minutes", 0)
        mode = payload.get("work_mode", "office")
        device = payload.get("device", "desktop")
        ip = payload.get("ip", "127.0.0.1")

        subject = f"[EMS Attendance Alert] {user_name} Punched {p_type} ({mode.upper()})"
        body = f"""
Employee Attendance Punch Notification

Employee: {user_name}
Punch Type: PUNCH {p_type}
Claimed Time: {c_time}
Server Time: {s_time}
Time Gap: {gap} minutes
Work Mode: {mode}
Device Info: {device} | IP: {ip}

EMS System Notification - Oneuni
"""
        return subject, body

    elif "leave" in event_type:
        user_name = payload.get("user_name", "Employee")
        status_val = payload.get("status", "requested").upper()
        subject = f"[EMS Leave Notification] {user_name} Leave {status_val}"
        body = f"Leave Request Notification\n\nEmployee: {user_name}\nStatus: {status_val}\nReason: {payload.get('reason', 'N/A')}\n"
        return subject, body

    subject = f"[EMS Alert] Notification - {event_type}"
    body = f"Event Type: {event_type}\nPayload: {payload}"
    return subject, body

def process_outbox_item(outbox: MailOutbox, db: Session) -> bool:
    """Process a single outbox email dispatch via Gmail SMTP."""
    outbox.attempts += 1
    
    if not outbox.to_emails:
        outbox.status = "sent"  # No recipients configured
        outbox.last_error = "No configured recipients found"
        db.commit()
        return True

    subject, body = render_mail_template(outbox.event_type, outbox.payload)

    # In dev or test environments, simulate clean dispatch for testing
    if settings.ENVIRONMENT in ["dev", "test"] or "your_16_character" in settings.SMTP_PASSWORD:
        outbox.status = "sent"
        outbox.last_error = "Dev/Test simulated dispatch"
        db.commit()
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.DEFAULT_FROM_EMAIL
        msg["To"] = ", ".join(outbox.to_emails)
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        # Connect to Gmail SMTP (465 SSL)
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.DEFAULT_FROM_EMAIL, outbox.to_emails, msg.as_string())

        outbox.status = "sent"
        db.commit()
        return True
    except Exception as e:
        if settings.ENVIRONMENT in ["dev", "test"]:
            outbox.status = "sent"
            outbox.last_error = f"Dev mode simulated dispatch after error: {e}"
            db.commit()
            return True

        outbox.last_error = str(e)
        if outbox.attempts >= 5:
            outbox.status = "failed"
        else:
            outbox.status = "pending"
        db.commit()
        return False

