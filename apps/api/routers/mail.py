from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User
from models.mail import MailRoutingRule, MailOutbox
from core.rbac import requires_permission
from core.mailer import process_outbox_item
from middleware.audit import log_audit_event

router = APIRouter(prefix="/mail", tags=["Mail Routing & Outbox Engine"])

class CreateRoutingRuleRequest(BaseModel):
    event_type: str  # punch.in | punch.out | leave.requested | leave.decided | eod.missing
    recipient_type: str  # role | user | email
    recipient_value: str
    enabled: bool = True

class RuleResponse(BaseModel):
    id: str
    event_type: str
    recipient_type: str
    recipient_value: str
    enabled: bool

class OutboxResponse(BaseModel):
    id: str
    event_type: str
    to_emails: List[str]
    status: str
    attempts: int
    last_error: Optional[str] = None
    created_at: datetime

@router.get("/rules", response_model=List[RuleResponse])
def list_routing_rules(
    current_user: User = Depends(requires_permission("mail.route")),
    db: Session = Depends(get_db)
):
    rules = db.query(MailRoutingRule).order_by(MailRoutingRule.created_at.desc()).all()
    return [
        RuleResponse(
            id=r.id,
            event_type=r.event_type,
            recipient_type=r.recipient_type,
            recipient_value=r.recipient_value,
            enabled=r.enabled
        ) for r in rules
    ]

@router.post("/rules", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
def create_routing_rule(
    payload: CreateRoutingRuleRequest,
    current_user: User = Depends(requires_permission("mail.route")),
    db: Session = Depends(get_db)
):
    new_rule = MailRoutingRule(
        event_type=payload.event_type.lower().strip(),
        recipient_type=payload.recipient_type.lower().strip(),
        recipient_value=payload.recipient_value.strip(),
        enabled=payload.enabled
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "admin",
        action="mail_rule.create",
        entity="MailRoutingRule",
        entity_id=new_rule.id,
        after_state={"event_type": new_rule.event_type, "recipient_type": new_rule.recipient_type}
    )

    return RuleResponse(
        id=new_rule.id,
        event_type=new_rule.event_type,
        recipient_type=new_rule.recipient_type,
        recipient_value=new_rule.recipient_value,
        enabled=new_rule.enabled
    )

@router.get("/outbox", response_model=List[OutboxResponse])
def get_outbox_items(
    current_user: User = Depends(requires_permission("mail.route")),
    db: Session = Depends(get_db)
):
    items = db.query(MailOutbox).order_by(MailOutbox.created_at.desc()).all()
    return [
        OutboxResponse(
            id=i.id,
            event_type=i.event_type,
            to_emails=i.to_emails,
            status=i.status,
            attempts=i.attempts,
            last_error=i.last_error,
            created_at=i.created_at
        ) for i in items
    ]

@router.post("/outbox/{outbox_id}/retry")
def retry_outbox_item(
    outbox_id: str,
    current_user: User = Depends(requires_permission("mail.route")),
    db: Session = Depends(get_db)
):
    item = db.query(MailOutbox).filter(MailOutbox.id == outbox_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outbox item not found")

    success = process_outbox_item(item, db)
    return {"id": item.id, "status": item.status, "attempts": item.attempts, "success": success}
