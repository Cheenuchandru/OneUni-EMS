from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from core.database import get_db
from models.auth import User
from models.projects import Project, Task, ProjectStatusUpdate
from core.rbac import requires_permission, get_role_permissions
from middleware.audit import log_audit_event

router = APIRouter(prefix="/projects", tags=["Project Management"])

class CreateProjectRequest(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    status: str = "active"  # planned | active | on_hold | done

class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    priority: str = "med"  # low | med | high
    due_date: Optional[date] = None

class UpdateTaskStatusRequest(BaseModel):
    status: str  # todo | in_progress | review | done
    note: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    status: str
    task_count: int
    created_at: datetime

def format_task_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        assignee_id=task.assignee_id,
        assignee_name=task.assignee.full_name if task.assignee else None,
        status=task.status,
        priority=task.priority,
        due_date=str(task.due_date) if task.due_date else None
    )

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest,
    current_user: User = Depends(requires_permission("projects.manage")),
    db: Session = Depends(get_db)
):
    code_clean = payload.code.upper().strip()
    if db.query(Project).filter(Project.code == code_clean).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Project code '{code_clean}' already exists")

    new_project = Project(
        name=payload.name,
        code=code_clean,
        description=payload.description,
        status=payload.status.lower().strip(),
        created_by=current_user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="project.create",
        entity="Project",
        entity_id=new_project.id,
        after_state={"name": new_project.name, "code": new_project.code}
    )

    return ProjectResponse(
        id=new_project.id,
        name=new_project.name,
        code=new_project.code,
        description=new_project.description,
        status=new_project.status,
        task_count=0,
        created_at=new_project.created_at
    )

@router.get("", response_model=List[ProjectResponse])
def list_projects(
    current_user: User = Depends(requires_permission("projects.view_assigned")),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    result = []
    for p in projects:
        t_count = db.query(Task).filter(Task.project_id == p.id).count()
        result.append(ProjectResponse(
            id=p.id,
            name=p.name,
            code=p.code,
            description=p.description,
            status=p.status,
            task_count=t_count,
            created_at=p.created_at
        ))
    return result

@router.get("/{project_id}")
def get_project_detail(
    project_id: str,
    current_user: User = Depends(requires_permission("projects.view_assigned")),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    updates = db.query(ProjectStatusUpdate).filter(ProjectStatusUpdate.project_id == project_id).order_by(ProjectStatusUpdate.created_at.desc()).all()

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "code": project.code,
            "description": project.description,
            "status": project.status,
            "created_at": project.created_at
        },
        "tasks": [format_task_response(t) for t in tasks],
        "timeline": [
            {
                "id": u.id,
                "task_id": u.task_id,
                "user_name": u.user.full_name if u.user else "System",
                "note": u.note,
                "old_status": u.old_status,
                "new_status": u.new_status,
                "created_at": u.created_at
            } for u in updates
        ]
    }

@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_project_task(
    project_id: str,
    payload: CreateTaskRequest,
    current_user: User = Depends(requires_permission("projects.manage")),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if payload.assignee_id:
        assignee = db.query(User).filter(User.id == payload.assignee_id).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee user not found")

    new_task = Task(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        assignee_id=payload.assignee_id,
        priority=payload.priority.lower().strip(),
        due_date=payload.due_date,
        status="todo"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="task.create",
        entity="Task",
        entity_id=new_task.id,
        after_state={"title": new_task.title, "assignee_id": new_task.assignee_id}
    )

    return format_task_response(new_task)

@router.patch("/tasks/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: str,
    payload: UpdateTaskStatusRequest,
    current_user: User = Depends(requires_permission("projects.view_assigned")),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Ownership check: User must be assigned to task UNLESS user holds projects.edit_any_status or projects.manage
    user_perms = get_role_permissions(current_user.role_id, db) if current_user.role_id else set()
    can_edit_any = "*" in user_perms or "projects.edit_any_status" in user_perms or "projects.manage" in user_perms

    if not can_edit_any and task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: You can only update the status of tasks assigned to you"
        )

    old_st = task.status
    new_st = payload.status.lower().strip()
    if new_st not in ["todo", "in_progress", "review", "done", "future_plan", "idea"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status value")

    task.status = new_st

    # Record Project Status Update timeline row
    update_row = ProjectStatusUpdate(
        project_id=task.project_id,
        task_id=task.id,
        user_id=current_user.id,
        note=payload.note,
        old_status=old_st,
        new_status=new_st
    )
    db.add(update_row)
    db.commit()
    db.refresh(task)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "employee",
        action="task.update_status",
        entity="Task",
        entity_id=task.id,
        before_state={"status": old_st},
        after_state={"status": new_st, "note": payload.note}
    )

    return format_task_response(task)

class EditTaskFullRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None

@router.put("/tasks/{task_id}", response_model=TaskResponse)
def edit_task(
    task_id: str,
    payload: EditTaskFullRequest,
    current_user: User = Depends(requires_permission("projects.manage")),
    db: Session = Depends(get_db)
):
    """Full task edit endpoint for MD/Admin or assigned manager."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if payload.title:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.assignee_id is not None:
        task.assignee_id = payload.assignee_id
    if payload.priority:
        task.priority = payload.priority.lower().strip()
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.status:
        st_clean = payload.status.lower().strip()
        if st_clean in ["todo", "in_progress", "review", "done", "future_plan", "idea"]:
            task.status = st_clean

    db.commit()
    db.refresh(task)

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        actor_role=current_user.role.name if current_user.role else "md",
        action="task.edit",
        entity="Task",
        entity_id=task.id,
        after_state={"title": task.title, "status": task.status, "assignee_id": task.assignee_id}
    )

    return format_task_response(task)

@router.get("/tasks/me", response_model=List[TaskResponse])
def get_my_tasks(
    current_user: User = Depends(requires_permission("projects.view_assigned")),
    db: Session = Depends(get_db)
):
    my_tasks = db.query(Task).filter(Task.assignee_id == current_user.id).order_by(Task.created_at.desc()).all()
    return [format_task_response(t) for t in my_tasks]

