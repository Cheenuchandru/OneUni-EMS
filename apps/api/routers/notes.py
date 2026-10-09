from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import csv
import io
import json
from sqlalchemy.orm import Session
from sqlalchemy import or_
from core.database import get_db
from models.auth import User
from models.notes import LifetimeNote
from core.rbac import get_current_active_user
from middleware.audit import log_audit_event

router = APIRouter(prefix="/notes", tags=["Knowledge & Bug Resolution Notes"])

class CreateNoteRequest(BaseModel):
    title: str
    scope: str = "individual" # "individual" | "common"
    category: str = "bug_fix" # "bug_fix", "tech_stack", "feature_note", "architecture", "guide"
    bug_description: Optional[str] = None
    resolution_method: Optional[str] = None
    tech_stack: Optional[str] = None
    tags: Optional[str] = None

class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    scope: Optional[str] = None
    category: Optional[str] = None
    bug_description: Optional[str] = None
    resolution_method: Optional[str] = None
    tech_stack: Optional[str] = None
    tags: Optional[str] = None

class NoteResponse(BaseModel):
    id: str
    user_id: str
    author_name: str
    scope: str
    title: str
    category: str
    bug_description: Optional[str]
    resolution_method: Optional[str]
    tech_stack: Optional[str]
    tags: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[NoteResponse])
def get_notes(
    scope: str = Query("all", description="Scope filter: individual, common, or all"),
    category: Optional[str] = Query(None, description="Category filter"),
    search: Optional[str] = Query(None, description="Search query string"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve Knowledge & Bug Resolution notes based on scope and search filters."""
    query = db.query(LifetimeNote)

    if scope == "individual":
        query = query.filter(LifetimeNote.scope == "individual", LifetimeNote.user_id == current_user.id)
    elif scope == "common":
        query = query.filter(LifetimeNote.scope == "common")
    else: # "all"
        query = query.filter(
            or_(
                LifetimeNote.scope == "common",
                (LifetimeNote.scope == "individual") & (LifetimeNote.user_id == current_user.id)
            )
        )

    if category:
        query = query.filter(LifetimeNote.category == category)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                LifetimeNote.title.ilike(term),
                LifetimeNote.bug_description.ilike(term),
                LifetimeNote.resolution_method.ilike(term),
                LifetimeNote.tech_stack.ilike(term),
                LifetimeNote.tags.ilike(term),
                LifetimeNote.author_name.ilike(term)
            )
        )

    return query.order_by(LifetimeNote.created_at.desc()).all()


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    req: CreateNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new lifetime note for bug resolution, tech stack notes, or general feature knowledge."""
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Note title cannot be empty.")

    note = LifetimeNote(
        user_id=current_user.id,
        author_name=current_user.full_name,
        scope=req.scope if req.scope in ["individual", "common"] else "individual",
        title=req.title.strip(),
        category=req.category,
        bug_description=req.bug_description.strip() if req.bug_description else None,
        resolution_method=req.resolution_method.strip() if req.resolution_method else None,
        tech_stack=req.tech_stack.strip() if req.tech_stack else None,
        tags=req.tags.strip() if req.tags else None
    )

    db.add(note)
    db.commit()
    db.refresh(note)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if hasattr(current_user, 'role') and hasattr(current_user.role, 'name') else 'user',
        action="notes.create",
        entity="LifetimeNote",
        entity_id=note.id,
        after_state={"title": note.title, "scope": note.scope, "category": note.category}
    )

    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: str,
    req: UpdateNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an existing lifetime note."""
    note = db.query(LifetimeNote).filter(LifetimeNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    role_name = current_user.role.name if hasattr(current_user, 'role') and hasattr(current_user.role, 'name') else ''
    if note.user_id != current_user.id and role_name not in ['admin', 'md']:
        raise HTTPException(status_code=403, detail="Permission denied. You can only edit your own notes.")

    if req.title is not None and req.title.strip():
        note.title = req.title.strip()
    if req.scope in ["individual", "common"]:
        note.scope = req.scope
    if req.category is not None:
        note.category = req.category
    if req.bug_description is not None:
        note.bug_description = req.bug_description.strip()
    if req.resolution_method is not None:
        note.resolution_method = req.resolution_method.strip()
    if req.tech_stack is not None:
        note.tech_stack = req.tech_stack.strip()
    if req.tags is not None:
        note.tags = req.tags.strip()

    db.commit()
    db.refresh(note)

    return note


@router.delete("/{note_id}", status_code=status.HTTP_200_OK)
def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a lifetime note."""
    note = db.query(LifetimeNote).filter(LifetimeNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    role_name = current_user.role.name if hasattr(current_user, 'role') and hasattr(current_user.role, 'name') else ''
    if note.user_id != current_user.id and role_name not in ['admin', 'md']:
        raise HTTPException(status_code=403, detail="Permission denied. You can only delete your own notes.")

    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully", "note_id": note_id}


@router.get("/export")
def export_notes(
    export_format: str = Query("md", alias="format", description="Export format: md, json, or csv"),
    scope: str = Query("all", description="Scope filter: individual, common, or all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export Lifetime Knowledge & Bug Resolution notes in Markdown, JSON, or CSV format."""
    notes_list = get_notes(scope=scope, category=None, search=None, db=db, current_user=current_user)

    filename_prefix = f"oneuni_knowledge_notes_{scope}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if export_format == "json":
        data = [
            {
                "id": n.id,
                "title": n.title,
                "scope": n.scope,
                "category": n.category,
                "author": n.author_name,
                "bug_description": n.bug_description,
                "resolution_method": n.resolution_method,
                "tech_stack": n.tech_stack,
                "tags": n.tags,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in notes_list
        ]
        content = json.dumps(data, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename_prefix}.json"}
        )

    elif export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Title", "Scope", "Category", "Author", "Bug Description / Issue", "Resolution Method / Stack", "Tech Stack", "Tags", "Created At"])
        for n in notes_list:
            writer.writerow([
                n.id,
                n.title,
                n.scope,
                n.category,
                n.author_name,
                n.bug_description or "",
                n.resolution_method or "",
                n.tech_stack or "",
                n.tags or "",
                n.created_at.strftime("%Y-%m-%d %H:%M:%S") if n.created_at else ""
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename_prefix}.csv"}
        )

    else: # default "md" (Markdown)
        md_lines = [
            f"# OneUni EMS — Lifetime Knowledge & Bug Resolution Notes Log",
            f"**Export Scope:** `{scope.upper()}` | **Export Date:** `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}` | **Total Notes:** {len(notes_list)}",
            "\n---\n"
        ]

        for i, n in enumerate(notes_list, 1):
            md_lines.append(f"## {i}. {n.title}")
            md_lines.append(f"- **Scope:** `{n.scope.upper()}` | **Category:** `{n.category.upper()}`")
            md_lines.append(f"- **Author:** {n.author_name} | **Date:** {n.created_at.strftime('%Y-%m-%d %H:%M') if n.created_at else 'N/A'}")
            if n.tech_stack:
                md_lines.append(f"- **Tech Stack:** `{n.tech_stack}`")
            if n.tags:
                md_lines.append(f"- **Tags:** `{n.tags}`")

            if n.bug_description:
                md_lines.append("\n### 🐛 Bug / Issue Raised:")
                md_lines.append(f"```text\n{n.bug_description}\n```")

            if n.resolution_method:
                md_lines.append("\n### ✅ Resolution Method & Clear Steps:")
                md_lines.append(f"```text\n{n.resolution_method}\n```")

            md_lines.append("\n---\n")

        content = "\n".join(md_lines)
        return Response(
            content=content,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename={filename_prefix}.md"}
        )
