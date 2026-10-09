from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models.audit import AuditLog

def log_audit_event(
    db: Session,
    actor_id: str,
    actor_role: str,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """
    Log an authenticated write operation into the immutable audit_log table.
    """
    audit_entry = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before_state=before_state,
        after_state=after_state,
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
