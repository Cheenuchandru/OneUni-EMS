import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy import String
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User
from models.comms import Announcement, Comment, Notification, Standup, ChatMessage, ChatReadStatus, ChatChannel
from models.attendance import Punch
from models.calendar import DayStatus
from core.rbac import requires_permission
from middleware.audit import log_audit_event
from core.uuid7 import generate_uuid7

router = APIRouter(tags=["Comms, Notifications & Export"])

class CreateStandupRequest(BaseModel):
    yesterday_work: str
    today_plan: str
    blockers: Optional[str] = None

class StandupResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    date: str
    yesterday_work: str
    today_plan: str
    blockers: Optional[str] = None
    created_at: datetime

class CreateChatMessageRequest(BaseModel):
    channel: str = "general"
    recipient_id: Optional[str] = None
    message: str

class ChatMessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    channel: str
    recipient_id: Optional[str] = None
    message: str
    created_at: datetime

# --- Daily Morning Standup Endpoints ---

@router.post("/standup", response_model=StandupResponse, status_code=status.HTTP_201_CREATED)
def submit_standup(
    payload: CreateStandupRequest,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = db.query(Standup).filter(
        Standup.user_id == current_user.id,
        Standup.date == today_str
    ).first()

    if existing:
        existing.yesterday_work = payload.yesterday_work
        existing.today_plan = payload.today_plan
        existing.blockers = payload.blockers
        db.commit()
        db.refresh(existing)
        s_obj = existing
    else:
        s_obj = Standup(
            user_id=current_user.id,
            date=today_str,
            yesterday_work=payload.yesterday_work,
            today_plan=payload.today_plan,
            blockers=payload.blockers
        )
        db.add(s_obj)
        db.commit()
        db.refresh(s_obj)

    return StandupResponse(
        id=s_obj.id,
        user_id=s_obj.user_id,
        user_name=current_user.full_name,
        date=s_obj.date,
        yesterday_work=s_obj.yesterday_work,
        today_plan=s_obj.today_plan,
        blockers=s_obj.blockers,
        created_at=s_obj.created_at
    )

@router.get("/standup/today", response_model=Optional[StandupResponse])
def get_my_today_standup(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    s_obj = db.query(Standup).filter(
        Standup.user_id == current_user.id,
        Standup.date == today_str
    ).first()

    if not s_obj:
        return None

    return StandupResponse(
        id=s_obj.id,
        user_id=s_obj.user_id,
        user_name=current_user.full_name,
        date=s_obj.date,
        yesterday_work=s_obj.yesterday_work,
        today_plan=s_obj.today_plan,
        blockers=s_obj.blockers,
        created_at=s_obj.created_at
    )

@router.get("/standup/team", response_model=List[StandupResponse])
def get_team_today_standups(
    target_date: Optional[str] = None,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    t_date = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    standups = db.query(Standup).filter(Standup.date == t_date).order_by(Standup.created_at.desc()).all()

    return [
        StandupResponse(
            id=s.id,
            user_id=s.user_id,
            user_name=s.user.full_name if s.user else "Employee",
            date=s.date,
            yesterday_work=s.yesterday_work,
            today_plan=s.today_plan,
            blockers=s.blockers,
            created_at=s.created_at
        ) for s in standups
    ]

# --- Real-time Team Chat Endpoints ---

@router.get("/chat/messages", response_model=List[ChatMessageResponse])
def list_chat_messages(
    channel: Optional[str] = "general",
    recipient_id: Optional[str] = None,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    query = db.query(ChatMessage)
    if recipient_id:
        query = query.filter(
            ((ChatMessage.sender_id == current_user.id) & (ChatMessage.recipient_id == recipient_id)) |
            ((ChatMessage.sender_id == recipient_id) & (ChatMessage.recipient_id == current_user.id))
        )
    else:
        query = query.filter(ChatMessage.channel == channel, ChatMessage.recipient_id.is_(None))

    messages = query.order_by(ChatMessage.created_at.asc()).limit(100).all()

    return [
        ChatMessageResponse(
            id=m.id,
            sender_id=m.sender_id,
            sender_name=m.sender.full_name if m.sender else "User",
            sender_avatar=getattr(m.sender, 'avatar_url', None) if m.sender else None,
            channel=m.channel,
            recipient_id=m.recipient_id,
            message=m.message,
            created_at=m.created_at
        ) for m in messages
    ]

@router.post("/chat/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_chat_message(
    payload: CreateChatMessageRequest,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    msg = ChatMessage(
        sender_id=current_user.id,
        channel=payload.channel,
        recipient_id=payload.recipient_id,
        message=payload.message.strip()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return ChatMessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=current_user.full_name,
        sender_avatar=getattr(current_user, 'avatar_url', None),
        channel=msg.channel,
        recipient_id=msg.recipient_id,
        message=msg.message,
        created_at=msg.created_at
    )

class MarkReadRequest(BaseModel):
    target: str

@router.post("/chat/read")
def mark_chat_read(
    payload: MarkReadRequest,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    existing = db.query(ChatReadStatus).filter(
        ChatReadStatus.user_id == current_user.id,
        ChatReadStatus.target == payload.target
    ).first()

    now_time = datetime.now(timezone.utc)
    if existing:
        existing.last_read_at = now_time
    else:
        existing = ChatReadStatus(
            user_id=current_user.id,
            target=payload.target,
            last_read_at=now_time
        )
        db.add(existing)

    db.commit()
    return {"status": "ok", "target": payload.target}

class CreateChannelRequest(BaseModel):
    name: str
    description: Optional[str] = None
    member_ids: Optional[List[str]] = []
    is_private: bool = False

class ChannelResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    created_by: str
    member_ids: Optional[List[str]] = []
    is_private: bool
    created_at: datetime

@router.get("/chat/channels", response_model=List[ChannelResponse])
def list_chat_channels(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    default_channels = [
        {"id": "c-gen", "name": "general", "slug": "general", "description": "Company-wide team discussions", "created_by": "system", "member_ids": [], "is_private": False, "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc)},
        {"id": "c-agri", "name": "agri-projects", "slug": "agri-projects", "description": "Agri platform & engineering updates", "created_by": "system", "member_ids": [], "is_private": False, "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc)},
        {"id": "c-ann", "name": "announcements", "slug": "announcements", "description": "Broadcast discussions", "created_by": "system", "member_ids": [], "is_private": False, "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc)},
    ]

    custom_db_channels = db.query(ChatChannel).order_by(ChatChannel.created_at.asc()).all()
    result = [ChannelResponse(**ch) for ch in default_channels]

    for cc in custom_db_channels:
        if not cc.is_private or cc.created_by == current_user.id or (cc.member_ids and current_user.id in cc.member_ids):
            result.append(ChannelResponse(
                id=cc.id,
                name=cc.name,
                slug=cc.slug,
                description=cc.description,
                created_by=cc.created_by,
                member_ids=cc.member_ids or [],
                is_private=cc.is_private,
                created_at=cc.created_at
            ))

    return result

@router.post("/chat/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
def create_chat_channel(
    payload: CreateChannelRequest,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    clean_slug = payload.name.strip().lower().replace(" ", "-")
    existing = db.query(ChatChannel).filter(ChatChannel.slug == clean_slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Channel with this name already exists")

    members = list(set((payload.member_ids or []) + [current_user.id]))

    ch = ChatChannel(
        name=payload.name.strip(),
        slug=clean_slug,
        description=payload.description,
        created_by=current_user.id,
        member_ids=members,
        is_private=payload.is_private
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)

    return ChannelResponse(
        id=ch.id,
        name=ch.name,
        slug=ch.slug,
        description=ch.description,
        created_by=ch.created_by,
        member_ids=ch.member_ids,
        is_private=ch.is_private,
        created_at=ch.created_at
    )

@router.get("/chat/unread")
def get_unread_chat_counts(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    read_statuses = db.query(ChatReadStatus).filter(
        ChatReadStatus.user_id == current_user.id
    ).all()

    read_dict = {rs.target: rs.last_read_at for rs in read_statuses}

    # Fetch channel list
    all_channels = db.query(ChatChannel).all()
    channel_slugs = ["general", "agri-projects", "announcements"] + [c.slug for c in all_channels]
    unread_channels = {}

    for ch in channel_slugs:
        target_key = f"channel:{ch}"
        last_read = read_dict.get(target_key, datetime(1970, 1, 1, tzinfo=timezone.utc))
        count = db.query(ChatMessage).filter(
            ChatMessage.channel == ch,
            ChatMessage.recipient_id.is_(None),
            ChatMessage.sender_id != current_user.id,
            ChatMessage.created_at > last_read
        ).count()
        unread_channels[ch] = count

    dm_msgs = db.query(ChatMessage).filter(
        ChatMessage.recipient_id == current_user.id
    ).all()

    unread_dms = {}
    for msg in dm_msgs:
        sender_id = msg.sender_id
        target_key = f"dm:{sender_id}"
        last_read = read_dict.get(target_key, datetime(1970, 1, 1, tzinfo=timezone.utc))
        if msg.created_at > last_read:
            unread_dms[sender_id] = unread_dms.get(sender_id, 0) + 1

    # Calculate recent message timestamps for all DM partners
    all_dm_msgs = db.query(ChatMessage).filter(
        (ChatMessage.recipient_id.isnot(None)) &
        ((ChatMessage.sender_id == current_user.id) | (ChatMessage.recipient_id == current_user.id))
    ).all()

    recent_dms = {}
    for msg in all_dm_msgs:
        other_user = msg.sender_id if msg.sender_id != current_user.id else msg.recipient_id
        if other_user:
            t_str = msg.created_at.isoformat()
            if other_user not in recent_dms or t_str > recent_dms[other_user]:
                recent_dms[other_user] = t_str

    total_unread = sum(unread_channels.values()) + sum(unread_dms.values())

    return {
        "unread_channels": unread_channels,
        "unread_dms": unread_dms,
        "recent_dms": recent_dms,
        "total_unread": total_unread
    }


class CreateAnnouncementRequest(BaseModel):
    title: str
    body_md: str
    pinned: bool = False

class CreateCommentRequest(BaseModel):
    entity_type: str  # project | task
    entity_id: str
    body: str

class AnnouncementResponse(BaseModel):
    id: str
    author_id: str
    author_name: str
    title: str
    body_md: str
    pinned: bool
    created_at: datetime

class CommentResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    author_id: str
    author_name: str
    body: str
    created_at: datetime

class NotificationResponse(BaseModel):
    id: str
    type: str
    payload: dict
    read_at: Optional[datetime] = None
    created_at: datetime

# --- Announcements Endpoints ---

@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: CreateAnnouncementRequest,
    current_user: User = Depends(requires_permission("comms.announce")),
    db: Session = Depends(get_db)
):
    new_ann = Announcement(
        author_id=current_user.id,
        title=payload.title,
        body_md=payload.body_md,
        pinned=payload.pinned
    )
    db.add(new_ann)
    db.commit()
    db.refresh(new_ann)

    # Fan-out notification to all active users
    active_users = db.query(User).filter(User.is_active == True).all()
    for u in active_users:
        notif = Notification(
            user_id=u.id,
            type="announcement",
            payload={"announcement_id": new_ann.id, "title": new_ann.title, "author_name": current_user.full_name}
        )
        db.add(notif)
    db.commit()

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="announcement.create",
        entity="Announcement",
        entity_id=new_ann.id,
        after_state={"title": new_ann.title, "pinned": new_ann.pinned}
    )

    return AnnouncementResponse(
        id=new_ann.id,
        author_id=new_ann.author_id,
        author_name=current_user.full_name,
        title=new_ann.title,
        body_md=new_ann.body_md,
        pinned=new_ann.pinned,
        created_at=new_ann.created_at
    )

@router.get("/announcements", response_model=List[AnnouncementResponse])
def list_announcements(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    anns = db.query(Announcement).order_by(Announcement.pinned.desc(), Announcement.created_at.desc()).all()
    return [
        AnnouncementResponse(
            id=a.id,
            author_id=a.author_id,
            author_name=a.author.full_name if a.author else "Management",
            title=a.title,
            body_md=a.body_md,
            pinned=a.pinned,
            created_at=a.created_at
        ) for a in anns
    ]

# --- Comments Endpoints ---

@router.post("/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    payload: CreateCommentRequest,
    current_user: User = Depends(requires_permission("comms.comment")),
    db: Session = Depends(get_db)
):
    et = payload.entity_type.lower().strip()
    if et not in ["project", "task"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entity_type must be 'project' or 'task'")

    new_comment = Comment(
        entity_type=et,
        entity_id=payload.entity_id,
        author_id=current_user.id,
        body=payload.body.strip()
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="comment.create",
        entity="Comment",
        entity_id=new_comment.id,
        after_state={"entity_type": et, "entity_id": payload.entity_id}
    )

    return CommentResponse(
        id=new_comment.id,
        entity_type=new_comment.entity_type,
        entity_id=new_comment.entity_id,
        author_id=new_comment.author_id,
        author_name=current_user.full_name,
        body=new_comment.body,
        created_at=new_comment.created_at
    )

@router.get("/comments/{entity_type}/{entity_id}", response_model=List[CommentResponse])
def get_comments(
    entity_type: str,
    entity_id: str,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    comments = db.query(Comment).filter(
        Comment.entity_type == entity_type.lower().strip(),
        Comment.entity_id == entity_id
    ).order_by(Comment.created_at.asc()).all()

    return [
        CommentResponse(
            id=c.id,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            author_id=c.author_id,
            author_name=c.author.full_name if c.author else "User",
            body=c.body,
            created_at=c.created_at
        ) for c in comments
    ]

# --- Notifications Endpoints ---

@router.get("/notifications", response_model=List[NotificationResponse])
def get_my_notifications(
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return [
        NotificationResponse(
            id=n.id,
            type=n.type,
            payload=n.payload,
            read_at=n.read_at,
            created_at=n.created_at
        ) for n in notifs
    ]

@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(requires_permission("dashboard.self")),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notif.read_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Marked as read"}

# --- CSV Attendance Export ---

@router.get("/export/attendance.csv")
def export_attendance_csv(
    month: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: User = Depends(requires_permission("attendance.view_all")),
    db: Session = Depends(get_db)
):
    # 1. Fetch all punches matching filters
    p_query = db.query(Punch)
    if month:
        p_query = p_query.filter(Punch.day.cast(String).like(f"{month}%"))
    if user_id:
        p_query = p_query.filter(Punch.user_id == user_id)
    punches = p_query.order_by(Punch.day.desc(), Punch.user_id).all()

    # 2. Fetch all day statuses matching filters
    ds_query = db.query(DayStatus)
    if month:
        ds_query = ds_query.filter(DayStatus.date.cast(String).like(f"{month}%"))
    if user_id:
        ds_query = ds_query.filter(DayStatus.user_id == user_id)
    day_statuses = ds_query.order_by(DayStatus.date.desc(), DayStatus.user_id).all()

    # 3. Collect unique (user_id, date) pairs
    user_date_pairs = set()
    for p in punches:
        user_date_pairs.add((p.user_id, p.day))
    for ds in day_statuses:
        user_date_pairs.add((ds.user_id, ds.date))

    # Sort pairs in reverse chronological order
    sorted_pairs = sorted(list(user_date_pairs), key=lambda x: (x[1], x[0]), reverse=True)

    # Pre-cache user objects
    all_user_ids = {u_id for u_id, _ in sorted_pairs}
    users = db.query(User).filter(User.id.in_(all_user_ids)).all() if all_user_ids else []
    user_map = {u.id: u for u in users}

    # Group punches by (user_id, date)
    punch_map = {}
    for p in punches:
        key = (p.user_id, p.day)
        if key not in punch_map:
            punch_map[key] = []
        punch_map[key].append(p)

    # Map day status by (user_id, date)
    ds_map = {(ds.user_id, ds.date): ds.status for ds in day_statuses}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Employee_Name", "Employee_Email", "Date", "Status",
        "In_Claimed_IST", "In_Server_IST", "Out_Claimed_IST", "Out_Server_IST",
        "Gap_Minutes", "Work_Mode", "Late_Flag", "Device_Type", "OS_Name", "Browser", "IP_Address"
    ])

    ist_offset = timedelta(hours=5, minutes=30)

    for u_id, d in sorted_pairs:
        u = user_map.get(u_id)
        u_name = u.full_name if u else u_id
        u_email = u.email if u else ""

        pair_punches = punch_map.get((u_id, d), [])
        p_in = next((p for p in pair_punches if p.punch_type == "in"), None)
        p_out = next((p for p in pair_punches if p.punch_type == "out"), None)

        status_val = ds_map.get((u_id, d))
        if not status_val:
            if p_in:
                status_val = "present" if p_in.work_mode == "office" else p_in.work_mode
            else:
                status_val = "absent"

        def format_ist(dt_val):
            if not dt_val:
                return ""
            dt_utc = dt_val.replace(tzinfo=timezone.utc) if dt_val.tzinfo is None else dt_val
            dt_ist = dt_utc + ist_offset
            return dt_ist.strftime("%H:%M:%S")

        in_c = format_ist(p_in.claimed_at) if p_in else ""
        in_s = format_ist(p_in.server_at) if p_in else ""
        out_c = format_ist(p_out.claimed_at) if p_out else ""
        out_s = format_ist(p_out.server_at) if p_out else ""

        gap_min = 0.0
        if p_in:
            c_at = p_in.claimed_at.replace(tzinfo=timezone.utc) if p_in.claimed_at.tzinfo is None else p_in.claimed_at
            s_at = p_in.server_at.replace(tzinfo=timezone.utc) if p_in.server_at.tzinfo is None else p_in.server_at
            gap_min = round(abs((s_at - c_at).total_seconds()) / 60.0, 1)

        late_flag = False
        if p_in:
            c_at = p_in.claimed_at.replace(tzinfo=timezone.utc) if p_in.claimed_at.tzinfo is None else p_in.claimed_at
            c_ist = c_at + ist_offset
            if c_ist.hour > 9 or (c_ist.hour == 9 and c_ist.minute > 30):
                late_flag = True

        work_mode = p_in.work_mode if p_in else (status_val if status_val in ["wfh", "half"] else "office")
        device = p_in.device_type if p_in else ""
        os_name = p_in.os_name if p_in else ""
        browser_name = p_in.browser if p_in else ""
        ip_addr = p_in.ip if p_in else ""

        writer.writerow([
            u_name, u_email, str(d), status_val,
            in_c, in_s, out_c, out_s,
            gap_min, work_mode, late_flag, device, os_name, browser_name, ip_addr
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="attendance_export.csv"'}
    )
