import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Note, Tag, User, note_tags
from app.schemas import NoteCreate, NoteUpdate, NoteOut, NoteStats

router = APIRouter(prefix="/api/notes", tags=["notes"])


def _get_own_note(note_id: int, db: Session, user: User) -> Note:
    note = db.scalar(
        select(Note).where(Note.id == note_id, Note.owner_id == user.id)
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


def _resolve_tags(tag_ids: list[int], db: Session, user: User) -> list[Tag]:
    if not tag_ids:
        return []
    tags = db.scalars(
        select(Tag).where(Tag.id.in_(tag_ids), Tag.owner_id == user.id)
    ).all()
    if len(tags) != len(set(tag_ids)):
        raise HTTPException(status_code=422, detail="Some tag_ids are invalid")
    return list(tags)


@router.get("/stats", response_model=list[NoteStats])
def stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Tag.name, func.count(note_tags.c.note_id))
        .join(note_tags, note_tags.c.tag_id == Tag.id)
        .join(Note, Note.id == note_tags.c.note_id)
        .where(Tag.owner_id == user.id, Note.owner_id == user.id)
        .group_by(Tag.name)
        .order_by(func.count(note_tags.c.note_id).desc(), Tag.name)
    ).all()
    return [{"tag": name, "count": count} for name, count in rows]


@router.get("", response_model=list[NoteOut])
def list_notes(
    search: str | None = None,
    tag_id: int | None = None,
    pinned_only: bool = False,
    sort: str = Query(
        "created_desc",
        pattern="^(created_desc|created_asc|title_asc|title_desc)$",
    ),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Note).where(Note.owner_id == user.id)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Note.title.ilike(pattern), Note.content.ilike(pattern))
        )

    if tag_id is not None:
        stmt = stmt.join(
            note_tags, note_tags.c.note_id == Note.id
        ).where(note_tags.c.tag_id == tag_id)

    if pinned_only:
        stmt = stmt.where(Note.is_pinned.is_(True))

    if sort == "created_asc":
        stmt = stmt.order_by(Note.is_pinned.desc(), Note.created_at.asc())
    elif sort == "title_asc":
        stmt = stmt.order_by(Note.is_pinned.desc(), Note.title.asc())
    elif sort == "title_desc":
        stmt = stmt.order_by(Note.is_pinned.desc(), Note.title.desc())
    else:
        stmt = stmt.order_by(Note.is_pinned.desc(), Note.created_at.desc())

    stmt = stmt.limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.get("/export")
def export_notes(
    search: str | None = None,
    tag_id: int | None = None,
    pinned_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Note).where(Note.owner_id == user.id)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Note.title.ilike(pattern), Note.content.ilike(pattern))
        )

    if tag_id is not None:
        stmt = stmt.join(
            note_tags, note_tags.c.note_id == Note.id
        ).where(note_tags.c.tag_id == tag_id)

    if pinned_only:
        stmt = stmt.where(Note.is_pinned.is_(True))

    stmt = stmt.order_by(Note.is_pinned.desc(), Note.created_at.desc())

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(
        ["id", "title", "content", "is_pinned", "tags", "created_at", "updated_at"]
    )
    for note in db.scalars(stmt).all():
        writer.writerow(
            [
                note.id,
                note.title,
                note.content,
                "да" if note.is_pinned else "нет",
                ", ".join(tag.name for tag in note.tags),
                note.created_at.strftime("%Y-%m-%d %H:%M:%S") if note.created_at else "",
                note.updated_at.strftime("%Y-%m-%d %H:%M:%S") if note.updated_at else "",
            ]
        )

    content = "\ufeff" + buffer.getvalue()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="notes.csv"'},
    )


@router.get("/{note_id}", response_model=NoteOut)
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _get_own_note(note_id, db, user)


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = Note(
        title=payload.title,
        content=payload.content,
        is_pinned=payload.is_pinned,
        owner_id=user.id,
    )
    note.tags = _resolve_tags(payload.tag_ids, db, user)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = _get_own_note(note_id, db, user)
    data = payload.model_dump(exclude_unset=True)

    if "tag_ids" in data:
        note.tags = _resolve_tags(data.pop("tag_ids") or [], db, user)

    for field, value in data.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = _get_own_note(note_id, db, user)
    db.delete(note)
    db.commit()
    return None